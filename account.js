import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {getAuth,setPersistence,browserLocalPersistence,GoogleAuthProvider,EmailAuthProvider,reauthenticateWithPopup,reauthenticateWithCredential,signInWithPopup,signInWithCredential,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendEmailVerification,sendPasswordResetEmail,signOut,onAuthStateChanged,reload,getIdToken} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import {getFirestore,doc,getDocFromServer,getDocsFromServer,collection,onSnapshot,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import {initializeAppCheck,ReCaptchaEnterpriseProvider} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app-check.js';
import {firebaseConfig,googleClientId,appCheckSiteKey} from './firebase-config.js';
import {eraseAccount} from './account-delete.js?v=3';
import {initSocial} from './social.js?v=roster4';

const app=initializeApp(firebaseConfig);
// Enable only after the matching web provider is registered in Firebase.
// The APK uses this same web app through HTTPS; do not bypass attestation there.
if(appCheckSiteKey)initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(appCheckSiteKey),isTokenAutoRefreshEnabled:true});
const by=id=>document.getElementById(id),auth=getAuth(app),db=getFirestore();auth.languageCode='tr';
const persistenceReady=setPersistence(auth,browserLocalPersistence);persistenceReady.catch(()=>message('Oturum bu tarayıcıda kalıcı saklanamadı. Tarayıcının site verileri iznini kontrol et.'));
let uid='',cache={days:{},dirty:{}},base=null,devices=new Map(),devicesLoaded=false,unsub=[],generation=0,syncing=false,ready=false,observed={},avatar='',profile={uid:'',name:'',photo:''};
let socialReadyUid='',loginIntent=false,loginPendingUid='';
let onlineBanned=false;
let deleting=false,deletionLocked=false,nativeDeleteUid='';
const storedDeviceId=localStorage.getItem('focus_device_id');
const deviceId=/^[A-Za-z0-9_-]{8,64}$/.test(storedDeviceId||'')?storedDeviceId:crypto.randomUUID();localStorage.setItem('focus_device_id',deviceId);
const message=value=>by('accountStatus').textContent=value;
const json=value=>JSON.parse(JSON.stringify(value));
function saveCache(){if(uid)try{localStorage.setItem('focus_account_'+uid,JSON.stringify(cache))}catch(e){message('Cihaz hafızası dolu. Kayıtların buluta ulaşması için internet bağlantını açık tut.')}}
function fields(){return window.FocusData?.fields()||{}}
function watchChanges(){if(!uid||deleting||deletionLocked)return;for(const [key,value] of Object.entries(fields()))if(value!==observed[key]){cache.dirty[key]=value;observed[key]=value}cache.observed={...observed};saveCache()}
function renderProfile(){
 by('openAccount').textContent=auth.currentUser?'Profilim':'Giriş yap';
 by('accountGuest').hidden=!!auth.currentUser;by('accountMember').hidden=!auth.currentUser;
 by('verifyAccount').hidden=!auth.currentUser||auth.currentUser.emailVerified;
 by('profileControls').hidden=!auth.currentUser?.emailVerified;
 by('accountEmail').textContent=auth.currentUser?.email||'';
 window.FocusAccountUI?.resolved(auth.currentUser);
 try{if(auth.currentUser)localStorage.setItem('focus_profile_label',profile.name.slice(0,30)||'Profilim');else localStorage.removeItem('focus_profile_label')}catch(e){}
 if(by('deletePasswordRow'))by('deletePasswordRow').hidden=!auth.currentUser?.providerData?.some(p=>p.providerId==='password');
 if(document.activeElement!==by('profileName'))by('profileName').value=profile.name;
 by('profileAvatar').hidden=!profile.photo;
 if(profile.photo)by('profileAvatar').src=profile.photo;else by('profileAvatar').removeAttribute('src');
 window.dispatchEvent(new Event('focus-profile'));
}
function settleAccountUI(){
 if(!uid||!ready||!base||!devicesLoaded||socialReadyUid!==uid||!auth.currentUser?.emailVerified||onlineBanned||deleting||deletionLocked)return;
 if(window.FocusSocial.needsIdentity?.()){window.FocusAccountUI?.onboarding();return}
 if(loginPendingUid===uid){window.FocusAccountUI?.closeLogin();if(window.location)window.location.hash='calisma';loginPendingUid='';loginIntent=false}
}
function acknowledgeFields(){const own=devices.get(deviceId);for(const [key,value] of Object.entries(cache.dirty))if(own?.[key]?.value===value)delete cache.dirty[key]}
function applyCloud(){
 if(!base||!devicesLoaded||syncing||!uid||deleting||deletionLocked)return;
 watchChanges();
 const rows=[...devices].filter(([id])=>id!==deviceId).map(([,d])=>d),own=devices.get(deviceId)||{days:{}};
 for(const [key,n] of Object.entries(CloudModel.days(own.days)))cache.days[key]=Math.max(cache.days[key]||0,n);
 rows.push({...own,days:cache.days});const merged=CloudModel.combine(base,rows);
 Study.applyDays(merged.days);
 const updates={};for(const key of CloudModel.keys)if(!Object.hasOwn(cache.dirty,key)&&typeof merged.fields[key]==='string')updates[key]=merged.fields[key];
 window.FocusData?.apply(updates);observed=fields();cache.observed={...observed};
 profile=CloudModel.profile({...base.profile,uid});avatar=profile.photo;renderProfile();saveCache();settleAccountUI();
}
async function sync(){
 if(!uid||syncing||!ready||deleting||deletionLocked||onlineBanned)return;watchChanges();const owner=uid,revision=generation,target=doc(db,'users',uid,'devices',deviceId),counts=json(cache.days),dirty={...cache.dirty};
 const last=devices.get(deviceId)?.days||{};if(!Object.keys(dirty).length&&JSON.stringify(counts)===JSON.stringify(last))return;
 syncing=true;
 try{
  const result=await runTransaction(db,async tx=>{
   const snap=await tx.get(target),existing=snap.exists()?snap.data():{days:{}};
   const days=CloudModel.days(existing.days);for(const [date,n] of Object.entries(counts))days[date]=Math.max(days[date]||0,n);
   const next={...existing,days};for(const [key,value] of Object.entries(dirty))if(CloudModel.keys.includes(key))next[key]={value,at:serverTimestamp()};
   tx.set(target,next);return days;
  });
  if(owner!==uid||revision!==generation)return;
  for(const [date,n] of Object.entries(result))cache.days[date]=Math.max(cache.days[date]||0,n);
  acknowledgeFields();
  message('Bulut kayıtların güncel.');saveCache();
 }catch(e){if(owner===uid)message('Buluta şu an ulaşılamıyor. Değişikliklerin cihazda tutuluyor; bağlantı gelince tekrar denenecek.')}
 finally{syncing=false;if(owner===uid)applyCloud()}
}
async function bind(user){
 if(deleting)return;
 window.FocusSocial?.stop();
 deletionLocked=false;
 const previous=localStorage.getItem('focus_current_uid')||'',next=user?.emailVerified?user.uid:'';
 if(previous&&previous!==next){try{const guest=JSON.parse(localStorage.getItem('focus_guest_backup')||'null');if(guest){Study.applyDays(guest.days);window.FocusData?.apply(guest.fields)}}catch(e){}}
 if(next)localStorage.setItem('focus_current_uid',next);else localStorage.removeItem('focus_current_uid');
 generation++;const revision=generation;for(const stop of unsub)stop();unsub=[];ready=false;base=null;devices=new Map();devicesLoaded=false;uid='';
 socialReadyUid='';if(user&&(loginIntent||window.FocusAccountUI?.mode==='login'))loginPendingUid=user.uid;if(!user){loginPendingUid='';loginIntent=false}
 profile=CloudModel.profile({uid:user?.uid,name:user?.displayName||'Odak arkadaşı',photo:''});avatar=profile.photo;renderProfile();
 onlineBanned=false;
 if(!user){message('Giriş yapınca ilerlemen cihazların arasında otomatik eşitlenir.');return}
 try{const lockRef=doc(db,'deletions',user.uid),lock=await getDocFromServer(lockRef);if(revision!==generation)return;if(lock.exists()){deletionLocked=true;ready=false;clearAccountDevice(user.uid);message('Yarım kalan hesap silme işlemi sürdürülüyor…');await finishDeletion(user);return}unsub.push(onSnapshot(lockRef,snap=>{if(revision!==generation||deleting||!snap.exists())return;receiveDeletion(user.uid);},()=>{}));}catch(e){if(e.code!=='permission-denied'){message('Hesap durumu sunucudan doğrulanamadı. İnternet bağlantını kontrol et.');return}}
 const ban=await getDocFromServer(doc(db,'appBans',user.uid));if(revision!==generation)return;onlineBanned=ban.exists()&&user.email!=='efeozbilgin550@gmail.com';if(onlineBanned){uid=user.uid;window.FocusSocial.bind(user).catch(failure);message('Çevrimiçi özelliklerin yasaklandı. Kişisel sayacını kullanabilir, verilerini indirebilir veya hesabını silebilirsin.');return}
 if(!user.emailVerified){message('Bulut kayıtlarını kullanmak için e-postanı doğrula, ardından Doğruladım’a bas.');return}
 uid=user.uid;try{cache=JSON.parse(localStorage.getItem('focus_account_'+uid)||'null')||{days:{},dirty:{}}}catch(e){cache={days:{},dirty:{}}}
 cache.days=CloudModel.days(cache.days);cache.dirty=cache.dirty&&typeof cache.dirty==='object'?cache.dirty:{};
 observed=fields();for(const [key,value] of Object.entries(observed))if(typeof cache.observed?.[key]==='string'&&value!==cache.observed[key])cache.dirty[key]=value;cache.observed={...observed};saveCache();
 const ref=doc(db,'users',uid,'meta','main');
 if(!cache.seed){const initial=CloudModel.days(Study.snapshot().days);for(const [date,n] of Object.entries(cache.days))initial[date]=Math.max(0,(initial[date]||0)-n);cache.seed={days:initial,fields:fields()};saveCache()}
 const seed={...cache.seed,profile};
 if(!localStorage.getItem('focus_guest_backup'))localStorage.setItem('focus_guest_backup',JSON.stringify(seed));
 message('Hesabın ve kayıtların yükleniyor…');
 try{
  await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())tx.set(ref,seed)});
  if(revision!==generation)return;ready=true;observed=fields();
  window.FocusSocial.bind(user).catch(()=>message('Sosyal odalara erişilemiyor. Firebase oda kurallarının yayımlandığını kontrol et.')); 
  unsub.push(onSnapshot(ref,snap=>{if(revision!==generation||!snap.exists())return;base=snap.data();applyCloud();message('Bulut kayıtların açık; değişiklikler otomatik kaydedilir.')},()=>{ready=false;renderProfile();message('Bulut kayıtlarına erişilemiyor. Kayıtların cihazda duruyor.')}));
  unsub.push(onSnapshot(collection(db,'users',uid,'devices'),snap=>{if(revision!==generation)return;watchChanges();devices=new Map(snap.docs.map(d=>[d.id,d.data()]));devicesLoaded=true;acknowledgeFields();applyCloud()},()=>message('Bulut kayıtlarına bağlantı kesildi; cihaz kayıtları korunuyor.')));
 }catch(e){message('Hesap açık, fakat bulut kayıtları henüz bağlanamadı. Cihaz kayıtların korunuyor.');renderProfile()}
}
function failure(error){if(error?.message==='account-changed')return;const code=error?.code||'';message(error?.message==='username-taken'?'Bu kullanıcı adı alınmış. Başka bir @kullanıcıadı seç.':error?.message==='invalid-username'?'3–24 küçük harf, rakam veya alt çizgiden oluşan bir @kullanıcıadı yaz.':code.includes('popup-closed')?'Giriş penceresi kapatıldı.':code.includes('invalid-credential')?'E-posta veya şifre doğru değil.':code.includes('email-already-in-use')?'Bu e-posta zaten kayıtlı. Giriş yapmayı veya şifre sıfırlamayı dene.':code.includes('weak-password')?'En az 8 karakterlik güçlü bir şifre seç.':code.includes('too-many-requests')?'Çok fazla deneme oldu. Biraz bekleyip tekrar dene.':code.includes('unauthorized-domain')?'Bu sitenin Google giriş ayarı henüz tamamlanmadı.':'İşlem tamamlanamadı. Bağlantını kontrol edip tekrar dene.')}
async function busy(fn){const controls=['googleLogin','emailLogin','emailRegister','saveProfile','removeProfilePhoto','exportAccount','deleteAccount','logoutAccount'];for(const id of controls)if(by(id))by(id).disabled=true;try{await fn()}catch(e){failure(e)}finally{for(const id of controls)if(by(id))by(id).disabled=false}}
by('googleLogin').onclick=()=>busy(async()=>{
 loginIntent=true;window.FocusAccountUI?.beginLogin();await persistenceReady;
 if(window.FocusAndroid){if(!window.FocusAndroid.googleSignIn){message('APK’de Google girişi için uygulamayı en yeni sürüme güncelle. E-postayla giriş şu anda kullanılabilir.');return}window.FocusAndroid.googleSignIn(googleClientId);return}
 await signInWithPopup(auth,new GoogleAuthProvider());
});
window.FocusGoogleResult=async(token,error)=>{const owner=nativeDeleteUid;nativeDeleteUid='';if(error){message(error);return}await busy(async()=>{if(owner){if(auth.currentUser?.uid!==owner)throw Error('account-changed');await reauthenticateWithCredential(auth.currentUser,GoogleAuthProvider.credential(token));await finishDeletion(auth.currentUser)}else{loginIntent=true;window.FocusAccountUI?.beginLogin();await persistenceReady;await signInWithCredential(auth,GoogleAuthProvider.credential(token))}})};
const credentials=()=>({email:by('loginEmail').value.trim(),password:by('loginPassword').value});
by('emailLogin').onclick=()=>busy(async()=>{const c=credentials();loginIntent=true;window.FocusAccountUI?.beginLogin();await persistenceReady;await signInWithEmailAndPassword(auth,c.email,c.password);by('loginPassword').value=''});
by('emailRegister').onclick=()=>busy(async()=>{const c=credentials();if(c.password.length<8){message('Şifren en az 8 karakter olmalı.');return}loginIntent=true;window.FocusAccountUI?.beginLogin();await persistenceReady;const result=await createUserWithEmailAndPassword(auth,c.email,c.password);by('loginPassword').value='';await sendEmailVerification(result.user);message('Doğrulama e-postası gönderildi. Gelen kutunu ve spam klasörünü kontrol et.')});
by('resetPassword').onclick=()=>busy(async()=>{const email=by('loginEmail').value.trim();if(!email){message('Önce e-posta adresini yaz.');return}await sendPasswordResetEmail(auth,email);message('Hesap varsa şifre sıfırlama e-postası gönderildi. Gelen kutunu kontrol et.')});
by('verifyAccountButton').onclick=()=>busy(async()=>{await reload(auth.currentUser);await getIdToken(auth.currentUser,true);await bind(auth.currentUser)});
by('resendVerification').onclick=()=>busy(async()=>{if(auth.currentUser&&!auth.currentUser.emailVerified){await sendEmailVerification(auth.currentUser);message('Doğrulama e-postası tekrar gönderildi.')}});
by('logoutAccount').onclick=()=>busy(async()=>{if(Study.liveSession?.().running){message('Çıkış yapmadan önce sayacı duraklat.');return}await sync();saveCache();await window.FocusSocial?.pauseRoom();window.FocusTemporaryRoom?.leaveNow();await signOut(auth);window.FocusAndroid?.clearGoogleSession?.()});
by('profilePhoto').onchange=async e=>{
 if(!by('profilePhotoConsent').checked){message('Fotoğrafını saklamak ve katıldığın odada göstermek için fotoğraf onayını işaretle.');e.target.value='';return}
 const file=e.target.files[0];if(!file)return;if(!file.type.startsWith('image/')||file.size>20*1024*1024){message('20 MB’tan küçük bir fotoğraf seç.');return}const owner=uid,revision=generation;let bitmap;
 try{bitmap=await createImageBitmap(file);if(owner!==uid||revision!==generation)return;const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),size=Math.min(bitmap.width,bitmap.height);ctx.fillStyle='#fff';ctx.fillRect(0,0,128,128);ctx.drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,128,128);avatar=canvas.toDataURL('image/jpeg',.8);if(!CloudModel.photo(avatar))throw Error();by('profileAvatar').src=avatar;by('profileAvatar').hidden=false;message('Fotoğraf hazır. Profilini kaydet’e bas.')}catch(e){if(owner===uid&&revision===generation)message('Fotoğraf açılamadı. JPEG veya PNG ile tekrar dene.')}finally{bitmap?.close();if(owner===uid&&revision===generation)e.target.value=''}
};
by('saveProfile').onclick=()=>busy(async()=>{
 if(!uid||!ready){message('Önce bulut kayıtlarının bağlanmasını bekle.');return}
 const name=by('profileName').value.trim();if(!name||name.length>30){message('1–30 karakterlik bir görünen ad yaz.');return}
 if(avatar!==profile.photo&&avatar&&!by('profilePhotoConsent').checked){message('Yeni fotoğraf için fotoğraf onayını işaretle.');return}
 const owner=uid,revision=generation,next={uid:owner,name,photo:CloudModel.photo(avatar)},ref=doc(db,'users',owner,'meta','main'),assertCurrent=()=>{if(owner!==uid||revision!==generation||auth.currentUser?.uid!==owner||deleting||deletionLocked||onlineBanned)throw Error('account-changed')};
 await runTransaction(db,async tx=>{assertCurrent();const snap=await tx.get(ref);assertCurrent();if(!snap.exists())throw Error();tx.update(ref,{profile:next})});assertCurrent();profile=next;avatar=next.photo;
 if(!window.FocusSocial.saveIdentity)throw Error('social-profile-not-ready');await window.FocusSocial.saveIdentity();assertCurrent();renderProfile();message('Profilin kaydedildi.');
 const onboarding=window.FocusAccountUI?.mode==='onboarding';by('accountSheet').close();if(onboarding||loginPendingUid===owner){if(window.location)window.location.hash='calisma';loginPendingUid='';loginIntent=false}
});
by('removeProfilePhoto').onclick=()=>busy(async()=>{
 if(!uid||!ready){message('Önce bulut kayıtlarının bağlanmasını bekle.');return}
 const owner=uid,revision=generation,ref=doc(db,'users',owner,'meta','main'),assertCurrent=()=>{if(owner!==uid||revision!==generation||auth.currentUser?.uid!==owner||deleting||deletionLocked||onlineBanned)throw Error('account-changed')};
 const next=await runTransaction(db,async tx=>{assertCurrent();const snap=await tx.get(ref);assertCurrent();if(!snap.exists())throw Error();const next={...CloudModel.profile({...snap.data().profile,uid:owner}),photo:''};tx.update(ref,{profile:next});return next});
 assertCurrent();profile=next;avatar='';if(!window.FocusSocial.needsIdentity?.()){await window.FocusSocial.saveIdentity();assertCurrent()}renderProfile();message('Profil fotoğrafın kaldırıldı. Odadaki katılımcıların daha önce aldığı kopyalar silinmez.');
});
by('exportAccount').onclick=()=>busy(async()=>{
 if(onlineBanned&&uid){const owner=uid,revision=generation;const [meta,rows]=await Promise.all([getDocFromServer(doc(db,'users',uid,'meta','main')),getDocsFromServer(collection(db,'users',uid,'devices'))]);if(owner!==uid||revision!==generation)return;base=meta.exists()?meta.data():{};devices=new Map(rows.docs.map(d=>[d.id,d.data()]));devicesLoaded=true;profile=CloudModel.profile({...base.profile,uid});}
 if(!uid||(!ready&&!onlineBanned)||!base||!devicesLoaded){message('Verilerini indirmek için önce bulut kayıtlarının yüklenmesini bekle.');return}
 watchChanges();const owner=uid,revision=generation;
 const social=await window.FocusSocial.exportData();
 const value=JSON.stringify({social,format:'focus-for-you-data-v1',exportedAt:new Date().toISOString(),account:{uid:owner,email:auth.currentUser.email,profile:{...profile}},cloud:{baseline:json(base),devices:[...devices].map(([id,data])=>({id,data:json(data)}))},currentDevice:{days:json(cache.days),pendingFields:json(cache.dirty),visibleDays:Study.snapshot().days,settings:fields()}},null,2);
 if(owner!==uid||revision!==generation)return;
 if(window.FocusAndroid){if(!window.FocusAndroid.saveBackup){message('Verilerini indirmek için APK’yi güncelle veya siteyi tarayıcıda aç.');return}if(new TextEncoder().encode(value).length>1000000){message('Dosya APK için büyük. Hesabınla tarayıcıdan giriş yapıp Verilerimi indir’i kullan.');return}window.FocusAndroid.saveBackup(value);message('Verilerini kaydetmek için açılan pencerede dosya konumunu seç.');return}
 const url=URL.createObjectURL(new Blob([value],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='focus-for-you-verilerim.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);message('Veri dosyan hazır. Dosya kişisel kayıtlarını içerir; herkese açık paylaşma.');
});
function clearAccountDevice(owner){
 window.FocusSocial?.stop();sessionStorage.removeItem('focus_active_room_'+owner);by('leaveRoom')?.click();Study.stopForAccountDeletion?.();
 by('lobbyName').value='';window.FocusNative?.pulse();
 profile={uid:'',name:'',photo:''};avatar='';renderProfile();
 localStorage.removeItem('focus_current_uid');localStorage.removeItem('focus_account_'+owner);localStorage.removeItem('focus_guest_backup');
 localStorage.removeItem('focus_profile_label');
 Study.resetForDeletion?.();Study.applyDays({});window.FocusData?.apply({preferences:JSON.stringify({focus:25,break:5,goal:120}),tasks:'{"t":[],"a":null}',forest:'{"f":0,"l":0}',exam:''});
 for(const key of ['focus_study','mikro_tasks','mikro_forest','mikro_timer','ex'])localStorage.removeItem(key);
}
function receiveDeletion(owner){
 if(deleting||auth.currentUser?.uid!==owner)return;
 deletionLocked=true;ready=false;generation++;for(const stop of unsub)stop();unsub=[];
 clearAccountDevice(owner);uid='';cache={days:{},dirty:{}};
 // Signing out here would also sign out another tab still finishing the deletion.
 message('Hesabın başka bir pencerede siliniyor. Bu pencerenin kayıtları temizlendi. İşlem yarıda kaldıysa Hesabımı sil ile sürdürebilirsin.');
}
addEventListener('storage',event=>{if(event.key!=='focus_delete_notice'||!event.newValue)return;try{receiveDeletion(JSON.parse(event.newValue).uid)}catch(e){}});
async function finishDeletion(user){
 const owner=user.uid;deleting=true;by('deleteAccount').disabled=true;
 try{
  await eraseAccount({db,user,locked:deletionLocked,assertCurrent:()=>{if(auth.currentUser?.uid!==owner)throw Error('account-changed')},onLocked:async()=>{deletionLocked=true;ready=false;generation++;for(const stop of unsub)stop();unsub=[];localStorage.setItem('focus_delete_notice',JSON.stringify({uid:owner}));localStorage.removeItem('focus_delete_notice');clearAccountDevice(owner);uid='';cache={days:{},dirty:{}};message('Bulut kayıtların ve hesabın siliniyor… Pencereyi açık tut.')}});
  uid='';clearAccountDevice(owner);window.FocusAndroid?.clearGoogleSession?.();deleting=false;deletionLocked=false;await bind(null);by('deleteConsent').checked=false;message('Hesabın ve bulut kayıtların silindi. Bu cihazdaki çalışma kopyası temizlendi. Google hesabın silinmedi.');
 }catch(e){message(e.code==='auth/requires-recent-login'?'Silme kilidi korunuyor. Hesabımı sil düğmesine basıp Google veya şifrenle yeniden doğrulanarak tamamla.':deletionLocked?'Silme henüz tamamlanmadı. Hesabın yeni kayıt yazmaya kapatıldı; bağlantını kontrol edip Hesabımı sil ile tekrar dene.':'Silme başlayamadı. Firebase silme kuralları ve bağlantı kontrol edilmeli.');}
 finally{deleting=false;by('deleteAccount').disabled=false;by('deletePassword').value=''}
}
if(by('deleteAccount'))by('deleteAccount').onclick=()=>busy(async()=>{
 if(deleting||nativeDeleteUid)return;
 const user=auth.currentUser;if(!user)return;
 if(!by('deleteConsent').checked){message('Kalıcı silme onayını işaretle. Önce verilerini indirebilirsin.');return}
 if(Study.liveSession?.().running){message('Hesabını silmeden önce sayacı duraklat.');return}
 if(user.providerData?.some(p=>p.providerId==='google.com')){
  if(window.FocusAndroid){if(!window.FocusAndroid.googleSignIn){message('Silmek için APK’yi güncelle veya tarayıcıdan giriş yap.');return}nativeDeleteUid=user.uid;window.FocusAndroid.googleSignIn(googleClientId);return}
  await reauthenticateWithPopup(user,new GoogleAuthProvider());
 }else{
  const password=by('deletePassword').value;if(!password){message('Hesabını doğrulamak için mevcut şifreni yaz.');return}
  await reauthenticateWithCredential(user,EmailAuthProvider.credential(user.email,password));
 }
 by('deletePassword').value='';await finishDeletion(user);
});
window.FocusAccount={profile:()=>({...profile}),record:(date,seconds)=>{if(!uid||deleting||deletionLocked)return;cache.days[date]=Math.min(86400,(cache.days[date]||0)+seconds)},sync};
initSocial({db,auth});
onAuthStateChanged(auth,user=>{bind(user).catch(failure)});
addEventListener('focus-social-ready',event=>{if(event.detail?.uid&&event.detail.uid!==auth.currentUser?.uid)return;socialReadyUid=auth.currentUser?.uid||'';settleAccountUI()});
addEventListener('focus-identity-ready',event=>{if(event.detail?.uid&&event.detail.uid!==auth.currentUser?.uid)return;settleAccountUI()});
setInterval(()=>{watchChanges();saveCache();if(!auth.currentUser)localStorage.setItem('focus_guest_backup',JSON.stringify({days:Study.snapshot().days,fields:fields()}))},5000);setInterval(sync,60000);
addEventListener('online',()=>{if(auth.currentUser?.emailVerified&&!ready)bind(auth.currentUser);else sync()});
addEventListener('pagehide',()=>{watchChanges();saveCache()});
document.addEventListener('visibilitychange',()=>{watchChanges();saveCache();if(!document.hidden)sync()});

addEventListener('focus-moderation',event=>{const was=onlineBanned;onlineBanned=!!event.detail.banned;if(onlineBanned){ready=false;message('Çevrimiçi özelliklerin yasaklandı. Kişisel sayaç ve hesap silme açık.')}else if(was&&auth.currentUser)void bind(auth.currentUser).catch(failure)});
