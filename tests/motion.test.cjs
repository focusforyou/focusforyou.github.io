const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(permission=false,reduced=false){
 const events=new Map(),visibility={},points=[],nodes={toggleMotion:{setAttribute(){}},motionStatus:{}},storage=new Map();let now=100,requests=0;
 const ctx={window:null,screen:{orientation:{angle:0}},performance:{now:()=>now+=40},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},matchMedia:q=>({matches:q.includes('899')?true:reduced,addEventListener(){}}),DeviceOrientationEvent:permission?{requestPermission:async()=>{requests++;return 'granted'}}:class{},document:{hidden:false,getElementById:id=>nodes[id],addEventListener:(name,fn)=>visibility[name]=fn},addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:(name,fn)=>{if(events.get(name)===fn)events.delete(name)},setTimeout:()=>1,clearTimeout(){},FocusSky:{set:(x,y)=>points.push([x,y])}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('motion.js','utf8'),ctx);
 return {ctx,events,visibility,points,nodes,get requests(){return requests}};
}
test('gyro movement calibrates, remains bounded and stops when hidden or disabled',async()=>{
 const f=fixture();assert(f.ctx.FocusMotion.active);f.events.get('deviceorientation')({beta:10,gamma:20});f.events.get('deviceorientation')({beta:150,gamma:-150});assert(f.points.at(-1).every(n=>Math.abs(n)<=.5));f.ctx.document.hidden=true;f.visibility.visibilitychange();assert(!f.events.has('deviceorientation'));assert.deepEqual(f.points.at(-1),[0,0]);f.ctx.document.hidden=false;f.visibility.visibilitychange();assert(f.events.has('deviceorientation'));
});
test('permission is requested only after user gesture; reduced motion stays still',async()=>{
 const f=fixture(true);assert.equal(f.requests,0);assert(!f.ctx.FocusMotion.active);await f.ctx.FocusMotion.start();assert.equal(f.requests,1);assert(f.ctx.FocusMotion.active);const reduced=fixture(false,true);await reduced.ctx.FocusMotion.start();assert(!reduced.ctx.FocusMotion.active);
});

test('Android bridge starts automatically without orientation API and detaches when hidden',()=>{const calls=[],f=fixture();f.ctx.FocusAndroid={motion:on=>calls.push(on)};delete f.ctx.DeviceOrientationEvent;vm.runInContext(fs.readFileSync('motion.js','utf8'),f.ctx);assert(f.ctx.FocusMotion.active);assert.equal(calls.at(-1),true);f.ctx.FocusMotion.receive(10,20,0);f.ctx.FocusMotion.receive(30,40,0);assert(f.points.at(-1).some(n=>n!==0));f.ctx.document.hidden=true;f.visibility.visibilitychange();assert.equal(calls.at(-1),false);assert(!f.ctx.FocusMotion.active)});


