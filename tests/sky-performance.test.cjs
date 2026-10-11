const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(reduced=false){
 const callbacks=new Map(),events={},docEvents={};let id=0,draws=0;
 const cx={setTransform(){},clearRect(){draws++},beginPath(){},arc(){},fill(){},moveTo(){},lineTo(){},stroke(){},createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})};
 const cv={getContext:()=>cx};
 const context={document:{hidden:false,documentElement:{classList:{contains:()=>false}},getElementById:()=>cv,addEventListener:(n,f)=>docEvents[n]=f},matchMedia:()=>({matches:reduced}),performance:{now:()=>0},innerWidth:1920,innerHeight:1080,devicePixelRatio:3,addEventListener:(n,f)=>events[n]=f,requestAnimationFrame:f=>{callbacks.set(++id,f);return id},cancelAnimationFrame:n=>callbacks.delete(n)};
 context.window=context;
 const script=fs.readFileSync('index.html','utf8').split('const $=')[1].split('/* Sınav geri sayımı */')[0];
 vm.runInNewContext('const $='+script,context);
 function frame(now){const pending=[...callbacks];callbacks.clear();for(const [,fn]of pending)fn(now)}
 return {context,cv,events,docEvents,callbacks,frame,get draws(){return draws}};
}
test('Sky limits canvas pixels and rendering rate, pauses hidden and resumes one animation chain',()=>{
 const app=setup();assert(app.cv.width*app.cv.height<=2200001);
 app.frame(0);assert.equal(app.draws,1);app.frame(16);assert.equal(app.draws,1);app.frame(34);assert.equal(app.draws,2);
 app.context.document.hidden=true;app.docEvents.visibilitychange();assert.equal(app.callbacks.size,0);
 app.context.document.hidden=false;app.docEvents.visibilitychange();app.context.FocusSky.resume();assert.equal(app.callbacks.size,1);
 app.events['focus-anim-change']({detail:{enabled:false}});assert.equal(app.callbacks.size,0);
});
test('Reduced-motion sky draws a static scene without continuous frames, and redraws theme changes',()=>{
 const app=setup(true);app.frame(0);assert.equal(app.draws,1);assert.equal(app.callbacks.size,0);
 app.events['focus-theme-change']({detail:{theme:'light'}});assert.equal(app.callbacks.size,1);
 app.frame(1);assert.equal(app.draws,2);assert.equal(app.callbacks.size,0);
});
