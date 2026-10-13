'use strict';
(()=>{
 const viewport=window.visualViewport;if(!viewport)return;
 const root=document.documentElement;let frame=0,baseline=viewport.height,lastWidth=viewport.width;
 const saved=new Map();
 function property(name,value){if(saved.get(name)===value)return;saved.set(name,value);root.style.setProperty(name,value)}
 function sync(){
  frame=0;const scaled=viewport.scale>1.05,active=document.activeElement,editing=!!active?.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]),textarea,[contenteditable=true]');
  if(Math.abs(viewport.width-lastWidth)>40){baseline=viewport.height;lastWidth=viewport.width}else if(!editing&&!scaled)baseline=Math.max(baseline,viewport.height);
  const bottom=scaled?0:Math.max(0,Math.round(window.innerHeight-viewport.height-viewport.offsetTop));
  property('--mobile-viewport-bottom',bottom+'px');property('--mobile-viewport-height',Math.round(viewport.height)+'px');property('--mobile-viewport-top',Math.round(viewport.offsetTop)+'px');
  root.toggleAttribute('data-mobile-keyboard',!scaled&&editing&&baseline-viewport.height>140);
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(sync)}
 viewport.addEventListener('resize',schedule);viewport.addEventListener('scroll',schedule);window.addEventListener('resize',schedule);window.addEventListener('pageshow',schedule);document.addEventListener('focusin',schedule);document.addEventListener('focusout',schedule);sync();
})();
