'use strict';
(()=>{
const by=id=>document.getElementById(id),mobile=matchMedia('(max-width:899px)'),timer=document.querySelector('.timer'),home=timer.parentNode,next=timer.nextSibling,sheet=by('timerSheet');
const hashView=()=>location.hash==='#lobi'?'room':location.hash==='#chat'?'chat':location.hash==='#ilerleme'||location.hash==='#kurulum'?'progress':location.hash==='#ayarlar'?'settings':'work';
let view=hashView();
const titles={work:'Çalışma alanın',room:'Birlikte çalış',chat:'Oda sohbeti',progress:'İlerlemen',settings:'Ayarlar'};
const order=["work","room","chat","progress","settings"];let transition;
const mini={time:by('miniTime'),phase:by('miniPhase'),toggle:by('miniToggle'),open:by('openTimer'),sourceTime:by('tt'),sourcePhase:by('tl'),sourceToggle:by('tg'),ring:by('rg')};
const navButtons=[...document.querySelectorAll('.mobile-nav button')],navLinks=[...document.querySelectorAll('header nav a')];let miniProgress;
function placeTimer(){const target=mobile.matches||view!=='work'?by('timerSlot'):home;if(timer.parentNode!==target){if(target===home)home.insertBefore(timer,next);else target.append(timer)}}
function expand(open){by("miniTimer").classList.toggle("expanded",open);by("openTimer").setAttribute("aria-expanded",String(open));sheet.inert=!open;if(!open&&sheet.contains(document.activeElement))by("openTimer").focus()}
function select(value,animate=false){
if(!Object.hasOwn(titles,value))return;if(view!==value)document.activeElement?.blur?.();expand(false);const changed=view!==value,direction=order.indexOf(value)>order.indexOf(view)?1:-1,main=document.querySelector('main'),moving=animate&&changed&&!matchMedia('(prefers-reduced-motion:reduce)').matches;
if(changed)transition?.cancel();
// Animate the existing page; cloning all cards/chat duplicates layout, images and paint.

view=value;placeTimer();document.body.dataset.view=view;by('workspaceTitle').textContent=mobile.matches?titles[view]:titles.work;document.querySelector('.mobile-nav')?.style.setProperty('--active-tab',order.indexOf(view));navButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));navLinks.forEach(link=>link.setAttribute('aria-current',link.getAttribute('href')===({work:'#calisma',room:'#lobi',progress:'#ilerleme',settings:'#ayarlar'}[view])?'page':'false'));window.scrollTo({top:0,left:0,behavior:'instant'});
if(changed&&!mobile.matches)window.dispatchEvent(new Event('focus-desktop-navigation'));
const target=document.querySelector(({work:'#calisma',room:'#lobiler',chat:'#calisma',progress:'#ilerleme',settings:'#ayarlar'}[view])+' h2');
if(moving)transition=target?.animate?.([{opacity:.15,transform:'none'},{opacity:1,transform:'translate(0,0)'}],{duration:mobile.matches?320:140,easing:'cubic-bezier(.22,.8,.25,1)'});
}
function sync(){if(document.hidden)return;const text=(el,value)=>{if(el.textContent!==value)el.textContent=value};text(mini.time,mini.sourceTime.textContent);text(mini.phase,mini.sourcePhase.textContent);const running=mini.sourceToggle.textContent==='Duraklat';text(mini.toggle,running?'Ⅱ':'▶');const label=running?'Sayacı duraklat':'Sayacı başlat';if(mini.toggle.getAttribute('aria-label')!==label)mini.toggle.setAttribute('aria-label',label);const offset=Number(mini.ring.style.strokeDashoffset)||0,progress=Math.max(0,Math.min(100,100-offset/527.79*100)).toFixed(2)+'%';if(progress!==miniProgress){mini.open.style.setProperty('--timer-progress',progress);miniProgress=progress}}
function layout(){select(view);sync()}
by('openTimer').onclick=()=>{sync();expand(sheet.inert)};by('closeTimer').onclick=()=>expand(false);by('miniToggle').onclick=()=>by('tg').click();
addEventListener('keydown',e=>{if(e.key==='Escape')expand(false)});
addEventListener('pointerdown',e=>{if(!sheet.inert&&by('miniTimer')&&!by('miniTimer').contains(e.target))expand(false)});
document.querySelectorAll('.mobile-nav button').forEach(button=>button.onclick=()=>{const target={work:'#calisma',room:'#lobi',chat:'#chat',progress:'#ilerleme',settings:'#ayarlar'}[button.dataset.view];if(target&&location.hash!==target)history.pushState(null,'',target);select(button.dataset.view,true)});
document.querySelectorAll('header nav a').forEach(link=>link.addEventListener('click',event=>{const target=link.getAttribute('href');if(!['#calisma','#lobi','#ilerleme','#kurulum','#ayarlar'].includes(target)||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();if(location.hash!==target)history.pushState(null,'',target);select(hashView(),true)}));
const observer=new MutationObserver(sync);for(const id of ['tt','tl','tg'])observer.observe(by(id),{childList:true,subtree:true,characterData:true});mobile.addEventListener('change',layout);layout();
addEventListener('hashchange',()=>select(hashView(),true));
addEventListener('popstate',()=>select(hashView(),true));
addEventListener('load',()=>window.scrollTo({top:0,left:0,behavior:'instant'}));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
})();

