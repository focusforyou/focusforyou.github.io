'use strict';
(()=>{
 const by=id=>document.getElementById(id),panel=by('friendsPanel'),toggle=by('friendsToggle'),create=by('createRoomSheet');
 function friends(open){const restore=!open&&panel.contains(document.activeElement);panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open){if(!matchMedia('(prefers-reduced-motion:reduce)').matches)panel.animate?.([{opacity:0,transform:'translateY(12px) scale(.98)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:220,easing:'cubic-bezier(.22,.8,.25,1)'});by('closeFriends').focus()}else if(restore)toggle.focus()}
 toggle.onclick=()=>friends(panel.hidden);by('closeFriends').onclick=()=>friends(false);
 document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!toggle.contains(e.target))friends(false)});
 addEventListener('keydown',e=>{if(e.key==='Escape')friends(false)});
 by('openCreateRoom').onclick=()=>{if(!window.FocusAccount?.profile?.().uid){by('openAccount').click();return}if(window.FocusSocial?.banned?.())return;by('createRoomStatus').textContent='';create.showModal();by('closeCreateRoom').focus()};
 by('closeCreateRoom').onclick=()=>create.close();create.addEventListener('click',e=>{if(e.target!==create)return;const r=create.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)create.close()});

 const memberModal=by('memberProfileModal');
 let viewedMember='';
 function refreshMemberSession(explicitTimer){
  if(!viewedMember)return;
  const selfUid=window.FocusSocial?.uid?.()||window.FocusAccount?.profile?.()?.uid;
  const self=!!selfUid&&viewedMember===selfUid;
  const t=self&&typeof Study!=='undefined'?Study.liveSession():window.FocusSocial?.getMemberTimer?.(viewedMember)||explicitTimer;
  const state=self?(window.ExtrasModel?.state(t,navigator.onLine!==false)||LobbyModel.describe(t)):window.FocusSocial?.memberState?.(viewedMember)||'Çevrimdışı';
  by('memberProfileStatusText').textContent=state;
  by('memberProfileTotalHours').textContent=t&&window.LobbyModel?LobbyModel.hours(t.worked||0):'—';
  const roomTimer=window.FocusSocial?.getMemberTimer?.(viewedMember)||(!self?explicitTimer:null);
  by('memberProfileRoomHours').textContent=roomTimer&&window.LobbyModel?LobbyModel.hours(roomTimer.roomWorked||0):'—';
 }
 setInterval(()=>{if(memberModal?.open&&!document.hidden)refreshMemberSession()},1000);
 if(memberModal){
  by('closeMemberProfile')?.addEventListener('click',()=>memberModal.close());
  memberModal.addEventListener('click',e=>{
   if(e.target!==memberModal)return;
   const r=memberModal.getBoundingClientRect();
   if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)memberModal.close();
  });
 }

 window.openMemberProfile=function(targetUid,fallbackName,explicitTimer,extraData){
  const modal=by('memberProfileModal');
  if(!modal)return;
  const p=(window.FocusSocial?.getProfile?window.FocusSocial.getProfile(targetUid):null)||extraData||{};
  const name=p.name||fallbackName||'Kullanıcı';window.FocusProfileStudio?.member?.(p,targetUid===(window.FocusSocial?.uid?.()||window.FocusAccount?.profile?.()?.uid));
  by('memberProfileTitle').textContent=name;
  window.SocialModel?.decorate(by('memberProfileTitle'),{...p,username:null});
  const frame=window.SocialModel?.cosmetics(p.cosmetics).frame;for(const value of (window.FocusCosmetics?.frames||['gold','ruby','ice','violet','emerald']))for(const id of ['memberProfileAvatar','memberProfileFallback'])by(id).classList.toggle('frame-'+value,frame===value);
  by('memberProfileHandle').textContent='@'+(p.username||'kullanici');
  if(p.exam){by('memberProfileExam').textContent=p.exam==='OTHER'?'Diğer':p.exam;by('memberProfileExam').hidden=false}else by('memberProfileExam').hidden=true;
  if(p.photo){
   by('memberProfileAvatar').src=p.photo;by('memberProfileAvatar').hidden=false;by('memberProfileFallback').hidden=true;
  }else{
   by('memberProfileAvatar').hidden=true;by('memberProfileFallback').textContent=name.slice(0,1).toUpperCase();by('memberProfileFallback').hidden=false;
  }
  viewedMember=targetUid;
  refreshMemberSession(explicitTimer);
  window.FocusExtras?.paintVitrine?.(p);window.FocusExtras?.profileControls?.(targetUid);
  window.FocusSocial?.setupPokeButton?.(targetUid);
  const friendBtn=by('memberProfileFriendBtn');
  const selfUid=window.FocusSocial?.uid?.()||window.FocusAccount?.profile?.()?.uid;
  if(!selfUid||!targetUid||targetUid===selfUid||!/^[A-Za-z0-9_-]{10,40}$/.test(targetUid)){
   friendBtn.hidden=true;
  }else if(window.FocusSocial?.setupFriendButton){
   friendBtn.hidden=false;
   window.FocusSocial.setupFriendButton(friendBtn,targetUid);
  }else{
   friendBtn.hidden=true;
  }
  try{
   if(modal.open)modal.close();
   if(typeof modal.showModal==='function')modal.showModal();
  }catch(e){
   console.warn('Profile modal error',e);
  }
 };
})();

