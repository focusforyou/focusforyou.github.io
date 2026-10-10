'use strict';
(()=>{
const sheet=document.getElementById('accountSheet');
document.getElementById('accountContent').append(document.querySelector('.account-card'));
document.getElementById('openAccount').onclick=()=>sheet.showModal();
sheet.addEventListener('click',event=>{if(event.target!==sheet)return;const rect=sheet.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)sheet.close()});
})();
