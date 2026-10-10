'use strict';
(()=>{
const by=id=>document.getElementById(id),mobile=matchMedia('(max-width:899px)'),timer=document.querySelector('.timer'),home=timer.parentNode,next=timer.nextSibling,sheet=by('timerSheet');
const hashView=()=>location.hash==='#lobi'?'room':location.hash==='#ilerleme'||location.hash==='#kurulum'?'progress':'work';
let view=hashView();
const titles={work:'Çalışma alanın',room:'Birlikte çalış',chat:'Oda sohbeti',progress:'İlerlemen'};
function select(value){if(!Object.hasOwn(titles,value))return;view=value;document.body.dataset.view=view;by('workspaceTitle').textContent=mobile.matches?titles[view]:titles.work;document.querySelectorAll('.mobile-nav button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));if(mobile.matches)window.scrollTo({top:0,behavior:'instant'})}
function sync(){by('miniTime').textContent=by('tt').textContent;by('miniPhase').textContent=by('tl').textContent;const running=by('tg').textContent==='Duraklat';by('miniToggle').textContent=running?'Ⅱ':'▶';by('miniToggle').setAttribute('aria-label',running?'Sayacı duraklat':'Sayacı başlat');const offset=Number(by('rg').style.strokeDashoffset)||0;by('openTimer').style.setProperty('--timer-progress',Math.max(0,Math.min(100,100-offset/527.79*100))+'%')}
function layout(){if(sheet.open)sheet.close();if(mobile.matches)by('timerSlot').append(timer);else home.insertBefore(timer,next);select(view);sync()}
by('openTimer').onclick=()=>{sync();sheet.showModal()};by('miniToggle').onclick=()=>by('tg').click();
sheet.addEventListener('click',e=>{if(e.target===sheet){const rect=sheet.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)sheet.close()}});
document.querySelectorAll('.mobile-nav button').forEach(button=>button.onclick=()=>select(button.dataset.view));
document.querySelectorAll('header nav a').forEach(link=>link.addEventListener('click',()=>{if(!mobile.matches)return;const target=link.getAttribute('href');select(target==='#lobi'?'room':target==='#ilerleme'||target==='#kurulum'?'progress':'work')}));
const observer=new MutationObserver(sync);for(const id of ['tt','tl','tg'])observer.observe(by(id),{childList:true,subtree:true,characterData:true});mobile.addEventListener('change',layout);layout();
addEventListener('hashchange',()=>select(hashView()));
})();
