'use strict';
window.FocusMotion=(()=>{
const mobile=matchMedia('(max-width:899px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
let listening=false,baseline=null,last=0,permitted=false;
const native=typeof window.FocusAndroid?.motion==='function',needsPermission=typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function';
function orientation(e){if(!Number.isFinite(e.beta)||!Number.isFinite(e.gamma)||!listening)return;if(!baseline)baseline={beta:e.beta,gamma:e.gamma};const now=performance.now();if(now-last<33)return;last=now;const wrap=v=>(v+540)%360-180,clamp=v=>Math.max(-.5,Math.min(.5,v/45));let x=clamp(wrap(e.gamma-baseline.gamma)),y=clamp(wrap(e.beta-baseline.beta));const angle=e.angle??screen.orientation?.angle??0;if(angle===90)[x,y]=[y,-x];else if(angle===270)[x,y]=[-y,x];else if(angle===180){x=-x;y=-y}window.FocusSky?.set(x,y)}
function detach(){if(native)window.FocusAndroid.motion(false);else removeEventListener('deviceorientation',orientation);listening=false;baseline=null;window.FocusSky?.set(0,0)}
function attach(){detach();if(!mobile.matches||reduced.matches||document.hidden||(!native&&needsPermission&&!permitted))return;listening=true;if(native)window.FocusAndroid.motion(true);else addEventListener('deviceorientation',orientation,{passive:true})}
async function start(){if(!native&&needsPermission&&!permitted){try{permitted=await DeviceOrientationEvent.requestPermission()==='granted'}catch(e){return}}attach()}
mobile.addEventListener('change',attach);reduced.addEventListener('change',attach);document.addEventListener('visibilitychange',attach);addEventListener('orientationchange',()=>{baseline=null});addEventListener('pagehide',detach);
if(needsPermission&&!native)document.addEventListener('click',()=>{if(!permitted)start()},{once:true});attach();
return {get active(){return listening},start,receive:(beta,gamma,angle)=>orientation({beta,gamma,angle})};
})();
