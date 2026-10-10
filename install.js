'use strict';
(()=>{
const by=id=>document.getElementById(id),sheet=by('installSheet');
const isApk=typeof window.FocusAndroid!=='undefined'||/\bFocusForYou\/\d/.test(navigator.userAgent);
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
document.body.classList.toggle('is-app',isApk||standalone);
sheet.querySelector('.install-content').append(by('kurulum'));
by('openInstall').onclick=()=>{if(!isApk&&!standalone)sheet.showModal()};
let installPrompt;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();if(isApk||standalone)return;installPrompt=e;by('installApp').hidden=false});
by('installApp').onclick=async()=>{if(!installPrompt)return;await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;by('installApp').hidden=true};
addEventListener('appinstalled',()=>{document.body.classList.add('is-app');by('installApp').hidden=true;by('installHelp').textContent='Uygulama kuruldu. Ana ekranından açabilirsin.';if(sheet.open)sheet.close()});
if('serviceWorker' in navigator){addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{})})}
})();
