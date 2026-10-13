const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const base='android/app/src/main/java/io/github/focusforyou/app/';
test('Native sound bridge allows only alert and phase sound kinds and gates playback on the trusted page',()=>{
 const source=fs.readFileSync(base+'MainActivity.java','utf8');
 const bridge=source.split('@JavascriptInterface public void sound(String kind){')[1].split('@JavascriptInterface')[0];
 assert(bridge);assert.match(bridge,/!"alarm"\.equals\(kind\)&&!"nudge"\.equals\(kind\)&&!"focus"\.equals\(kind\)&&!"break"\.equals\(kind\)\)return/);
 assert.match(bridge,/runOnUiThread\(\(\)->\{if\(trustedPage\(\)\)FocusSound\.play\(kind\)/);
});
test('Native foreground completion predicate rings only once for an expired running focus phase',()=>{
 const source=fs.readFileSync(base+'FocusService.java','utf8');
 const java=source.match(/if\((running&&[^\n]+?)\)\{completionPlayed=true;FocusSound\.play\("alarm"\)/)[1];
 const js=java.replace('"Odak".equals(phase)',"phase==='Odak'").replace('SystemClock.elapsedRealtime()','now');
 const due=Function('running','phase','completionPlayed','end','now','return '+js);
 assert.equal(due(true,'Odak',false,1000,1000),true);
 assert.equal(due(true,'Odak',true,1000,2000),false);
 assert.equal(due(true,'Mola',false,1000,2000),false);
 assert.equal(due(false,'Odak',false,1000,2000),false);
 assert.equal(due(true,'Odak',false,3000,2000),false);
 const rearm=source.match(/if\((!running\|\|[^\n]+?)\)completionPlayed=false/)[1].replace('"Odak".equals(phase)',"(phase==='Odak')").replace('SystemClock.elapsedRealtime()','now');
 const reset=Function('running','phase','end','now','return '+rearm);
 assert.equal(reset(true,'Odak',1000,2000),false); // Late heartbeat cannot rearm an already-expired focus phase.
 assert.equal(reset(true,'Odak',300000,2000),true);
 assert.equal(reset(true,'Mola',2000,2000),true);
});
test('Web and service alerts share throttling and audio resources are released on success and failure',()=>{
 const source=fs.readFileSync(base+'FocusSound.java','utf8');
 assert.match(source,/static synchronized void play/);
 assert.match(source,/if\(now-\(alarm\?lastAlarm:lastNudge\)<1500\)return/);
 assert.match(source,/postDelayed\(playing::release,duration\+150\)/);
 assert.match(source,/if\(!started\)\{tone\.release\(\);return/);
 assert.match(source,/catch\(RuntimeException ignored\)\s*\{\s*if\(tone!=null\)tone\.release\(\)/);
});

