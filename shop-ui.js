'use strict';
(()=>{
 const by=id=>document.getElementById(id),model=window.FocusCosmetics,modal=by('cosmeticShop'),cards=new Map();let adminState=null,owner='',lastUsername='';
 const hours=n=>{const seconds=Math.max(0,Math.floor(Number(n)||0)),h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return [h?h.toLocaleString('tr-TR')+' sa':'',m?m+' dk':'',s||(!h&&!m)?s+' sn':''].filter(Boolean).join(' ')};
 const text=(node,value)=>{if(node.textContent!==value)node.textContent=value};
 function error(e){const map={'sign-in-required':'Önce giriş yap.','insufficient-hours':'Bu kozmetik için 1.000 saat kullanılabilir bakiye gerekiyor.','already-owned':'Bu kozmetik zaten envanterinde.','invalid-username':'Geçerli bir @kullanıcıadı yaz.','user-not-found':'Bu kullanıcı bulunamadı.','invalid-tag':'Etiket 1–24 karakter olmalı.','admin-required':'Bu işlem yöneticiye özel.','online-banned':'Çevrimiçi özelliklerin yasaklı.'};return map[e?.message]||'İşlem tamamlanamadı. İnternet bağlantını kontrol et.'}
 function build(state){
  cards.clear();const list=by('shopItems');list.replaceChildren();
  for(const item of model.catalog()){
   const card=document.createElement('article');card.className='cosmetic-item';const preview=document.createElement('div');preview.className='cosmetic-preview';
   if(item.kind==='frame'){const avatar=document.createElement('span');avatar.className='cosmetic-avatar frame-'+item.value;avatar.textContent='F';preview.append(avatar)}else{const name=document.createElement('strong');name.textContent=item.kind==='font'?(window.FocusAccount?.profile?.()?.name||'Focus'):'Focus';name.className=(item.kind==='font'?'font-':item.kind==='name'?'name-':'plate-')+item.value;preview.append(name)}
   const label=document.createElement('h4');label.textContent=item.label;const buy=document.createElement('button');buy.type='button';buy.className='pill';const record={buy,busy:false};
   buy.onclick=()=>act(()=>window.FocusCosmeticStore.purchase(item.id),record,by('shopStatus'),'Envanterine eklendi. Profilinden kullanabilirsin.');card.append(preview,label,buy);
   if(state.admin){
    const gift=document.createElement('button');gift.type='button';gift.className='pill gift-item';gift.textContent='Hediye et';gift.setAttribute('aria-expanded','false');
    const form=document.createElement('form');form.className='gift-item-form';form.hidden=true;
    const input=document.createElement('input');input.placeholder='@kullanıcıadı';input.maxLength=25;input.autocomplete='off';input.required=true;input.setAttribute('aria-label',item.label+' hediye edilecek kullanıcı');
    const send=document.createElement('button');send.type='submit';send.className='pill';send.textContent='Gönder';const status=document.createElement('small');status.setAttribute('role','status');form.append(input,send,status);
    gift.onclick=()=>{form.hidden=!form.hidden;gift.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden){if(!input.value)input.value=lastUsername;input.focus()}};
    record.send=send;form.onsubmit=e=>{e.preventDefault();lastUsername=input.value.trim();return act(()=>window.FocusCosmeticStore.grant(lastUsername,item.id),record,status,'@'+lastUsername.replace(/^@/,'')+' envanterine verildi. ✓')};card.append(gift,form);
   }
   cards.set(item.id,record);list.append(card);
  }
 }
 function render(){
  const store=window.FocusCosmeticStore,state=store?.snapshot?.()||{};
  text(by('shopBalance'),state.loading?'Yükleniyor…':state.error?'Senkronizasyon bekleniyor':hours(state.balance||0));text(by('shopEarned'),state.error?'Çalışma bakiyesi buluta kaydedilemedi. Bağlantı ve hesabın e-posta doğrulamasını kontrol et; otomatik yeniden denenecek.':'Kazanılan '+hours(state.earnedSeconds||0)+' · Harcanan '+hours(state.spentSeconds||0));by('cosmeticAdmin').hidden=!state.admin;
  if(adminState!==!!state.admin||owner!==(state.uid||'')){adminState=!!state.admin;owner=state.uid||'';lastUsername='';build(state)}
  for(const item of model.catalog()){const record=cards.get(item.id),owned=store?.owned?.(item.id);text(record.buy,owned?'Envanterinde':'1.000 saat · Satın al');record.buy.disabled=record.busy||!!owned||!state.uid||state.banned||state.balance<item.cost;if(record.send)record.send.disabled=record.busy||!state.admin||state.banned;}
 }
 async function act(fn,record,status,success){if(record?.busy)return;if(record)record.busy=true;render();text(status,'Gönderiliyor…');try{await fn();text(status,success)}catch(e){text(status,error(e))}finally{if(record)record.busy=false;render()}}
 by('openCosmeticShop').onclick=()=>{render();modal.showModal()};by('closeCosmeticShop').onclick=()=>modal.close();
 by('giftTagAction').onclick=async()=>{const button=by('giftTagAction');if(button.disabled)return;button.disabled=true;try{await window.FocusCosmeticStore.grantTag(by('giftUsername').value,by('giftTag').value);text(by('shopStatus'),'Özel etiket kullanıcının envanterine verildi.')}catch(e){text(by('shopStatus'),error(e))}finally{button.disabled=false}};
 addEventListener('focus-cosmetics',()=>{if(modal.open)render()});render();
})();
