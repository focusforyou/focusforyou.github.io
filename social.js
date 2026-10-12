import {doc,collection,getDoc,getDocs,getDocFromServer,getDocsFromServer,query,where,orderBy,limit,startAfter,onSnapshot,setDoc,updateDoc,deleteDoc,writeBatch,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';

// All identities and permissions are also checked by Firestore rules.
export function initSocial({db,auth}){
 const by=id=>document.getElementById(id),model=window.SocialModel||SocialModel;
 let directory=[],searchResults=null,roomCache=new Map(),roomWatches=new Map(),entitlements={};
 let banned=false,banStop=null,moderationStops=[],roomBans=[],roomKicks=[],appBans=[];
 let lastPokeSent=0,lastPokeSound=0,pokeSending=null,pokeLastTarget='',pokeFailedTarget='';const pokeControls=new Map(),roomTasks=new Map();
 const obsoleteRooms=['21795044','3dabaf3580c14d0ea4841bc7fa22688f','97309248'];
 let user=null,me=null,active='',room=null,stops=[],roomStops=[],epoch=0,members=[],messages=[],profiles=new Map(),profileStops=new Map(),saved=[],friends=[],invitations=[],roomSeconds=0,pendingSeconds=0,lastLocal=0,lastWrite=0,lastState='',writing=null,loaded=false,switching=false,restored=false,historyPage=false,historyCursor=null,latest=[],leftRooms=new Set(obsoleteRooms);
 const storage={get:k=>{try{return(typeof localStorage!=='undefined'?localStorage:null)?.getItem(k)||null}catch(e){return null}},set:(k,v)=>{try{(typeof localStorage!=='undefined'?localStorage:null)?.setItem(k,v)}catch(e){}},remove:k=>{try{(typeof localStorage!=='undefined'?localStorage:null)?.removeItem(k)}catch(e){}}};
 const saveRoomCache=()=>{if(user?.uid)storage.set('focus_room_cards_'+user.uid,JSON.stringify(saved.slice(0,100).map(r=>({id:r.id,name:r.name}))))};
 function pruneRoomWatches(){const needed=new Set(saved.map(r=>r.id));for(const [id,stop] of roomWatches)if(!needed.has(id)){stop();roomWatches.delete(id)}const retained=new Set([...needed,...directory.map(r=>r.id),...(searchResults||[]).map(r=>r.id),active]);for(const id of roomCache.keys())if(!retained.has(id))roomCache.delete(id)}
 const markRoomLeft=id=>{leftRooms.add(id);try{sessionStorage.setItem('focus_left_rooms_'+(user?.uid||''),JSON.stringify([...leftRooms]))}catch(e){}};
 const unmarkRoomLeft=id=>{leftRooms.delete(id);try{sessionStorage.setItem('focus_left_rooms_'+(user?.uid||''),JSON.stringify([...leftRooms]))}catch(e){}};
 const status=s=>{by('socialStatus').textContent=s;by('friendsStatus').textContent=s;by('createRoomStatus').textContent=s};
 const ref=(...path)=>doc(db,...path),own=()=>!!user?.emailVerified&&!!me&&!banned;
 const admin=()=>!!user?.emailVerified&&user.email==='efeozbilgin550@gmail.com';
 const manager=()=>admin()||room?.ownerUid===user?.uid;
 const moderator=()=>manager()||members.some(m=>m.uid===user?.uid&&m.role==='moderator');
 const presence=(t,fresh=true)=>window.ExtrasModel?.state(t,fresh)||(!fresh?'Çevrimdışı':t.running&&t.phase==='focus'?'Odaklanıyor':'Molada');
 let questionStop=null,questionLimit=12,questionRoom='',showcaseWrite=0,questionAuthors=new Set(),pinAuthors=new Set();
 async function syncShowcaseHours(){if(!own()||!me?.showcase?.showHours||typeof Study.totalSeconds!=='function'||Date.now()-showcaseWrite<300000)return;const seconds=Math.floor(Study.totalSeconds());if(Math.floor((me.showcase.seconds||0)/60)===Math.floor(seconds/60))return;showcaseWrite=Date.now();const op=operation();try{await updateDoc(ref('publicProfiles',op.uid),{'showcase.seconds':seconds});op.check()}catch(e){if(op.rev===epoch)showcaseWrite=Date.now()-240000}}
 function extrasState(){window.FocusRoomTools?.state?.(active&&room?{id:active,name:room.name,manager:manager(),moderator:moderator()}:null);window.FocusExtras?.room?.(active&&room?{id:active,room,uid:user?.uid,admin:admin(),leader:manager(),moderator:moderator(),members}:null)}
 const stamp=v=>v?.toMillis?.()||0;
 const protectedUid=uid=>uid===user?.uid||identity(uid).username==='efe';
 const report=e=>status(e?.message==='username-taken'?'Bu kullanıcı adı alınmış. Başka bir ad seç.':e?.code==='permission-denied'?'Bu işlem için izin yok. Oda şifresini, üyeliğini veya yayımlanan Firebase kurallarını kontrol et.':'Bağlantı kurulamadı. İnternet gelince tekrar dene.');
 const operation=()=>{const rev=epoch,uid=user?.uid;return {rev,uid,check:()=>{if(rev!==epoch||uid!==user?.uid)throw Error('account-changed')}}};
 const action=fn=>async()=>{const rev=epoch;if(banned){status('Çevrimiçi özelliklerin yasaklandı. Kişisel sayaç ve hesap silme açık.');return}try{await fn()}catch(e){if(rev===epoch)report(e)}};
 const pendingControls=new Map();
 function releasePending(control,task){if(pendingControls.get(control)!==task)return;pendingControls.delete(control);control._pending=false;control.disabled=banned;control.textContent=task.original;control.setAttribute?.('aria-busy','false')}
 function resetPending(){for(const [control,task] of pendingControls)releasePending(control,task)}
 function pendingButton(control,fn,label){return action(async()=>{if(control._pending)return;const task={rev:epoch,original:control.textContent};pendingControls.set(control,task);control._pending=true;control.disabled=true;control.textContent=label;control.setAttribute?.('aria-busy','true');try{return await fn()}finally{releasePending(control,task)}})}
 async function roomTask(id,kind,fn){if(roomTasks.has(id)){status('Bu oda işlemi sürüyor…');return false}const task={rev:epoch,kind};roomTasks.set(id,task);renderSaved();renderDirectory();try{return await fn()}finally{if(roomTasks.get(id)===task){roomTasks.delete(id);renderSaved();renderDirectory()}}}
 const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.className='pill';b.textContent=text;b.onclick=action(fn);return b};
 const row=(name,buttons=[],p=null)=>{const n=document.createElement('div');n.className='social-row';const label=document.createElement('strong');label.textContent=name;if(p)model.decorate(label,p);n.append(label,...buttons);return n};
 const identity=uid=>{if(uid==='focusforyou')return {name:'Focus For You',username:'focusforyou',photo:'icon-192.png',cosmetics:{tag:'system',nameStyle:'gold'}};if(profiles.has(uid))return profiles.get(uid);if(user&&uid===user.uid){const base=window.FocusAccount?.profile?.()||{};return {name:me?.name||base.name||'Sen',username:me?.username||'',photo:me?.photo||base.photo||'',cosmetics:me?.cosmetics||{},showcase:me?.showcase,banner:me?.banner}}return {name:'Odak arkadaşı',username:'',photo:'',cosmetics:{}}};
 const memberViews=new Map(),profileChanges=new Set();let profilePaintQueued=null;
 const profileKey=p=>JSON.stringify([p?.name||'',p?.username||'',p?.photo||'',p?.exam||'',p?.cosmetics||{},p?.showcase||{},p?.banner||'']);
 const setText=(node,text)=>{if(node&&node.textContent!==text)node.textContent=text};
 const viewVisible=node=>!!node&&!document.hidden&&!node.hidden&&(!node.closest||!node.closest('[hidden]'))&&(!node.getClientRects||node.getClientRects().length>0);
 function pruneProfileListeners(){
  const needed=new Set(members.map(m=>m.uid));if(user)needed.add(user.uid);for(const m of messages)needed.add(m.uid);
  for(const uid of [...questionAuthors,...pinAuthors])needed.add(uid);
  for(const f of friends){needed.add(f.from);needed.add(f.to)}for(const b of [...roomBans,...appBans])needed.add(b.id);
  for(const r of [...saved,...directory,...(searchResults||[])]){const full=roomCache.get(r.id)||r;if(full?.ownerUid)needed.add(full.ownerUid);for(const uid of (full?.previewUids||[]).slice(0,4))needed.add(uid)}
  for(const [uid,stop] of profileStops)if(!needed.has(uid)){stop();profileStops.delete(uid);profiles.delete(uid);profileChanges.delete(uid)}
 }
 function watchProfile(uid){
  if(!uid||uid==='focusforyou'||profileStops.has(uid))return;const rev=epoch;
  profileStops.set(uid,onSnapshot(ref('publicProfiles',uid),s=>{
   if(rev!==epoch||!profileStops.has(uid))return;const next=s.exists()?s.data():{name:'Odak arkadaşı',username:'',photo:'',cosmetics:{}};
   if(profileKey(profiles.get(uid))===profileKey(next))return;profiles.set(uid,next);if(profilePaintQueued!==rev){profileChanges.clear();profilePaintQueued=rev;profileChanges.add(uid)}else{profileChanges.add(uid);return}
   Promise.resolve().then(()=>{if(rev!==epoch)return;profilePaintQueued=null;const changed=new Set(profileChanges);profileChanges.clear();
    if(members.some(m=>changed.has(m.uid)))renderMembers();
    if(friends.some(f=>changed.has(f.from)||changed.has(f.to)))renderFriends();
    if(messages.some(m=>changed.has(m.uid)))renderChat();
    if([...questionAuthors].some(uid=>changed.has(uid)))window.FocusExtras?.refreshQuestions?.();if([...pinAuthors].some(uid=>changed.has(uid)))window.FocusRoomTools?.refresh?.();
    if([...roomBans,...appBans].some(b=>changed.has(b.id)))renderModeration();
    const ownerChanged=r=>{const full=roomCache.get(r.id)||r;return changed.has(full?.ownerUid)||(full?.previewUids||[]).some(uid=>changed.has(uid))};
    if(saved.some(ownerChanged))renderSaved();if([...directory,...(searchResults||[])].some(ownerChanged))renderDirectory();pruneProfileListeners();
   });
  },()=>{}));
 }
 function projectedMembers(targetUid){const nowMs=Date.now();return (targetUid?members.filter(m=>m.uid===targetUid):members).map(m=>{const p=identity(m.uid),self=m.uid===user?.uid,age=m.presenceAt?.toMillis?Math.max(0,(nowMs-m.presenceAt.toMillis())/1000):120,fresh=self||(m.online!==false&&age<90);const timer=self?{...LobbyModel.cleanTimer(Study.liveSession()),roomWorked:Math.min(315360000,roomSeconds+pendingSeconds+Math.max(0,Study.localSeconds()-lastLocal))}:LobbyModel.project({...m.timer,running:fresh&&m.timer?.running},Math.min(15,age));return {m,p,self,fresh,timer,presenceMs:m.presenceAt?.toMillis?m.presenceAt.toMillis():nowMs}})}
 function paintMembers(list,entries,create,update,permissionKey=''){
  const scope=epoch+':'+active;let cache=memberViews.get(list);
  if(!cache||cache.scope!==scope){cache={scope,rows:new Map(),order:[]};memberViews.set(list,cache)}
  const nodes=[],next=new Set();for(const value of entries){const uid=value.m.uid,key=profileKey(value.p)+':'+permissionKey+':'+(uid===room.ownerUid)+':'+value.self+':'+(value.m.role||'member');let record=cache.rows.get(uid);if(!record||record.key!==key){record={key,value};Object.assign(record,create(value,record));cache.rows.set(uid,record)}record.value=value;update(record,value);next.add(uid);nodes.push(record.item)}
  for(const uid of cache.rows.keys())if(!next.has(uid))cache.rows.delete(uid);
  const changed=nodes.length!==cache.order.length||nodes.some((node,i)=>cache.order[i]!==node)||nodes.length!==list.children.length||nodes.some((node,i)=>list.children[i]!==node);
  if(changed){list.replaceChildren(...nodes);cache.order=nodes;pruneProfileListeners()}
 }
 function renderFriends(){
  const list=by('friendList');list.replaceChildren();
  for(const f of friends){const other=f.from===user.uid?f.to:f.from,p=identity(other);watchProfile(other);const controls=[];
   if(f.state==='pending'){if(f.to===user.uid)controls.push(button('Kabul et',()=>updateDoc(ref('friendships',f.id),{state:'accepted'})));else controls.push(document.createTextNode('İstek gönderildi'))}
   else if(active&&manager())controls.push(button('Odaya davet et',()=>invite(other)));
   controls.push(button(f.state==='pending'?'İptal':'Arkadaşlıktan çıkar',()=>deleteDoc(ref('friendships',f.id))));const entry=document.createElement('div');entry.className='social-row friend-card';const hit=button('',()=>openMemberProfile(other,p.name));hit.className='friend-profile';hit.ariaLabel=p.name+' profilini aç';
   if(p.banner){const banner=document.createElement('img');banner.className='friend-banner';banner.src=p.banner;banner.alt='';banner.loading='lazy';banner.decoding='async';banner.referrerPolicy='no-referrer';banner.onerror=()=>{banner.hidden=true};hit.append(banner)}
   const face=document.createElement('span');face.className='friend-face';const c=model.cosmetics(p.cosmetics),fallback=document.createElement('span');fallback.className='friend-avatar owner-fallback'+(c.frame!=='none'?' frame-'+c.frame:'');fallback.textContent=(p.name||'?').slice(0,1).toUpperCase();fallback.hidden=!!p.photo;
   if(p.photo){const photo=document.createElement('img');photo.className='friend-avatar'+(c.frame!=='none'?' frame-'+c.frame:'');photo.src=p.photo;photo.alt='';photo.width=photo.height=52;photo.loading='lazy';photo.decoding='async';photo.referrerPolicy='no-referrer';photo.onerror=()=>{photo.hidden=true;fallback.hidden=false};face.append(photo)}face.append(fallback);
   const text=document.createElement('span');text.className='friend-identity';const label=document.createElement('strong');label.textContent=p.name;model.decorate(label,{...p,username:''});const handle=document.createElement('span');handle.className='friend-handle';handle.textContent=p.username?'@'+p.username:'';text.append(label,handle);hit.append(face,text);entry.append(hit,...controls);list.append(entry);
  }
  if(!friends.length)list.textContent='Henüz arkadaşın yok. @kullanıcıadı ile istek gönder.';const pending=friends.filter(f=>f.to===user?.uid&&f.state==='pending').length;by('friendBadge').hidden=!pending;by('friendBadge').textContent=String(pending);
 }
 function watchRoom(id){if(roomWatches.has(id))return;const rev=epoch;roomWatches.set(id,onSnapshot(ref('rooms',id),s=>{if(rev!==epoch)return;if(s.exists()){const r={id,...s.data()};roomCache.set(id,r);watchProfile(r.ownerUid)}else roomCache.set(id,null);renderSaved();renderDirectory()},()=>{}))}
 async function drain(queryRef,op){
  for(let page=0;page<1000;page++){op.check();const rows=await getDocsFromServer(query(queryRef,limit(100)));op.check();if(rows.empty)return;const batch=writeBatch(db);for(const row of rows.docs)batch.delete(row.ref);op.check();await batch.commit();op.check()}throw Error('cleanup-limit');
 }
 async function deleteLobbyCard(id,name){
  if(!own())throw Error('social-profile-not-ready');const op=operation(),snap=await getDocFromServer(ref('rooms',id));op.check();
  if(!snap.exists())throw Error('room-missing');const r=snap.data();if(!admin()&&(r.ownerUid!==op.uid||model.exams.includes(id)))throw Error('permission-denied');
  status('Lobi siliniyor…');
  if(active===id&&!r.deleting){await flush(true);op.check();}
  await updateDoc(ref('rooms',id),{deleting:true});op.check();
  for(const col of ['messages','nudges','bans','kicks'])await drain(collection(db,'rooms',id,col),op);
  // Keep the leader and protected administrator until the root is deleted in the same batch.
  const membersSnapshot=await getDocsFromServer(collection(db,'rooms',id,'members'));op.check();const held=[];
  for(const member of membersSnapshot.docs){op.check();const p=await getDocFromServer(ref('publicProfiles',member.id));op.check();if(member.id===op.uid||p.data()?.username==='efe')held.push(member);else{await deleteDoc(member.ref);op.check()}}
  const remaining=await getDocsFromServer(collection(db,'rooms',id,'members'));op.check();if(remaining.docs.some(m=>!held.some(h=>h.id===m.id)))throw Error('room-members-changed');
  await deleteDoc(ref('rooms',id,'secrets','password'));op.check();
  const batch=writeBatch(db);for(const member of remaining.docs)batch.delete(member.ref);batch.delete(ref('rooms',id));op.check();await batch.commit();op.check();
  const verified=await getDocFromServer(ref('rooms',id));op.check();if(verified.exists())throw Error('room-delete-unconfirmed');
  await deleteDoc(ref('users',op.uid,'rooms',id));op.check();if(active===id)stopRoom();markRoomLeft(id);
  if(storage.get('focus_last_room_'+op.uid)===id)storage.remove('focus_last_room_'+op.uid);
  saved=saved.filter(s=>s.id!==id);saveRoomCache();roomCache.set(id,null);directory=directory.filter(d=>d.id!==id);renderSaved();renderDirectory();status('"'+(name||r.name||id)+'" lobisi kalıcı olarak silindi.');
 }
 async function leaveLobbyCard(id,name){
  if(!own())throw Error('social-profile-not-ready');const op=operation();status('Lobiden ayrılınıyor…');
  if(active===id){await pauseRoom();op.check()}
  // Never discard the deletion inventory while personal chat data remains in this room.
  await drain(query(collection(db,'rooms',id,'messages'),where('uid','==',op.uid)),op);
  await preview(id,false);op.check();
  const batch=writeBatch(db);batch.delete(ref('rooms',id,'members',op.uid));batch.delete(ref('users',op.uid,'rooms',id));op.check();await batch.commit();op.check();
  markRoomLeft(id);if(storage.get('focus_last_room_'+op.uid)===id)storage.remove('focus_last_room_'+op.uid);saved=saved.filter(s=>s.id!==id);saveRoomCache();renderSaved();status('"'+(name||id)+'" lobisinden ayrıldın. Bu odadaki kendi mesajların ve fotoğrafların da kaldırıldı.');
 }

 function roomCard(r){
  const isExam=model.exams.includes(r.id);
  const ownerUid=isExam?'focusforyou':r.ownerUid;
  const card=document.createElement('article');card.className='lobby-tile';const heading=document.createElement('div');heading.className='lobby-tile-heading';const title=document.createElement('h4');title.textContent=r.name;const code=document.createElement('span');code.className='room-id';code.textContent='#'+r.id;heading.append(title);card.append(heading,code);
  const owner=document.createElement('div');owner.className='lobby-owner';const p=identity(ownerUid);if(r.ownerUid&&!isExam)watchProfile(r.ownerUid);if(p.photo){const img=document.createElement('img');img.src=p.photo;img.alt='';img.loading='lazy';img.decoding='async';img.width=img.height=32;img.referrerPolicy='no-referrer';img.className=model.cosmetics(p.cosmetics).frame!=='none'?'frame-'+model.cosmetics(p.cosmetics).frame:'';owner.append(img)}else{const fallback=document.createElement('span');fallback.className='owner-fallback';fallback.textContent=(p.name||'?').slice(0,1);owner.append(fallback)}const label=document.createElement('strong');label.textContent=ownerUid?p.name:'Oda bilgisi yükleniyor…';if(ownerUid)model.decorate(label,p);owner.append(label);
  const footer=document.createElement('div');footer.className='lobby-tile-footer';const lock=document.createElement('small');lock.className='room-lock';lock.textContent=isExam?'Sürekli açık · Limitsiz':(r.locked?'Şifreli oda':'Açık oda');
  const actions=document.createElement('div');actions.className='lobby-tile-actions';
  if(user?.uid){
   const isOwner=(r.ownerUid===user.uid)&&!isExam;
   const canDelete=admin()||isOwner;
   if(canDelete){
    const delBtn=document.createElement('button');delBtn.type='button';delBtn.className='pill lobby-danger-btn';delBtn.textContent='Lobiyi sil';
    delBtn.onclick=action(async()=>{
     if(!delBtn.confirming){
      delBtn.confirming=true;delBtn.textContent='Emin misin? Sil';if(delBtn.style){delBtn.style.background='#ba1a1a';delBtn.style.color='#fff'}
      setTimeout(()=>{if(delBtn.confirming){delBtn.confirming=false;delBtn.textContent='Lobiyi sil';if(delBtn.style){delBtn.style.background='';delBtn.style.color=''}}},4000);
      return;
     }
     delBtn.confirming=false;
     await deleteLobbyCard(r.id,r.name);
    });
    actions.append(delBtn);
   }
   if(!isOwner&&(saved.some(s=>s.id===r.id)||isExam)){
    const leaveBtn=document.createElement('button');leaveBtn.type='button';leaveBtn.className='pill lobby-leave-btn';leaveBtn.textContent='Lobiden ayrıl';
    leaveBtn.onclick=action(async()=>{
     if(!leaveBtn.confirming){
      leaveBtn.confirming=true;leaveBtn.textContent='Emin misin? Ayrıl';
      setTimeout(()=>{if(leaveBtn.confirming){leaveBtn.confirming=false;leaveBtn.textContent='Lobiden ayrıl'}},4000);
      return;
     }
     leaveBtn.confirming=false;
     await roomTask(r.id,'leave',()=>leaveLobbyCard(r.id,r.name));
    });
    actions.append(leaveBtn);
   }
  }
  const joinButton=button(r.deleting?'Kapatılıyor':active===r.id?'Bu odadasın':'Odaya katıl',()=>roomTask(r.id,'join',()=>join(r.id,by('joinPassword').value)));joinButton.disabled=!!r.deleting||active===r.id;actions.append(joinButton);const pending=roomTasks.get(r.id);if(pending){for(const control of actions.children){control.disabled=true;control.setAttribute?.('aria-busy','true')}joinButton.textContent=pending.kind==='leave'?'Ayrılınıyor…':'Bağlanılıyor…';}
  const previews=document.createElement('div');previews.className='lobby-member-preview';card.dataset&&(card.dataset.theme=r.theme||'night');for(const uid of (r.previewUids||[]).slice(0,4)){watchProfile(uid);const p=identity(uid);if(p.photo){const img=document.createElement('img');img.src=p.photo;img.alt=p.name;img.title=p.name;img.loading='lazy';img.width=img.height=30;img.referrerPolicy='no-referrer';previews.append(img)}else{const fallback=document.createElement('span');fallback.className='preview-fallback';fallback.textContent=(p.name||'?').slice(0,1);fallback.title=p.name;previews.append(fallback)}}if((r.previewUids||[]).length){const caption=document.createElement('small');caption.textContent='Oda üyeleri';previews.append(caption)}footer.append(lock,actions);card.append(owner,previews,footer);return card;
 }
 function empty(list,text){const p=document.createElement('p');p.className='lobby-empty';p.textContent=text;list.append(p)}
 let savedPaint='',directoryPaint='';
 const lobbyViews=new Map();
 const cardKey=r=>{const v=roomCache.get(r.id)||r;const look=uid=>{const p=identity(uid);return [p.name,p.photo,p.cosmetics]};return JSON.stringify([epoch,user?.uid,!!user?.emailVerified,!!me,banned,active===r.id,roomTasks.get(r.id),saved.some(x=>x.id===r.id),v.id,v.name,v.ownerUid,!!v.locked,!!v.deleting,v.theme||'night',look(v.ownerUid),(v.previewUids||[]).slice(0,4).map(uid=>[uid,look(uid)])])};
 const cardsKey=rows=>rows.map(cardKey).join('|');
 function paintLobbyCards(list,rows,message){let cache=lobbyViews.get(list);if(!cache){cache=new Map();lobbyViews.set(list,cache)}const next=[],keep=new Set();for(const r of rows){const key=cardKey(r);let entry=cache.get(r.id);if(!entry||entry.key!==key){entry={key,node:roomCard(roomCache.get(r.id)||r)};cache.set(r.id,entry)}keep.add(r.id);next.push(entry.node)}for(const id of cache.keys())if(!keep.has(id))cache.delete(id);if(!next.length){list.replaceChildren();empty(list,message);return}if(next.length!==list.children.length||next.some((node,i)=>list.children[i]!==node))list.replaceChildren(...next)}
 function renderSaved(){if(by('workCommunityCard'))by('workCommunityCard').hidden=!!(active&&room);const list=by('savedRooms');const visible=saved.filter(r=>roomCache.get(r.id)!==null);if(active&&room&&!visible.some(r=>r.id===active))visible.unshift({id:active,...room});const key=cardsKey(visible);if(key===savedPaint)return;savedPaint=key;paintLobbyCards(list,visible,'Henüz bir odan yok. Oda oluşturabilir veya aşağıdaki lobilerden birine katılabilirsin.');by('activeRoomSummary').textContent=active&&room?room.name+' odasındasın. Oda üyelerin ve sohbetin bağlı; kişisel sayacını burada yönet.':'Sana ait bir oda oluştur veya bir çalışma lobisine katıl. Sayacın burada senin ritminde devam eder.'}
 function renderDirectory(){const list=by('roomResults');const rows=(searchResults||directory).filter(r=>!model.exams.includes(r.id)&&!r.deleting);const key=cardsKey(rows)+':'+!!searchResults;if(key===directoryPaint)return;directoryPaint=key;paintLobbyCards(list,rows,!user?.emailVerified?'Odaları keşfetmek için giriş yap. Genel çalışma alanları her zaman burada.':searchResults?'Bu aramayla eşleşen oda yok. Oda adının tamamını veya #ID kullan.':'Henüz keşfedilecek bir oda yok. İlk alanı sen oluşturabilirsin.')}
 function renderInvites(){const list=by('roomInvitations');list.replaceChildren();for(const i of invitations)list.append(row('#'+i.roomId,[button('Daveti kabul et',async()=>{const op=operation();await join(i.roomId,'');op.check();if(active===i.roomId)await deleteDoc(ref('roomInvites',i.id))}),button('Reddet',()=>deleteDoc(ref('roomInvites',i.id)))]))}

 function getSixAMTimestamp(){const now=new Date(),six=new Date(now.getFullYear(),now.getMonth(),now.getDate(),6,0,0,0);if(now.getTime()<six.getTime())six.setDate(six.getDate()-1);return six.getTime()}

 function renderMembers(){
  extrasState();
  if(!active||!room||document.hidden)return;by('permanentRoomSettings').hidden=!manager();const list=by('roomMembers'),home=by('homeLobbyCoWorkers'),roster=by('chatRosterPane');if(home)home.hidden=!members.length;if(roster)roster.hidden=!members.length;
  if(!viewVisible(list)&&!viewVisible(by('homeLobbyList'))&&!viewVisible(by('chatRosterList')))return;const entries=projectedMembers();
  if(viewVisible(list)){
   const sixAM=getSixAMTimestamp();let total=0,online=0,dailyTotal=0;for(const v of entries){total+=v.timer.roomWorked;if(v.fresh)online++;if(v.presenceMs>=sixAM)dailyTotal+=v.timer.roomWorked}
   paintMembers(list,entries,(v,record)=>{const {m,p,self}=v,li=document.createElement('li'),label=document.createElement('strong');label.textContent=p.name+(m.uid===room.ownerUid?' · lider':'')+(self?' · sen':'');model.decorate(label,p);
    if(p.photo){const img=document.createElement('img');img.className='room-avatar'+(model.cosmetics(p.cosmetics).frame!=='none'?' frame-'+model.cosmetics(p.cosmetics).frame:'');img.src=p.photo;img.alt='';img.referrerPolicy='no-referrer';img.width=img.height=32;li.append(img)}
    const clock=document.createElement('div'),hours=document.createElement('small');li.append(label,clock,hours);if(li.style)li.style.cursor='pointer';li.onclick=()=>{const v=record.value;openMemberProfile(v.m.uid,v.p.name,v.timer)};
    if(moderator()&&!protectedUid(m.uid)&&(manager()||(m.uid!==room.ownerUid&&m.role!=='moderator'))){const controls=document.createElement('div');controls.className='moderation-actions';controls.onclick=e=>e.stopPropagation();controls.append(button('Odadan at',()=>moderate(m.uid,'kick')),button('Odadan yasakla',()=>moderate(m.uid,'roomBan')));if(admin())controls.append(button('Uygulamadan yasakla',()=>moderate(m.uid,'appBan')));li.append(controls)}return {item:li,clock,hours};
   },(record,v)=>{setText(record.clock,presence(v.timer,v.fresh)+(v.fresh?' · '+LobbyModel.clock(v.timer.left):'')+(v.m.role==='moderator'?' · Moderatör':''));setText(record.hours,'Toplam '+LobbyModel.hours(v.timer.worked)+' · bu odada '+LobbyModel.hours(v.timer.roomWorked))},String(moderator())+':'+admin());
   setText(by('roomTotal'),LobbyModel.hours(total));setText(by('roomDailyTotal'),LobbyModel.hours(dailyTotal));setText(by('roomInfo'),online+' kişi aktif · '+members.length+' kayıtlı üye'+(model.exams.includes(active)?' · Limitsiz kapasite · Sürekli açık':' · herkesin kendi sayacı'));
  }
  updateHomeCoWorkers(entries);renderRosterSidebar(entries);paintPokeButtons(entries);
 }
 function updateHomeCoWorkers(entries){
  const container=by('homeLobbyCoWorkers'),list=by('homeLobbyList');if(!container||!list)return;if(!active||!room||!members.length){container.hidden=true;return}
  container.hidden=false;if(!viewVisible(list))return;paintMembers(list,entries||projectedMembers(),(v,record)=>{const pill=document.createElement('button');pill.type='button';pill.className='home-lobby-member';
   if(v.p.photo){const img=document.createElement('img');img.className='home-lobby-member-avatar'+(model.cosmetics(v.p.cosmetics).frame!=='none'?' frame-'+model.cosmetics(v.p.cosmetics).frame:'');img.src=v.p.photo;img.alt='';pill.append(img)}const text=document.createElement('span');pill.append(text);pill.onclick=()=>{const v=record.value;openMemberProfile(v.m.uid,v.p.name,v.timer)};return {item:pill,text};
  },(record,v)=>{const value=v.p.name+' · '+presence(v.timer,v.fresh);if(record.display!==value){record.text.textContent=value;model.decorate(record.text,v.p);record.display=value}});
 }
 function renderRosterSidebar(entries){
  const pane=by('chatRosterPane'),list=by('chatRosterList'),cnt=by('chatRosterCount');if(!pane||!list)return;if(!active||!room||!members.length){pane.hidden=true;return}
  pane.hidden=false;if(!viewVisible(list))return;setText(cnt,String(members.length));paintMembers(list,entries||projectedMembers(),(v,record)=>{const {p}=v,item=document.createElement('li');item.className='chat-roster-item';
   if(p.photo){const img=document.createElement('img');img.className='chat-roster-avatar'+(model.cosmetics(p.cosmetics).frame!=='none'?' frame-'+model.cosmetics(p.cosmetics).frame:'');img.src=p.photo;img.alt='';img.width=img.height=24;item.append(img)}else{const fb=document.createElement('span');fb.className='chat-roster-avatar-fallback';fb.textContent=(p.name||'?').slice(0,1).toUpperCase();item.append(fb)}
   const info=document.createElement('div');info.className='chat-roster-info';const nm=document.createElement('span');nm.className='chat-roster-name';nm.textContent=p.name;model.decorate(nm,p);const st=document.createElement('small');st.className='chat-roster-status';info.append(nm,st);item.append(info);if(!v.self){const nudge=button('Dürt',()=>poke(record.value.m.uid));nudge.className='pill roster-nudge';pokeControls.set(nudge,record.value.m.uid);nudge.onclick=async e=>{e?.stopPropagation?.();await action(()=>poke(record.value.m.uid))()};item.append(nudge)}if(item.style)item.style.cursor='pointer';item.onclick=()=>{const v=record.value;openMemberProfile(v.m.uid,v.p.name,v.timer)};return {item,status:st};
  },(record,v)=>setText(record.status,presence(v.timer,v.fresh)+(v.fresh?' · '+LobbyModel.clock(v.timer.left):'')));
 }

 function setupFriendButton(friendBtn,targetUid){
  if(!user||!targetUid||targetUid===user.uid){friendBtn.hidden=true;return}
  friendBtn.hidden=false;const f=friends.find(fr=>fr.uids?.includes(targetUid));
  if(f){if(f.state==='accepted'){friendBtn.textContent='Arkadaşsınız ✓';friendBtn.disabled=true}else{friendBtn.textContent='İstek Beklemede';friendBtn.disabled=true}}
  else{friendBtn.textContent='Arkadaş Ekle';friendBtn.disabled=false;friendBtn.onclick=action(async()=>{
    const op=operation(),fid=model.pair(user.uid,targetUid);
    await runTransaction(db,async tx=>{op.check();const cur=await tx.get(ref('friendships',fid));op.check();if(cur.exists())return;tx.set(ref('friendships',fid),{uids:[user.uid,targetUid].sort(),from:user.uid,to:targetUid,state:'pending'})});
    op.check();friendBtn.textContent='İstek Gönderildi';friendBtn.disabled=true;status('Arkadaşlık isteği gönderildi.');
  })}
 }

 function canPoke(targetUid){return !!active&&own()&&targetUid!==user?.uid&&members.some(v=>v.uid===targetUid)}
 function paintPokeButtons(entries){const available=new Set((entries||members.map(m=>({m}))).map(v=>v.m.uid)),wait=Math.max(0,Math.ceil((10000-(Date.now()-lastPokeSent))/1000));for(const [control,target] of pokeControls){if(control.isConnected===false){pokeControls.delete(control);continue}const eligible=!!active&&own()&&target!==user?.uid&&available.has(target);control.disabled=!eligible||!!pokeSending||wait>0;control.setAttribute?.('aria-busy',String(pokeSending?.target===target));control.classList?.toggle?.('nudge-sent',wait>0&&pokeLastTarget===target);control.textContent=pokeSending?.target===target?'Gönderiliyor…':wait>0?(pokeLastTarget===target?'Dürtüldü ✓ · ':'Bekle · ')+wait+' sn':pokeFailedTarget===target?'Tekrar dene':'Dürt';}}
 async function poke(targetUid){
  if(!canPoke(targetUid)){status('Dürtmek için aynı kalıcı odada olmalısınız.');return false}
  if(pokeSending){status('Dürtme gönderiliyor…');return false}
  const op=operation(),id=active,now=Date.now();if(now-lastPokeSent<10000){status('Tekrar dürtmek için biraz bekle.');paintPokeButtons();return false}
  const attempt={target:targetUid,rev:op.rev};pokeSending=attempt;pokeFailedTarget='';paintPokeButtons();
  try{op.check();const batch=writeBatch(db);batch.update(ref('rooms',id,'members',op.uid),{presenceAt:serverTimestamp()});batch.set(ref('rooms',id,'nudges',targetUid),{from:op.uid,to:targetUid,at:serverTimestamp()});op.check();await batch.commit();op.check();if(active!==id)return false;lastPokeSent=Date.now();pokeLastTarget=targetUid;status(identity(targetUid).name+' dürtüldü.');Promise.resolve(window.FocusPush?.send?.(id,targetUid)).catch(()=>{if(op.rev===epoch&&active===id)status(identity(targetUid).name+' dürtüldü; arka plan bildirimi gönderilemedi.')});return true}
  catch(e){if(op.rev===epoch)pokeFailedTarget=targetUid;throw e}
  finally{if(pokeSending===attempt){pokeSending=null;paintPokeButtons()}}
 }
 function pokeButton(targetUid){const b=by('memberProfilePokeBtn');if(!b)return;b.hidden=!canPoke(targetUid);pokeControls.set(b,targetUid);b.onclick=action(()=>poke(targetUid));paintPokeButtons()}
 function watchNudges(id,op){
  let first=true,seen='';const started=Date.now();
  roomStops.push(onSnapshot(ref('rooms',id,'nudges',op.uid),s=>{
   if(op.rev!==epoch||active!==id)return;
   const n=s.exists()?s.data():null,at=stamp(n?.at),key=n?String(at)+':'+n.from:'';
   if(s.metadata?.hasPendingWrites||s.metadata?.fromCache)return;
   if(first){first=false;if(!n||at<=started){seen=key;return}}
   if(!n||key===seen)return;seen=key;const now=Date.now();
   if(n.to!==op.uid||n.from===op.uid||!at||at<started||now-at>30000||at-now>5000)return;
   if(window.FocusExtras?.quiet?.())return;const text=identity(n.from).name+' seni dürttü.';const notice=by('nudgeNotice');if(notice){notice.hidden=false;notice.textContent=text}else status(text);
   if(now-lastPokeSound>=10000){lastPokeSound=now;try{const result=window.FocusSound?.play?.('nudge');result?.catch?.(()=>{})}catch(e){}}
  },()=>{}));
 }
 function openMemberProfile(targetUid,fallbackName,explicitTimer){
  pokeButton(targetUid);
  if(typeof window.openMemberProfile==='function'){window.openMemberProfile(targetUid,fallbackName,explicitTimer,identity(targetUid));return}
  const modal=by('memberProfileModal');if(!modal)return;const p=identity(targetUid);
  by('memberProfileTitle').textContent=p.name||fallbackName||'Kullanıcı';by('memberProfileHandle').textContent='@'+(p.username||'kullanici');
  if(p.exam){by('memberProfileExam').textContent=p.exam;by('memberProfileExam').hidden=false}else by('memberProfileExam').hidden=true;
  if(p.photo){by('memberProfileAvatar').src=p.photo;by('memberProfileAvatar').hidden=false;by('memberProfileFallback').hidden=true}
  else{by('memberProfileAvatar').hidden=true;by('memberProfileFallback').textContent=(p.name||fallbackName||'?').slice(0,1).toUpperCase();by('memberProfileFallback').hidden=false}
  const mem=members.find(m=>m.uid===targetUid),t=explicitTimer||(mem?mem.timer:(targetUid===user?.uid?LobbyModel.cleanTimer(Study.liveSession()):null));
  if(t){by('memberProfileTotalHours').textContent=LobbyModel.hours(t.worked||0);by('memberProfileRoomHours').textContent=LobbyModel.hours(t.roomWorked||0);by('memberProfileStatusText').textContent=LobbyModel.describe(t)}
  else{by('memberProfileTotalHours').textContent='—';by('memberProfileRoomHours').textContent='—';by('memberProfileStatusText').textContent='Çevrimdışı'}
  const friendBtn=by('memberProfileFriendBtn');setupFriendButton(friendBtn,targetUid);
  try{if(modal.open)modal.close();if(typeof modal.showModal==='function')modal.showModal()}catch(e){}
 }

 function renderChat(){if(!active)return;for(const m of messages){const p=identity(m.uid);if(!profiles.has(m.uid))watchProfile(m.uid);const id=active;RoomChat.receive({...m,sender:p.name||'Odak arkadaşı',avatar:p.photo||'',uid:m.uid,time:typeof m.time==='number'?m.time:(m.time?.toMillis?.()||Date.now())},p,user&&m.uid===user.uid?()=>deleteDoc(ref('rooms',id,'messages',m.id)).catch(report):null)}}
 async function compress(image){if(!image||image.length<=450000)return image;const bitmap=await createImageBitmap(await(await fetch(image)).blob());try{const canvas=document.createElement('canvas'),ratio=Math.min(1,1024/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);let out=canvas.toDataURL('image/jpeg',.65);for(let q=.5;out.length>450000&&q>=.2;q-=.1)out=canvas.toDataURL('image/jpeg',q);if(out.length>450000)throw Error('photo-too-large');return out}finally{bitmap.close()}}
 function stopQuestions(){questionStop?.();questionStop=null;questionRoom='';questionLimit=12;questionAuthors.clear();pruneProfileListeners()}
 function watchQuestions(open){
  if(!open||!active||!own()){stopQuestions();return}const key=active+':'+questionLimit;if(questionStop&&questionRoom===key)return;questionStop?.();questionRoom=key;const op=operation(),id=active;
  questionStop=onSnapshot(query(collection(db,'rooms',id,'messages'),where('question','==',true),limit(questionLimit)),s=>{if(op.rev!==epoch||active!==id)return;const rows=s.docs.map(d=>({id:d.id,...d.data()}));questionAuthors=new Set(rows.map(q=>q.uid));for(const uid of questionAuthors)watchProfile(uid);window.FocusExtras?.questions?.(rows,s.docs.length===questionLimit&&questionLimit<60);pruneProfileListeners()},e=>{if(op.rev===epoch&&active===id)report(e)})
 }
 async function pinMessage(messageId,pinned){if(!own()||!active||!moderator()||!/^[A-Z2-9]{20}$/.test(messageId))throw Error('pin-not-allowed');const op=operation(),id=active;await updateDoc(ref('rooms',id,'messages',messageId),{pinned:pinned===true});op.check();if(id!==active)throw Error('room-changed');status(pinned?'Mesaj sabitlendi.':'Mesaj sabitlemesi kaldırıldı.')}
 async function resolveQuestion(messageId,solved){if(!own()||!active||!/^[A-Z2-9]{20}$/.test(messageId))throw Error('invalid-question');const op=operation(),id=active,target=ref('rooms',id,'messages',messageId);await runTransaction(db,async tx=>{op.check();const s=await tx.get(target);op.check();if(id!==active||!s.exists()||!s.data().question||(s.data().uid!==op.uid&&!moderator()))throw Error('not-question-owner');tx.update(target,{solved:solved===true})});op.check()}
 async function setRole(uid,role){if(!active||!own()||!manager()||protectedUid(uid)||uid===room.ownerUid||!['member','moderator'].includes(role))throw Error('role-not-allowed');const op=operation(),id=active;await updateDoc(ref('rooms',id,'members',uid),{role});op.check();status('Oda rolü güncellendi.')}
 async function setTheme(theme){if(!active||!own()||!manager()||!['night','aurora','ocean','sunset'].includes(theme))throw Error('theme-not-allowed');const op=operation(),id=active;await updateDoc(ref('rooms',id),{theme});op.check();status('Oda teması kaydedildi.')}
 async function saveShowcase(value){if(!own())throw Error('profile-not-ready');const op=operation(),s=window.ExtrasModel.showcase(value);const earned=window.ExtrasModel.earned(Study.totalSeconds());s.badges=s.badges.filter(id=>earned.some(m=>m.id===id));s.seconds=s.showHours?Math.floor(Study.totalSeconds()):Math.max(0,...earned.filter(m=>s.badges.includes(m.id)).map(m=>m.hours*3600));await updateDoc(ref('publicProfiles',op.uid),{showcase:s});op.check();showcaseWrite=Date.now()}
 async function syncQuiet(){if(!own())return;const op=operation(),until=Math.round(window.FocusExtras?.quietUntil?.()||0),ids=[...new Set([...saved.map(r=>r.id),active].filter(Boolean))].slice(0,100);for(let at=0;at<ids.length;at+=10){op.check();const group=ids.slice(at,at+10),results=await Promise.allSettled(group.map(id=>updateDoc(ref('rooms',id,'members',op.uid),{quietUntil:until})));op.check();const failure=results.findIndex((r,i)=>r.status==='rejected'&&group[i]===active);if(failure>=0)throw results[failure].reason}}
 async function preview(id,add){const op=operation();await runTransaction(db,async tx=>{op.check();const target=ref('rooms',id),s=await tx.get(target);op.check();if(!s.exists())return;const list=(s.data().previewUids||[]).slice(0,4),next=add?(list.includes(op.uid)?list:[...list,op.uid].slice(0,4)):list.filter(uid=>uid!==op.uid);if(JSON.stringify(next)!==JSON.stringify(list))tx.update(target,{previewUids:next})});op.check()}
 function transport(message){if(!active||!own())return false;if(historyPage)by('latestMessages').onclick();const op=operation(),id=active,uid=op.uid;void(async()=>{try{const image=await compress(message.image);op.check();if(id!==active)throw Error('room-changed');const text=message.text||'';const docData={uid,text,image,time:serverTimestamp()};if(message.question){docData.question=true;docData.solved=false}if(message.replyTo){docData.replyTo={id:String(message.replyTo.id||'').slice(0,30),sender:String(message.replyTo.sender||'').slice(0,50),text:String(message.replyTo.text||'').slice(0,200)}}await setDoc(ref('rooms',id,'messages',message.id),docData)}catch(e){if(op.rev===epoch&&active===id)RoomChat.rejected(message.id,'Mesaj saklanamadı. Bağlantını kontrol edip tekrar dene.')}})();return true}
 async function toggleReaction(messageId,emoji){if(!active||!own()||!['👍','❤️','🔥','👏','🎯','💡','🎉'].includes(emoji))return;const op=operation(),id=active,uid=op.uid;try{const target=ref('rooms',id,'messages',messageId);await runTransaction(db,async tx=>{op.check();const s=await tx.get(target);op.check();if(!s.exists())return;const reactions=s.data().reactions||{},current=reactions[emoji]||[],set=new Set(current);if(set.has(uid))set.delete(uid);else set.add(uid);const updated={...reactions};if(set.size)updated[emoji]=[...set];else delete updated[emoji];if(id!==active)throw Error('room-changed');tx.update(target,{reactions:updated})});op.check()}catch(e){if(op.rev===epoch)report(e)}}
 function stopRoom(){stopQuestions();pinAuthors.clear();window.FocusRoomTools?.pins?.([]);window.FocusRoomTools?.close?.();pokeControls.clear();memberViews.clear();for(const stop of roomStops)stop();roomStops=[];active='';room=null;members=[];messages=[];extrasState();if(by('questionMark'))by('questionMark').checked=false;loaded=false;historyPage=false;historyCursor=null;latest=[];by('chatHistory').hidden=true;by('permanentRoomSettings').hidden=true;by('clearChatConsent').checked=false;by('clearRoomChat').disabled=false;if(by('deleteRoomConsent'))by('deleteRoomConsent').checked=false;if(by('deleteRoomAction'))by('deleteRoomAction').disabled=false;roomBans=[];by('roomBanList').replaceChildren();RoomChat.reset();by('roomPanel').hidden=true;if(by('homeLobbyCoWorkers'))by('homeLobbyCoWorkers').hidden=true;if(by('chatRosterPane'))by('chatRosterPane').hidden=true;window.FocusNative?.room?.('');memberViews.clear();for(const id of ['roomMembers','homeLobbyList','chatRosterList'])by(id)?.replaceChildren();renderFriends();renderSaved();pruneProfileListeners()}
 async function deleteRoom(){if(!active||!manager()||!by('deleteRoomConsent')?.checked){status('Odayı silmek için onay kutusunu işaretle.');return}const op=operation(),id=active,btn=by('deleteRoomAction');if(btn)btn.disabled=true;try{await deleteLobbyCard(id,room?.name)}catch(e){if(op.rev===epoch)report(e)}finally{if(op.rev===epoch&&btn)btn.disabled=false}}

 async function pauseRoom(){const op=operation(),id=active;if(active&&own()){if(loaded){await flush(true);op.check();if(active!==id)throw Error('room-changed');const target=ref('rooms',id,'members',op.uid);await runTransaction(db,async tx=>{op.check();const current=await tx.get(target);op.check();if(active!==id)throw Error('room-changed');if(current.exists())tx.update(target,{timer:{...LobbyModel.cleanTimer(Study.liveSession()),running:false,roomWorked:current.data().timer.roomWorked},presenceAt:serverTimestamp(),online:false})});op.check()}sessionStorage.removeItem('focus_active_room_'+op.uid);storage.remove('focus_last_room_'+op.uid);storage.remove('focus_last_room');const url=new URL(location.href);url.searchParams.delete('club');history.replaceState(history.state,'',url.href)}op.check();stopRoom()}
 async function passwordProof(password,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:150000,hash:'SHA-256'},key,256);return [...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,'0')).join('')}

 async function join(id,password){
  const op=operation(),desiredQuiet=Math.round(window.FocusExtras?.quietUntil?.()||0);if(switching){status('Oda geçişi sürüyor…');return false}switching=true;try{
  if(!own()){status('Kalıcı odalar için giriş yapıp kullanıcı adını kaydet.');by('openAccount').click();return}id=model.roomId(id);if(!id){status('Geçerli bir oda ID’si yaz.');return}if(active===id)return true;status('Odaya bağlanılıyor…');
  const [snap,memberSnap,invitation,ban,kick,bookmark]=await Promise.all([getDocFromServer(ref('rooms',id)),getDoc(ref('rooms',id,'members',op.uid)),getDoc(ref('roomInvites',id+'_'+op.uid)),getDocFromServer(ref('rooms',id,'bans',op.uid)),getDocFromServer(ref('rooms',id,'kicks',op.uid)),getDoc(ref('users',op.uid,'rooms',id))]);op.check();if(!snap.exists()){status('Oda bulunamadı.');return}const next=snap.data();if(next.deleting){status('Bu oda kapatılıyor. Başka bir lobi seç.');return}let member=memberSnap;
  if(ban.exists()&&!admin()){status('Bu odadan yasaklandın. Lider yasağı kaldırmadan katılamazsın.');return}const kicked=member.exists()&&kick.exists()&&stamp(member.data().joinedAt)<=stamp(kick.data().at);
  if((!member.exists()||kicked)&&next.locked&&!invitation.exists()&&!admin()){const hash=await passwordProof(password,next.salt);op.check();await setDoc(ref('users',op.uid,'roomProofs',id),{hash,at:serverTimestamp()});op.check()}
  if(!member.exists()){const batch=writeBatch(db);batch.set(ref('users',op.uid,'rooms',id),{name:next.name});batch.set(ref('rooms',id,'members',op.uid),{uid:op.uid,joinedAt:serverTimestamp(),presenceAt:serverTimestamp(),online:true,timer:{...LobbyModel.cleanTimer(Study.liveSession()),roomWorked:0}});op.check();await batch.commit();op.check()}else if(kicked){await updateDoc(ref('rooms',id,'members',op.uid),{joinedAt:serverTimestamp(),presenceAt:serverTimestamp(),online:true,timer:{...LobbyModel.cleanTimer(Study.liveSession()),roomWorked:member.data().timer.roomWorked}});op.check();member=await getDocFromServer(ref('rooms',id,'members',op.uid));op.check()}
  if(member.exists()&&!bookmark.exists()){await setDoc(ref('users',op.uid,'rooms',id),{name:next.name});op.check()}
  if(desiredQuiet>0)await updateDoc(ref('rooms',id,'members',op.uid),{quietUntil:desiredQuiet});op.check();await pauseRoom();op.check();window.FocusTemporaryRoom?.leaveNow();active=id;unmarkRoomLeft(id);room=next;if(!saved.some(r=>r.id===id))saved.push({id,name:next.name});roomCache.set(id,{id,...next});saveRoomCache();roomSeconds=member.data()?.timer?.roomWorked||0;pendingSeconds=0;lastLocal=Study.localSeconds();lastWrite=0;lastState='';loaded=false;sessionStorage.setItem('focus_active_room_'+op.uid,id);storage.set('focus_last_room_'+op.uid,id);storage.set('focus_last_room',id);const currentUrl=new URL(location.href);currentUrl.searchParams.set('club',id);history.replaceState(history.state,'',currentUrl.href);by('roomPanel').hidden=false;by('roomCode').textContent=next.name+' · #'+id;by('leaveRoom').hidden=false;by('leaveRoom').textContent='Aktif odadan çık';by('leaveRoom').onclick=pendingButton(by('leaveRoom'),()=>roomTask(id,'leave',pauseRoom),'Ayrılınıyor…');by('copyInvite').onclick=action(async()=>{const copy=operation(),url=new URL(location.origin+location.pathname);url.searchParams.set('club',id);url.hash='lobi';await navigator.clipboard.writeText(url.href);copy.check();status('Oda daveti kopyalandı.')});RoomChat.configure(transport,{persistent:true,onReaction:toggleReaction});RoomChat.state(true);by('chatHistory').hidden=false;window.FocusNative?.room?.(id);
  document.querySelector('.chat-note').textContent='Bu kalıcı odanın mesajları ve fotoğrafları bulutta saklanır. Fotoğraf paylaşırken kişisel bilgileri ve başkalarının iznini gözet.';
  const roomError=e=>{if(op.rev===epoch&&active===id){if(e?.code==='permission-denied'){stopRoom();status('Oda erişimin kaldırıldı. Kişisel sayacını kullanmaya devam edebilirsin.')}else report(e)}};
  const expelled=text=>{if(op.rev!==epoch||active!==id||admin())return;sessionStorage.removeItem('focus_active_room_'+op.uid);stopRoom();status(text)};
  roomStops.push(onSnapshot(ref('rooms',id,'bans',op.uid),s=>{if(s.exists())expelled('Bu odadan yasaklandın. Kişisel sayacın kullanılabilir.')},roomError));
  roomStops.push(onSnapshot(ref('rooms',id,'kicks',op.uid),s=>{if(s.exists()&&stamp(s.data().at)>=stamp(member.data()?.joinedAt))expelled('Odadan çıkarıldın. İstersen tekrar katılabilirsin.')},roomError));
  roomStops.push(onSnapshot(ref('rooms',id),s=>{if(op.rev!==epoch||active!==id)return;if(s.exists()){room=s.data();roomCache.set(id,{id,...room});renderSaved();renderDirectory();if(room.deleting){stopRoom();status('Bu oda kapatılıyor. Başka bir lobi seç.');return}renderFriends();renderMembers()}else{stopRoom();status('Bu oda kapatıldı.')}},roomError));
  watchNudges(id,op);
  roomStops.push(onSnapshot(collection(db,'rooms',id,'members'),s=>{if(op.rev!==epoch||active!==id)return;members=s.docs.map(d=>d.data());window.FocusExtras?.applyQuiet?.(members.find(m=>m.uid===op.uid)?.quietUntil||0);for(const m of members)watchProfile(m.uid);loaded=true;renderMembers()},roomError));
  roomStops.push(onSnapshot(query(collection(db,'rooms',id,'messages'),orderBy('time','desc'),limit(20)),s=>{if(op.rev!==epoch||active!==id)return;latest=s.docs;if(!historyPage){historyCursor=s.docs.at(-1)||null;messages=s.docs.map(d=>({id:d.id,...d.data()})).reverse();RoomChat.retain(messages.map(m=>m.id));renderChat()}},roomError));
  roomStops.push(onSnapshot(query(collection(db,'rooms',id,'messages'),where('pinned','==',true),limit(8)),s=>{if(op.rev!==epoch||active!==id)return;const rows=s.docs.map(d=>({id:d.id,...d.data()}));pinAuthors=new Set(rows.map(m=>m.uid));for(const uid of pinAuthors)watchProfile(uid);window.FocusRoomTools?.pins?.(rows);pruneProfileListeners()},roomError));
  if(manager())roomStops.push(onSnapshot(collection(db,'rooms',id,'bans'),s=>{if(op.rev!==epoch||active!==id)return;roomBans=s.docs.map(d=>({id:d.id,...d.data()}));renderModeration()},roomError));
  status('Kalıcı odadasın. Üyeliğin saklanır; oda lideri çevrimdışıyken de çalışabilirsiniz.');renderSaved();renderFriends();extrasState();await flush();if(window.FocusExtras?.quietUntil?.())await syncQuiet();try{await preview(id,true)}catch(e){op.check();status('Oda açık; üye önizlemesi için yeni Firebase kuralları gerekiyor.')}return true;
  }finally{if(op.rev===epoch)switching=false}
 }
 function roomNumber(){const max=Math.floor(4294967296/90000000)*90000000;let value;do{value=crypto.getRandomValues(new Uint32Array(1))[0]}while(value>=max);return String(10000000+value%90000000)}
 async function create(){
  if(!own()){status('Önce Profilim’den kullanıcı adını tamamla.');by('createRoomSheet').close?.();by('openAccount').click();return}const op=operation(),name=by('permanentName').value.trim(),password=by('permanentPassword').value;
  if(!name||name.length>40){status('1–40 karakterlik bir oda adı yaz.');return}if(password&&password.length<6){status('Oda şifresi en az 6 karakter olmalı.');return}
  status('Odan oluşturuluyor…');const salt=crypto.randomUUID(),hash=password?await passwordProof(password,salt):'';op.check();let id='';
  for(let attempt=0;attempt<8;attempt++){const candidate=roomNumber();const created=await runTransaction(db,async tx=>{op.check();const r=ref('rooms',candidate),existing=await tx.get(r);op.check();if(existing.exists())return false;tx.set(r,{name,ownerUid:op.uid,locked:!!password,salt:password?salt:'',exam:'',createdAt:serverTimestamp()});if(password)tx.set(ref('rooms',candidate,'secrets','password'),{hash});return true});op.check();if(created){id=candidate;break}}
  if(!id)throw Error('room-code-collision');const created=await getDocFromServer(ref('rooms',id));op.check();if(created.exists()){roomCache.set(id,{id,...created.data()});if(!directory.some(r=>r.id===id))directory.unshift({id,...created.data()});renderDirectory()}status('Odan oluşturuldu; bağlanılıyor…');const joinedRoom=await join(id,password);op.check();if(joinedRoom!==true){status('Odan oluşturuldu. Lobilerden tekrar katılabilirsin.');return false}by('permanentPassword').value='';by('createRoomSheet').close?.();if(window.location)window.location.hash='lobi';
 }
 async function invite(uid){if(!active||!manager())return;const op=operation(),id=active;await setDoc(ref('roomInvites',id+'_'+uid),{from:op.uid,to:uid,roomId:id});op.check();if(active===id)status('Oda daveti gönderildi.')}
 async function search(){if(!own()){by('openAccount').click();return}const op=operation(),term=by('roomSearch').value.trim();if(!term){searchResults=null;renderDirectory();return}let rows=[];const id=model.roomId(term);if(id){const s=await getDocFromServer(ref('rooms',id));op.check();if(s.exists())rows=[{id:s.id,...s.data()}]}else{const s=await getDocsFromServer(query(collection(db,'rooms'),where('name','==',term),limit(20)));op.check();rows=s.docs.map(d=>({id:d.id,...d.data()}))}searchResults=rows;for(const r of rows){roomCache.set(r.id,r);watchProfile(r.ownerUid)}renderDirectory()}
 function cosmeticOptions(){
  const sets={nameFont:admin()?['default',...FocusCosmetics.fonts]:['default',...(entitlements.fonts||[])],nameStyle:admin()?['plain',...FocusCosmetics.palette]:['plain',...(entitlements.nameStyles||[])],avatarFrame:admin()?['none',...FocusCosmetics.palette]:['none',...(entitlements.frames||[])],namePlate:admin()?['none',...FocusCosmetics.palette]:['none',...(entitlements.plates||[])]};
  for(const [id,allowed] of Object.entries(sets)){const select=by(id);for(const option of select.options||[])option.disabled=!allowed.includes(option.value)}const tags=by('profileTag');if(tags){const current=tags.value;tags.replaceChildren();for(const value of ['none',...(admin()?['doctor']:[]),...(entitlements.tags||[])]){const option=document.createElement('option');option.value=value;option.textContent=value==='none'?'Etiketsiz':value==='doctor'?'[DOKTOR]':'['+value.slice(7)+']';tags.append(option)}tags.value=[...tags.options].some(o=>o.value===current)?current:(me?.cosmetics?.tag||'none')}by('adminCosmetics').hidden=false;by('cosmeticsHint').textContent=admin()?'[DOKTOR] etiketi ve seçtiğin görünüm hesabına kaydedilir. Odalarda, sohbetlerde ve oda kartlarında herkes aynı görünümü görür.':'Sahip olduğun kozmetikler hesabına kaydedilir ve herkes tarafından görülür. Henüz sahip olmadığın seçenekler kilitlidir.';window.FocusProfileStudio?.cosmetics?.();
 }
 async function saveIdentity(){
  if(!user?.emailVerified||banned)throw Error('social-profile-not-ready');const op=operation(),email=user.email;let username=by('socialUsername').value.trim().replace(/^@/,'').toLowerCase();if(admin())username='efe';if(username==='focusforyou'){status('@focusforyou sistem hesabına ayrılmıştır. Başka bir kullanıcı adı seç.');throw Error('reserved-username')}if(!model.username(username)){status('Kullanıcı adı: 3–24 küçük harf, rakam veya alt çizgi.');throw Error('invalid-username')}
  const base=window.FocusAccount.profile(),exam=by('examCategory').value||'',previousExam=me?.exam||'',cosmetics={font:by('nameFont').value||'default',tag:by('profileTag')?.value||(admin()?'doctor':'none'),nameStyle:by('nameStyle').value||'plain',frame:by('avatarFrame').value||'none',plate:by('namePlate').value||'none'};
  if(base.uid!==op.uid||!base.name||base.name.length>30)throw Error('account-changed');
  await runTransaction(db,async tx=>{op.check();const current=await tx.get(ref('publicProfiles',op.uid));op.check();const claim=await tx.get(ref('usernames',username));op.check();if(current.exists()&&current.data().username!==username)throw Error('username-immutable');if(claim.exists()&&claim.data().uid!==op.uid)throw Error('username-taken');tx.set(ref('usernames',username),{uid:op.uid});tx.set(ref('publicProfiles',op.uid),{uid:op.uid,username,name:base.name,photo:base.photo||'',exam,cosmetics,...(current.exists()&&current.data().showcase?{showcase:current.data().showcase}:{}),...(window.FocusProfileStudio?{banner:window.FocusProfileStudio.banner(current.exists()?current.data().banner:'')}:current.exists()&&current.data().banner?{banner:current.data().banner}:{})})});op.check();status('Profilin ve kozmetikleri buluta kaydedildi.');if(typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('focus-identity-ready',{detail:{uid:op.uid}}));if(exam!==previousExam&&model.exams.includes(exam)){try{await join(exam,'')}catch(e){op.check();status('Profilin kaydedildi. Genel odaya şimdi bağlanılamadı; Lobiler’den tekrar katılabilirsin.')}}return true;
 }
 async function seed(){if(user.email!=='efeozbilgin550@gmail.com')return;const op=operation();for(const exam of model.exams){op.check();const target=ref('rooms',exam);await runTransaction(db,async tx=>{op.check();const s=await tx.get(target);op.check();if(!s.exists()){tx.set(target,{name:exam+' çalışma odası',ownerUid:'focusforyou',locked:false,salt:'',exam,unlimited:true,createdAt:serverTimestamp()})}else if(s.data().ownerUid!=='focusforyou'||!s.data().unlimited){tx.update(target,{ownerUid:'focusforyou',unlimited:true})}});op.check()}}
 async function flush(force=false){if(!active||!own()||!loaded)return;const op=operation();if(writing){if(force){await writing;op.check();return flush(true)}return}const live=LobbyModel.cleanTimer(Study.liveSession()),now=Study.localSeconds(),state=live.phase+live.running+live.rounds;pendingSeconds+=Math.max(0,now-lastLocal);lastLocal=now;const delta=Date.now()-lastWrite;if(!force&&delta<(live.running?15000:60000)&&state===lastState)return;const id=active,uid=op.uid,amount=pendingSeconds,target=ref('rooms',id,'members',uid),task=runTransaction(db,async tx=>{op.check();const s=await tx.get(target);op.check();if(active!==id)throw Error('room-changed');if(!s.exists())throw Error('membership-missing');const total=Math.min(315360000,(s.data().timer?.roomWorked||0)+amount);tx.update(target,{timer:{...live,roomWorked:total},presenceAt:serverTimestamp(),online:true});return total});writing=task;try{const total=await task;op.check();if(id===active){roomSeconds=total;pendingSeconds=Math.max(0,pendingSeconds-amount);lastWrite=Date.now();lastState=state}}catch(e){if(op.rev===epoch)report(e);if(force)throw e}finally{if(writing===task)writing=null}}
 async function bind(next){
  const rev=++epoch;resetPending();pokeSending=null;pokeLastTarget='';pokeFailedTarget='';lastPokeSent=0;pokeControls.clear();roomTasks.clear();for(const stop of roomWatches.values())stop();roomWatches.clear();roomCache.clear();directory=[];searchResults=null;entitlements={};if(banStop)banStop();banStop=null;for(const s of moderationStops)s();moderationStops=[];banned=false;switching=false;stopRoom();for(const s of stops)s();stops=[];for(const s of profileStops.values())s();profileStops.clear();profiles.clear();user=next;me=null;saved=[];friends=[];invitations=[];restored=false;try{const raw=sessionStorage.getItem('focus_left_rooms_'+next?.uid);leftRooms.clear();for(const rid of obsoleteRooms)leftRooms.add(rid);if(raw)for(const rid of JSON.parse(raw))leftRooms.add(rid)}catch(e){leftRooms.clear();for(const rid of obsoleteRooms)leftRooms.add(rid)}
  if(next?.uid){for(const rid of obsoleteRooms){if(storage.get('focus_last_room_'+next.uid)===rid)storage.remove('focus_last_room_'+next.uid);if(sessionStorage.getItem('focus_active_room_'+next.uid)===rid)sessionStorage.removeItem('focus_active_room_'+next.uid);}}
  if(obsoleteRooms.includes(storage.get('focus_last_room')))storage.remove('focus_last_room');by('socialMember').hidden=!next?.emailVerified;by('socialGuest').hidden=!!next?.emailVerified;by('friendsMember').hidden=!next?.emailVerified;by('friendsGuest').hidden=!!next?.emailVerified;renderSaved();renderDirectory();
  if(!next?.emailVerified){renderDirectory();return;}
  // Cached cards are presentation only; opening a room still passes all live checks.
  try{const cards=JSON.parse(storage.get('focus_room_cards_'+next.uid)||'[]');if(Array.isArray(cards))saved=cards.slice(0,100).filter(r=>r&&model.roomId(r.id)&&typeof r.name==='string'&&r.name.length<=40&&!leftRooms.has(r.id));renderSaved()}catch(e){}
  const boundError=e=>{if(rev===epoch)report(e)};const [lock,ban]=await Promise.all([getDocFromServer(ref('deletions',next.uid)),getDocFromServer(ref('appBans',next.uid))]);if(rev!==epoch||lock.exists())return;banned=ban.exists()&&!admin();setBanState(banned);
  banStop=onSnapshot(ref('appBans',next.uid),s=>{if(rev!==epoch)return;const nextBan=s.exists()&&!admin();if(nextBan===banned)return;banned=nextBan;setBanState(banned);if(!banned)void bind(next)},boundError);
  by('adminModeration').hidden=!admin();
  if(admin()){
   moderationStops.push(onSnapshot(collection(db,'appBans'),s=>{if(rev!==epoch)return;appBans=s.docs.map(d=>({id:d.id,...d.data()}));for(const b of appBans)watchProfile(b.id);renderModeration()},boundError));

  }
  if(banned)return;
  stops.push(onSnapshot(ref('publicProfiles',next.uid),s=>{if(rev!==epoch)return;me=s.exists()?s.data():null;if(me){profiles.set(next.uid,me);window.FocusExtras?.loadProfile?.(me);by('socialUsername').value=me.username;by('socialUsername').readOnly=true;by('examCategory').value=me.exam||'';by('nameFont').value=me.cosmetics.font||'default';by('nameStyle').value=me.cosmetics.nameStyle;by('avatarFrame').value=me.cosmetics.frame;by('namePlate').value=me.cosmetics.plate;if(by('profileTag'))by('profileTag').value=me.cosmetics.tag;const restore=new URLSearchParams(location.search).get('club')||sessionStorage.getItem('focus_active_room_'+next.uid)||storage.get('focus_last_room_'+next.uid);if(!restored){restored=true;if(restore&&!leftRooms.has(restore))join(restore,'').catch(boundError)}}else{by('socialUsername').readOnly=false;by('socialUsername').value=next.email==='efeozbilgin550@gmail.com'?'efe':'';status('Arkadaşlıklar ve kalıcı odalar için @kullanıcıadını kaydet.')}cosmeticOptions();window.FocusProfileStudio?.profile?.(me||{uid:next.uid});renderMembers();renderSaved();renderDirectory();if(typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('focus-social-ready',{detail:{uid:next.uid}}))},boundError));
  stops.push(onSnapshot(collection(db,'users',next.uid,'rooms'),s=>{if(rev!==epoch)return;if(s.metadata?.fromCache&&s.docs.length===0&&saved.length)return;saved=s.docs.map(d=>({id:d.id,...d.data()})).filter(r=>!leftRooms.has(r.id));saveRoomCache();pruneRoomWatches();for(const r of saved)watchRoom(r.id);renderSaved();pruneProfileListeners()},boundError));
  stops.push(onSnapshot(ref('entitlements',next.uid),s=>{if(rev!==epoch)return;entitlements=s.exists()?s.data():{};cosmeticOptions()},boundError));
  stops.push(onSnapshot(query(collection(db,'rooms'),orderBy('createdAt','desc'),limit(24)),s=>{if(rev!==epoch)return;directory=s.docs.map(d=>({id:d.id,...d.data()}));for(const r of directory){roomCache.set(r.id,r);watchProfile(r.ownerUid)}renderDirectory();pruneProfileListeners()},boundError));
  stops.push(onSnapshot(query(collection(db,'friendships'),where('uids','array-contains',next.uid)),s=>{if(rev!==epoch)return;friends=s.docs.map(d=>({id:d.id,...d.data()}));renderFriends();pruneProfileListeners()},boundError));
  stops.push(onSnapshot(query(collection(db,'roomInvites'),where('to','==',next.uid)),s=>{if(rev!==epoch)return;invitations=s.docs.map(d=>({id:d.id,...d.data()}));renderInvites()},boundError));try{await seed()}catch(e){if(rev!==epoch)return;throw e}if(rev!==epoch)return;
  if(next.email==='efeozbilgin550@gmail.com'&&rev===epoch&&!me){by('socialUsername').value='efe'}
 }

 function setBanState(value){
  if(value){stopRoom();window.FocusTemporaryRoom?.leaveNow();by('socialMember').hidden=true;by('socialGuest').hidden=true;by('friendsMember').hidden=true;by('friendsGuest').hidden=false;sessionStorage.removeItem('focus_active_room_'+user.uid);status('Hesabının çevrimiçi özellikleri yasaklandı. Kişisel sayaç, verilerini indirme ve Profilim → Hesabımı sil kullanılabilir.');for(const id of ['savedRooms','friendList','roomInvitations','roomResults'])by(id).replaceChildren()}
  by('createRoom').disabled=value;by('joinRoom').disabled=value;
  if(typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('focus-moderation',{detail:{banned:value}}));
 }
 function renderModeration(){
  const roomList=by('roomBanList');roomList.replaceChildren();for(const b of roomBans){watchProfile(b.id);roomList.append(row('@'+(identity(b.id).username||b.id),[button('Oda yasağını kaldır',()=>deleteDoc(ref('rooms',active,'bans',b.id)))]))}if(!roomBans.length)roomList.textContent='Bu odada yasaklı hesap yok.';
  const appList=by('appBanList');appList.replaceChildren();for(const b of appBans)appList.append(row('@'+(identity(b.id).username||b.id),[button('Uygulama yasağını kaldır',()=>deleteDoc(ref('appBans',b.id)))]));if(!appBans.length)appList.textContent='Uygulamada yasaklı hesap yok.';
 }
 async function moderate(uid,kind){
  if(!own()||protectedUid(uid)||(kind==='appBan'?!admin():!active||!moderator()||(!manager()&&(uid===room.ownerUid||members.find(m=>m.uid===uid)?.role==='moderator'))))return;const op=operation(),id=active;
  const target=kind==='appBan'?ref('appBans',uid):ref('rooms',id,kind==='kick'?'kicks':'bans',uid);await setDoc(target,{by:op.uid,at:serverTimestamp()});op.check();status(kind==='kick'?'Üye odadan çıkarıldı; tekrar katılabilir.':kind==='roomBan'?'Üye bu odadan yasaklandı.':'Hesabın çevrimiçi özellikleri yasaklandı. Kişisel sayaç ve hesap silme kullanılabilir.');
 }
 by('moderateAccount').onclick=action(async()=>{if(!admin())return;const op=operation(),name=model.username(by('moderationUsername').value.trim().replace(/^@/,''));if(!name||name==='efe'){status('Geçerli bir kullanıcı adı yaz.');return}const s=await getDocFromServer(ref('usernames',name));op.check();if(!s.exists()){status('Kullanıcı bulunamadı.');return}await moderate(s.data().uid,'appBan')});
 by('saveIdentity').onclick=action(saveIdentity);by('createPermanent').onclick=pendingButton(by('createPermanent'),create,'Oluşturuluyor…');by('searchRooms').onclick=action(search);by('joinPermanent').onclick=pendingButton(by('joinPermanent'),()=>join(by('roomSearch').value.trim(),by('joinPassword').value),'Bağlanılıyor…');by('addFriend').onclick=action(async()=>{if(!own())return;const op=operation(),handle=model.username(by('friendUsername').value.trim().replace(/^@/,''));if(!handle){status('Geçerli bir @kullanıcıadı yaz.');return}const s=await getDoc(ref('usernames',handle));op.check();if(!s.exists()||s.data().uid===op.uid){status('Kullanıcı bulunamadı veya kendini eklemeye çalıştın.');return}const other=s.data().uid,id=model.pair(op.uid,other);await runTransaction(db,async tx=>{op.check();const f=await tx.get(ref('friendships',id));op.check();if(f.exists())return;tx.set(ref('friendships',id),{uids:[op.uid,other].sort(),from:op.uid,to:other,state:'pending'})});op.check();status('Arkadaşlık isteği gönderildi.')});
 by('examCategory').onchange=()=>{if(own())status('Sınav seçimini Profilini kaydet ile buluta kaydet. Genel sınav seçersen o odaya katılırsın.');};
 by('refreshLobby').onclick=action(async()=>{if(!own()){by('openAccount').click();return}const op=operation(),s=await getDocsFromServer(query(collection(db,'rooms'),orderBy('createdAt','desc'),limit(24)));op.check();directory=s.docs.map(d=>({id:d.id,...d.data()}));searchResults=null;renderDirectory()});
 for(const exam of model.exams)by('join'+exam).onclick=pendingButton(by('join'+exam),()=>roomTask(exam,'join',()=>join(exam,'')),'Bağlanılıyor…');
 setInterval(()=>{if(active){if(!document.hidden)paintPokeButtons();renderMembers();void flush()}void syncShowcaseHours()},1000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active)void flush(true).catch(()=>{})});
 by('clearRoomChat').onclick=action(async()=>{if(!active||!manager()||!by('clearChatConsent').checked){status('Sohbeti silmek için onay kutusunu işaretle.');return}const op=operation(),id=active,control=by('clearRoomChat');control.disabled=true;try{for(let page=0;page<1000;page++){op.check();if(active!==id)throw Error('room-changed');const rows=await getDocsFromServer(query(collection(db,'rooms',id,'messages'),limit(150)));op.check();if(active!==id)throw Error('room-changed');if(rows.empty){historyPage=false;latest=[];historyCursor=null;messages=[];RoomChat.retain([]);by('clearChatConsent').checked=false;status('Sohbet geçmişi ve fotoğraflar silindi.');return}const batch=writeBatch(db);for(const message of rows.docs)batch.delete(message.ref);op.check();await batch.commit();op.check()}throw Error('chat-cleanup-limit')}finally{if(op.rev===epoch)control.disabled=false}});
 const delRoomBtn=by('deleteRoomAction');if(delRoomBtn)delRoomBtn.onclick=action(deleteRoom);
 const adminDelBtn=by('adminDeleteRoomBtn');if(adminDelBtn)adminDelBtn.onclick=action(async()=>{if(!admin())return;const rid=by('adminDeleteRoomId')?.value?.trim().replace(/^#/,'');if(!rid){status('Silinecek oda ID numarasını gir.');return}await deleteLobbyCard(rid);if(by('adminDeleteRoomId'))by('adminDeleteRoomId').value=''});
 const closeProfBtn=by('closeMemberProfile');if(closeProfBtn)closeProfBtn.onclick=()=>by('memberProfileModal')?.close?.();
 by('olderMessages').onclick=action(async()=>{if(!active||!historyCursor)return;const op=operation(),id=active,rows=await getDocs(query(collection(db,'rooms',id,'messages'),orderBy('time','desc'),startAfter(historyCursor),limit(20)));op.check();if(id!==active)return;if(rows.empty){status('Sohbetin başlangıcına ulaştın.');return}historyPage=true;historyCursor=rows.docs.at(-1);messages=rows.docs.map(d=>({id:d.id,...d.data()})).reverse();RoomChat.retain(messages.map(m=>m.id));renderChat()});
 by('latestMessages').onclick=()=>{historyPage=false;historyCursor=latest.at(-1)||null;messages=latest.map(d=>({id:d.id,...d.data()})).reverse();RoomChat.retain(messages.map(m=>m.id));renderChat()};
 window.FocusSocial={pinMessage,setRole,setTheme,saveShowcase,syncQuiet,watchQuestions,resolveQuestion,moderate,moreQuestions:()=>{questionLimit=Math.min(60,questionLimit+12);watchQuestions(true)},memberState:uid=>{const v=projectedMembers(uid).find(m=>m.m.uid===uid);return uid&&uid===user?.uid?presence(Study.liveSession(),navigator.onLine!==false):v?presence(v.timer,v.fresh):'Çevrimdışı'},bind,saveIdentity,needsIdentity:()=>!!user?.emailVerified&&!banned&&!me?.username,pauseRoom,active:()=>active,banned:()=>banned,poke,setupPokeButton:pokeButton,openMemberProfile,getProfile:uid=>identity(uid),getMemberTimer:uid=>projectedMembers(uid).find(m=>m.m.uid===uid)?.timer,setupFriendButton,uid:()=>user?.uid||'',stop:()=>{++epoch;resetPending();pokeSending=null;pokeLastTarget='';pokeFailedTarget='';lastPokeSent=0;roomTasks.clear();for(const stop of roomWatches.values())stop();roomWatches.clear();roomCache.clear();directory=[];searchResults=null;entitlements={};if(banStop)banStop();banStop=null;for(const s of moderationStops)s();moderationStops=[];banned=false;setBanState(false);switching=false;stopRoom();for(const s of stops)s();stops=[];for(const s of profileStops.values())s();profileStops.clear();user=null;me=null;saved=[];leftRooms.clear();for(const rid of obsoleteRooms)leftRooms.add(rid);friends=[];invitations=[];profiles.clear();by('socialMember').hidden=true;by('socialGuest').hidden=false;by('friendsMember').hidden=true;by('friendsGuest').hidden=false;by('friendBadge').hidden=true;for(const id of ['savedRooms','friendList','roomInvitations','roomResults'])by(id).replaceChildren()},exportData:async()=>{
  if(!user)return {};const op=operation(),ownProfile=me,roomList=[...saved],ownFriends=[...friends],receivedInvitations=[...invitations],rooms=[];
  if(banned){const [rows,fs,is]=await Promise.all([getDocsFromServer(collection(db,'users',op.uid,'rooms')),getDocsFromServer(query(collection(db,'friendships'),where('uids','array-contains',op.uid))),getDocsFromServer(query(collection(db,'roomInvites'),where('to','==',op.uid)))]);op.check();roomList.splice(0,roomList.length,...rows.docs.map(d=>({id:d.id,...d.data()})));ownFriends.splice(0,ownFriends.length,...fs.docs.map(d=>({id:d.id,...d.data()})));receivedInvitations.splice(0,receivedInvitations.length,...is.docs.map(d=>({id:d.id,...d.data()})))}
  for(const r of roomList){const membership=await getDocFromServer(ref('rooms',r.id,'members',op.uid));op.check();const s=await getDocsFromServer(query(collection(db,'rooms',r.id,'messages'),where('uid','==',op.uid)));op.check();rooms.push({...r,membership:membership.exists()?membership.data():null,messages:s.docs.map(d=>({id:d.id,...d.data()}))})}
  const sent=await getDocsFromServer(query(collection(db,'roomInvites'),where('from','==',op.uid)));op.check();return {profile:ownProfile,rooms,friends:ownFriends,invitations:receivedInvitations,sentInvitations:sent.docs.map(d=>({id:d.id,...d.data()}))};
 }};
 return window.FocusSocial;
}
