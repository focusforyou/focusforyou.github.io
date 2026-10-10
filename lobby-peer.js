'use strict';
(()=>{
const by=id=>document.getElementById(id),PREFIX='focusforyou-room-v3-',LIMIT=8;
let peer=null,host=false,code='',name='',upstream=null,joined=false,connecting=false,attempts=0,lastMessage=0;
let timeout=null,retry=null,signalRetry=null,roomMembers=[];
const members=new Map(),pending=new Set();
const profiles=new Map();let sentProfiles='',sentOwnProfile='';
const ownProfile=()=>LobbyModel.profile(window.FocusAccount?.profile());
function presence(){const packet={type:'presence',version:1,timer:live()},profile=ownProfile(),serialized=JSON.stringify(profile);if(serialized!==sentOwnProfile){packet.profile=profile;sentOwnProfile=serialized}send(upstream,packet)}
const departed=new Map(),history=[];let ownRoom=0,ownBase=0,roomPast=0,rosterAt=0,views=[];
const status=message=>by('lobbyStatus').textContent=message;
const busy=()=>{by('createRoom').disabled=!!peer||connecting;by('joinRoom').disabled=!!peer||connecting;by('leaveRoom').hidden=!peer&&!connecting};
const live=()=>{const timer=LobbyModel.cleanTimer(Study.liveSession?.()),local=Study.localSeconds?.()??timer.worked;if(joined)ownRoom+=Math.max(0,local-ownBase);ownBase=local;timer.roomWorked=ownRoom;return timer};
const send=(conn,data)=>{try{if(conn?.open){conn.send(data);return true}}catch(e){}return false};
const nameKey=value=>value.normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('tr-TR');
function retire(id,entry){departed.set(id,entry.timer.roomWorked);members.delete(id)}
function acceptChat(input,sender,profile){const body=LobbyModel.content(input);if(!body||history.some(m=>m.id===body.id))return;const message={...body,sender,avatar:profile?.photo||'',time:Date.now()};history.push(message);while(history.length>60||history.filter(m=>m.image).length>8||history.reduce((n,m)=>n+m.image.length,0)>4500000)history.shift();RoomChat.receive(message);for(const m of members.values())send(m.conn,{type:'chat',message})}
function sendChat(message){if(!joined)return false;if(host){acceptChat(message,name,ownProfile());return true}return send(upstream,{type:'chat-send',version:1,message})}RoomChat.configure(sendChat);
function randomCode(){const limit=Math.floor(4294967296/90000)*90000;let value;do{value=crypto.getRandomValues(new Uint32Array(1))[0]}while(value>=limit);return String(10000+value%90000)}
function clear(){
clearTimeout(timeout);clearTimeout(retry);clearTimeout(signalRetry);timeout=retry=signalRetry=null;
const old=peer;peer=null;upstream=null;connecting=false;joined=false;host=false;code='';attempts=0;
members.clear();pending.clear();departed.clear();history.length=0;ownRoom=ownBase=roomPast=0;roomMembers=[];views=[];RoomChat.reset();old?.destroy();by('roomPanel').hidden=true;busy();
profiles.clear();sentProfiles='';sentOwnProfile='';
window.FocusNative?.room('');
}
function render(){
if(!joined)return;
window.FocusNative?.room(code);
views=[];
by('roomPanel').hidden=false;by('roomCode').textContent='Oda '+code;
by('roomInfo').textContent=roomMembers.length+'/'+LIMIT+' kişi · Herkes kendi sayacını yönetir'+(host?' · Oda sahibisin.':'');
by('roomMembers').replaceChildren(...roomMembers.map(member=>{
const li=document.createElement('li'),own=member.id===peer?.id;
const label=document.createElement('strong');label.textContent=member.name+(member.host?' · oda sahibi':'')+(own?' · sen':'');
const photo=profiles.get(member.id)?.photo;if(photo){const image=document.createElement('img');image.className='member-avatar';image.width=image.height=32;image.src=photo;image.alt='';image.referrerPolicy='no-referrer';label.prepend(image)}
const text=document.createElement('span');text.textContent=' — '+LobbyModel.describe(own?live():member.timer);
text.className='member-clock';const totals=document.createElement('small');views.push({member,clock:text,totals});li.append(label,text,totals);return li;
}));
RoomChat.state(true);renderClocks();
}
function renderClocks(){if(!joined)return;const own=live(),age=(Date.now()-rosterAt)/1000;let total=roomPast;for(const view of views){const t=view.member.id===peer.id?own:LobbyModel.project(view.member.timer,age);total+=t.roomWorked;view.clock.textContent=LobbyModel.describe(t)+(age>15?' · son alınan durum':'');view.totals.textContent='Toplam '+LobbyModel.hours(t.worked)+' · bu odada '+LobbyModel.hours(t.roomWorked)}by('roomTotal').textContent=LobbyModel.hours(total)}
function broadcast(){
if(!host||!joined)return;
const list=[{id:peer.id,profile:ownProfile()},...[...members].map(([id,m])=>({id,profile:m.profile}))],serialized=JSON.stringify(list);profiles.clear();for(const entry of list)profiles.set(entry.id,entry.profile);if(serialized!==sentProfiles){sentProfiles=serialized;for(const m of members.values())send(m.conn,{type:'profiles',code,profiles:list})}
const now=Date.now();
for(const [id,entry] of members)if(now-entry.seen>120000){retire(id,entry);entry.conn.close()}
roomMembers=[{id:peer.id,name,host:true,timer:live()},...[...members].map(([id,m])=>({id,name:m.name,host:false,timer:LobbyModel.project(m.timer,(now-m.seen)/1000)}))];
rosterAt=now;roomPast=[...departed.values()].reduce((n,s)=>n+s,0);views=[];
const packet={type:'roster',version:1,code,members:roomMembers,roomWorked:roomPast+roomMembers.reduce((n,m)=>n+m.timer.roomWorked,0)};
for(const m of members.values())send(m.conn,packet);render();
}
function receiveConnection(conn){
if(!host||!joined||pending.size>=LIMIT||members.size>=LIMIT-1&&!members.has(conn.peer)){
conn.on('open',()=>{send(conn,{type:'reject',message:'Oda dolu.'});setTimeout(()=>conn.close(),100)});return;
}
pending.add(conn);let greeted=false,rejected=false;
const handshake=setTimeout(()=>conn.close(),10000);
conn.on('data',data=>{
if(peer===null||!host||rejected)return;
if(!data||data.version!==1)return;
if(!greeted){
const clean=LobbyModel.cleanName(data.name);
if(data.type!=='hello'||!clean){conn.close();return}
const key=nameKey(clean);
if(key===nameKey(name)||[...members].some(([id,member])=>id!==conn.peer&&nameKey(member.name)===key)){
rejected=true;clearTimeout(handshake);pending.delete(conn);send(conn,{type:'reject',reason:'name-in-use'});setTimeout(()=>conn.close(),100);return;
}
if(members.size>=LIMIT-1&&!members.has(conn.peer)){send(conn,{type:'reject',message:'Oda dolu.'});setTimeout(()=>conn.close(),100);return}
greeted=true;clearTimeout(handshake);pending.delete(conn);
const old=members.get(conn.peer);departed.delete(conn.peer);
members.set(conn.peer,{conn,name:clean,profile:LobbyModel.profile(data.profile),timer:LobbyModel.cleanTimer(data.timer),seen:Date.now(),chatAt:0});if(old&&old.conn!==conn)old.conn.close();sentProfiles='';broadcast();for(const message of history)send(conn,{type:'chat',message});return;
}
const m=members.get(conn.peer);if(!m||m.conn!==conn)return;
if(data.type==='presence'){m.timer=LobbyModel.cleanTimer(data.timer);if(data.profile!==undefined)m.profile=LobbyModel.profile(data.profile);m.seen=Date.now()}
else if(data.type==='chat-send'){if(Date.now()-m.chatAt>700){m.chatAt=Date.now();acceptChat(data.message,m.name,m.profile)}else send(conn,{type:'chat-error',id:data.message?.id})}
else if(data.type==='leave'){retire(conn.peer,m);conn.close();broadcast()}
});
const closed=()=>{clearTimeout(handshake);pending.delete(conn);if(members.get(conn.peer)?.conn===conn){retire(conn.peer,members.get(conn.peer));broadcast()}};
conn.on('close',closed);conn.on('error',()=>{conn.close();closed()});
}
function retryJoin(message){
if(!peer||host)return;
clearTimeout(timeout);const old=upstream;upstream=null;old?.close();status(message);attempts++;
if(attempts>4){clear();status('Bağlantı kurulamadı. Oda sahibi sayfayı açık tutsun; başka bir ağla tekrar deneyebilirsin.');return}
clearTimeout(retry);retry=setTimeout(dial,Math.min(8000,attempts*1500));
}
function dial(){
if(!peer||host||peer.destroyed)return;
if(peer.disconnected){retry=setTimeout(dial,2000);return}
const conn=peer.connect(PREFIX+code,{reliable:true,serialization:'binary',metadata:{app:'focus-room',version:1}});upstream=conn;
timeout=setTimeout(()=>{if(upstream===conn){upstream=null;conn.close();retryJoin('Oda sahibine ulaşılamıyor; tekrar deneniyor…')}},25000);
conn.on('open',()=>{if(upstream===conn)send(conn,{type:'hello',version:1,name,profile:ownProfile(),timer:live()})});
conn.on('data',data=>{
if(upstream!==conn)return;
if(data?.type==='profiles'&&data.code===code&&Array.isArray(data.profiles)&&data.profiles.length<=LIMIT){profiles.clear();for(const p of data.profiles)if(typeof p?.id==='string'&&p.id.length<=150)profiles.set(p.id,LobbyModel.profile(p.profile));render();return}
if(data?.type==='closed'){clear();status('Oda sahibi ayrıldı; oda kapandı.');return}
if(data?.type==='reject'){clear();status(data.reason==='name-in-use'?'Bu takma ad odada kullanılıyor. Başka bir isim seçip tekrar katıl.':'Oda dolu. Başka bir oda açabilirsin.');return}
if(data?.type==='chat'){RoomChat.receive(data.message);return}
if(data?.type==='chat-error'){RoomChat.rejected(data.id,'Çok hızlı gönderildi. Bir saniye bekleyip tekrar Gönder’e bas.');return}
const roster=LobbyModel.cleanRoster(data,code,PREFIX+code,peer.id);
if(!roster)return;
clearTimeout(timeout);if(!joined)ownBase=Study.localSeconds?.()??LobbyModel.cleanTimer(Study.liveSession?.()).worked;joined=true;connecting=false;attempts=0;lastMessage=Date.now();rosterAt=lastMessage;roomMembers=roster;views=[];roomPast=Math.max(0,LobbyModel.seconds(data.roomWorked)-roster.reduce((n,m)=>n+m.timer.roomWorked,0));
status('Odaya bağlısın. Sayacın ve çalışma süren burada canlı paylaşılır.');busy();render();
});
conn.on('close',()=>{if(upstream===conn)retryJoin('Oda bağlantısı kesildi; yeniden bağlanılıyor…')});
conn.on('error',()=>{if(upstream===conn){upstream=null;conn.close();retryJoin('Bağlantı sorunu; tekrar deneniyor…')}});
}
function enter(create,collisions=0){
if(window.FocusSocial?.banned?.()){status("Çevrimiçi özelliklerin yasaklandı. Kişisel sayacını kullanabilir veya Profilim’den hesabını silebilirsin.");return}
if(window.FocusSocial?.active()){window.FocusSocial.pauseRoom().then(()=>enter(create,collisions)).catch(()=>status('Önce kalıcı odadan ayrılmayı tekrar dene.'));return}
if(peer||connecting)return;
by('leaveRoom').onclick=leave;by('leaveRoom').textContent='Odadan ayrıl';RoomChat.configure(sendChat);by('copyInvite').onclick=copyInvite;document.querySelector('.chat-note').textContent='Geçici odanın sohbeti yalnızca açık oturumda tutulur.';
name=LobbyModel.cleanName(by('lobbyName').value);
if(!name){status('1–30 karakterlik bir takma ad yaz.');return}
code=create?randomCode():by('roomCodeInput').value.trim().toUpperCase().replace(/\s/g,'');
if(!/^[1-9][0-9]{4}$/.test(code)){status('5 haneli oda numarasını yaz.');return}
if(typeof Peer!=='function'){status('Bağlantı aracı yüklenemedi. Sayfayı yenile ve tekrar dene.');return}
host=create;connecting=true;busy();status('Ücretsiz oda bağlantısı kuruluyor…');by('roomPanel').hidden=false;
let local;try{local=new Peer(create?PREFIX+code:undefined,{secure:true,debug:0})}catch(e){clear();status('Tarayıcı doğrudan bağlantıyı desteklemiyor. Güncel Chrome veya Safari ile dene.');return}peer=local;
timeout=setTimeout(()=>{if(peer===local&&connecting){clear();status('Bağlantı hizmetine ulaşılamadı. İnternetini kontrol edip tekrar dene.')}},25000);
local.on('open',()=>{
if(peer!==local)return;
clearTimeout(timeout);clearTimeout(signalRetry);
if(host){connecting=false;if(!joined)ownBase=Study.localSeconds?.()??LobbyModel.cleanTimer(Study.liveSession?.()).worked;joined=true;broadcast();status('Oda hazır. Kodu arkadaşına gönder; sayfanı açık tut.');busy()}
else if(!upstream)dial();
});
local.on('connection',conn=>{if(peer===local)receiveConnection(conn);else conn.close()});
local.on('error',error=>{
if(peer!==local)return;
if(error.type==='unavailable-id'&&create&&collisions<5){clear();enter(true,collisions+1);return}
if(error.type==='peer-unavailable'){if(upstream){const old=upstream;upstream=null;old.close()}retryJoin('Oda bulunamadı veya oda sahibi çevrimdışı; tekrar deneniyor…');return}
if(error.type==='network'||error.type==='socket-error'||error.type==='socket-closed'){
if(connecting){clear();status('Ücretsiz bağlantı hizmetine ulaşılamıyor. Biraz sonra tekrar dene.')}else status('Bağlantı hizmetiyle iletişim kesildi; mevcut oda bağlantıları sürüyor.');return}
if(error.type==='webrtc'){if(!host)retryJoin('Bu ağda doğrudan bağlantı kurulamıyor; tekrar deneniyor…');return}
clear();status(error.type==='unavailable-id'?'Oda kodu kullanımda. Yeni oda oluştur.':'Tarayıcı bağlantıyı açamadı. Güncel Chrome veya Safari ile tekrar dene.');
});
local.on('disconnected',()=>{
if(peer!==local)return;status('Bağlantı hizmetine yeniden bağlanılıyor…');
clearTimeout(signalRetry);signalRetry=setTimeout(()=>{if(peer===local&&!local.destroyed&&local.disconnected)local.reconnect()},2000);
});
local.on('close',()=>{if(peer===local){clear();status('Oda bağlantısı kapandı. Tekrar katılabilirsin.')}});
}
function leave(){
if(host)for(const m of members.values())send(m.conn,{type:'closed'});
else send(upstream,{type:'leave',version:1});
// Give the ordered data channel time to deliver the departure notice.
setTimeout(()=>{clear();status('Odadan ayrıldın. Kişisel sayacın devam eder.')},100);
}
by('createRoom').onclick=()=>enter(true);by('joinRoom').onclick=()=>enter(false);by('leaveRoom').onclick=leave;
async function copyInvite(){
if(!joined)return;const url=new URL(location.origin+location.pathname);url.searchParams.set('room',code);url.hash='lobi';
try{await navigator.clipboard.writeText(url.href);status('Davet bağlantısı kopyalandı.')}catch(e){status('Davet bağlantısı: '+url.href)}
}by('copyInvite').onclick=copyInvite;
const invite=new URLSearchParams(location.search).get('room');if(invite&&/^[1-9][0-9]{4}$/.test(invite))by('roomCodeInput').value=invite;
window.FocusRoomHeartbeat=()=>{
if(!joined)return;
if(host)broadcast();else if(upstream?.open){
presence();
if(Date.now()-lastMessage>120000){const old=upstream;upstream=null;old.close();retryJoin('Oda sahibinden yanıt gelmiyor; tekrar deneniyor…')}
else if(Date.now()-lastMessage>20000)status('Oda sahibi yanıt vermiyor. Son alınan durum gösteriliyor.');
}render();
};
setInterval(window.FocusRoomHeartbeat,1000);
setInterval(renderClocks,250);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&joined){if(host)broadcast();else presence();render()}});
window.addEventListener('pagehide',()=>{if(peer){if(host)for(const m of members.values())send(m.conn,{type:'closed'});else send(upstream,{type:'leave',version:1});clear()}});
window.FocusTemporaryRoom={active:()=>joined,leaveNow:()=>{if(!peer)return;if(host)for(const m of members.values())send(m.conn,{type:'closed'});else send(upstream,{type:'leave',version:1});clear()}};
sessionStorage.removeItem('focus_room');busy();status('Ücretsiz lobi hazır. Oda aç veya kodla katıl.');
window.addEventListener('focus-profile',()=>{const profile=ownProfile();if(!peer&&profile.uid&&profile.name)by('lobbyName').value=profile.name});
})();

