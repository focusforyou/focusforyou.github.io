'use strict';
(()=>{
 const sheet=document.getElementById('legalSheet'),frame=document.getElementById('legalFrame');
 document.querySelectorAll('a[href="/terms.html"],a[href="/privacy.html"],a[href="/delete-account.html"]').forEach(link=>link.addEventListener('click',event=>{if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();frame.src=link.getAttribute('href');sheet.showModal()}));
 sheet.addEventListener('close',()=>{frame.removeAttribute('src')});
})();

