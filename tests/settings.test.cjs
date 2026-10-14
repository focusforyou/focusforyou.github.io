const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');

function setup(initialStorage={}){
 const storage=new Map(Object.entries(initialStorage));
 class Element{
  constructor(tag='div'){
   this.tagName=tag;
   this.attrs={};
   this.events={};
   this.style={setProperty(k,v){this[k]=v},removeProperty(k){delete this[k]}};
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
  themeAmoledBtn:new Element('button'),
  themeForestBtn:new Element('button'),themeOceanBtn:new Element('button'),themeDuskBtn:new Element('button'),themeMinecraftBtn:new Element('button'),themeInventoryBtn:new Element('button'),themeInventoryDarkBtn:new Element('button'),themeInventoryAmoledBtn:new Element('button'),themeTerrariaBtn:new Element('button'),themeStardewBtn:new Element('button'),themeAisBtn:new Element('button'),themeHoi4Btn:new Element('button'),inventoryColorSettings:new Element('div'),inventoryAccentColor:new Element('input'),inventoryAccentReset:new Element('button'),themeCursorToggle:new Element('input'),
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
  settingsDurationsFeedback:fb,
  settingsMessage:new Element('span')
 };

 let skyResumed=false;
 const listeners={};
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
   setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)
  },
  CustomEvent:class{constructor(name,data){this.name=name;this.detail=data.detail;}},
  dispatchEvent:()=>{},
  addEventListener:(name,fn)=>listeners[name]=fn,
  FocusSky:{resume:()=>{skyResumed=true;}},
  setTimeout:globalThis.setTimeout,
  clearTimeout:globalThis.clearTimeout,
  window:null
 };
 ctx.window=ctx;
 vm.createContext(ctx);
 vm.runInContext(fs.readFileSync('settings.js','utf8'),ctx);

 return {ctx,storage,docElement,body,metaTheme,sky,elements,listeners,isSkyResumed:()=>skyResumed,isOrigSaved:()=>origSaveClicked};
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

test('colour themes survive reload, deselect previous palettes and keep stars independent',()=>{
 const app=setup({focus_bg_anim:'off'});
 for(const [name,id,color]of [['forest','themeForestBtn','#081c16'],['ocean','themeOceanBtn','#071c2b'],['dusk','themeDuskBtn','#1a1029'],['minecraft','themeMinecraftBtn','#18261d'],["inventory","themeInventoryBtn","#292724"],["inventory-dark","themeInventoryDarkBtn","#161616"],["inventory-amoled","themeInventoryAmoledBtn","#000000"],["terraria","themeTerrariaBtn","#172349"],["stardew","themeStardewBtn","#d1e6ee"],["ais","themeAisBtn","#eef0f3"],["hoi4","themeHoi4Btn","#202722"]]){
  app.elements[id].click();assert.equal(app.ctx.FocusSettings.theme,name);assert.equal(app.metaTheme.attrs.content,color);assert.equal(app.storage.get('focus_theme'),name);assert.equal(app.sky.hidden,true);
  for(const key of ['forest','ocean','dusk','minecraft','amoled','light','inventory','inventory-dark','inventory-amoled','terraria','stardew','ais','hoi4'])assert.equal(app.body.classList.contains('theme-'+key),key===name);
  const restored=setup({focus_theme:name});assert.equal(restored.ctx.FocusSettings.theme,name);assert.equal(restored.docElement.classList.contains('theme-'+name),true);assert.equal(restored.sky.hidden,false);
 }
 app.elements.themeDarkBtn.click();assert.equal(app.body.classList.contains('theme-minecraft'),false);assert.equal(app.ctx.FocusSettings.theme,'dark');
});

test('AMOLED persists independently of animation and switches cleanly to other themes',()=>{
 const app=setup();app.elements.themeAmoledBtn.click();
 assert.equal(app.ctx.FocusSettings.theme,'amoled');assert.equal(app.metaTheme.attrs.content,'#000000');assert.equal(app.storage.get('focus_theme'),'amoled');assert.equal(app.sky.hidden,false);
 assert.equal(app.elements.themeDarkBtn.attrs['aria-pressed'],'false');assert.equal(app.elements.themeAmoledBtn.attrs['aria-pressed'],'true');
 app.elements.themeLightBtn.click();assert.equal(app.body.classList.contains('theme-amoled'),false);assert.equal(app.elements.themeAmoledBtn.attrs['aria-pressed'],'false');
 const restored=setup({focus_theme:'amoled'});assert.equal(restored.ctx.FocusSettings.theme,'amoled');assert.equal(restored.docElement.classList.contains('theme-amoled'),true);assert.equal(restored.sky.hidden,false);
});

test('Rejected duration change shows timer rejection and restores current durations',()=>{
 const app=setup();
 app.elements.saveDurations.events.click=()=>{
  app.elements.focusMinutes.value='30';app.elements.breakMinutes.value='10';
  app.elements.settingsMessage.textContent='Önce devam eden turu sıfırla; sonra süreleri değiştirebilirsin.';
 };
 app.elements.settingsFocusMinutes.value='45';app.elements.settingsBreakMinutes.value='15';
 app.elements.settingsSaveDurations.click();
 assert.equal(app.elements.settingsFocusMinutes.value,'30');
 assert.equal(app.elements.settingsBreakMinutes.value,'10');
 assert.match(app.elements.settingsDurationsFeedback.textContent,/Önce devam eden turu/);
});

test('Cloud duration hydration updates visible settings fields',()=>{
 const app=setup();app.elements.focusMinutes.value='50';app.elements.breakMinutes.value='20';
 app.listeners['focus-preferences-change']();
 assert.equal(app.elements.settingsFocusMinutes.value,'50');
 assert.equal(app.elements.settingsBreakMinutes.value,'20');
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


test('inventory palette controls only appear for inventory variants and preserve the custom accent across reload',()=>{
 const app=setup({focus_inventory_accent:'#123456'});
 assert.equal(app.elements.inventoryColorSettings.hidden,true);
 for(const name of ['inventory','inventory-dark','inventory-amoled']){
  app.ctx.FocusSettings.applyTheme(name);assert.equal(app.elements.inventoryColorSettings.hidden,false);
  assert.equal(app.docElement.style['--inventory-accent'],'#123456');
 }
 app.ctx.FocusSettings.applyAccent('#ffffff');
 assert.equal(app.docElement.style['--inventory-on'],'#000000');
 assert.equal(app.storage.get('focus_inventory_accent'),'#ffffff');
 const restored=setup({focus_theme:'inventory',focus_inventory_accent:app.storage.get('focus_inventory_accent')});
 assert.equal(restored.docElement.style['--inventory-accent'],'#ffffff');
 app.ctx.FocusSettings.applyAccent('#000000');assert.equal(app.docElement.style['--inventory-on'],'#ffffff');
 app.elements.inventoryAccentReset.click();
 assert.equal(app.docElement.style['--inventory-accent'],undefined);
 assert.equal(app.storage.has('focus_inventory_accent'),false);
 app.ctx.FocusSettings.applyTheme('stardew');assert.equal(app.elements.inventoryColorSettings.hidden,true);
});
test('invalid stored palette is ignored and cannot become a CSS value',()=>{
 const app=setup({focus_inventory_accent:'url(https://invalid.example)'});
 assert.equal(app.docElement.style['--inventory-accent'],undefined);
 assert.equal(app.elements.inventoryAccentColor.value,'#77ad48');
});
test('system cursor choice survives reload and switching games without changing animation',()=>{
 const app=setup({focus_game_cursor:'off',focus_bg_anim:'off'});
 assert.equal(app.docElement.classList.contains('game-cursor-off'),true);
 assert.equal(app.elements.themeCursorToggle.checked,false);
 app.ctx.FocusSettings.applyTheme('hoi4');
 assert.equal(app.docElement.classList.contains('game-cursor-off'),true);
 app.elements.themeCursorToggle.events.change({target:{checked:true}});
 assert.equal(app.docElement.classList.contains('game-cursor-off'),false);
 assert.equal(app.storage.get('focus_game_cursor'),'on');assert.equal(app.sky.hidden,true);
});
