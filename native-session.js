'use strict';
// A single timer drives the page and Android notification actions.
window.FocusNative=(()=>{
let room='';
function pulse(){
 if(!window.FocusAndroid?.session||typeof Study==='undefined'||!Study.liveSession)return;
 const timer=Study.liveSession();
 const deadline=timer.running?Math.round((Date.now()+timer.left*1000)/1000)*1000:0;
 const active=timer.running||timer.left<timer.total||!!room;
 const remaining=Math.ceil(timer.left);
 window.FocusAndroid.session(active,timer.running,timer.phase==='break',deadline,remaining,room);
}
function toggle(){document.getElementById('tg')?.click();pulse()}
document.addEventListener('click',()=>queueMicrotask(pulse));
document.addEventListener('visibilitychange',pulse);
setInterval(pulse,1000);
function heartbeat(){pulse();if(document.hidden)window.FocusRoomHeartbeat?.()}
return {pulse,heartbeat,toggle,room:code=>{room=/^[1-9][0-9]{4}$/.test(code)?code:'';pulse()}};
})();
