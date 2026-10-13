const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('Android visible viewport keeps fixed controls above the hidden bottom and restores after resize',()=>{
 const events={},styles=[],frames=[],viewport={height:720,offsetTop:0,scale:1,addEventListener:(name,fn)=>events[name]=fn};
 const window={innerHeight:844,visualViewport:viewport,addEventListener:(name,fn)=>events['window:'+name]=fn};
 vm.runInNewContext(fs.readFileSync('mobile-viewport.js','utf8'),{window,document:{documentElement:{style:{setProperty:(name,value)=>styles.push(value)}}},requestAnimationFrame:fn=>{frames.push(fn);return frames.length}});
 assert.equal(styles.at(-1),'124px');viewport.height=844;events.resize();events.scroll();assert.equal(frames.length,1);frames.shift()();assert.equal(styles.at(-1),'0px');
 viewport.height=500;viewport.scale=2;events.resize();frames.shift()();assert.equal(styles.at(-1),'0px');
 viewport.scale=1;viewport.offsetTop=40;events.resize();frames.shift()();assert.equal(styles.at(-1),'304px');
});

