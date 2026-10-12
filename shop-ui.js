'use strict';
(()=>{
 const by=id=>document.getElementById(id),model=window.FocusCosmetics,modal=by('cosmeticShop');
 const hours=n=>(Math.max(0,n)/3600).toLocaleString('tr-TR',{maximumFractionDigits:1})+' saat';
 function render(){
  const store=window.FocusCosmeticStore,state=store?.snapshot?.()||{};
  by('shopBalance').textContent=hours(state.balance||0);
  by('shopEarned').textContent='Kazanılan '+hours(state.earnedSeconds||0)+' · Harcanan '+hours(state.spentSeconds||0);
  by('cosmeticAdmin').hidden=!state.admin;
  const list=by('shopItems');list.replaceChildren();
  for(const item of model.catalog()){
   const card=document.createElement('article');card.className='cosmetic-item';
   const preview=document.createElement('div');preview.className='cosmetic-preview';
   if(item.kind==='frame'){const avatar=document.createElement('span');avatar.className='cosmetic-avatar frame-'+item.value;avatar.textContent='F';preview.append(avatar)}
   else{const name=document.createElement('strong');name.textContent=item.kind==='font'?(window.FocusAccount?.profile?.()?.name||'Focus'):'Focus';name.className=(item.kind==='font'?'font-':item.kind==='name'?'name-':'plate-')+item.value;preview.append(name)}
   const label=document.createElement('h4');label.textContent=item.label;
   const button=document.createElement('button');button.type='button';button.className='pill';
   const owned=store?.owned?.(item.id);button.textContent=owned?'Envanterinde':'1.000 saat · Satın al';button.disabled=!!owned||!state.uid||state.banned||state.balance<item.cost;
   button.onclick=()=>act(async()=>{await store.purchase(item.id);by('shopStatus').textContent='Envanterine eklendi. Profilinden kullanabilirsin.'},button);
   card.append(preview,label,button);list.append(card);
  }
 }
 function error(e){const map={'sign-in-required':'Önce giriş yap.','insufficient-hours':'Bu kozmetik için 1.000 saat kullanılabilir bakiye gerekiyor.','already-owned':'Bu kozmetik zaten envanterinde.','invalid-username':'Geçerli bir @kullanıcıadı yaz.','user-not-found':'Bu kullanıcı bulunamadı.','invalid-tag':'Etiket 1–24 karakter olmalı.','admin-required':'Bu işlem yöneticiye özel.','online-banned':'Çevrimiçi özelliklerin yasaklı.'};return map[e?.message]||'İşlem tamamlanamadı. İnternet bağlantını kontrol et.'}
 async function act(fn,button){if(button)button.disabled=true;try{await fn()}catch(e){by('shopStatus').textContent=error(e)}finally{render()}}
 by('openCosmeticShop').onclick=()=>{render();modal.showModal()};
 by('closeCosmeticShop').onclick=()=>modal.close();
 for(const item of model.catalog()){const option=document.createElement('option');option.value=item.id;option.textContent=item.label;by('giftCosmetic').append(option)}
 by('giftCosmeticAction').onclick=()=>act(async()=>{await window.FocusCosmeticStore.grant(by('giftUsername').value,by('giftCosmetic').value);by('shopStatus').textContent='Kozmetik kullanıcının bulut envanterine verildi.'},by('giftCosmeticAction'));
 by('giftTagAction').onclick=()=>act(async()=>{await window.FocusCosmeticStore.grantTag(by('giftUsername').value,by('giftTag').value);by('shopStatus').textContent='Özel etiket kullanıcının envanterine verildi.'},by('giftTagAction'));
 addEventListener('focus-cosmetics',()=>{if(modal.open)render()});
 render();
})();

