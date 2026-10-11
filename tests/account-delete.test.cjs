const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture({locked=false,failAt='',count=450}={}){
 let devices=Array.from({length:count},(_,i)=>({ref:'device-'+i})),meta=true,auth=true,lock=locked;const events=[];
 const ctx={eraseSocial:async()=>{events.push("social");if(failAt==="social")throw Error("social-cleanup-failed")},doc:(_, ...p)=>p.join('/'),setDoc:async()=>{events.push('lock');if(failAt==='lock')throw Error();lock=true},serverTimestamp:()=>0,collection:(_, ...p)=>p.join('/'),query:x=>x,limit:()=>200,
 getDocFromServer:async()=>{if(failAt==='verify')throw Error('offline');return {exists:()=>meta||failAt==='remaining-meta'}},getDocsFromServer:async()=>({empty:!devices.length&&!(failAt==='remaining-device'&&!meta),docs:devices.slice(0,200)}),writeBatch:()=>{const rows=[];return {delete:ref=>rows.push(ref),commit:async()=>{assert.equal(lock,true);events.push('batch');if(failAt==='batch')throw Error();devices=devices.filter(r=>!rows.includes(r.ref))}}},deleteDoc:async()=>{events.push('meta');assert.equal(devices.length,0);if(failAt==='meta')throw Error();meta=false},deleteUser:async()=>{events.push('auth');assert.equal(meta,false);if(failAt==='auth')throw Error();auth=false}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('account-delete.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export async function','async function'),ctx);
 return {events,run:()=>ctx.eraseAccount({db:{},user:{uid:'alice'},locked,assertCurrent(){},onLocked:async()=>events.push('stop-sync')}),get devices(){return devices.length},get meta(){return meta},get auth(){return auth},ctx};
}
test('cleanup locks writes, deletes all device pages and metadata, then deletes Auth last',async()=>{const f=fixture();await f.run();assert.deepEqual(f.events,['lock','stop-sync','social','batch','batch','batch','meta','auth']);assert.equal(f.devices,0);assert.equal(f.auth,false)});
test('failures never report deletion or remove Auth before cloud cleanup',async()=>{for(const failAt of ['lock','social','batch','meta']){const f=fixture({failAt});await assert.rejects(f.run());assert.equal(f.auth,true)}const f=fixture({failAt:'auth'});await assert.rejects(f.run());assert.equal(f.meta,false);assert.equal(f.auth,true)});
test('retry after interruption retains the lock and does not resurrect records',async()=>{const f=fixture({locked:true,count:1});await f.run();assert.equal(f.events.includes('lock'),false);assert.equal(f.auth,false)});
test('changing the signed-in account aborts before touching its data',async()=>{const f=fixture();await assert.rejects(f.ctx.eraseAccount({db:{},user:{uid:'alice'},assertCurrent(){throw Error('account-changed')},onLocked(){}}));assert.deepEqual(f.events,[])});

test('server verification failure or leftover records preserve Auth for retry',async()=>{for(const failAt of ['verify','remaining-meta','remaining-device']){const f=fixture({failAt,count:1});await assert.rejects(f.run());assert.equal(f.auth,true);assert.equal(f.events.includes('auth'),false)}});

test('changing account while device page loads prevents the cleanup batch',async()=>{
 const f=fixture();let current=true;const original=f.ctx.getDocsFromServer;f.ctx.getDocsFromServer=async q=>{const rows=await original(q);current=false;return rows};await assert.rejects(f.ctx.eraseAccount({db:{},user:{uid:'alice'},locked:true,assertCurrent(){if(!current)throw Error('account-changed')},onLocked(){}}),/account-changed/);assert.equal(f.events.includes('batch'),false);assert.equal(f.auth,true);
});
test('push erasure precedes social data and failure preserves Auth and all retryable records',async()=>{
 const f=fixture({count:1,locked:true});await assert.rejects(f.ctx.eraseAccount({db:{},user:{uid:'alice'},locked:true,assertCurrent(){},onLocked(){},erasePush:async()=>{f.events.push('push');throw Error('push-cleanup-failed')}}),/push-cleanup-failed/);
 assert.deepEqual(f.events,['push']);assert.equal(f.auth,true);assert.equal(f.devices,1);assert.equal(f.meta,true);
 const success=fixture({count:1,locked:true});await success.ctx.eraseAccount({db:{},user:{uid:'alice'},locked:true,assertCurrent(){},onLocked(){},erasePush:async owner=>{assert.equal(owner.uid,'alice');success.events.push('push')}});
 assert.deepEqual(success.events,['push','social','batch','meta','auth']);assert.equal(success.auth,false);
});
test('account switch during push erasure aborts before deleting any cloud or Auth records',async()=>{
 const f=fixture({count:1});let current=true;await assert.rejects(f.ctx.eraseAccount({db:{},user:{uid:'alice'},locked:true,assertCurrent(){if(!current)throw Error('account-changed')},onLocked(){},erasePush:async()=>{current=false}}),/account-changed/);
 assert.equal(f.auth,true);assert.equal(f.devices,1);assert.equal(f.meta,true);assert.deepEqual(f.events,[]);
});

