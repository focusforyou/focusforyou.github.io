import {pushEndpoint} from './firebase-config.js?v=appcheck1';

// FCM tokens stay in the native bridge and the private push service, never Firestore.
export function initPush({auth}){
 const endpoint=typeof pushEndpoint==='string'&&/^https:\/\/[a-z0-9.-]+\.workers\.dev$/.test(pushEndpoint)?pushEndpoint:'';
 let deviceId=localStorage.getItem('focus_push_device');
 if(!/^[A-Za-z0-9_-]{8,64}$/.test(deviceId||'')){deviceId=crypto.randomUUID();localStorage.setItem('focus_push_device',deviceId)}
 let owner=null,revision=0,token='',registered='',registering=null,retry=null,suspended=false;
 function current(user,rev){if(rev!==revision||auth.currentUser?.uid!==user?.uid)throw Error('account-changed')}
 async function request(path,body,user=owner,rev=revision){
  if(!endpoint)throw Error('push-not-configured');if(!user)throw Error('push-no-account');
  const idToken=await user.getIdToken();current(user,rev);
  const appToken=await window.FocusAppProtection?.token?.()||'';current(user,rev);
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch(endpoint+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+idToken,...(appToken?{'X-Firebase-AppCheck':appToken}:{})},body:JSON.stringify(body),signal:controller.signal});current(user,rev);if(!response.ok)throw Error('push-http-'+response.status);const result=await response.json();current(user,rev);return result}
  finally{clearTimeout(timeout)}
 }
 async function register(){
  if(suspended||!endpoint||!owner?.emailVerified||!token)return false;
  const user=owner,rev=revision,key=user.uid+':'+token;
  if(registered===key)return true;if(registering?.rev===rev){if(registering.key===key)return registering.promise;await registering.promise.catch(()=>{});current(user,rev);return register()}
  const job={key,rev,promise:null};job.promise=(async()=>{await request('/register',{deviceId,token},user,rev);current(user,rev);registered=key;return true})();registering=job;
  try{return await job.promise}finally{if(registering===job)registering=null}
 }
 function schedule(){const rev=revision;clearTimeout(retry);void register().catch(()=>{if(rev===revision&&!suspended&&owner?.emailVerified)retry=setTimeout(()=>schedule(),60000)})}
 async function bind(user){revision++;owner=user;registered='';registering=null;suspended=false;clearTimeout(retry);if(!user?.emailVerified)return;window.FocusAndroid?.pushToken?.();schedule()}
 async function cleanup(path,user){if(!endpoint||!user)return;const rev=revision;suspended=true;clearTimeout(retry);if(registering?.rev===rev)await registering.promise.catch(()=>{});current(user,rev);try{await request(path,path==='/unregister'?{deviceId}:{},user,rev);registered=''}catch(e){if(rev===revision)suspended=false;throw e}}
 async function unregister(){await cleanup('/unregister',owner)}
 async function erase(user){await cleanup('/delete-account',user)}
 window.FocusPush={
  bind,unregister,erase,
  receiveToken(value){token=typeof value==='string'&&value.length>=20&&value.length<=4096?value:'';if(token)schedule()},
  async send(roomId,targetUid){if(!endpoint)return false;await request('/send',{roomId,targetUid});return true},
  async invite(roomId,targetUid){if(!endpoint)return false;await request('/invite',{roomId,targetUid});return true}
 };
 addEventListener('online',()=>{if(owner?.emailVerified){window.FocusAndroid?.pushToken?.();schedule()}});
 return window.FocusPush;
}
