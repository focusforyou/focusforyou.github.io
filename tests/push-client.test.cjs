const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const TOKEN_A='native-token-aaaaaaaaaaaaaaaaaaaa',TOKEN_B='native-token-bbbbbbbbbbbbbbbbbbbb';
test('room invite push uses the authenticated private service with only room and target identifiers',async()=>{const f=fixture();await f.bind(user());await f.ctx.FocusPush.invite('YKS','bob');const r=f.requests.at(-1);assert.equal(r.path,'/invite');assert.equal(r.headers.Authorization,'Bearer alice-id-token');assert.deepEqual(JSON.parse(JSON.stringify(r.body)),{roomId:'YKS',targetUid:'bob'})});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}};
function fixture(endpoint='https://focus-push.example.workers.dev'){
 const requests=[],timers=new Map(),storage=new Map(),listeners=new Map();let next=0,bridgeCalls=0;
 const ctx={pushEndpoint:endpoint,crypto:crypto.webcrypto,AbortController,console,
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  setTimeout:(fn,delay)=>{const id=++next;timers.set(id,{fn,delay});return id},clearTimeout:id=>timers.delete(id),
  addEventListener:(event,fn)=>listeners.set(event,fn),FocusAndroid:{pushToken:()=>bridgeCalls++},auth:{currentUser:null}};
 const f={ctx,requests,timers,storage,listeners,handler:async()=>({ok:true,json:async()=>({ok:true})}),
  settle:async()=>{for(let i=0;i<35;i++)await Promise.resolve()},
  async bind(user){ctx.auth.currentUser=user;await ctx.FocusPush.bind(user);await f.settle()},
  get bridgeCalls(){return bridgeCalls},
  async retry(){const entry=[...timers].find(([,timer])=>timer.delay===60000);assert(entry,'Retry must be scheduled');timers.delete(entry[0]);entry[1].fn();await f.settle()}};
 ctx.fetch=async(url,options)=>{const request={url,path:new URL(url).pathname,body:JSON.parse(options.body),headers:options.headers};requests.push(request);return f.handler(request)};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('push-client.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function'),ctx);ctx.initPush({auth:ctx.auth});return f;
}
const user=(uid='alice',verified=true)=>({uid,emailVerified:verified,getIdToken:async()=>uid+'-id-token'});
test('verified native token registration deduplicates refreshes and never puts the Firebase ID token in the body',async()=>{
 const f=fixture();await f.bind(user());assert.equal(f.requests.length,0);assert.equal(f.bridgeCalls,1);
 f.ctx.FocusPush.receiveToken(TOKEN_A);await f.settle();assert.equal(f.requests.length,1);assert.equal(f.requests[0].path,'/register');
 assert.equal(f.requests[0].headers.Authorization,'Bearer alice-id-token');assert.equal(f.requests[0].body.token,TOKEN_A);assert.match(f.requests[0].body.deviceId,/^[A-Za-z0-9_-]{8,64}$/);
 f.ctx.FocusPush.receiveToken(TOKEN_A);await f.settle();assert.equal(f.requests.length,1);
 await f.bind(user('unverified',false));f.ctx.FocusPush.receiveToken(TOKEN_B);await f.settle();assert.equal(f.requests.length,1);
});
test('token rotations serialize backend registration so an older request cannot overwrite the new token',async()=>{
 const f=fixture(),gate=deferred();let first=true;f.handler=async()=>{if(first){first=false;await gate.promise}return {ok:true,json:async()=>({ok:true})}};
 await f.bind(user());f.ctx.FocusPush.receiveToken(TOKEN_A);await f.settle();assert.equal(f.requests.length,1);
 f.ctx.FocusPush.receiveToken(TOKEN_B);await f.settle();assert.equal(f.requests.length,1,'The old registration must finish before the rotated token writes');
 gate.resolve();await f.settle();assert.equal(f.requests.length,2);assert.equal(f.requests[1].body.token,TOKEN_B);
 f.ctx.FocusPush.receiveToken(TOKEN_B);await f.settle();assert.equal(f.requests.length,2);
});
test('registration failure retries the current account without duplicate registration',async()=>{
 const f=fixture();let fail=true;f.handler=async()=>{if(fail){fail=false;throw Error('offline')}return {ok:true,json:async()=>({ok:true})}};
 await f.bind(user());f.ctx.FocusPush.receiveToken(TOKEN_A);await f.settle();assert.equal(f.requests.length,1);
 await f.retry();assert.equal(f.requests.length,2);f.ctx.FocusPush.receiveToken(TOKEN_A);await f.settle();assert.equal(f.requests.length,2);
});
test('account switch during registration discards the old completion and its retry timer',async()=>{
 const f=fixture(),gate=deferred();f.handler=async request=>{if(request.headers.Authorization==='Bearer alice-id-token')await gate.promise;return {ok:true,json:async()=>({ok:true})}};
 await f.bind(user());f.ctx.FocusPush.receiveToken(TOKEN_A);await f.settle();await f.bind(user('bob'));assert.equal(f.requests.length,2);
 gate.resolve();await f.settle();assert.equal([...f.timers.values()].filter(t=>t.delay===60000).length,0,'Stale account failure must not schedule a new account retry');
 f.ctx.FocusPush.receiveToken(TOKEN_A);await f.settle();assert.equal(f.requests.length,2);
});
test('logout unregisters only the signed-in device and can register it again after the next login',async()=>{
 const f=fixture();await f.bind(user());f.ctx.FocusPush.receiveToken(TOKEN_A);await f.settle();await f.ctx.FocusPush.unregister();
 assert.equal(f.requests.at(-1).path,'/unregister');assert.deepEqual(Object.keys(f.requests.at(-1).body),['deviceId']);await f.bind(null);
 await f.bind(user());assert.equal(f.requests.filter(r=>r.path==='/register').length,2);
});
test('account switch while unregister JSON is loading preserves the new registration state',async()=>{
 const f=fixture(),gate=deferred();await f.bind(user());f.ctx.FocusPush.receiveToken(TOKEN_A);await f.settle();
 f.handler=async request=>({ok:true,json:async()=>request.path==='/unregister'?gate.promise:{ok:true}});
 const cleanup=f.ctx.FocusPush.unregister(),rejected=assert.rejects(cleanup,/account-changed/);await f.settle();await f.bind(user('bob'));
 gate.resolve({ok:true});await rejected;const before=f.requests.length;f.ctx.FocusPush.receiveToken(TOKEN_A);await f.settle();assert.equal(f.requests.length,before);
});
test('disabled or untrusted push endpoints are harmless and never fetch or require an account',async()=>{
 for(const endpoint of ['', 'http://focus.workers.dev','https://evil.test','https://focus.workers.dev/path']){
  const f=fixture(endpoint);await f.bind(user());f.ctx.FocusPush.receiveToken(TOKEN_A);await f.settle();await f.ctx.FocusPush.unregister();await f.ctx.FocusPush.erase(user());assert.equal(await f.ctx.FocusPush.send('YKS','bob'),false);assert.equal(f.requests.length,0);assert.equal(f.timers.size,0);
 }
});
test('logout waits for pending registration and suppresses any queued token rotation',async()=>{
 const f=fixture(),gate=deferred();f.handler=async request=>{if(request.path==='/register')await gate.promise;return {ok:true,json:async()=>({ok:true})}};
 await f.bind(user());f.ctx.FocusPush.receiveToken(TOKEN_A);await f.settle();f.ctx.FocusPush.receiveToken(TOKEN_B);await f.settle();
 const cleanup=f.ctx.FocusPush.unregister();await f.settle();assert.equal(f.requests.length,1);
 gate.resolve();await cleanup;await f.settle();assert.deepEqual(f.requests.map(r=>r.path),['/register','/unregister']);
 f.ctx.FocusPush.receiveToken(TOKEN_B);await f.settle();assert.equal(f.requests.length,2);
});
test('failed unregister surfaces the error and permits an explicit retry while preserving the signed-in account',async()=>{
 const f=fixture();await f.bind(user());f.ctx.FocusPush.receiveToken(TOKEN_A);await f.settle();let fail=true;
 f.handler=async request=>{if(request.path==='/unregister'&&fail){fail=false;return {ok:false,status:503,json:async()=>({})}}return {ok:true,json:async()=>({ok:true})}};
 await assert.rejects(f.ctx.FocusPush.unregister(),/push-http-503/);assert.equal(f.ctx.auth.currentUser.uid,'alice');
 await f.ctx.FocusPush.unregister();assert.equal(f.requests.filter(r=>r.path==='/unregister').length,2);
});

