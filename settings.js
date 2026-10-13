'use strict';
(()=>{
 const by=id=>document.getElementById(id);
 const THEME_KEY='focus_theme',ANIM_KEY='focus_bg_anim';

 const THEMES={dark:['Siyah Mod (Koyu)','#0A1128','themeDarkBtn'],light:['Beyaz Mod (Açık)','#EDF2FC','themeLightBtn'],amoled:['AMOLED (Tam siyah)','#000000','themeAmoledBtn'],forest:['Orman','#081c16','themeForestBtn'],ocean:['Okyanus','#071c2b','themeOceanBtn'],dusk:['Mor Gece','#1a1029','themeDuskBtn']};
 let currentTheme='dark';
 function applyTheme(theme,save=true){
  theme=Object.hasOwn(THEMES,theme)?theme:'dark';currentTheme=theme;
  for(const [key,value]of Object.entries(THEMES)){
   for(const node of [document.documentElement,document.body])node?.classList.toggle('theme-'+key,key===theme);
   const button=by(value[2]);if(button){button.setAttribute('aria-pressed',String(key===theme));button.classList.toggle('active',key===theme)}
  }
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',THEMES[theme][1]);
  const info=by('currentThemeInfo');if(info)info.textContent=THEMES[theme][0];
  if(save)try{localStorage.setItem(THEME_KEY,theme)}catch(e){}
  window.dispatchEvent(new CustomEvent('focus-theme-change',{detail:{theme}}));
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

  for(const [key,value]of Object.entries(THEMES))by(value[2])?.addEventListener('click',()=>applyTheme(key));
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
  get theme(){return currentTheme},
  get anim(){return window.FocusSkyAnim!==false}
 };
})();

