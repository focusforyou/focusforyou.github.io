const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs');
const base='android/app/src/main/java/io/github/focusforyou/app/';
const source=name=>fs.readFileSync(base+name+'.java','utf8');
test('Nudge destinations use validated room IDs, never a remote-message URL',()=>{
 const push=source('FocusPush');
 const regex=new RegExp('^'+push.match(/room\.matches\("([^"]+)"\)/)[1]+'$');
 for(const id of ['YKS','LGS','TUS','12345','12345678','abcdefghijklmnopqrst']) assert(regex.test(id),id);
 for(const id of ['https://evil.test','YKS?redirect=x','TUS#x','../x','<script>','123456789']) assert(!regex.test(id),id);
 assert.match(push,/appendQueryParameter\("club", room\)\.fragment\("lobi"\)/);
 assert.match(push,/intent\.getStringExtra\("roomId"\)/);
 assert(!push.includes('intent.getData()'));
 const main=source('MainActivity');
 assert.match(main,/onNewIntent\(Intent intent\).*FocusPush\.destination\(intent\).*web\.loadUrl\(destination\)/);
 assert.match(main,/if\(pushDestination!=null\)web\.loadUrl\(pushDestination\)/);
});
test('Token delivery rechecks trust after asynchronous refresh and escapes script data',()=>{
 const main=source('MainActivity');
 const bridge=main.split('@JavascriptInterface public void pushToken()')[1].split('@JavascriptInterface')[0];
 assert.match(bridge,/if\(!trustedPage\(\)\|\|!resumed\)return/);
 assert.match(bridge,/if\(!FocusPush\.initialize\(MainActivity.this\)\)\{pushResult\(""\);return/);
 assert.match(main,/private void pushResult\(String token\).*runOnUiThread.*if\(trustedPage\(\)\).*FocusPush\?\.receiveToken.*JSONObject\.quote\(token\)/);
 assert.match(main,/request==202.*PERMISSION_GRANTED&&trustedPage\(\)/);
 assert.match(source('FocusMessagingService'),/onNewToken\(String token\).*FocusPush\.saveToken\(this, token\)/);
 assert.match(source('FocusPush'),/task\.isSuccessful\(\).*saveToken\(context, token\)/);
});
test('Native push remains disabled when any public Android Firebase setting is missing',()=>{
 const push=source('FocusPush'), gradle=fs.readFileSync('android/app/build.gradle','utf8');
 for(const key of ['APP_ID','API_KEY','PROJECT_ID','SENDER_ID']){
  assert(push.includes('BuildConfig.FIREBASE_'+key+'.isEmpty()'));
  assert(gradle.includes("System.getenv('FOCUS_FIREBASE_"+key+"')"));
 }
 assert.match(gradle,/mobilesdk_app_id/);
 assert.match(push,/FIREBASE_APP_ID\.matches\("1:\[0-9\]\+:android:/);
 assert.match(gradle,/google-services\.json must contain io\.github\.focusforyou\.app/);
 assert.match(source('FocusApplication'),/onCreate\(\).*\{[\s\S]*FocusPush\.initialize\(this\)/);
 const manifest=fs.readFileSync('android/app/src/main/AndroidManifest.xml','utf8');
 assert.match(manifest,/firebase_messaging_auto_init_enabled" android:value="false"/);
 assert.match(manifest,/\.FocusMessagingService" android:exported="false"/);
 assert.match(manifest,/default_notification_channel_id" android:value="focus_nudges"/);
});
test('Foreground alerts respect notification permissions and persist bounded replay protection',()=>{
 const service=source('FocusMessagingService'), push=source('FocusPush');
 assert(service.indexOf('POST_NOTIFICATIONS')<service.indexOf('rememberNudge(this, id)'));
 assert(service.indexOf('areNotificationsEnabled()')<service.indexOf('rememberNudge(this, id)'));
 assert.match(service,/manager\.notify\(id, 2,/);
 assert.match(service,/@" \+ username \+ " seni dürttü!/);
 assert.match(service,/FLAG_UPDATE_CURRENT \| PendingIntent.FLAG_IMMUTABLE/);
 assert.match(push,/if \(ids\.contains\(id\)\) return false/);
 assert.match(push,/while \(ids\.size\(\) > 64\) ids\.remove\(0\)/);
 assert.match(push,/putString\("seen_nudges", String\.join\(",", ids\)\)\.commit\(\)/);
 const username=new RegExp('^'+service.match(/username\.matches\("([^"]+)"\)/)[1]+'$');
 assert(username.test('efe')); assert(!username.test('efe\nadmin')); assert(!username.test('<script>'));
});
test('FCM sound is suppressed only when the trusted visible Activity receives the same room nudge live',()=>{
 const push=source('FocusPush'),main=source('MainActivity'),service=source('FocusMessagingService');
 const predicate=push.match(/static boolean foregroundReceives\(String room\) \{ return (.*?); \}/)[1]
  .replace('!room.isEmpty()','room.length>0').replace('room.equals(foregroundRoom)','room===foregroundRoom');
 const silent=Function('room','foregroundRoom','return '+predicate);
 assert.equal(silent('YKS','YKS'),true);assert.equal(silent('TUS','YKS'),false);assert.equal(silent('YKS',''),false);assert.equal(silent('',''),false);assert.equal(silent(null,'YKS'),false);
 assert.match(push,/private static volatile String foregroundRoom/);
 assert.match(service,/\.setSilent\(FocusPush\.foregroundReceives\(room\)\)/);
 assert.match(main,/updatePushForegroundRoom\(\)\{FocusPush\.setForegroundRoom\(resumed&&trustedPage\(\)\?sessionRoom:""\)/);
 assert.match(main,/sessionRoom=active\?code:"";updatePushForegroundRoom\(\);/);
 assert.match(main,/onPageStarted.*sessionRoom="";updatePushForegroundRoom\(\)/);
 for(const lifecycle of ['onPause','onDestroy'])assert.match(main,new RegExp(lifecycle+'\\(\\).*resumed=false;updatePushForegroundRoom\\(\\)'));
 assert.match(main,/onResume\(\).*resumed=true;updatePushForegroundRoom\(\)/);
});
