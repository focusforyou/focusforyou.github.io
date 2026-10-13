'use strict';
const ProfileEditModel=(()=>{
 function draft(){let uid='',base={},value={};return {
  load(owner,next){if(owner!==uid){uid=owner;base={...next};value={...next};return {...value}}const edits=Object.fromEntries(Object.entries(value).filter(([k,v])=>v!==base[k]));base={...next};value={...next,...edits};return {...value}},
  set(next){if(uid)value={...next}},
  revert(){value={...base};return {...value}},
  commit(next){base={...next};value={...next}},
  get dirty(){return !!uid&&Object.keys({...base,...value}).some(k=>base[k]!==value[k])},
  get uid(){return uid},get value(){return {...value}},get base(){return {...base}}
 }}return {draft};
})();
if(typeof module!=='undefined')module.exports=ProfileEditModel;
if(typeof window!=='undefined')(()=>{
 const by=id=>document.getElementById(id),model=ProfileEditModel.draft();
 const fields=['profileName','socialUsername','examCategory','nameFont','nameStyle','avatarFrame','namePlate','profileTag','showcaseBio'];
 let ready=false,saving=false,hydrating=false,bar,note,discard;
 function read(){const values=Object.fromEntries(fields.map(id=>[id,by(id)?.value||'']));values.photo=by('profileAvatar')?.hidden?'':by('profileAvatar')?.getAttribute('src')||'';values.banner=window.FocusProfileStudio?.banner?.('')||'';values.showcaseHours=String(!!by('showcaseHours')?.checked);values.badges=JSON.stringify([...by('showcaseBadges')?.querySelectorAll('input:checked')||[]].map(i=>i.value).sort());return values}
 function write(values){for(const id of fields)if(by(id))by(id).value=values[id]||'';if(by('showcaseHours'))by('showcaseHours').checked=values.showcaseHours==='true';const badges=JSON.parse(values.badges||'[]');for(const input of by('showcaseBadges')?.querySelectorAll('input')||[])input.checked=badges.includes(input.value)}
 function paint(){if(!ready)return;const onboarding=window.FocusAccountUI?.mode==='onboarding';bar.hidden=!model.dirty&&!onboarding&&!saving;by('saveProfile').hidden=!model.dirty&&!onboarding&&!saving;discard.hidden=!model.dirty;discard.disabled=saving;bar.classList.toggle('saving',saving);by('profileControls').classList.toggle('profile-saving',saving);for(const node of by('profileControls').querySelectorAll('.studio-layout,.studio-tabs'))node.inert=saving;note.textContent=saving?'Değişiklikler kaydediliyor…':model.dirty?'Kaydedilmemiş değişiklikler var.':'Profilini tamamlayıp kaydet.'}
 function sync(){if(!ready||hydrating||saving)return;const owner=window.FocusAccount?.profile?.()?.uid||'';if(owner!==model.uid){model.load(owner,read());paint();return}model.set(read());paint()}
 function hydrate(p){if(!ready)return;hydrating=true;const owner=window.FocusAccount?.profile?.()?.uid||p?.uid||'';const current=read();const base=window.FocusAccount?.profile?.()||{};const next={...current,profileName:base.name||'',photo:base.photo||'',banner:p?.banner||'',socialUsername:p?.username||current.socialUsername,examCategory:p?.exam||'',nameFont:p?.cosmetics?.font||'default',nameStyle:p?.cosmetics?.nameStyle||'plain',avatarFrame:p?.cosmetics?.frame||'none',namePlate:p?.cosmetics?.plate||'none',profileTag:p?.cosmetics?.tag||'none'};if(p?.showcase){next.showcaseBio=p.showcase.bio||'';next.showcaseHours=String(!!p.showcase.showHours);next.badges=JSON.stringify([...(p.showcase.badges||[])].sort())}write(model.load(owner,next));hydrating=false;paint()}
 function warn(){paint();if(!model.dirty&&!saving)return false;note.textContent=saving?'Kaydetme işleminin bitmesini bekle.':'Çıkmadan önce değişiklikleri kaydet veya iptal et.';bar.classList.remove('attention');void bar.offsetWidth;bar.classList.add('attention');bar.scrollIntoView({block:'nearest',behavior:'smooth'});return true}
 function revert(){if(saving)return;hydrating=true;window.FocusAccount?.discardProfileDraft?.();window.FocusExtras?.discardProfileDraft?.();window.FocusProfileStudio?.discard?.();write(model.revert());hydrating=false;window.FocusProfileStudio?.refresh?.();window.FocusProfileStudio?.cosmetics?.();by('accountStatus').textContent='Değişiklikler iptal edildi.';sync()}
 function init(){if(ready)return;ready=true;const controls=by('profileControls'),sheet=by('accountSheet'),save=by('saveProfile');bar=document.createElement('div');bar.className='profile-save-bar';bar.id='profileSaveBar';bar.hidden=true;bar.setAttribute('role','status');bar.setAttribute('aria-live','polite');note=document.createElement('span');discard=document.createElement('button');discard.type='button';discard.className='pill';discard.textContent='İptal et';discard.onclick=revert;bar.append(note,discard,save);controls.append(bar);const extraSave=controls.querySelector('.showcase-editor button');if(extraSave)extraSave.hidden=true;
  const close=sheet.close.bind(sheet);sheet.close=value=>{if(model.dirty||saving){warn();return}close(value)};
  sheet.addEventListener('cancel',e=>{if(model.dirty||saving){e.preventDefault();e.stopImmediatePropagation();warn()}},true);
  sheet.addEventListener('submit',e=>{if(e.target.method==='dialog'&&(model.dirty||saving)){e.preventDefault();e.stopImmediatePropagation();warn()}},true);
  controls.addEventListener('input',sync);controls.addEventListener('change',sync);
  addEventListener('beforeunload',e=>{if(model.dirty||saving){e.preventDefault();e.returnValue=''}});
  addEventListener('focus-profile',()=>{const owner=window.FocusAccount?.profile?.()?.uid||'';if(owner!==model.uid)hydrate({uid:owner})});
  const p=window.FocusSocial?.getProfile?.(window.FocusSocial?.uid?.());hydrate(p);paint();
 }
 window.FocusProfileEditor={sync,hydrate,warn,get dirty(){return model.dirty},get savingState(){return saving},saving(value){saving=!!value;paint()},committed(){model.commit(read());saving=false;paint()},mode:paint};
 if(document.readyState==='loading')addEventListener('DOMContentLoaded',init);else init();
})();

