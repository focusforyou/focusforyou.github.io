const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(hash=''){
 class Element{constructor(){this.children=[];this.style={setProperty:(k,v)=>this[k]=v};this.attrs={};this.events={};this.classList={toggle:(name,on)=>this[name]=on}}contains(){return false}focus(){}append(child){child.parentNode?.remove(child);this.children.push(child);child.parentNode=this}remove(child){this.children=this.children.filter(c=>c!==child)}insertBefore(child,next){child.parentNode?.remove(child);const index=this.children.indexOf(next);this.children.splice(index<0?this.children.length:index,0,child);child.parentNode=this}setAttribute(k,v){this.attrs[k]=v}getAttribute(k){return this.attrs[k]}addEventListener(k,fn){this.events[k]=fn}click(){this.onclick?.()}showModal(){this.open=true}close(){this.open=false}}
 const ids=Object.fromEntries(['miniTimer','closeTimer','timerSheet','timerSlot','workspaceTitle','miniTime','miniPhase','miniToggle','openTimer','tt','tl','tg','rg'].map(id=>[id,new Element()]));
 const home=new Element(),timer=new Element(),task=new Element();home.append(timer);home.append(task);timer.nextSibling=task;ids.tt.textContent='12:34';ids.tl.textContent='Odak';ids.tg.textContent='Başlat';ids.rg.style.strokeDashoffset='263.895';let toggles=0;ids.tg.onclick=()=>{toggles++;ids.tg.textContent=toggles%2?'Duraklat':'Başlat'};
 const buttons=['work','room','chat','progress','settings'].map(view=>Object.assign(new Element(),{dataset:{view}}));const body={dataset:{}};let observer,resize;const media={matches:true,addEventListener:(event,fn)=>resize=fn};
 const links=['#calisma','#ilerleme','#ayarlar'].map(href=>{const el=new Element();el.attrs.href=href;return el}),events={},scrolls=[],animations=[];const main={animate:(frames,options)=>{animations.push(options);return {cancel(){}}}};const location={hash};const history={pushState:(state,title,target)=>{location.hash=target}};
 const context={history,document:{body,getElementById:id=>ids[id],querySelector:s=>s==='main'?main:timer,querySelectorAll:s=>s==='.mobile-nav button'?buttons:links},location,matchMedia:s=>s.includes('reduced-motion')?{matches:false}:media,window:{scrollTo:opts=>scrolls.push(opts)},MutationObserver:class{constructor(fn){observer=fn}observe(){}},addEventListener:(name,fn)=>events[name]=fn};
 vm.runInNewContext(fs.readFileSync('mobile-ui.js','utf8'),context);return {links,location,events,scrolls,animations,ids,home,timer,task,buttons,body,media,resize,refresh:()=>observer(),toggles:()=>toggles};
}
test('Mobile sheet and mini control use the original timer, then restore desktop placement',()=>{const app=setup();assert.equal(app.timer.parentNode,app.ids.timerSlot);app.ids.openTimer.click();assert.equal(app.ids.timerSheet.inert,false);assert.equal(app.ids.miniTimer.expanded,true);assert.equal(app.ids.openTimer.attrs['aria-expanded'],'true');app.ids.closeTimer.click();assert.equal(app.ids.timerSheet.inert,true);app.ids.openTimer.click();app.ids.miniToggle.click();app.refresh();assert.equal(app.toggles(),1);assert.equal(app.ids.miniToggle.attrs['aria-label'],'Sayacı duraklat');app.ids.tt.textContent='12:33';app.refresh();assert.equal(app.ids.miniTime.textContent,'12:33');assert.equal(app.ids.openTimer['--timer-progress'],'50%');app.media.matches=false;app.resize();assert.equal(app.ids.timerSheet.inert,true);assert.equal(app.ids.miniTimer.expanded,false);assert.deepEqual(app.home.children,[app.timer,app.task])});
test('Room invitation starts on the room tab and navigation updates selected state',()=>{const app=setup('#lobi');assert.equal(app.body.dataset.view,'room');app.buttons[2].click();assert.equal(app.body.dataset.view,'chat');assert.equal(app.buttons[2].attrs['aria-pressed'],'true');assert.equal(app.buttons[1].attrs['aria-pressed'],'false')});

test('Desktop navigation prevents anchor clipping, animates and restores history routes',()=>{const app=setup();app.media.matches=false;app.resize();let prevented=false;app.links[1].events.click({preventDefault(){prevented=true}});assert.equal(prevented,true);assert.equal(app.location.hash,'#ilerleme');assert.equal(app.body.dataset.view,'progress');assert.equal(app.scrolls.at(-1).top,0);assert.equal(app.animations.at(-1).duration,240);app.location.hash='#calisma';app.events.popstate();assert.equal(app.body.dataset.view,'work');assert.equal(app.scrolls.at(-1).top,0)});

test('Mobile timer popup automatically collapses when switching tabs',()=>{
 const app=setup();
 app.ids.openTimer.click();
 assert.equal(app.ids.miniTimer.expanded,true);
 assert.equal(app.ids.timerSheet.inert,false);
 app.buttons[1].click(); // Switch to room view
 assert.equal(app.ids.miniTimer.expanded,false);
 assert.equal(app.ids.timerSheet.inert,true);
});

test('Settings view activates via mobile nav button and desktop hash link',()=>{
 const app=setup();
 app.buttons[4].click();
 assert.equal(app.body.dataset.view,'settings');
 assert.equal(app.buttons[4].attrs['aria-pressed'],'true');
 assert.equal(app.ids.workspaceTitle.textContent,'Ayarlar');

 app.media.matches=false;
 app.resize();
 app.links[2].events.click({preventDefault(){}});
 assert.equal(app.location.hash,'#ayarlar');
 assert.equal(app.body.dataset.view,'settings');
});

test('Mobile tab navigation keeps URL and back navigation aligned with the selected view',()=>{
 const app=setup();app.buttons[2].click();
 assert.equal(app.location.hash,'#chat');assert.equal(app.body.dataset.view,'chat');
 assert.equal(setup(app.location.hash).body.dataset.view,'chat');
 app.buttons[4].click();assert.equal(app.location.hash,'#ayarlar');
 app.location.hash='#chat';app.events.popstate();assert.equal(app.body.dataset.view,'chat');
});

test('Desktop popup uses the original timer outside work and returns it without adding another ticker',()=>{
 const app=setup();app.media.matches=false;app.resize();assert.equal(app.timer.parentNode,app.home);
 app.links[1].events.click({preventDefault(){}});
 assert.equal(app.timer.parentNode,app.ids.timerSlot);
 app.ids.openTimer.click();assert.equal(app.ids.timerSheet.inert,false);
 app.ids.miniToggle.click();app.refresh();assert.equal(app.toggles(),1);
 app.ids.tt.textContent='09:41';app.refresh();assert.equal(app.ids.miniTime.textContent,'09:41');
 app.links[0].events.click({preventDefault(){}});assert.equal(app.timer.parentNode,app.home);
 assert.equal(app.ids.timerSheet.inert,true);assert.deepEqual(app.home.children,[app.timer,app.task]);
});


