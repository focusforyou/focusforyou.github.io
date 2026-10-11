const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');

function setup(initialStorage={}){
 const storage=new Map(Object.entries(initialStorage));
 class Element{
  constructor(tag='div'){
   this.tagName=tag;
   this.attrs={};
   this.events={};
   this.style={};
   this.classList={
    classes:new Set(),
    add:(c)=>this.classList.classes.add(c),
    remove:(c)=>this.classList.classes.delete(c),
    toggle:(c,val)=>{if(val===undefined)val=!this.classList.classes.has(c);if(val)this.classList.classes.add(c);else this.classList.classes.delete(c);return val;},
    contains:(c)=>this.classList.classes.has(c)
   };
  }
  setAttribute(k,v){this.attrs[k]=String(v)}
  getAttribute(k){return this.attrs[k]}
  addEventListener(name,fn){this.events[name]=fn}
  click(){this.events['click']?.()}
 }

 const docElement=new Element('html');
 const body=new Element('body');
 const metaTheme=new Element('meta');
 metaTheme.attrs.name='theme-color';
 metaTheme.attrs.content='#0A1128';

 const sky=new Element('canvas');
 sky.hidden=false;

 const darkBtn=new Element('button');
 const lightBtn=new Element('button');
 const onBtn=new Element('button');
 const offBtn=new Element('button');
 const label=new Element('span');
 const infoTheme=new Element('strong');
 const infoAnim=new Element('strong');
 const sFocus=new Element('input');
 const sBreak=new Element('input');
 const oFocus=new Element('input');oFocus.value='30';
 const oBreak=new Element('input');oBreak.value='10';
 const saveBtn=new Element('button');
 const fb=new Element('span');
 let origSaveClicked=false;
 const origSave=new Element('button');
 origSave.addEventListener('click',()=>{origSaveClicked=true;});

 const elements={
  sky,
  themeDarkBtn:darkBtn,
  themeLightBtn:lightBtn,
  bgAnimOnBtn:onBtn,
  bgAnimOffBtn:offBtn,
  bgAnimStateLabel:label,
  currentThemeInfo:infoTheme,
  currentAnimInfo:infoAnim,
  settingsFocusMinutes:sFocus,
  settingsBreakMinutes:sBreak,
  focusMinutes:oFocus,
  breakMinutes:oBreak,
  settingsSaveDurations:saveBtn,
  saveDurations:origSave,
  settingsDurationsFeedback:fb
 };

 let skyResumed=false;
 const ctx={
  document:{
   readyState:'complete',
   documentElement:docElement,
   body,
   getElementById:id=>elements[id]||null,
   querySelector:sel=>sel==='meta[name="theme-color"]'?metaTheme:null,
   addEventListener:()=>{}
  },
  localStorage:{
   getItem:k=>storage.get(k)||null,
   setItem:(k,v)=>storage.set(k,String(v))
  },
  CustomEvent:class{constructor(name,data){this.name=name;this.detail=data.detail;}},
  dispatchEvent:()=>{},
  FocusSky:{resume:()=>{skyResumed=true;}},
  setTimeout:globalThis.setTimeout,
  clearTimeout:globalThis.clearTimeout,
  window:null
 };
 ctx.window=ctx;
 vm.createContext(ctx);
 vm.runInContext(fs.readFileSync('settings.js','utf8'),ctx);

 return {ctx,storage,docElement,body,metaTheme,sky,elements,isSkyResumed:()=>skyResumed,isOrigSaved:()=>origSaveClicked};
}

test('Default settings are dark theme and background animation on', ()=>{
 const app=setup();
 assert.equal(app.docElement.classList.contains('theme-light'),false);
 assert.equal(app.body.classList.contains('theme-light'),false);
 assert.equal(app.sky.hidden,false);
 assert.equal(app.elements.themeDarkBtn.attrs['aria-pressed'],'true');
 assert.equal(app.elements.themeLightBtn.attrs['aria-pressed'],'false');
 assert.equal(app.elements.bgAnimOnBtn.attrs['aria-pressed'],'true');
 assert.equal(app.elements.bgAnimOffBtn.attrs['aria-pressed'],'false');
 assert.equal(app.ctx.FocusSettings.theme,'dark');
 assert.equal(app.ctx.FocusSettings.anim,true);
});

test('Switching to light theme updates classes, meta theme color and localStorage', ()=>{
 const app=setup();
 app.elements.themeLightBtn.click();
 assert.equal(app.docElement.classList.contains('theme-light'),true);
 assert.equal(app.body.classList.contains('theme-light'),true);
 assert.equal(app.metaTheme.attrs.content,'#EDF2FC');
 assert.equal(app.storage.get('focus_theme'),'light');
 assert.equal(app.ctx.FocusSettings.theme,'light');
 assert.equal(app.elements.themeLightBtn.attrs['aria-pressed'],'true');
 assert.equal(app.elements.themeDarkBtn.attrs['aria-pressed'],'false');

 // Switching back to dark theme
 app.elements.themeDarkBtn.click();
 assert.equal(app.docElement.classList.contains('theme-light'),false);
 assert.equal(app.body.classList.contains('theme-light'),false);
 assert.equal(app.metaTheme.attrs.content,'#0A1128');
 assert.equal(app.storage.get('focus_theme'),'dark');
 assert.equal(app.ctx.FocusSettings.theme,'dark');
});

test('Toggling background animation off hides sky canvas and stores preference', ()=>{
 const app=setup();
 app.elements.bgAnimOffBtn.click();
 assert.equal(app.sky.hidden,true);
 assert.equal(app.sky.style.display,'none');
 assert.equal(app.storage.get('focus_bg_anim'),'off');
 assert.equal(app.ctx.FocusSettings.anim,false);

 // Toggling back on resumes animation
 app.elements.bgAnimOnBtn.click();
 assert.equal(app.sky.hidden,false);
 assert.equal(app.sky.style.display,'');
 assert.equal(app.storage.get('focus_bg_anim'),'on');
 assert.equal(app.ctx.FocusSettings.anim,true);
 assert.equal(app.isSkyResumed(),true);
});

test('Initializing with stored light theme and anim off restores state immediately', ()=>{
 const app=setup({focus_theme:'light',focus_bg_anim:'off'});
 assert.equal(app.docElement.classList.contains('theme-light'),true);
 assert.equal(app.body.classList.contains('theme-light'),true);
 assert.equal(app.sky.hidden,true);
 assert.equal(app.ctx.FocusSettings.theme,'light');
 assert.equal(app.ctx.FocusSettings.anim,false);
});

test('Saving durations from settings triggers original duration save', ()=>{
 const app=setup();
 app.elements.settingsFocusMinutes.value='45';
 app.elements.settingsBreakMinutes.value='15';
 app.elements.settingsSaveDurations.click();
 assert.equal(app.elements.focusMinutes.value,'45');
 assert.equal(app.elements.breakMinutes.value,'15');
 assert.equal(app.isOrigSaved(),true);
 assert.equal(app.elements.settingsDurationsFeedback.textContent,'Süreler kaydedildi!');
});
