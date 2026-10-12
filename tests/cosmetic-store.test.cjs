const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const model=require('../cosmetics.js');
function fixture(){
 const records=new Map(),listeners=[],intervals=[],events=[];let clock=1000000,session={phase:'focus',running:true},transactions=0;
 const auth={currentUser:null},ref=path=>({path}),snapshot=r=>({exists:()=>records.has(r.path),data:()=>records.get(r.path)});
 const emit=()=>{for(const s of listeners)if(s.active)s.fn(snapshot(s.ref))};
 const ctx={console,Promise,Date:class extends Date{static now(){return clock}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}},
  auth,FocusCosmetics:model,Study:{liveSession:()=>session},document:{hidden:false,addEventListener(){}},setInterval:fn=>intervals.push(fn),dispatchEvent:e=>events.push(e),
  doc:(_, ...path)=>ref(path.join('/')),getDoc:async r=>snapshot(r),serverTimestamp:()=>{const at=clock;return {toMillis:()=>at}},
  onSnapshot:(r,fn)=>{const s={ref:r,fn,active:true};listeners.push(s);fn(snapshot(r));return ()=>s.active=false},
  runTransaction:async(_,fn)=>{transactions++;const writes=[];await fn({get:async r=>snapshot(r),set:(r,data)=>writes.push([r,data]),update:(r,data)=>writes.push([r,{...records.get(r.path),...data}])});for(const [r,data] of writes)records.set(r.path,data);emit()},
 };ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('cosmetic-store.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function'),ctx);const api=ctx.initCosmeticStore({db:{},auth});
 return {api,ctx,records,events,get transactions(){return transactions},async login(uid='buyer',admin=false){auth.currentUser={uid,emailVerified:true,email:admin?'efeozbilgin550@gmail.com':uid+'@example.com'};await api.bind(auth.currentUser)},advance:ms=>clock+=ms,setSession:v=>session=v,async tick(){for(const fn of intervals)fn();for(let i=0;i<20;i++)await Promise.resolve()}};
}
test('catalog has eighteen explicit thousand-hour items and normalized inventory never grants free ownership',()=>{
 assert.equal(model.catalog().length,21);for(const item of model.catalog())assert.equal(item.cost,3600000);
 assert.deepEqual(model.normalize(),{fonts:[],nameStyles:[],frames:[],plates:[],tags:[]});assert.equal(model.owned({},'frame:gold'),false);
 assert.equal(model.validTag('custom:Merhaba'),true);assert.equal(model.validTag('custom:\nFake'),false);assert.equal(model.validTag('custom:'+'x'.repeat(25)),false);
 assert.equal(model.balance({earnedSeconds:7200000,spentSeconds:3600000}),3600000);
});
test('wallet heartbeat caps offline credit, stops earning during breaks and purchase updates cost plus one ownership atomically',async()=>{
 const f=fixture();await f.login();await f.api.sync(true);assert.equal(f.records.get('wallets/buyer').earnedSeconds,0);
 f.advance(120000);await f.api.sync(false);assert.equal(f.records.get('wallets/buyer').earnedSeconds,60);assert.equal(f.records.get('wallets/buyer').running,false);
 f.advance(3600000);await f.api.sync(false);assert.equal(f.records.get('wallets/buyer').earnedSeconds,60);
 f.records.set('wallets/buyer',{earnedSeconds:3600000,spentSeconds:0,running:false,checkpoint:{toMillis:()=>1000000},lastPurchase:''});
 await f.api.purchase('frame:emerald');assert.equal(f.records.get('wallets/buyer').spentSeconds,3600000);assert.equal(f.records.get('wallets/buyer').lastPurchase,'frame:emerald');assert.deepEqual(f.records.get('entitlements/buyer').frames,['emerald']);
 await assert.rejects(f.api.purchase('frame:emerald'),/already-owned/);await assert.rejects(f.api.purchase('plate:ruby'),/insufficient-hours/);
});
test('a stop while start sync is pending is coalesced before settling and the final wallet cannot stay running',async()=>{
 const f=fixture();await f.login();const start=f.api.sync(true),stop=f.api.sync(false);await Promise.all([start,stop]);assert.equal(f.records.get('wallets/buyer').running,false);
});
test('admin gifts item and custom tag to exact username while ordinary users cannot grant inventory',async()=>{
 const f=fixture();f.records.set('usernames/friend',{uid:'friendUid'});await f.login();await assert.rejects(f.api.grant('@friend','name:ice'),/admin-required/);
 await f.login('admin',true);await f.api.grant('@friend','name:ice');await f.api.grantTag('friend',' [Usta] ');assert.deepEqual(f.records.get('entitlements/friendUid').nameStyles,['ice']);assert.deepEqual(f.records.get('entitlements/friendUid').tags,['custom:[Usta]']);
 await assert.rejects(f.api.grantTag('friend','x'.repeat(25)),/invalid-tag/);assert.equal(f.records.has('entitlements/buyer'),false);
});
test('account changes cancel delayed purchases without writing inventory or balance into the new account',async()=>{
 const f=fixture();await f.login();f.records.set('wallets/buyer',{earnedSeconds:3600000,spentSeconds:0,running:false,checkpoint:{toMillis:()=>1000000},lastPurchase:''});
 const original=f.ctx.runTransaction,releases=[];f.ctx.runTransaction=(_,fn)=>original({},tx=>fn({...tx,get:r=>new Promise(resolve=>{releases.push(()=>tx.get(r).then(resolve))})}));
 const pending=f.api.purchase('frame:gold');for(let i=0;i<3;i++)await Promise.resolve();assert.equal(releases.length,2);await f.login('other');for(const release of releases)release();
 f.ctx.runTransaction=original;await assert.rejects(pending,/account-changed/);
 assert.equal(f.records.has('entitlements/other'),false);assert.equal(f.records.get('wallets/buyer').spentSeconds,0);
});

test('font purchases and admin gifts preserve colors and only add the chosen font',async()=>{
 const f=fixture();await f.login();f.records.set('wallets/buyer',{earnedSeconds:3600000,spentSeconds:0,running:false,checkpoint:{toMillis:()=>1000000},lastPurchase:''});f.records.set('entitlements/buyer',{nameStyles:['ice'],frames:['gold'],plates:[],tags:[]});
 await f.api.purchase('font:fredoka');assert.deepEqual(f.records.get('entitlements/buyer').fonts,['fredoka']);assert.deepEqual(f.records.get('entitlements/buyer').nameStyles,['ice']);assert.equal(f.records.get('wallets/buyer').spentSeconds,3600000);
 assert.deepEqual(model.normalize({fonts:['evil','cinzel','cinzel']}).fonts,['cinzel']);assert.equal(model.owned({},'font:cinzel'),false);
 f.records.set('usernames/friend',{uid:'friendUid'});await f.login('admin',true);await f.api.grant('@friend','font:space-mono');assert.deepEqual(f.records.get('entitlements/friendUid').fonts,['space-mono']);
});

test('idle and break heartbeat performs no recurring transactions while focus start, credit and stop still sync',async()=>{
 const f=fixture();f.setSession({phase:'focus',running:false});await f.login();await f.tick();assert.equal(f.transactions,1);const initialCheckpoint=f.records.get('wallets/buyer').checkpoint;
 for(let i=0;i<12;i++){f.advance(30000);await f.tick()}assert.equal(f.transactions,1);assert.equal(f.records.get('wallets/buyer').checkpoint,initialCheckpoint);
 f.setSession({phase:'focus',running:true});await f.tick();assert.equal(f.transactions,2);assert.equal(f.records.get('wallets/buyer').running,true);
 f.advance(30000);await f.tick();assert.equal(f.transactions,3);assert.equal(f.records.get('wallets/buyer').earnedSeconds,29);
 f.setSession({phase:'break',running:true});await f.tick();assert.equal(f.transactions,4);assert.equal(f.records.get('wallets/buyer').running,false);
 for(let i=0;i<12;i++){f.advance(30000);await f.tick()}assert.equal(f.transactions,4);assert.equal(f.records.get('wallets/buyer').earnedSeconds,29);
});


test('a hidden page still credits a running focus session and a break stops earning',async()=>{
 const f=fixture();await f.login();await f.tick();f.ctx.document.hidden=true;f.advance(30000);await f.tick();assert.equal(f.records.get('wallets/buyer').earnedSeconds,29);
 f.setSession({phase:'break',running:true});await f.tick();assert.equal(f.records.get('wallets/buyer').running,false);f.advance(30000);await f.tick();assert.equal(f.records.get('wallets/buyer').earnedSeconds,29);
});
test('failed wallet writes expose a recoverable sync error and a successful retry clears it',async()=>{
 const f=fixture();await f.login();const original=f.ctx.runTransaction;f.ctx.runTransaction=async()=>{throw Error('offline')};await f.tick();assert.equal(f.api.snapshot().error,'wallet-sync-failed');
 f.ctx.runTransaction=original;f.advance(30000);await f.tick();assert.equal(f.api.snapshot().error,'');assert.equal(f.records.get('wallets/buyer').running,true);
});
