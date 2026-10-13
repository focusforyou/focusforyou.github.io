const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('Android visible viewport keeps fixed controls above the hidden bottom and restores after resize',()=>{
 const events={},styles={},frames=[],viewport={height:720,width:390,offsetTop:0,scale:1,addEventListener:(name,fn)=>events[name]=fn};
 const window={innerHeight:844,visualViewport:viewport,addEventListener:(name,fn)=>events['window:'+name]=fn};
 const doc={documentElement:{style:{setProperty:(name,value)=>styles[name]=value},toggleAttribute:(name,value)=>styles[name]=value},addEventListener:(name,fn)=>events[name]=fn};
 vm.runInNewContext(fs.readFileSync('mobile-viewport.js','utf8'),{window,document:doc,requestAnimationFrame:fn=>{frames.push(fn);return frames.length}});
 assert.equal(styles['--mobile-viewport-bottom'],'124px');viewport.height=844;events.resize();events.scroll();assert.equal(frames.length,1);frames.shift()();assert.equal(styles['--mobile-viewport-bottom'],'0px');
 viewport.height=500;viewport.scale=2;events.resize();frames.shift()();assert.equal(styles['--mobile-viewport-bottom'],'0px');
 viewport.scale=1;viewport.offsetTop=40;events.resize();frames.shift()();assert.equal(styles['--mobile-viewport-bottom'],'304px');
 doc.activeElement={matches:()=>true};events.focusin();frames.shift()();assert.equal(styles['data-mobile-keyboard'],true);assert.equal(styles['--mobile-viewport-height'],'500px');
 doc.activeElement=null;events.focusout();frames.shift()();assert.equal(styles['data-mobile-keyboard'],false);
});

