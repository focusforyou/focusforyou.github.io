'use strict';
(()=>{
 const by=id=>document.getElementById(id);
 const THEME_KEY='focus_theme',ANIM_KEY='focus_bg_anim';

 function applyTheme(theme,save=true){
  const isLight=theme==='light';
  document.documentElement.classList.toggle('theme-light',isLight);
  if(document.body)document.body.classList.toggle('theme-light',isLight);
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content',isLight?'#EDF2FC':'#0A1128');

  const darkBtn=by('themeDarkBtn'),lightBtn=by('themeLightBtn');
  if(darkBtn){
   darkBtn.setAttribute('aria-pressed',String(!isLight));
   darkBtn.classList.toggle('active',!isLight);
  }
  if(lightBtn){
   lightBtn.setAttribute('aria-pressed',String(isLight));
   lightBtn.classList.toggle('active',isLight);
  }
  const info=by('currentThemeInfo');
  if(info)info.textContent=isLight?'Beyaz Mod (Açık)':'Siyah Mod (Koyu)';

  if(save){
   try{localStorage.setItem(THEME_KEY,isLight?'light':'dark')}catch(e){}
  }
  window.dispatchEvent(new CustomEvent('focus-theme-change',{detail:{theme:isLight?'light':'dark'}}));
 }

 function applyBgAnim(enabled,save=true){
  const on=enabled!==false&&enabled!=='off';
  const sky=by('sky');
  if(sky){
   sky.hidden=!on;
   sky.style.display=on?'':'none';
  }
  window.FocusSkyAnim=on;
  if(on&&typeof window.FocusSky?.resume==='function'){
   window.FocusSky.resume();
  }

  const onBtn=by('bgAnimOnBtn'),offBtn=by('bgAnimOffBtn');
  if(onBtn){
   onBtn.setAttribute('aria-pressed',String(on));
   onBtn.classList.toggle('active',on);
  }
  if(offBtn){
   offBtn.setAttribute('aria-pressed',String(!on));
   offBtn.classList.toggle('active',!on);
  }
  const label=by('bgAnimStateLabel');
  if(label)label.textContent=on?'Animasyon Açık':'Animasyon Kapalı';
  const info=by('currentAnimInfo');
  if(info)info.textContent=on?'Animasyon Açık':'Animasyon Kapalı';

  if(save){
   try{localStorage.setItem(ANIM_KEY,on?'on':'off')}catch(e){}
  }
  window.dispatchEvent(new CustomEvent('focus-anim-change',{detail:{enabled:on}}));
 }

 let savedTheme='dark',savedAnim='on';
 try{
  savedTheme=localStorage.getItem(THEME_KEY)||'dark';
  savedAnim=localStorage.getItem(ANIM_KEY)||'on';
 }catch(e){}

 // Apply immediately before full DOM if called early
 applyTheme(savedTheme,false);
 applyBgAnim(savedAnim!=='off',false);

 function init(){
  applyTheme(savedTheme,false);
  applyBgAnim(savedAnim!=='off',false);

  by('themeDarkBtn')?.addEventListener('click',()=>applyTheme('dark'));
  by('themeLightBtn')?.addEventListener('click',()=>applyTheme('light'));
  by('bgAnimOnBtn')?.addEventListener('click',()=>applyBgAnim(true));
  by('bgAnimOffBtn')?.addEventListener('click',()=>applyBgAnim(false));

  const sFocus=by('settingsFocusMinutes'),sBreak=by('settingsBreakMinutes');
  const oFocus=by('focusMinutes'),oBreak=by('breakMinutes');
  if(sFocus&&oFocus)sFocus.value=oFocus.value||'25';
  if(sBreak&&oBreak)sBreak.value=oBreak.value||'5';

  by('settingsSaveDurations')?.addEventListener('click',()=>{
   if(oFocus&&sFocus)oFocus.value=sFocus.value;
   if(oBreak&&sBreak)oBreak.value=sBreak.value;
   by('saveDurations')?.click();
   if(sFocus&&oFocus)sFocus.value=oFocus.value;
   if(sBreak&&oBreak)sBreak.value=oBreak.value;
   const fb=by('settingsDurationsFeedback');
   if(fb){
    fb.textContent=by('settingsMessage')?.textContent||'Süreler kaydedildi!';
    const message=fb.textContent;
    setTimeout(()=>{if(fb.textContent===message)fb.textContent='';},2500);
   }
  });
 }

 window.addEventListener('focus-preferences-change',()=>{
  for(const [target,source] of [['settingsFocusMinutes','focusMinutes'],['settingsBreakMinutes','breakMinutes']]){
   if(by(target)&&by(source))by(target).value=by(source).value;
  }
 });

 if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',init);
 }else{
  init();
 }

 window.FocusSettings={
  applyTheme,
  applyBgAnim,
  get theme(){return document.documentElement.classList.contains('theme-light')?'light':'dark'},
  get anim(){return window.FocusSkyAnim!==false}
 };
})();
