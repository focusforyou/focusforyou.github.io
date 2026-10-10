const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const Model=require('../cloud-model.js');
const copy=x=>JSON.parse(JSON.stringify(x));
function fixture(storage=new Map()){
 const nodes=new Map(),intervals=[],listeners=new Map(),rows=new Map(),subscriptions=[],events={};let authChange,clock=1000,offline=false;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,textContent:'',disabled:false,removeAttribute(){},click(){},close(){this.closed=true}});return nodes.get(id)};
 let daily={'2026-10-10':100},fields={preferences:'{"focus":25}',tasks:'[]',forest:'{}',exam:'""'};
 const snap=path=>({exists:()=>rows.has(path),data:()=>rows.get(path)});
 const ctx={initSocial:()=>{ctx.FocusSocial={bind:async()=>{},stop(){},pauseRoom:async()=>{},exportData:async()=>({})}},sessionStorage:{removeItem(){}},CloudModel:Model,console,URL,Event:class{},crypto:{randomUUID:()=>storage.get('focus_device_id')||'device-a'},firebaseConfig:{},googleClientId:'client',appCheckSiteKey:'',initializeApp:()=>({}),getAuth:()=>ctx.auth,getFirestore:()=>({}),auth:{currentUser:null},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},document:{hidden:false,activeElement:null,getElementById:node,addEventListener:(k,f)=>listeners.set(k,f)},setInterval:(f,ms)=>intervals.push({f,ms}),addEventListener:(k,f)=>events[k]=f,
 doc:(_, ...p)=>p.join('/'),collection:(_, ...p)=>p.join('/'),serverTimestamp:()=>({toMillis:()=>++clock}),
 getDocFromServer:async path=>{if(offline)throw Error('offline');return snap(path)},
 runTransaction:async(_,fn)=>{if(offline)throw Error('offline');return fn({get:async path=>snap(path),set:(path,value)=>rows.set(path,value),update:(path,value)=>rows.set(path,{...rows.get(path),...value})})},
 onSnapshot:(path,fn)=>{const s={path,fn,active:true};subscriptions.push(s);return ()=>s.active=false},onAuthStateChanged:(_,fn)=>authChange=fn,
 signOut:async()=>{ctx.auth.currentUser=null;authChange(null)},GoogleAuthProvider:class{},EmailAuthProvider:{credential:()=>({})},reauthenticateWithPopup:async()=>{},reauthenticateWithCredential:async()=>{},signInWithPopup:async()=>{},signInWithCredential:async()=>{},signInWithEmailAndPassword:async()=>{},createUserWithEmailAndPassword:async()=>{},sendEmailVerification:async()=>{},sendPasswordResetEmail:async()=>{},reload:async()=>{},getIdToken:async()=>{},
 Study:{snapshot:()=>({days:copy(daily)}),applyDays:d=>daily=copy(d),liveSession:()=>({running:false})},FocusData:{fields:()=>({...fields}),apply:f=>Object.assign(fields,f)},dispatchEvent:()=>{}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('account.js','utf8').replace(/^import .*;\r?\n/gm,''),ctx);
 const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
 return {ctx,rows,node,storage,settle,subscriptions,get daily(){return daily},get fields(){return fields},set offline(v){offline=v},
 async login(uid='alice'){ctx.auth.currentUser={uid,emailVerified:true,displayName:uid,email:uid+'@example.com'};authChange(ctx.auth.currentUser);await settle()},
 async logout(){ctx.auth.currentUser=null;authChange(null);await settle()},
 emit(){for(const s of subscriptions.filter(s=>s.active)){if(s.path.endsWith('/devices'))s.fn({docs:[...rows].filter(([path])=>path.startsWith(s.path+'/')).map(([path,data])=>({id:path.split('/').at(-1),data:()=>data}))});else s.fn(snap(s.path))}},
 work(n){daily['2026-10-10']=(daily['2026-10-10']||0)+n;ctx.FocusAccount.record('2026-10-10',n)},edit(value){fields.preferences=value},watch(){intervals.find(x=>x.ms===5000).f()},online(){events.online()}};
}
test('two devices merge independent work; reconnect and repeated sends never duplicate seconds',async()=>{
 const a=fixture();await a.login();a.emit();a.work(60);await a.ctx.FocusAccount.sync();a.emit();assert.equal(a.daily['2026-10-10'],160);
 const b=fixture(new Map([['focus_device_id','device-b']]));for(const [k,v] of a.rows)b.rows.set(k,v);await b.login();b.emit();b.work(30);await b.ctx.FocusAccount.sync();b.emit();assert.equal(b.daily['2026-10-10'],190);
 for(const [k,v] of b.rows)a.rows.set(k,v);a.emit();assert.equal(a.daily['2026-10-10'],190);
 a.offline=true;a.work(20);await a.ctx.FocusAccount.sync();assert.equal(a.daily['2026-10-10'],210);a.offline=false;await a.ctx.FocusAccount.sync();a.emit();await a.ctx.FocusAccount.sync();a.emit();assert.equal(a.daily['2026-10-10'],210);
});
test('a committed preference survives delayed snapshots and pending edits survive remote changes',async()=>{
 const f=fixture();await f.login();f.emit();f.edit('{"focus":40}');await f.ctx.FocusAccount.sync();assert.equal(f.fields.preferences,'{"focus":40}');f.emit();assert.equal(f.fields.preferences,'{"focus":40}');
 f.edit('{"focus":50}');f.rows.set('users/alice/devices/device-b',{days:{},preferences:{value:'{"focus":10}',at:{toMillis:()=>99999}}});f.emit();assert.equal(f.fields.preferences,'{"focus":50}');
});
test('failed first account setup retries without counting work in both baseline and device',async()=>{
 const f=fixture();f.offline=true;await f.login();f.work(40);f.watch();f.offline=false;f.online();await f.settle();f.emit();await f.ctx.FocusAccount.sync();f.emit();assert.equal(f.daily['2026-10-10'],140);
});
test('switching accounts restores guest data and prevents the previous account leaking into a new account',async()=>{
 const f=fixture();await f.login();f.emit();f.work(80);await f.ctx.FocusAccount.sync();f.emit();assert.equal(f.daily['2026-10-10'],180);await f.logout();assert.equal(f.daily['2026-10-10'],100);await f.login('bob');f.emit();assert.equal(f.daily['2026-10-10'],100);assert.equal(f.rows.get('users/bob/meta/main').days['2026-10-10'],100);await f.login('alice');f.emit();assert.equal(f.daily['2026-10-10'],180);
});
test('cloud model filters invalid data and unsafe avatar URLs',()=>{
 assert.deepEqual(Model.days({'2026-10-10':25,bad:9,'2026-10-11':Infinity,'2026-10-12':-1}),{'2026-10-10':25});assert.equal(Model.photo('javascript:alert(1)'),'');assert.equal(Model.photo('https://evil.example/avatar.jpg'),'');assert.equal(Model.photo('https://lh3.googleusercontent.com/photo'),'https://lh3.googleusercontent.com/photo');
});
test('removing an avatar saves only the current profile and preserves its name',async()=>{
 const f=fixture();await f.login();f.rows.get('users/alice/meta/main').profile={uid:'alice',name:'Efe',photo:'https://lh3.googleusercontent.com/photo'};f.emit();await f.node('removeProfilePhoto').onclick();assert.equal(f.rows.get('users/alice/meta/main').profile.photo,'');assert.equal(f.rows.get('users/alice/meta/main').profile.name,'Efe');assert.equal(f.node('profileAvatar').hidden,true);
});
test('export waits for cloud load and includes only the signed-in account and its pending changes',async()=>{
 const f=fixture();let exported='';f.ctx.FocusAndroid={saveBackup:value=>exported=value};f.ctx.TextEncoder=TextEncoder;
 await f.login();await f.node('exportAccount').onclick();assert.equal(exported,'');f.emit();f.work(20);f.edit('{"focus":45}');await f.node('exportAccount').onclick();const data=JSON.parse(exported);assert.equal(data.account.uid,'alice');assert.equal(data.currentDevice.days['2026-10-10'],20);assert.equal(data.currentDevice.pendingFields.preferences,'{"focus":45}');assert.equal(data.account.password,undefined);
 await f.login('bob');f.emit();await f.node('exportAccount').onclick();assert.equal(JSON.parse(exported).account.uid,'bob');assert.equal(exported.includes('alice@example.com'),false);
});
test('successful profile save closes the window; failed save keeps the name available for retry',async()=>{
 const f=fixture();await f.login();f.emit();f.node('profileName').value='Efe';await f.node('saveProfile').onclick();assert.equal(f.rows.get('users/alice/meta/main').profile.name,'Efe');assert.equal(f.node('accountSheet').closed,true);
 f.node('accountSheet').closed=false;f.node('profileName').value='Yeni ad';f.offline=true;await f.node('saveProfile').onclick();assert.equal(f.node('accountSheet').closed,false);assert.equal(f.node('profileName').value,'Yeni ad');
});
test('account deletion needs explicit consent and reauthentication, then clears account caches',async()=>{
 const f=fixture();await f.login();f.emit();f.ctx.auth.currentUser.providerData=[{providerId:'google.com'}];let calls=0;
 f.ctx.eraseAccount=async options=>{calls++;options.assertCurrent();await options.onLocked();f.ctx.auth.currentUser=null};
 await f.node('deleteAccount').onclick();assert.equal(calls,0);
 f.node('deleteConsent').checked=true;f.ctx.reauthenticateWithPopup=async()=>{throw Error('cancelled')};await f.node('deleteAccount').onclick();assert.equal(calls,0);
 f.ctx.reauthenticateWithPopup=async()=>{};await f.node('deleteAccount').onclick();assert.equal(calls,1);assert.equal(f.storage.has('focus_account_alice'),false);assert.equal(f.storage.has('focus_current_uid'),false);assert.deepEqual(f.daily,{});assert.match(f.node('accountStatus').textContent,/silindi/);
});
test('interrupted deletion stays blocked and resumes after signing in again',async()=>{
 const f=fixture();await f.login();f.emit();f.ctx.auth.currentUser.providerData=[{providerId:'google.com'}];f.node('deleteConsent').checked=true;
 f.ctx.eraseAccount=async options=>{f.rows.set('deletions/alice',{startedAt:0});await options.onLocked();throw Error('offline')};await f.node('deleteAccount').onclick();assert.match(f.node('accountStatus').textContent,/henüz tamamlanmadı/);
 let resumed=false;f.ctx.eraseAccount=async options=>{resumed=options.locked;await options.onLocked();f.ctx.auth.currentUser=null};await f.login();await f.settle();assert.equal(resumed,true);assert.match(f.node('accountStatus').textContent,/silindi/);
});
test('a remote deletion lock stops recording without signing out the tab doing cleanup',async()=>{
 const f=fixture();await f.login();f.emit();f.work(20);f.rows.set('deletions/alice',{startedAt:0});f.emit();assert.equal(f.ctx.auth.currentUser.uid,'alice');assert.deepEqual(f.daily,{});assert.equal(f.storage.has('focus_account_alice'),false);f.ctx.FocusAccount.record('2026-10-10',30);await f.ctx.FocusAccount.sync();assert.equal(f.storage.has('focus_account_alice'),false);assert.match(f.node('accountStatus').textContent,/başka bir pencerede/);
});
test('offline boot without Firebase SDK preserves work and changed preferences for reconnect',async()=>{
 const storage=new Map([['focus_current_uid','alice'],['focus_device_id','device-a'],['focus_account_alice',JSON.stringify({days:{'2026-10-10':60},dirty:{},observed:{preferences:'{"focus":25}'}})]]),intervals=[];
 const context={localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},setInterval:f=>intervals.push(f),addEventListener(){},FocusData:{fields:()=>({preferences:'{"focus":40}'})},URL};context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync('cloud-model.js','utf8'),context);context.FocusAccount.record('2026-10-10',20);intervals[0]();
 const cached=JSON.parse(storage.get('focus_account_alice'));assert.equal(cached.days['2026-10-10'],80);assert.equal(cached.dirty.preferences,'{"focus":40}');
 const f=fixture(storage);f.edit('{"focus":40}');f.rows.set('users/alice/meta/main',{days:{'2026-10-10':100},fields:{preferences:'{"focus":25}'},profile:{uid:'alice',name:'Alice',photo:''}});f.rows.set('users/alice/devices/device-a',{days:{'2026-10-10':60}});await f.login();f.emit();await f.ctx.FocusAccount.sync();f.emit();assert.equal(f.daily['2026-10-10'],180);assert.equal(f.fields.preferences,'{"focus":40}');
});

test('cloud merge ignores oversized or malformed fields from existing records',()=>{const out=Model.combine({days:{},fields:{tasks:'x'.repeat(65537),exam:42,preferences:'{"focus":25}',unexpected:'bad'}},[{days:[],tasks:{value:[],at:{toMillis:()=>10}},preferences:{value:'x'.repeat(2049),at:{toMillis:()=>10}}}]);assert.deepEqual(out,{days:{},fields:{preferences:'{"focus":25}'}})});

