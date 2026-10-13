'use strict';
(()=>{
 const by=id=>document.getElementById(id),model=window.FocusCosmetics,modal=by('cosmeticShop'),cards=new Map();let adminState=null,owner='',lastUsername='',trying='';
 const hours=n=>{const seconds=Math.max(0,Math.floor(Number(n)||0)),h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return [h?h.toLocaleString('tr-TR')+' sa':'',m?m+' dk':'',s||(!h&&!m)?s+' sn':''].filter(Boolean).join(' ')};
 const text=(node,value)=>{if(node.textContent!==value)node.textContent=value};
 function error(e){const map={'sign-in-required':'Önce giriş yap.','insufficient-hours':'Bu kozmetik için yeterli çalışma bakiyen yok.','already-owned':'Bu kozmetik zaten envanterinde.','invalid-username':'Geçerli bir @kullanıcıadı yaz.','user-not-found':'Bu kullanıcı bulunamadı.','invalid-tag':'Etiket 1–24 karakter olmalı.','admin-required':'Bu işlem yöneticiye özel.','online-banned':'Çevrimiçi özelliklerin yasaklı.'};return map[e?.message]||'İşlem tamamlanamadı. İnternet bağlantını kontrol et.'}
 function clearTryOn(){trying='';const panel=by('cosmeticTryOn');panel.hidden=true;panel.replaceChildren();for(const r of cards.values())if(r.tryButton){r.tryButton.textContent='Dene';r.tryButton.setAttribute('aria-pressed','false')}}
 function tryOn(item){
  const own=window.FocusAccount?.profile?.()||{},social=window.FocusSocial?.getProfile?.(own.uid)||{},profile={...own,...social},c={...(profile.cosmetics||{})};c[({name:'nameStyle',frame:'frame',plate:'plate',font:'font'})[item.kind]]=item.value;const panel=by('cosmeticTryOn');panel.replaceChildren();panel.hidden=false;trying=item.id;
  const title=document.createElement('h3');title.textContent=item.label+' · Deneme';const identity=document.createElement('div');identity.className='try-on-identity';const avatar=document.createElement('span');avatar.className='cosmetic-avatar'+(c.frame&&c.frame!=='none'?' frame-'+c.frame:'');if(profile.photo){const img=document.createElement('img');img.src=profile.photo;img.alt='Profil fotoğrafın';img.referrerPolicy='no-referrer';avatar.append(img)}else avatar.textContent=(profile.name||'F').slice(0,1).toUpperCase();const name=document.createElement('strong');name.textContent=profile.name||'Focus';if(window.SocialModel)window.SocialModel.decorate(name,{...profile,cosmetics:c});else name.className='font-'+(c.font||'default')+' name-'+(c.nameStyle||'plain')+' plate-'+(c.plate||'none');identity.append(avatar,name);const hint=document.createElement('small');hint.textContent='Bu görünüm yalnızca burada deneniyor. Profilin ve envanterin değişmedi.';const reset=document.createElement('button');reset.type='button';reset.className='pill';reset.textContent='Denemeyi bitir';reset.onclick=clearTryOn;panel.append(title,identity,hint,reset);for(const r of cards.values()){r.tryButton.textContent=r.id===trying?'Deneniyor':'Dene';r.tryButton.setAttribute('aria-pressed',String(r.id===trying))}panel.scrollIntoView?.({block:'nearest',behavior:'smooth'});
 }
 function build(state){
  cards.clear();const list=by('shopItems');list.replaceChildren();
  for(const item of model.catalog()){
   const card=document.createElement('article');card.className='cosmetic-item';const preview=document.createElement('div');preview.className='cosmetic-preview';
   if(item.kind==='frame'){const avatar=document.createElement('span');avatar.className='cosmetic-avatar frame-'+item.value;avatar.textContent='F';preview.append(avatar)}else{const name=document.createElement('strong');name.textContent=item.kind==='font'?(window.FocusAccount?.profile?.()?.name||'Focus'):'Focus';name.className=(item.kind==='font'?'font-':item.kind==='name'?'name-':'plate-')+item.value;if(item.kind==='plate'&&window.SocialModel)SocialModel.decorate(name,{cosmetics:{plate:item.value}});preview.append(name)}
   const label=document.createElement('h4');label.textContent=item.label;const buy=document.createElement('button');buy.type='button';buy.className='pill';const record={id:item.id,buy,busy:false};
   buy.onclick=()=>act(()=>window.FocusCosmeticStore.purchase(item.id),record,by('shopStatus'),'Envanterine eklendi. Profilinden kullanabilirsin.');card.append(preview,label,buy);
   if(state.admin){
    const gift=document.createElement('button');gift.type='button';gift.className='pill gift-item';gift.textContent='Hediye et';gift.setAttribute('aria-expanded','false');
    const form=document.createElement('form');form.className='gift-item-form';form.hidden=true;
    const input=document.createElement('input');input.placeholder='@kullanıcıadı';input.maxLength=25;input.autocomplete='off';input.required=true;input.setAttribute('aria-label',item.label+' hediye edilecek kullanıcı');
    const send=document.createElement('button');send.type='submit';send.className='pill';send.textContent='Gönder';const status=document.createElement('small');status.setAttribute('role','status');form.append(input,send,status);
    gift.onclick=()=>{form.hidden=!form.hidden;gift.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden){if(!input.value)input.value=lastUsername;input.focus()}};
    record.send=send;form.onsubmit=e=>{e.preventDefault();lastUsername=input.value.trim();return act(()=>window.FocusCosmeticStore.grant(lastUsername,item.id),record,status,'@'+lastUsername.replace(/^@/,'')+' envanterine verildi. ✓')};card.append(gift,form);
   }
   const tryButton=document.createElement('button');tryButton.type='button';tryButton.className='pill try-item';tryButton.textContent='Dene';tryButton.setAttribute('aria-pressed','false');tryButton.onclick=()=>tryOn(item);record.tryButton=tryButton;card.append(tryButton);
   cards.set(item.id,record);list.append(card);
  }
 }
 function renderTotal(){const study=window.Study||(typeof Study!=='undefined'?Study:null);text(by('shopTotalStudy'),'Toplam çalışman: '+hours(study?.totalSeconds?.()||0)+' · İlerleme kaydın; mağaza bakiyesinden ayrıdır.')}
 function render(){
  renderTotal();
  const store=window.FocusCosmeticStore,state=store?.snapshot?.()||{};
  text(by('shopBalance'),state.loading?'Yükleniyor…':state.error?'Senkronizasyon bekleniyor':hours(state.balance||0));text(by('shopEarned'),state.error?'Çalışma bakiyesi buluta kaydedilemedi. Bağlantı ve hesabın e-posta doğrulamasını kontrol et; otomatik yeniden denenecek.':'Kazanılan '+hours(state.earnedSeconds||0)+' · Harcanan '+hours(state.spentSeconds||0));by('cosmeticAdmin').hidden=!state.admin;
  if(adminState!==!!state.admin||owner!==(state.uid||'')){adminState=!!state.admin;owner=state.uid||'';lastUsername='';clearTryOn();build(state)}
  for(const item of model.catalog()){const record=cards.get(item.id),owned=store?.owned?.(item.id);text(record.buy,owned?'Envanterinde':(item.cost/3600).toLocaleString('tr-TR')+' saat · Satın al');record.buy.disabled=record.busy||!!owned||!state.uid||state.banned||state.balance<item.cost;if(record.send)record.send.disabled=record.busy||!state.admin||state.banned;}
 }
 async function act(fn,record,status,success){if(record?.busy)return;if(record)record.busy=true;render();text(status,'Gönderiliyor…');try{await fn();text(status,success)}catch(e){text(status,error(e))}finally{if(record)record.busy=false;render()}}
 by('openCosmeticShop').onclick=()=>{render();modal.showModal()};by('closeCosmeticShop').onclick=()=>modal.close();
 modal.addEventListener('close',clearTryOn);
 by('giftTagAction').onclick=async()=>{const button=by('giftTagAction');if(button.disabled)return;button.disabled=true;try{await window.FocusCosmeticStore.grantTag(by('giftUsername').value,by('giftTag').value);text(by('shopStatus'),'Özel etiket kullanıcının envanterine verildi.')}catch(e){text(by('shopStatus'),error(e))}finally{button.disabled=false}};
 setInterval(()=>{if(modal.open&&!document.hidden)renderTotal()},1000);
 addEventListener('focus-cosmetics',()=>{if(modal.open)render()});render();
})();

