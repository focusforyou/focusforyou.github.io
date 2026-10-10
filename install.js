'use strict';
let installPrompt;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;document.getElementById('installApp').hidden=false});
document.getElementById('installApp').onclick=async()=>{if(!installPrompt)return;await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;document.getElementById('installApp').hidden=true};
addEventListener('appinstalled',()=>{document.getElementById('installApp').hidden=true;document.getElementById('installHelp').textContent='Uygulama kuruldu. Ana ekranından açabilirsin.'});
if('serviceWorker' in navigator){addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{})})}
