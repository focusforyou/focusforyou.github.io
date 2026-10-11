const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('notification follows timer, paused state, room leave and background actions',()=>{
 const calls=[],listeners={},timer={running:false,phase:'focus',left:1500,total:1500};let toggleCount=0,roomPulses=0;
 const document={hidden:false,addEventListener:(e,fn)=>listeners[e]=fn,getElementById:()=>({click(){toggleCount++;timer.running=!timer.running;}})};
 const window={FocusAndroid:{session:(...args)=>calls.push(args)},FocusRoomHeartbeat:()=>roomPulses++};
 const context=vm.createContext({window,document,Study:{liveSession:()=>timer},Date:{now:()=>100000},setInterval(){},queueMicrotask:fn=>fn()});
 vm.runInContext(fs.readFileSync('native-session.js','utf8'),context);
 const api=window.FocusNative;
 api.pulse();assert.equal(calls.at(-1)[0],false);
 timer.running=true;api.pulse();assert.deepEqual(calls.at(-1),[true,true,false,1600000,1500,'']);
 timer.left=1490;api.toggle();assert.equal(toggleCount,1);assert.deepEqual(calls.at(-1),[true,false,false,0,1490,'']);
 api.toggle();assert.equal(timer.running,true);
 timer.phase='break';timer.left=300;timer.total=300;api.pulse();assert.equal(calls.at(-1)[2],true);
 timer.running=false;api.room('12345');assert.equal(calls.at(-1)[0],true);assert.equal(calls.at(-1)[5],'12345');
 document.hidden=true;api.heartbeat();assert.equal(roomPulses,1);
 api.room('');assert.equal(calls.at(-1)[0],false);
 api.room('invalid');assert.equal(calls.at(-1)[5],'');
 for(const room of ['12345678','YKS','TUS','LGS','legacy_room_123456789']){
  api.room(room);assert.equal(calls.at(-1)[0],true);assert.equal(calls.at(-1)[5],room);
 }
 for(const room of ['01234567','123456','<script>','x'.repeat(41)]){
  api.room(room);assert.equal(calls.at(-1)[5],'');
 }
 delete window.FocusAndroid;assert.doesNotThrow(()=>api.pulse());
});

test('Android bridge validates all supported room identifiers',()=>{
 const source=fs.readFileSync('android/app/src/main/java/io/github/focusforyou/app/MainActivity.java','utf8');
 const pattern=source.match(/room\.matches\("([^"]+)"\)/)[1];
 const valid=new RegExp('^(?:'+pattern+')$');
 for(const room of ['12345','12345678','TUS','legacy_room_123456789'])assert.equal(valid.test(room),true);
 for(const room of ['01234567','123456','malicious\nroom'])assert.equal(valid.test(room),false);
});

