const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(reduced=false,width=1920,height=1080){
 const callbacks=new Map(),events={},docEvents={};let id=0,draws=0,fills=0,arcs=0;
 const cx={setTransform(){},clearRect(){draws++},beginPath(){},arc(){arcs++},fill(){fills++},moveTo(){},lineTo(){},stroke(){},createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})};
 const cv={getContext:()=>cx};
 const context={document:{hidden:false,documentElement:{classList:{contains:()=>false}},getElementById:()=>cv,addEventListener:(n,f)=>docEvents[n]=f},matchMedia:()=>({matches:reduced}),performance:{now:()=>0},innerWidth:width,innerHeight:height,devicePixelRatio:3,addEventListener:(n,f)=>events[n]=f,requestAnimationFrame:f=>{callbacks.set(++id,f);return id},cancelAnimationFrame:n=>callbacks.delete(n)};
 context.window=context;
 const script=fs.readFileSync('index.html','utf8').split('const $=')[1].split('/* Sınav geri sayımı */')[0];
 vm.runInNewContext('const $='+script,context);
 function frame(now){const pending=[...callbacks];callbacks.clear();for(const [,fn]of pending)fn(now)}
 return {context,cv,events,docEvents,callbacks,frame,get draws(){return draws},get fills(){return fills},get arcs(){return arcs}};
}
test('Sky limits canvas pixels and rendering rate, pauses hidden and resumes one animation chain',()=>{
 const app=setup();assert(app.cv.width*app.cv.height<=2200001);
 app.frame(0);assert.equal(app.draws,1);app.frame(16);assert.equal(app.draws,1);app.frame(34);assert.equal(app.draws,2);
 app.context.document.hidden=true;app.docEvents.visibilitychange();assert.equal(app.callbacks.size,0);
 app.context.document.hidden=false;app.docEvents.visibilitychange();app.context.FocusSky.resume();assert.equal(app.callbacks.size,1);
 app.events['focus-anim-change']({detail:{enabled:false}});assert.equal(app.callbacks.size,0);
});

test('Sky batches particles into a bounded number of paint calls and keeps mobile pixel cost bounded',()=>{
 for(const [w,h,budget] of [[1920,1080,1100000],[390,844,650000]]){
  const app=setup(false,w,h);app.frame(0);
  assert(app.cv.width*app.cv.height<=budget+1);
  assert(app.arcs>40,'stars and falling particles still render');
  assert(app.fills<=20,'particle paints are grouped, rather than one fill per point');
  const before=app.arcs;app.frame(34);assert(app.arcs>before,'motion continues');
 }
});
test('Reduced-motion sky draws a static scene without continuous frames, and redraws theme changes',()=>{
 const app=setup(true);app.frame(0);assert.equal(app.draws,1);assert.equal(app.callbacks.size,0);
 app.events['focus-theme-change']({detail:{theme:'light'}});assert.equal(app.callbacks.size,1);
 app.frame(1);assert.equal(app.draws,2);assert.equal(app.callbacks.size,0);
});

