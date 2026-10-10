'use strict';
(()=>{
 const by=id=>document.getElementById(id),panel=by('friendsPanel'),toggle=by('friendsToggle'),create=by('createRoomSheet');
 function friends(open){panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open){panel.animate?.([{opacity:0,transform:'translateY(12px) scale(.98)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:220,easing:'cubic-bezier(.22,.8,.25,1)'});by('friendUsername')?.focus()}}
 toggle.onclick=()=>friends(panel.hidden);by('closeFriends').onclick=()=>friends(false);
 document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!toggle.contains(e.target))friends(false)});
 addEventListener('keydown',e=>{if(e.key==='Escape')friends(false)});
 by('openCreateRoom').onclick=()=>{if(!window.FocusAccount?.profile?.().uid){by('openAccount').click();return}if(window.FocusSocial?.banned?.())return;by('createRoomStatus').textContent='';create.showModal();by('permanentName').focus()};
 by('closeCreateRoom').onclick=()=>create.close();create.addEventListener('click',e=>{if(e.target!==create)return;const r=create.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)create.close()});
})();
