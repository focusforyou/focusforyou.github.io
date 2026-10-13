'use strict';
(()=>{
 const viewport=window.visualViewport;if(!viewport)return;
 let frame=0,last=-1;
 function sync(){frame=0;const bottom=viewport.scale>1.05?0:Math.max(0,Math.round(window.innerHeight-viewport.height-viewport.offsetTop));if(bottom===last)return;last=bottom;document.documentElement.style.setProperty('--mobile-viewport-bottom',bottom+'px')}
 function schedule(){if(!frame)frame=requestAnimationFrame(sync)}
 viewport.addEventListener('resize',schedule);viewport.addEventListener('scroll',schedule);window.addEventListener('resize',schedule);window.addEventListener('pageshow',schedule);sync();
})();

