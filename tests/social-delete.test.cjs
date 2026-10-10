const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

function fixture(){
 const records=new Map(),events=[],uid='alice';let current=true,fail='',afterRead=null,keep='';
 const put=(path,data)=>records.set(path,{...data});
 const ref=path=>({path,id:path.split('/').at(-1)});
 const snap=path=>({id:ref(path).id,ref:ref(path),exists:()=>records.has(path),data:()=>records.get(path)});
 const pathOf=x=>typeof x==='string'?x:x.path;
 const mutate=async(op,path,data)=>{
  events.push(`${op}:${path}`);
  assert.equal(current,true,'changed accounts must not mutate');
  if(fail===`${op}:${path}`){fail='';throw Error('interrupted')}
  if(op==='delete'&&path!==keep)records.delete(path);
  if(op==='update')records.set(path,{...records.get(path),...data});
 };
 const ctx={
  doc:(_, ...p)=>ref(p.join('/')),collection:(_, ...p)=>({path:p.join('/'),clauses:[]}),
  where:(field,op,value)=>({kind:'where',field,op,value}),limit:value=>({kind:'limit',value}),
  query:(base,...clauses)=>({...base,clauses:[...(base.clauses||[]),...clauses]}),
  getDocsFromServer:async q=>{
   const depth=q.path.split('/').length+1;
   let paths=[...records.keys()].filter(p=>p.startsWith(q.path+'/')&&p.split('/').length===depth).sort();
   for(const c of q.clauses||[]){
    if(c.kind==='where')paths=paths.filter(p=>c.op==='array-contains'?records.get(p)[c.field]?.includes(c.value):records.get(p)[c.field]===c.value);
    if(c.kind==='limit')paths=paths.slice(0,c.value);
   }
   const result={docs:paths.map(snap),empty:paths.length===0};
   events.push(`read:${q.path}`);if(afterRead){const fn=afterRead;afterRead=null;fn(q)}return result;
  },
  getDocFromServer:async r=>{events.push(`read:${r.path}`);return snap(r.path)},
  deleteDoc:r=>mutate('delete',r.path),updateDoc:(r,data)=>mutate('update',r.path,data),
  writeBatch:()=>{const pending=[];return {delete:r=>pending.push(r.path),commit:async()=>{for(const p of pending)await mutate('delete',p)}}},
  setDoc:async(r,data)=>{put(r.path,data);events.push(`lock:${r.path}`)},serverTimestamp:()=>0,
  deleteUser:async()=>{events.push('auth');assert.equal(records.has('publicProfiles/alice'),false)},
 };
 vm.createContext(ctx);
 for(const filename of ['social-delete.js','account-delete.js']){
  const source=fs.readFileSync(''+filename,'utf8').replace(/^\uFEFF/,'').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');
  vm.runInContext(source,ctx);
 }
 const assertCurrent=()=>{if(!current)throw Error('account-changed')};
 return {records,events,put,run:()=>ctx.eraseSocial({db:{},uid,assertCurrent}),account:()=>ctx.eraseAccount({db:{},user:{uid},locked:true,assertCurrent,onLocked:async()=>{}}),failOnce:value=>{fail=value},changeAfterRead:()=>{afterRead=()=>{current=false}},keep:value=>{keep=value},reset:()=>{current=true}};
}

function populate(f){
 f.put('rooms/shared',{ownerUid:'alice'});f.put('rooms/solo',{ownerUid:'alice'});f.put('rooms/foreign',{ownerUid:'bob'});
 for(const room of ['shared','solo','foreign']){
  f.put(`users/alice/rooms/${room}`,{name:room});f.put(`rooms/${room}/members/alice`,{uid:'alice'});
  f.put(`rooms/${room}/messages/own`,{uid:'alice',image:'personal-photo'});
 }
 f.put('rooms/shared/members/bob',{uid:'bob'});f.put('rooms/shared/messages/other',{uid:'bob'});
 f.put('rooms/solo/secrets/password',{hash:'private-password-hash'});
 f.put('rooms/solo/bans/bob',{by:'alice',at:0});f.put('rooms/shared/bans/alice',{by:'bob',at:0});f.put('rooms/shared/kicks/alice',{by:'bob',at:0});f.put('appBans/alice',{by:'admin',at:0});
 f.put('rooms/foreign/members/bob',{uid:'bob'});
 f.put('users/alice/roomProofs/shared',{hash:'private-password-hash'});
 f.put('publicProfiles/alice',{username:'alice_handle'});f.put('usernames/alice_handle',{uid:'alice'});f.put('entitlements/alice',{nameStyles:['gold']});
 f.put('friendships/alice_bob',{uids:['alice','bob']});f.put('friendships/bob_charlie',{uids:['bob','charlie']});
 f.put('roomInvites/shared_bob',{from:'alice',to:'bob'});f.put('roomInvites/foreign_alice',{from:'bob',to:'alice'});f.put('roomInvites/foreign_charlie',{from:'bob',to:'charlie'});
}

test('social deletion removes personal data, transfers shared leadership and preserves other users',async()=>{
 const f=fixture();populate(f);for(let i=0;i<310;i++)f.put(`rooms/shared/messages/own${i}`,{uid:'alice'});
 await f.run();
 assert.equal(f.records.get('rooms/shared').ownerUid,'bob');assert.equal(f.records.has('rooms/solo'),false);assert.equal(f.records.has('rooms/solo/secrets/password'),false);
 assert.equal(f.records.has('rooms/solo/bans/bob'),false);assert.equal(f.records.has('rooms/shared/bans/alice'),false);assert.equal(f.records.has('rooms/shared/kicks/alice'),false);assert.equal(f.records.has('appBans/alice'),false);
 assert.equal(f.records.get('rooms/foreign').ownerUid,'bob');assert.equal(f.records.has('rooms/shared/messages/other'),true);
 assert.equal(f.records.has('friendships/bob_charlie'),true);assert.equal(f.records.has('roomInvites/foreign_charlie'),true);
 assert.equal([...f.records.entries()].some(([p,d])=>p.includes('/alice')||d.uid==='alice'||d.from==='alice'||d.to==='alice'||d.uids?.includes('alice')),false);
 assert.ok(f.events.indexOf('delete:rooms/shared/messages/own')<f.events.indexOf('delete:rooms/shared/members/alice'));
 assert.ok(f.events.indexOf('delete:rooms/shared/members/alice')<f.events.indexOf('delete:users/alice/rooms/shared'));
});

test('interrupted message, membership, room and handle cleanup resumes without losing the bookmark',async()=>{
 for(const location of ['delete:rooms/shared/messages/own','delete:users/alice/rooms/shared','delete:rooms/solo','delete:usernames/alice_handle','delete:publicProfiles/alice']){
  const f=fixture();populate(f);f.failOnce(location);await assert.rejects(f.run(),/interrupted/);
  await f.run();assert.equal(f.records.has('publicProfiles/alice'),false);assert.equal(f.records.has('usernames/alice_handle'),false);
  assert.equal(f.records.has('users/alice/rooms/shared'),false);assert.equal(f.records.has('rooms/shared/messages/own'),false);
 }
});

test('account changes during a cloud read stop before a mutation',async()=>{
 const f=fixture();populate(f);f.changeAfterRead();await assert.rejects(f.run(),/account-changed/);
 assert.equal(f.events.some(e=>e.startsWith('delete:')||e.startsWith('update:')),false);
});

test('handle must be server-confirmed absent before profile and Auth disappear',async()=>{
 const f=fixture();populate(f);f.keep('usernames/alice_handle');await assert.rejects(f.account(),/social-username-remains/);
 assert.equal(f.records.has('publicProfiles/alice'),true);assert.equal(f.events.includes('auth'),false);
 f.keep('');await f.account();assert.equal(f.events.at(-1),'auth');
});

test('failed social cleanup keeps Auth and private metadata available for retry',async()=>{
 const f=fixture();populate(f);f.put('users/alice/meta/main',{days:{}});f.put('users/alice/devices/device_123',{days:{}});
 f.failOnce('delete:rooms/shared/messages/own');await assert.rejects(f.account(),/interrupted/);
 assert.equal(f.events.includes('auth'),false);assert.equal(f.records.has('users/alice/meta/main'),true);
 await f.account();assert.equal(f.events.at(-1),'auth');assert.equal(f.records.has('users/alice/meta/main'),false);assert.equal(f.records.has('users/alice/devices/device_123'),false);
});

test('already cleaned and legacy accounts without social profiles remain deletable',async()=>{
 const f=fixture();await f.run();await f.run();await f.account();assert.equal(f.events.at(-1),'auth');
});

