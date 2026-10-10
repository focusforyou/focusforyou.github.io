'use strict';
(()=>{
const sheet=document.getElementById('accountSheet');
document.getElementById('accountContent').append(document.querySelector('.account-card'));
const by=id=>document.getElementById(id);
let cached='';try{cached=localStorage.getItem('focus_profile_label')||''}catch(e){}
// This name is presentation only. Firebase alone authorizes account actions.
if(cached&&cached.length<=30){by('openAccount').textContent='Profilim';by('accountGuest').hidden=true;by('accountMember').hidden=true;by('accountStatus').textContent='Hesabın yükleniyor…'}
let mode='';
const setMode=value=>{mode=value;const onboarding=value==='onboarding';if(by('profileSetupTitle'))by('profileSetupTitle').textContent=onboarding?'Profilini tamamla':'Profilin';if(by('profileSetupHelp')){by('profileSetupHelp').hidden=!onboarding;by('profileSetupHelp').textContent='Görünen adını ve benzersiz @kullanıcıadını seç. Arkadaşların seni bu kullanıcı adıyla bulabilir.'}};
window.FocusAccountUI={
 get mode(){return mode},
 open(value='profile'){setMode(value);if(!sheet.open)sheet.showModal()},
 beginLogin(){setMode('login')},
 closeLogin(){if(mode==='login'||mode==='onboarding'){sheet.close();setMode('')}},
 onboarding(){setMode('onboarding');if(!sheet.open)sheet.showModal()},
 resolved(user){if(!user&&mode==='onboarding')setMode('login')},
};
by('openAccount').onclick=()=>window.FocusAccountUI.open(by('openAccount').textContent==='Profilim'?'profile':'login');
sheet.addEventListener('close',()=>{mode=''});
sheet.addEventListener('click',event=>{if(event.target!==sheet)return;const rect=sheet.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)sheet.close()});
})();
