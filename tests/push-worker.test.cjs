const {test}=require('node:test'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const project='focus-for-you-dd88b',ROOM='YKS',tokenFor=id=>'FCM_'+id+'_private_device_registration_0000001';
test('room invite sends a background notification from a fresh authoritative receipt and deduplicates retries',async()=>{
 const f=await fixture();f.populate();f.rows.set('roomInvites/'+ROOM+'_bob',{from:'alice',to:'bob',roomId:ROOM,_updatedAt:f.time});await f.register('bob');
 const data={roomId:ROOM,targetUid:'bob'};assert.equal((await f.call('/invite',data)).status,200);assert.equal(f.sent.length,1);assert.equal(f.sent[0].data.kind,'invite');assert.equal(f.sent[0].notification.title,'@alice_handle seni odaya davet etti!');assert.equal(f.sent[0].android.ttl,'300s');assert.equal(f.sent[0].data.roomId,ROOM);
 assert.equal((await f.call('/invite',data)).data.duplicate,true);assert.equal(f.sent.length,1);
});
test('invites reject forged targets, stale receipts, former leaders and permissions revoked during OAuth',async()=>{
 for(const variant of ['absent','stale','wrong-from','former-leader','blocked-late']){const f=await fixture();f.populate();await f.register('bob');if(variant!=='absent')f.rows.set('roomInvites/'+ROOM+'_bob',{from:variant==='wrong-from'?'charlie':'alice',to:'bob',roomId:ROOM,_updatedAt:f.time-(variant==='stale'?31000:0)});if(variant==='former-leader')f.rows.get('rooms/'+ROOM).ownerUid='charlie';if(variant==='blocked-late')f.onOAuth=()=>f.denied.add('roomInvites/'+ROOM+'_bob');assert.equal((await f.call('/invite',{roomId:ROOM,targetUid:'bob'})).status,403);assert.equal(f.sent.length,0)}
});
test('deleting recipients never get invite notifications and account rebindings do not deliver to an old token',async()=>{
 const f=await fixture();f.populate();f.rows.set('roomInvites/'+ROOM+'_bob',{from:'alice',to:'bob',roomId:ROOM,_updatedAt:f.time});await f.register('bob');await f.call('/delete-account',{},f.auth('bob'));assert.equal((await f.call('/invite',{roomId:ROOM,targetUid:'bob'})).status,200);assert.equal(f.sent.length,0);
});
const b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
let keyPromise;
async function key(){if(!keyPromise)keyPromise=(async()=>{const keys=await webcrypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);const raw=Buffer.from(await webcrypto.subtle.exportKey('pkcs8',keys.privateKey));return {publicKey:keys.publicKey,private_key:'-----BEGIN PRIVATE KEY-----\n'+raw.toString('base64')+'\n-----END PRIVATE KEY-----'}})();return keyPromise}
function firestore(data){const fields={};for(const[k,v]of Object.entries(data)){if(typeof v==='string')fields[k]={stringValue:v};else if(typeof v==='boolean')fields[k]={booleanValue:v};else if(typeof v==='number'&&Number.isFinite(v))fields[k]={integerValue:String(v)};else if(v?.timestamp)fields[k]={timestampValue:new Date(v.timestamp).toISOString()};else if(typeof v==='object')fields[k]={mapValue:{fields:firestore(v).fields}}}return {fields}}
async function fixture(){
 const {createWorker}=await import('../push-worker/worker.mjs'),keys=await key();let time=Date.parse('2026-10-12T12:00:00Z'),fcmFailure=false,kvFailure='',authFailure=false,duringOAuth=null;
 const rows=new Map(),kv=new Map(),tokens=new Map(),calls=[],sent=[],denied=new Set();
 const env={FIREBASE_PROJECT_ID:project,FIREBASE_API_KEY:'public-web-api-key',FCM_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:project,client_email:'push@'+project+'.iam.gserviceaccount.com',private_key:keys.private_key}),PUSH_KV:{async get(k,type){if(kvFailure==='get:'+k)throw Error('kv-down');const value=kv.get(k);if(!value||value.expires&&value.expires<=time)return null;return type==='json'?JSON.parse(value.text):value.text},async put(k,text,opts={}){if(kvFailure==='put:'+k)throw Error('kv-down');kv.set(k,{text,expires:opts.expirationTtl?time+opts.expirationTtl*1000:0})},async delete(k){if(kvFailure==='delete:'+k)throw Error('kv-down');kv.delete(k)}}};
 function auth(uid='alice',verified=true,overrides={}){const claims={aud:project,iss:'https://securetoken.google.com/'+project,sub:uid,exp:Math.floor(time/1000)+3600,email_verified:verified,...overrides};const token=b64({alg:'RS256'})+'.'+b64(claims)+'.validsignature';tokens.set(token,{localId:uid,emailVerified:verified,email:uid+'@example.com'});return token}
 const remote=async(url,opts={})=>{calls.push({url,opts});if(url.startsWith('https://identitytoolkit.googleapis.com')){const user=tokens.get(JSON.parse(opts.body).idToken);return Response.json(user&&!authFailure?{users:[user]}:{error:{}},{status:user&&!authFailure?200:400})}
  if(url.startsWith('https://firestore.googleapis.com')){assert.ok(opts.headers.Authorization.startsWith('Bearer '));assert.notEqual(opts.headers.Authorization,'Bearer oauth-access');const path=decodeURIComponent(url.split('/documents/')[1]);if(denied.has(path))return Response.json({error:{}},{status:403});return rows.has(path)?Response.json({...firestore(rows.get(path)),updateTime:new Date(rows.get(path)._updatedAt||time).toISOString()}):Response.json({error:{}},{status:404})}
  if(url==='https://oauth2.googleapis.com/token'){const assertion=new URLSearchParams(opts.body).get('assertion'),parts=assertion.split('.'),claims=JSON.parse(Buffer.from(parts[1],'base64url'));assert.equal(claims.scope,'https://www.googleapis.com/auth/firebase.messaging');assert.equal(claims.aud,url);assert.equal(await webcrypto.subtle.verify('RSASSA-PKCS1-v1_5',keys.publicKey,Buffer.from(parts[2],'base64url'),Buffer.from(parts[0]+'.'+parts[1])),true);if(duringOAuth)await duringOAuth();return Response.json({access_token:'oauth-access',expires_in:3600})}
  if(url.startsWith('https://fcm.googleapis.com')){assert.equal(opts.headers.Authorization,'Bearer oauth-access');sent.push(JSON.parse(opts.body).message);return Response.json(fcmFailure?{error:{status:'UNAVAILABLE'}}:{name:'projects/'+project+'/messages/sent'},{status:fcmFailure?503:200})}throw Error('unexpected-url');
 };
 const worker=createWorker({fetch:remote,crypto:webcrypto,now:()=>time});
 const call=async(path,data={},token=auth(),extra={})=>{const request=new Request('https://push.example'+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://focusforyou.github.io',Authorization:'Bearer '+token,...extra.headers},body:typeof data==='string'?data:JSON.stringify(data)});const response=await worker.fetch(request,env);return {status:response.status,headers:response.headers,data:await response.json()}};
 function populate(){rows.set('rooms/'+ROOM,{ownerUid:'alice'});rows.set('rooms/'+ROOM+'/members/alice',{uid:'alice'});rows.set('rooms/'+ROOM+'/members/bob',{uid:'bob'});rows.set('rooms/'+ROOM+'/nudges/bob',{from:'alice',to:'bob',at:{timestamp:time}});rows.set('publicProfiles/alice',{username:'alice_handle'})}
 return {env,kv,rows,calls,sent,denied,auth,call,populate,advance:ms=>time+=ms,register:(uid,id='device_0001')=>call('/register',{deviceId:id,token:tokenFor(uid)},auth(uid)),get time(){return time},set onOAuth(fn){duringOAuth=fn},set authFailure(v){authFailure=v},set kvFailure(v){kvFailure=v},set fcmFailure(v){fcmFailure=v}};
}

test('Firebase auth is authoritative and rejects forged project, unverified, expired and lookup failures',async()=>{
 const f=await fixture();for(const token of [f.auth('alice',true,{aud:'other-project'}),f.auth('alice',true,{exp:1}),'not-a-valid-authentication-token'])assert.equal((await f.call('/register',{deviceId:'device_0001',token:tokenFor('alice')},token)).status,401);assert.equal((await f.register('unverified')).status,200);assert.equal((await f.call('/register',{deviceId:'device_0001',token:tokenFor('alice')},f.auth('alice',false))).status,403);f.authFailure=true;assert.equal((await f.register('alice')).status,401);assert.equal(f.sent.length,0);
});
test('registration is own-account only, bounded to six and never returns private token data',async()=>{
 const f=await fixture();for(let i=0;i<6;i++){const result=await f.register('alice','device_000'+i);assert.equal(result.status,200);assert.deepEqual(result.data,{ok:true});assert.equal(JSON.stringify(result.data).includes('FCM_'),false)}assert.equal((await f.register('alice','device_9999')).status,409);assert.equal((await f.call('/register',{deviceId:'device_0000',token:tokenFor('alice'),uid:'bob'})).status,400);assert.equal((await f.call('/unregister',{deviceId:'device_0000'},f.auth('bob'))).status,200);assert.equal(Object.keys(JSON.parse(f.kv.get('devices:alice').text)).length,6);
});
test('CORS rejects unrelated sites, oversized JSON and request notification/token spoofing',async()=>{
 const f=await fixture();assert.equal((await f.call('/send',{},f.auth(),{headers:{Origin:'https://evil.example'}})).status,403);assert.equal((await f.call('/send',{roomId:ROOM,targetUid:'bob',token:tokenFor('bob')})).status,400);assert.equal((await f.call('/send',{roomId:ROOM,targetUid:'bob',senderUsername:'admin'})).status,400);assert.equal((await f.call('/send',' '.repeat(9000))).status,413);assert.equal(f.sent.length,0);
});
test('only a fresh authoritative same-room nudge can send an unspoofed FCM notification',async()=>{
 const f=await fixture();f.populate();await f.register('bob');const response=await f.call('/send',{roomId:ROOM,targetUid:'bob'});assert.equal(response.status,200);assert.equal(f.sent.length,1);const m=f.sent[0];assert.equal(m.token,tokenFor('bob'));assert.equal(m.notification.body,'@alice_handle seni dürttü!');assert.equal(m.data.senderUsername,'alice_handle');assert.equal(m.data.roomId,ROOM);assert.ok(m.data.nudgeId);assert.equal(m.android.notification.tag,'focus-nudge-'+m.data.nudgeId);assert.equal(JSON.stringify(response.data).includes(tokenFor('bob')),false);const replay=await f.call('/send',{roomId:ROOM,targetUid:'bob'});assert.equal(replay.data.duplicate,true);assert.equal(f.sent.length,1);f.advance(31000);assert.equal((await f.call('/send',{roomId:ROOM,targetUid:'bob'})).status,403);
});
test('wrong author, absent membership, room deletion and rule denial never send',async()=>{
 for(const kind of ['author','member','deleting','denied']){const f=await fixture();f.populate();await f.register('bob');if(kind==='author')f.rows.get('rooms/'+ROOM+'/nudges/bob').from='charlie';if(kind==='member')f.rows.delete('rooms/'+ROOM+'/members/bob');if(kind==='deleting')f.rows.get('rooms/'+ROOM).deleting=true;if(kind==='denied')f.denied.add('rooms/'+ROOM+'/nudges/bob');assert.equal((await f.call('/send',{roomId:ROOM,targetUid:'bob'})).status,403);assert.equal(f.sent.length,0)}
});
test('banned and deleting users cannot register or send but can remove their own devices',async()=>{
 const f=await fixture();f.populate();await f.register('alice');f.rows.set('appBans/alice',{by:'admin'});assert.equal((await f.register('alice')).status,403);assert.equal((await f.call('/send',{roomId:ROOM,targetUid:'bob'})).status,403);assert.equal((await f.call('/unregister',{deviceId:'device_0001'})).status,200);f.rows.delete('appBans/alice');await f.register('alice');f.rows.set('deletions/alice',{startedAt:{timestamp:f.time}});assert.equal((await f.register('alice')).status,403);assert.equal((await f.call('/delete-account')).status,200);assert.equal(f.kv.has('devices:alice'),false);assert.equal(f.kv.get('deleted:alice').text,'1');
});
test('a reused physical token is delivered only to its current account, not an old registry',async()=>{
 const f=await fixture();f.populate();await f.register('bob');assert.equal((await f.call('/register',{deviceId:'device_0001',token:tokenFor('bob')},f.auth('charlie'))).status,200);assert.equal((await f.call('/send',{roomId:ROOM,targetUid:'bob'})).status,200);assert.equal(f.sent.length,0);await f.call('/delete-account',{},f.auth('bob'));assert.equal(f.kv.has('devices:charlie'),true);assert.ok([...f.kv.values()].some(v=>v.text.includes('charlie')&&v.text.includes('device_0001')));
});
test('deletion backend failure is explicit and never claims success',async()=>{
 const f=await fixture();await f.register('alice');f.kvFailure='delete:devices:alice';const response=await f.call('/delete-account');assert.equal(response.status,503);assert.equal(response.data.ok,undefined);assert.equal(f.kv.has('devices:alice'),true);f.kvFailure='';assert.equal((await f.call('/delete-account')).status,200);assert.equal(f.kv.has('devices:alice'),false);
});
test('FCM failure is private, returns retryable error and does not mark delivery successful',async()=>{
 const f=await fixture();f.populate();await f.register('bob');f.fcmFailure=true;const response=await f.call('/send',{roomId:ROOM,targetUid:'bob'});assert.equal(response.status,503);assert.deepEqual(response.data,{error:'messaging-unavailable'});assert.equal(JSON.stringify(response.data).includes(tokenFor('bob')),false);f.fcmFailure=false;f.advance(11000);assert.equal((await f.call('/send',{roomId:ROOM,targetUid:'bob'})).status,200);assert.equal(f.sent[0].android.notification.tag,f.sent[1].android.notification.tag);
});
test('concurrent requests for the same nudge share a single delivery task',async()=>{
 const f=await fixture();f.populate();await f.register('bob');const replies=await Promise.all(Array.from({length:5},()=>f.call('/send',{roomId:ROOM,targetUid:'bob'})));assert.equal(replies.every(r=>r.status===200),true);assert.equal(f.sent.length,1);
});
test('new events are sender-throttled, while repeated device registration does not rewrite KV',async()=>{
 const f=await fixture();await f.register('bob');f.kvFailure='put:devices:bob';assert.equal((await f.register('bob')).status,200);f.kvFailure='';f.populate();await f.call('/send',{roomId:ROOM,targetUid:'bob'});f.advance(1000);f.rows.get('rooms/'+ROOM+'/nudges/bob').at={timestamp:f.time};assert.equal((await f.call('/send',{roomId:ROOM,targetUid:'bob'})).status,429);assert.equal(f.sent.length,1);
});
test('recipient deletion blocks notifications even when an old Firestore receipt is still readable',async()=>{
 const f=await fixture();f.populate();await f.register('bob');assert.equal((await f.call('/delete-account',{},f.auth('bob',false))).status,200);assert.equal((await f.call('/send',{roomId:ROOM,targetUid:'bob'})).status,200);assert.equal(f.sent.length,0);assert.equal((await f.register('bob')).status,403);
});
test('invalid service-account project cannot authorize FCM and permission errors fail closed',async()=>{
 const f=await fixture();f.populate();await f.register('bob');const secret=JSON.parse(f.env.FCM_SERVICE_ACCOUNT_JSON);secret.project_id='other-project';f.env.FCM_SERVICE_ACCOUNT_JSON=JSON.stringify(secret);assert.equal((await f.call('/send',{roomId:ROOM,targetUid:'bob'})).status,503);assert.equal(f.sent.length,0);const g=await fixture();g.denied.add('deletions/alice');assert.equal((await g.register('alice')).status,403);assert.equal(g.kv.size,0);
});

test('retained sender membership does not bypass room ban or kick cutoff, but legitimate renewed membership may send',async()=>{
 for(const state of ['ban','kick']){const f=await fixture();f.populate();await f.register('bob');f.rows.get('rooms/'+ROOM+'/members/alice').joinedAt={timestamp:f.time-60000};f.rows.set('rooms/'+ROOM+'/'+(state==='ban'?'bans':'kicks')+'/alice',{by:'moderator',at:{timestamp:f.time-1000}});assert.equal((await f.call('/send',{roomId:ROOM,targetUid:'bob'})).status,403);assert.equal(f.sent.length,0);if(state==='kick'){f.rows.get('rooms/'+ROOM+'/members/alice').joinedAt={timestamp:f.time};assert.equal((await f.call('/send',{roomId:ROOM,targetUid:'bob'})).status,200);assert.equal(f.sent.length,1)}}
});
test('recipient gate and sender sanctions are checked again after OAuth delay before sending',async()=>{
 for(const change of ['recipientGate','senderKick','changedEvent']){const f=await fixture();f.populate();await f.register('bob');f.rows.get('rooms/'+ROOM+'/members/alice').joinedAt={timestamp:f.time-60000};f.onOAuth=()=>{if(change==='recipientGate')f.denied.add('rooms/'+ROOM+'/nudges/bob');if(change==='senderKick')f.rows.set('rooms/'+ROOM+'/kicks/alice',{by:'moderator',at:{timestamp:f.time}});if(change==='changedEvent')f.rows.get('rooms/'+ROOM+'/nudges/bob').from='charlie'};const response=await f.call('/send',{roomId:ROOM,targetUid:'bob'});assert.equal(response.status,change==='changedEvent'?409:403);assert.equal(f.sent.length,0)}
});
test('recipient quiet mode suppresses notifications before requesting OAuth credentials',async()=>{
 const f=await fixture();f.populate();await f.register('bob');f.rows.get('rooms/'+ROOM+'/members/bob').quietUntil=f.time+60000;
 const response=await f.call('/send',{roomId:ROOM,targetUid:'bob'});assert.equal(response.status,200);assert.deepEqual(response.data,{ok:true});assert.equal(f.sent.length,0);
 assert.equal(f.calls.some(c=>c.url==='https://oauth2.googleapis.com/token'),false);
});
test('quiet mode expires at the exact boundary so fresh nudges resume normally',async()=>{
 for(const offset of [-1,0,1]){const f=await fixture();f.populate();await f.register('bob');f.rows.get('rooms/'+ROOM+'/members/bob').quietUntil=f.time+offset;
  const response=await f.call('/send',{roomId:ROOM,targetUid:'bob'});assert.equal(response.status,200);assert.equal(f.sent.length,offset>0?0:1);
 }
});
test('quiet mode enabled during OAuth is read again before FCM sends any notification',async()=>{
 const f=await fixture();f.populate();await f.register('bob');f.onOAuth=()=>{f.rows.get('rooms/'+ROOM+'/members/bob').quietUntil=f.time+60000};
 const response=await f.call('/send',{roomId:ROOM,targetUid:'bob'});assert.equal(response.status,200);assert.deepEqual(response.data,{ok:true});assert.equal(f.sent.length,0);
 assert.equal(f.calls.filter(c=>c.url.endsWith('/rooms/YKS/members/bob')).length,2);
});
test('an expired quiet setting observed after OAuth permits delivery, but missing recipient membership fails closed',async()=>{
 for(const changed of ['expired','removed']){const f=await fixture();f.populate();await f.register('bob');f.onOAuth=()=>{if(changed==='removed')f.rows.delete('rooms/'+ROOM+'/members/bob');else f.rows.get('rooms/'+ROOM+'/members/bob').quietUntil=f.time};
  const response=await f.call('/send',{roomId:ROOM,targetUid:'bob'});assert.equal(response.status,changed==='removed'?403:200);assert.equal(f.sent.length,changed==='removed'?0:1);
 }
});

test('recipient block or mute enabled during OAuth makes the authoritative receipt unreadable and fails closed',async()=>{for(const reason of ['block','mute']){const f=await fixture();f.populate();await f.register('bob');f.onOAuth=async()=>{f.denied.add('rooms/'+ROOM+'/nudges/bob')};assert.equal((await f.call('/send',{roomId:ROOM,targetUid:'bob'})).status,403,reason);assert.equal(f.sent.length,0)}});

