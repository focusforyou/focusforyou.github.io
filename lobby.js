'use strict';
(()=>{
const by=id=>document.getElementById(id),api=(window.FOCUS_CONFIG?.lobbyApi||'').replace(/\/$/,'');
let session=null,state=null,pollId=null,pending=false,offset=0,failures=0;
try{session=JSON.parse(sessionStorage.getItem('focus_room')||'null')}catch(e){}
const status=message=>by('lobbyStatus').textContent=message;
function busy(value){by('createRoom').disabled=value;by('joinRoom').disabled=value}
async function request(path,body,auth=true){
const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
try{
const response=await fetch(api+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(auth&&session?{Authorization:'Bearer '+session.token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});
const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'Bağlantı kurulamadı.'),{status:response.status});return data;
}finally{clearTimeout(timeout)}
}
function clear(){
if(pollId)clearTimeout(pollId);pollId=null;session=null;state=null;sessionStorage.removeItem('focus_room');
by('roomPanel').hidden=true;busy(false);for(const id of ['roomToggle','roomFocus','roomBreak','roomReset'])by(id).disabled=false;
}
function display(data){
state=data;offset=data.serverTime-Date.now();by('roomPanel').hidden=false;busy(true);
by('roomCode').textContent='Oda '+data.code;by('hostControls').hidden=!data.host;
by('roomInfo').textContent=data.members.length+'/12 kişi · '+data.timer.rounds+' ortak odak turu · '+(data.host?'Oda sahibisin.':'Ortak sayacı oda sahibi yönetiyor.');
by('roomToggle').textContent=data.timer.running?'Duraklat':'Başlat';
by('roomMembers').replaceChildren(...data.members.map(member=>{const li=document.createElement('li');li.textContent=member.name+(member.host?' · oda sahibi':'');return li}));
draw();
}
function draw(){
if(!state)return;
let phase=state.timer.phase,remaining=state.timer.remaining;
if(state.timer.running){
remaining=Math.max(0,(state.timer.end-(Date.now()+offset))/1000);
let end=state.timer.end;
while(end<Date.now()+offset){
phase=phase==='focus'?'break':'focus';const total=phase==='focus'?state.focus:state.break;end+=total*1000;remaining=Math.max(0,(end-(Date.now()+offset))/1000);
}
}
const seconds=Math.ceil(remaining);
by('roomTime').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
by('roomPhase').textContent=phase==='focus'?'Birlikte odak':'Birlikte mola';
}
async function poll(){
if(!session||pending)return;pending=true;
try{const data=await request('/rooms/'+session.code);display(data);failures=0;status('Odaya bağlısın.')}
catch(error){
if([401,404].includes(error.status)){clear();status(error.message);return}
failures++;status('Bağlantı kesildi; yeniden bağlanılıyor. Ortak sayaç son alınan bilgiyle gösteriliyor.');
}finally{pending=false;if(session)pollId=setTimeout(poll,Math.min(15000,3000*Math.max(1,failures)))}
}
async function enter(create){
if(!api){status('Lobi sunucusu henüz etkinleştirilmedi. Kişisel çalışma araçlarını kullanabilirsin.');return}
if(session)return;
const name=by('lobbyName').value.trim();if(!name){status('Önce takma adını yaz.');return}
const code=by('roomCodeInput').value.trim().toUpperCase().replace(/\s/g,'');
if(!create&&!/^[A-Z2-9]{10}$/.test(code)){status('10 karakterlik oda kodunu yaz.');return}
busy(true);status('Odaya bağlanılıyor…');
try{
const data=await request(create?'/rooms':'/rooms/'+code+'/join',{name,...(create?{focus:Study.preferences.focus,break:Study.preferences.break}:{})},false);
session={code:data.code,token:data.token};sessionStorage.setItem('focus_room',JSON.stringify(session));display(data);status('Odaya bağlısın.');pollId=setTimeout(poll,3000);
}catch(error){busy(false);status(error.name==='AbortError'?'Sunucu zamanında yanıt vermedi. Tekrar dene.':error.message)}
}
by('createRoom').onclick=()=>enter(true);by('joinRoom').onclick=()=>enter(false);
for(const [id,action] of [['roomToggle','toggle'],['roomFocus','focus'],['roomBreak','break'],['roomReset','reset']]){
by(id).onclick=async()=>{
if(!session||!state?.host)return;
const controls=['roomToggle','roomFocus','roomBreak','roomReset'];controls.forEach(id=>by(id).disabled=true);
try{display(await request('/rooms/'+session.code+'/action',{action}));status('Ortak sayaç güncellendi.')}catch(error){status(error.message)}finally{controls.forEach(id=>by(id).disabled=false)}
};
}
by('leaveRoom').onclick=async()=>{
if(!session)return;
try{await request('/rooms/'+session.code+'/leave',{})}catch(e){}
clear();status('Odadan ayrıldın.');
};
by('copyInvite').onclick=async()=>{
if(!session)return;const url=new URL(location.origin+location.pathname);url.searchParams.set('room',session.code);url.hash='lobi';
try{await navigator.clipboard.writeText(url.href);status('Davet bağlantısı kopyalandı.')}catch(e){status('Davet bağlantısı: '+url.href)}
};
const invite=new URLSearchParams(location.search).get('room');if(invite&&/^[A-Z2-9]{10}$/.test(invite))by('roomCodeInput').value=invite;
setInterval(draw,250);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session&&!pending){if(pollId)clearTimeout(pollId);poll()}});
if(session&&api){by('roomPanel').hidden=false;busy(true);status('Odaya yeniden bağlanılıyor…');poll()}
else if(!api){clear();status('Lobi sunucusu kurulum aşamasında.')}
})();

