'use strict';
(()=>{
 function sync(){const open=!!document.querySelector('dialog[open]');if(open===!!window.FocusOverlayOpen)return;window.FocusOverlayOpen=open;document.body.classList.toggle('overlay-open',open);window.dispatchEvent(new CustomEvent('focus-overlay-change',{detail:{open}}))}
 function init(){const observer=new MutationObserver(sync);observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});sync()}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
