'use strict';
(()=>{
const by=id=>document.getElementById(id),mobile=matchMedia('(max-width:899px)'),timer=document.querySelector('.timer'),home=timer.parentNode,next=timer.nextSibling,sheet=by('timerSheet');
const hashView=()=>location.hash==='#lobi'?'room':location.hash==='#ilerleme'||location.hash==='#kurulum'?'progress':'work';
let view=hashView();
const titles={work:'Çalışma alanın',room:'Birlikte çalış',chat:'Oda sohbeti',progress:'İlerlemen'};
let transition;
function select(value,animate=false){if(!Object.hasOwn(titles,value))return;const changed=view!==value;view=value;document.body.dataset.view=view;by('workspaceTitle').textContent=mobile.matches?titles[view]:titles.work;document.querySelectorAll('.mobile-nav button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));window.scrollTo({top:0,behavior:'instant'});if(animate&&changed){transition?.cancel();if(!matchMedia('(prefers-reduced-motion:reduce)').matches)transition=document.querySelector('main')?.animate?.([{opacity:.35,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'ease-out'})}}
function sync(){by('miniTime').textContent=by('tt').textContent;by('miniPhase').textContent=by('tl').textContent;const running=by('tg').textContent==='Duraklat';by('miniToggle').textContent=running?'Ⅱ':'▶';by('miniToggle').setAttribute('aria-label',running?'Sayacı duraklat':'Sayacı başlat');const offset=Number(by('rg').style.strokeDashoffset)||0;by('openTimer').style.setProperty('--timer-progress',Math.max(0,Math.min(100,100-offset/527.79*100))+'%')}
function layout(){if(sheet.open)sheet.close();if(mobile.matches)by('timerSlot').append(timer);else home.insertBefore(timer,next);select(view);sync()}
by('openTimer').onclick=()=>{sync();sheet.showModal()};by('miniToggle').onclick=()=>by('tg').click();
sheet.addEventListener('click',e=>{if(e.target===sheet){const rect=sheet.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)sheet.close()}});
document.querySelectorAll('.mobile-nav button').forEach(button=>button.onclick=()=>select(button.dataset.view,true));
document.querySelectorAll('header nav a').forEach(link=>link.addEventListener('click',event=>{const target=link.getAttribute('href');if(!['#calisma','#lobi','#ilerleme','#kurulum'].includes(target)||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();if(location.hash!==target)history.pushState(null,'',target);select(hashView(),true)}));
const observer=new MutationObserver(sync);for(const id of ['tt','tl','tg'])observer.observe(by(id),{childList:true,subtree:true,characterData:true});mobile.addEventListener('change',layout);layout();
addEventListener('hashchange',()=>select(hashView(),true));
addEventListener('popstate',()=>select(hashView(),true));
addEventListener('load',()=>window.scrollTo({top:0,behavior:'instant'}));
})();
