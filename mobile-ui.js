'use strict';
(()=>{
const by=id=>document.getElementById(id),mobile=matchMedia('(max-width:899px)'),timer=document.querySelector('.timer'),home=timer.parentNode,next=timer.nextSibling,sheet=by('timerSheet');
const hashView=()=>location.hash==='#lobi'?'room':location.hash==='#chat'?'chat':location.hash==='#ilerleme'||location.hash==='#kurulum'?'progress':location.hash==='#ayarlar'?'settings':'work';
let view=hashView();
const titles={work:'Çalışma alanın',room:'Birlikte çalış',chat:'Oda sohbeti',progress:'İlerlemen',settings:'Ayarlar'};
const order=["work","room","chat","progress","settings"];let transition;
function expand(open){by("miniTimer").classList.toggle("expanded",open);by("openTimer").setAttribute("aria-expanded",String(open));sheet.inert=!open;if(!open&&sheet.contains(document.activeElement))by("openTimer").focus()}
function select(value,animate=false){
if(!Object.hasOwn(titles,value))return;expand(false);const changed=view!==value,direction=order.indexOf(value)>order.indexOf(view)?1:-1,main=document.querySelector('main'),moving=animate&&changed&&!matchMedia('(prefers-reduced-motion:reduce)').matches;
transition?.cancel();
// Animate the existing page; cloning all cards/chat duplicates layout, images and paint.

view=value;if(mobile.matches||view!=='work')by('timerSlot').append(timer);else home.insertBefore(timer,next);document.body.dataset.view=view;by('workspaceTitle').textContent=mobile.matches?titles[view]:titles.work;document.querySelector('.mobile-nav')?.style.setProperty('--active-tab',order.indexOf(view));document.querySelectorAll('.mobile-nav button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));window.scrollTo({top:0,left:0,behavior:'instant'});
if(moving)transition=main?.animate?.([{opacity:.15,transform:mobile.matches?'translateX('+(direction*40)+'px)':'translateY(10px)'},{opacity:1,transform:'translate(0,0)'}],{duration:mobile.matches?320:240,easing:'cubic-bezier(.22,.8,.25,1)'});
}
function sync(){by('miniTime').textContent=by('tt').textContent;by('miniPhase').textContent=by('tl').textContent;const running=by('tg').textContent==='Duraklat';by('miniToggle').textContent=running?'Ⅱ':'▶';by('miniToggle').setAttribute('aria-label',running?'Sayacı duraklat':'Sayacı başlat');const offset=Number(by('rg').style.strokeDashoffset)||0;by('openTimer').style.setProperty('--timer-progress',Math.max(0,Math.min(100,100-offset/527.79*100))+'%')}
function layout(){expand(false);if(mobile.matches)by('timerSlot').append(timer);else home.insertBefore(timer,next);select(view);sync()}
by('openTimer').onclick=()=>{sync();expand(sheet.inert)};by('closeTimer').onclick=()=>expand(false);by('miniToggle').onclick=()=>by('tg').click();
addEventListener('keydown',e=>{if(e.key==='Escape')expand(false)});
addEventListener('pointerdown',e=>{if(!sheet.inert&&by('miniTimer')&&!by('miniTimer').contains(e.target))expand(false)});
document.querySelectorAll('.mobile-nav button').forEach(button=>button.onclick=()=>{const target={work:'#calisma',room:'#lobi',chat:'#chat',progress:'#ilerleme',settings:'#ayarlar'}[button.dataset.view];if(target&&location.hash!==target)history.pushState(null,'',target);select(button.dataset.view,true)});
document.querySelectorAll('header nav a').forEach(link=>link.addEventListener('click',event=>{const target=link.getAttribute('href');if(!['#calisma','#lobi','#ilerleme','#kurulum','#ayarlar'].includes(target)||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();if(location.hash!==target)history.pushState(null,'',target);select(hashView(),true)}));
const observer=new MutationObserver(sync);for(const id of ['tt','tl','tg'])observer.observe(by(id),{childList:true,subtree:true,characterData:true});mobile.addEventListener('change',layout);layout();
addEventListener('hashchange',()=>select(hashView(),true));
addEventListener('popstate',()=>select(hashView(),true));
addEventListener('load',()=>window.scrollTo({top:0,left:0,behavior:'instant'}));
})();
