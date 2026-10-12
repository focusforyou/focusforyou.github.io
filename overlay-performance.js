'use strict';
(()=>{
 function sync(){const open=!!document.querySelector((window.innerWidth||0)>=900?'dialog[open],.friends-popover:not([hidden])':'dialog[open]');if(open===!!window.FocusOverlayOpen)return;window.FocusOverlayOpen=open;document.body.classList.toggle('overlay-open',open);window.dispatchEvent(new CustomEvent('focus-overlay-change',{detail:{open}}))}
 function init(){const observer=new MutationObserver(sync);observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});const friends=document.querySelector('.friends-popover');if(friends)new MutationObserver(sync).observe(friends,{attributes:true,attributeFilter:['hidden']});sync()}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
