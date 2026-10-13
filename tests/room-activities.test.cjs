const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const M=require('../room-activities-model.js');
test('shared Pomodoro projects focus, break and later rounds without drift or personal timer writes',()=>{
 const s={focus:1500,rest:300,status:'running',startedAt:100000};
 assert.deepEqual(M.phase(s,100000),{phase:'focus',left:1500,round:1});
 assert.deepEqual(M.phase(s,1600000),{phase:'break',left:300,round:1});
 assert.deepEqual(M.phase(s,1900000),{phase:'focus',left:1500,round:2});
 assert.deepEqual(M.phase({...s,status:'ready'},999999),{phase:'ready',left:1500,round:0});
 const ui=fs.readFileSync('room-activities.js','utf8');assert(!ui.includes('Study.changeDurations'));assert(!ui.includes("getElementById('tg')"));
});
test('appointment bounds reject invalid/past dates, accept future local timestamp and cap titles',()=>{
 const now=1700000000000;for(const time of [NaN,now,now+59999,now+91*86400000])assert.throws(()=>M.event('Çalışma',time,now));
 assert.throws(()=>M.event(' ',now+120000,now));assert.equal(M.event('x'.repeat(90),now+120000,now).title.length,80);
 assert.equal(M.duration(25,180),1500);for(const n of [0,181,2.5,NaN])assert.throws(()=>M.duration(n,180));
});
test('room goal contributions accumulate only the current goal and retain others device progress',()=>{
 assert.equal(M.contribution({goalId:'weekA',seconds:300},'weekA',60),360);
 assert.equal(M.contribution({goalId:'weekA',seconds:300},'weekB',60),60);
 assert.equal(M.contribution({goalId:'weekB',seconds:300},'weekB',-60),300);
 assert.equal(M.contribution({goalId:'weekB',seconds:604790},'weekB',60),604800);
});
test('native appointment bridge validates trusted origin and uses device-local non-exact immutable alarms',()=>{
 const base='android/app/src/main/java/io/github/focusforyou/app/',java=fs.readFileSync(base+'FocusReminder.java','utf8'),main=fs.readFileSync(base+'MainActivity.java','utf8');
 assert.match(java,/setAndAllowWhileIdle\(AlarmManager.RTC_WAKEUP/);assert(!java.includes('setExact'));assert.match(java,/FLAG_IMMUTABLE/);assert.match(java,/p.getAll\(\).size\(\)>=64/);assert.match(java,/POST_NOTIFICATIONS/);assert.match(java,/ACTION_BOOT_COMPLETED/);
 assert.match(main,/scheduleStudyReminder\(String key,long when,String title\).*runOnUiThread/);
 const bridge=main.split('scheduleStudyReminder(')[1].split('@JavascriptInterface')[0];assert.match(bridge,/if\(!trustedPage\(\)\)return/);assert.match(bridge,/if\(resumed&&android.os.Build.VERSION.SDK_INT>=33/);
});
