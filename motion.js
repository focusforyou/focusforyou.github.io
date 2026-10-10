'use strict';
window.FocusMotion=(()=>{
const mobile=matchMedia('(max-width:899px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)'),button=document.getElementById('toggleMotion'),status=document.getElementById('motionStatus');
let enabled=false,listening=false,baseline=null,last=0,timeout;
const needsPermission=typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function';
const preferred=()=>localStorage.getItem('focus_motion')!=='off';
function label(){button.textContent=enabled?'Telefon hareketini kapat':'Telefon hareketini aç';button.setAttribute('aria-pressed',String(enabled))}
function orientation(e){
if(!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;
if(!baseline)baseline={beta:e.beta,gamma:e.gamma};clearTimeout(timeout);
const now=performance.now();if(now-last<33)return;last=now;
const wrap=value=>(value+540)%360-180,clamp=value=>Math.max(-.3,Math.min(.3,value/60));
let x=clamp(wrap(e.gamma-baseline.gamma)),y=clamp(wrap(e.beta-baseline.beta));
const angle=screen.orientation?.angle||0;if(angle===90)[x,y]=[y,-x];else if(angle===270)[x,y]=[-y,x];else if(angle===180){x=-x;y=-y}
window.FocusSky?.set(x,y);status.textContent='Telefonunu hafif eğ; gökyüzü hareketini takip eder.';
}
function detach(){if(listening)removeEventListener('deviceorientation',orientation);listening=false;clearTimeout(timeout);baseline=null;window.FocusSky?.set(0,0)}
function attach(){detach();if(!enabled||!mobile.matches||reduced.matches||document.hidden)return;addEventListener('deviceorientation',orientation,{passive:true});listening=true;timeout=setTimeout(()=>{if(!baseline){detach();enabled=false;label();status.textContent='Bu cihazdan hareket bilgisi alınamıyor. Normal arka planı kullanabilirsin.'}},2000)}
async function start(){
if(reduced.matches){status.textContent='Telefon ayarlarında azaltılmış hareket açık.';return}
if(typeof DeviceOrientationEvent==='undefined'){status.textContent='Telefon hareketi bu tarayıcıda desteklenmiyor.';return}
try{if(needsPermission&&await DeviceOrientationEvent.requestPermission()!=='granted'){status.textContent='Hareket izni verilmedi. Normal arka plan açık.';return}enabled=true;localStorage.setItem('focus_motion','on');label();attach()}catch(e){status.textContent='Hareket izni açılamadı. Telefonunun tarayıcısından deneyebilirsin.'}
}
button.onclick=()=>{if(enabled){enabled=false;localStorage.setItem('focus_motion','off');detach();label();status.textContent='Telefon hareketi kapalı.'}else return start()};
mobile.addEventListener('change',attach);reduced.addEventListener('change',attach);document.addEventListener('visibilitychange',attach);addEventListener('orientationchange',()=>{baseline=null});addEventListener('pagehide',detach);
label();if(!needsPermission&&preferred()&&mobile.matches&&!reduced.matches)start();
return {get active(){return enabled&&listening},start};
})();
