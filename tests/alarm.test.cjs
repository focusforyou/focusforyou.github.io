const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(native=false){
 const events={},tones=[],nativeCalls=[];let clock=2000;
 class Audio{constructor(){this.state='suspended';this.currentTime=0;this.destination={}}resume(){this.state='running';return Promise.resolve()}createOscillator(){const tone={frequency:{},connect(){},disconnect(){tone.disconnected=true},start(){},stop(){tones.push(tone)}};return tone}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}}
 const context={document:{addEventListener:(n,f)=>events[n]=f},AudioContext:Audio,Date:{now:()=>clock},Promise};context.window=context;
 if(native)context.FocusAndroid={sound:kind=>nativeCalls.push(kind)};
 vm.runInNewContext(fs.readFileSync('alarm.js','utf8'),context);
 return {context,events,tones,nativeCalls,advance:()=>clock+=2000};
}
test('Alarm waits for user unlock, plays completion notes once, and cleans ended audio nodes',async()=>{
 const app=fixture();assert.equal(app.context.FocusSound.play('alarm'),false);
 await app.events.pointerdown();assert.equal(app.context.FocusSound.play('alarm'),true);assert.equal(app.tones.length,4);
 assert.equal(app.context.FocusSound.play('alarm'),false);app.tones[0].onended();assert.equal(app.tones[0].disconnected,true);
 app.advance();assert.equal(app.context.FocusSound.play('nudge'),true);assert.equal(app.tones.length,6);
});
test('Native alert works without browser AudioContext and rejects unknown sounds',()=>{
 const app=fixture(true);delete app.context.AudioContext;
 assert.equal(app.context.FocusSound.play('alarm'),true);assert.equal(app.nativeCalls[0],'alarm');
 assert.equal(app.context.FocusSound.play('anything'),false);
});
test('Pomodoro alerts both phase transitions once per catch-up and stays silent while paused',()=>{
 let now=0;const alerts=[];
 const source=fs.readFileSync('index.html','utf8').split('function syncTimer(){')[1].split("let timerVisual=")[0];
 const context={Date:{now:()=>now},run:1,lastT:0,left:1500,mode:'f',focusDuration:1500,breakDuration:300,sess:0,F:{f:0},grown:false,dead:false,lastS:0,consumeTasks(){},Study:{record(){}},persistTimer(){},FocusSound:{play:kind=>alerts.push(kind)}};context.window=context;
 vm.runInNewContext('function syncTimer(){'+source,context);
 now=1500000;context.syncTimer();assert.deepEqual(alerts,['break']);assert.equal(context.mode,'b');
 context.syncTimer();assert.deepEqual(alerts,['break']);
 now+=300000;context.syncTimer();assert.deepEqual(alerts,['break','focus']);assert.equal(context.mode,'f');
 now+=3600000;context.syncTimer();assert.deepEqual(alerts,['break','focus','focus']); // Catch-up only announces the final phase.
 context.run=0;now+=3600000;context.syncTimer();assert.deepEqual(alerts,['break','focus','focus']);
});

