const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(reduced=false,width=1920,height=1080){
 const callbacks=new Map(),events={},docEvents={},timers=new Map();let id=0,draws=0,fills=0,arcs=0;
 const cx={setTransform(){},clearRect(){draws++},beginPath(){},arc(){arcs++},fill(){fills++},moveTo(){},lineTo(){},stroke(){},createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})};
 const cv={getContext:()=>cx};
 const context={document:{hidden:false,documentElement:{classList:{contains:()=>false}},getElementById:()=>cv,addEventListener:(n,f)=>docEvents[n]=f},matchMedia:()=>({matches:reduced}),performance:{now:()=>0},innerWidth:width,innerHeight:height,devicePixelRatio:3,addEventListener:(n,f)=>events[n]=f,requestAnimationFrame:f=>{callbacks.set(++id,f);return id},cancelAnimationFrame:n=>callbacks.delete(n)};
 context.setTimeout=f=>{timers.set(1,f);return 1};context.clearTimeout=n=>timers.delete(n);context.window=context;
 const script=fs.readFileSync('index.html','utf8').split('const $=')[1].split('/* Sınav geri sayımı */')[0];
 vm.runInNewContext('const $='+script,context);
 function frame(now){const pending=[...callbacks];callbacks.clear();for(const [,fn]of pending)fn(now)}
 return {context,cv,events,docEvents,callbacks,frame,timers,get draws(){return draws},get fills(){return fills},get arcs(){return arcs}};
}
test('Sky limits canvas pixels and rendering rate, pauses hidden and resumes one animation chain',()=>{
 const app=setup();assert(app.cv.width*app.cv.height<=2200001);
 app.frame(0);assert.equal(app.draws,1);app.frame(16);assert.equal(app.draws,1);app.frame(51);assert.equal(app.draws,2);
 app.context.document.hidden=true;app.docEvents.visibilitychange();assert.equal(app.callbacks.size,0);
 app.context.document.hidden=false;app.docEvents.visibilitychange();app.context.FocusSky.resume();assert.equal(app.callbacks.size,1);
 app.events['focus-anim-change']({detail:{enabled:false}});assert.equal(app.callbacks.size,0);
});

test('Sky batches particles into a bounded number of paint calls and keeps mobile pixel cost bounded',()=>{
 for(const [w,h,budget] of [[1920,1080,550000],[390,844,650000]]){
  const app=setup(false,w,h);app.frame(0);
  assert(app.cv.width*app.cv.height<=budget+1);
  assert(app.arcs>40,'stars and falling particles still render');
  assert(app.fills<=20,'particle paints are grouped, rather than one fill per point');
  const before=app.arcs;app.frame(w<900?34:51);assert(app.arcs>before,'motion continues');
 }
});
test('Reduced-motion sky draws a static scene without continuous frames, and redraws theme changes',()=>{
 const app=setup(true);app.frame(0);assert.equal(app.draws,1);assert.equal(app.callbacks.size,0);
 app.events['focus-theme-change']({detail:{theme:'light'}});assert.equal(app.callbacks.size,1);
 app.frame(1);assert.equal(app.draws,2);assert.equal(app.callbacks.size,0);
});

test('modal pauses every sky frame and a hidden/disabled sky cannot be restarted by closing it',()=>{
 const app=setup();app.frame(0);const before=app.draws;
 app.context.FocusOverlayOpen=true;app.events['focus-overlay-change']({detail:{open:true}});assert.equal(app.callbacks.size,0);app.context.FocusSky.resume();assert.equal(app.callbacks.size,0);assert.equal(app.draws,before);
 app.context.FocusOverlayOpen=false;app.events['focus-overlay-change']({detail:{open:false}});assert.equal(app.callbacks.size,1);app.frame(51);assert.equal(app.draws,before+1);
 app.context.FocusSkyAnim=false;app.events['focus-anim-change']({detail:{enabled:false}});app.events['focus-overlay-change']({detail:{open:false}});assert.equal(app.callbacks.size,0);
});


test('desktop draws fewer particles while mobile retains its particle density and cadence',()=>{const desktop=setup(false,1920,1080),mobile=setup(false,390,844);desktop.frame(0);mobile.frame(0);assert(desktop.arcs<=168);assert(mobile.arcs>=70);desktop.frame(34);mobile.frame(34);assert.equal(desktop.draws,1);assert.equal(mobile.draws,2);desktop.frame(51);assert.equal(desktop.draws,2)});

test('scrolling pauses desktop drawing and resumes one chain, without changing mobile scroll behaviour',()=>{const desktop=setup();desktop.frame(0);desktop.events.scroll();assert.equal(desktop.callbacks.size,0);desktop.context.FocusSky.resume();assert.equal(desktop.callbacks.size,0);desktop.timers.get(1)();assert.equal(desktop.callbacks.size,1);const mobile=setup(false,390,844);mobile.frame(0);mobile.events.scroll();assert.equal(mobile.callbacks.size,1);assert.equal(mobile.timers.size,0)});
