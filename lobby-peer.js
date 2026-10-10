'use strict';
(()=>{
const by=id=>document.getElementById(id),PREFIX='focusforyou-room-v1-',LIMIT=8;
let peer=null,host=false,code='',name='',upstream=null,joined=false,connecting=false,attempts=0,lastMessage=0;
let timeout=null,retry=null,signalRetry=null,roomMembers=[];
const members=new Map(),pending=new Set();
const status=message=>by('lobbyStatus').textContent=message;
const busy=()=>{by('createRoom').disabled=!!peer||connecting;by('joinRoom').disabled=!!peer||connecting;by('leaveRoom').hidden=!peer&&!connecting};
const live=()=>LobbyModel.cleanTimer(Study.liveSession?.());
const send=(conn,data)=>{try{if(conn?.open)conn.send(data)}catch(e){}};
function randomCode(){const bytes=crypto.getRandomValues(new Uint8Array(10)),letters='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return [...bytes].map(n=>letters[n%32]).join('')}
function clear(){
clearTimeout(timeout);clearTimeout(retry);clearTimeout(signalRetry);timeout=retry=signalRetry=null;
const old=peer;peer=null;upstream=null;connecting=false;joined=false;host=false;code='';attempts=0;
members.clear();pending.clear();roomMembers=[];old?.destroy();by('roomPanel').hidden=true;busy();
}
function render(){
if(!joined)return;
by('roomPanel').hidden=false;by('roomCode').textContent='Oda '+code;
by('roomInfo').textContent=roomMembers.length+'/'+LIMIT+' kişi · Herkes kendi sayacını yönetir'+(host?' · Oda sahibisin.':'');
by('roomMembers').replaceChildren(...roomMembers.map(member=>{
const li=document.createElement('li'),own=member.id===peer?.id;
const label=document.createElement('strong');label.textContent=member.name+(member.host?' · oda sahibi':'')+(own?' · sen':'');
const text=document.createElement('span');text.textContent=' — '+LobbyModel.describe(own?live():member.timer);
li.append(label,text);return li;
}));
const timer=live();by('roomTime').textContent=LobbyModel.clock(timer.left);
by('roomPhase').textContent='Senin sayacın · '+(timer.phase==='focus'?'Odak':'Mola');
}
function broadcast(){
if(!host||!joined)return;
const now=Date.now();
for(const [id,entry] of members)if(now-entry.seen>120000){members.delete(id);entry.conn.close()}
roomMembers=[{id:peer.id,name,host:true,timer:live()},...[...members].map(([id,m])=>({id,name:m.name,host:false,timer:m.timer}))];
const packet={type:'roster',version:1,code,members:roomMembers};
for(const m of members.values())send(m.conn,packet);render();
}
function receiveConnection(conn){
if(!host||!joined||pending.size>=LIMIT||members.size>=LIMIT-1&&!members.has(conn.peer)){
conn.on('open',()=>{send(conn,{type:'reject',message:'Oda dolu.'});setTimeout(()=>conn.close(),100)});return;
}
pending.add(conn);let greeted=false;
const handshake=setTimeout(()=>conn.close(),10000);
conn.on('data',data=>{
if(peer===null||!host)return;
if(!data||data.version!==1)return;
if(!greeted){
const clean=LobbyModel.cleanName(data.name);
if(data.type!=='hello'||!clean){conn.close();return}
if(members.size>=LIMIT-1&&!members.has(conn.peer)){send(conn,{type:'reject',message:'Oda dolu.'});setTimeout(()=>conn.close(),100);return}
greeted=true;clearTimeout(handshake);pending.delete(conn);
const old=members.get(conn.peer);if(old&&old.conn!==conn)old.conn.close();
members.set(conn.peer,{conn,name:clean,timer:LobbyModel.cleanTimer(data.timer),seen:Date.now()});broadcast();return;
}
const m=members.get(conn.peer);if(!m||m.conn!==conn)return;
if(data.type==='presence'){m.timer=LobbyModel.cleanTimer(data.timer);m.seen=Date.now()}
else if(data.type==='leave'){members.delete(conn.peer);conn.close();broadcast()}
});
const closed=()=>{clearTimeout(handshake);pending.delete(conn);if(members.get(conn.peer)?.conn===conn){members.delete(conn.peer);broadcast()}};
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
const conn=peer.connect(PREFIX+code,{reliable:true,serialization:'json',metadata:{app:'focus-room',version:1}});upstream=conn;
timeout=setTimeout(()=>{if(upstream===conn){upstream=null;conn.close();retryJoin('Oda sahibine ulaşılamıyor; tekrar deneniyor…')}},25000);
conn.on('open',()=>{if(upstream===conn)send(conn,{type:'hello',version:1,name,timer:live()})});
conn.on('data',data=>{
if(upstream!==conn)return;
if(data?.type==='closed'){clear();status('Oda sahibi ayrıldı; oda kapandı.');return}
if(data?.type==='reject'){clear();status('Oda dolu. Başka bir oda açabilirsin.');return}
const roster=LobbyModel.cleanRoster(data,code,PREFIX+code,peer.id);
if(!roster)return;
clearTimeout(timeout);joined=true;connecting=false;attempts=0;lastMessage=Date.now();roomMembers=roster;
status('Odaya bağlısın. Kendi sayacını çalışma bölümünden yönetebilirsin.');busy();render();
});
conn.on('close',()=>{if(upstream===conn)retryJoin('Oda bağlantısı kesildi; yeniden bağlanılıyor…')});
conn.on('error',()=>{if(upstream===conn){upstream=null;conn.close();retryJoin('Bağlantı sorunu; tekrar deneniyor…')}});
}
function enter(create){
if(peer||connecting)return;
name=LobbyModel.cleanName(by('lobbyName').value);
if(!name){status('1–30 karakterlik bir takma ad yaz.');return}
code=create?randomCode():by('roomCodeInput').value.trim().toUpperCase().replace(/\s/g,'');
if(!/^[A-Z2-9]{10}$/.test(code)){status('10 karakterlik oda kodunu yaz.');return}
if(typeof Peer!=='function'){status('Bağlantı aracı yüklenemedi. Sayfayı yenile ve tekrar dene.');return}
host=create;connecting=true;busy();status('Ücretsiz oda bağlantısı kuruluyor…');by('roomPanel').hidden=false;
let local;try{local=new Peer(create?PREFIX+code:undefined,{secure:true,debug:0})}catch(e){clear();status('Tarayıcı doğrudan bağlantıyı desteklemiyor. Güncel Chrome veya Safari ile dene.');return}peer=local;
timeout=setTimeout(()=>{if(peer===local&&connecting){clear();status('Bağlantı hizmetine ulaşılamadı. İnternetini kontrol edip tekrar dene.')}},25000);
local.on('open',()=>{
if(peer!==local)return;
clearTimeout(timeout);clearTimeout(signalRetry);
if(host){connecting=false;joined=true;broadcast();status('Oda hazır. Kodu arkadaşına gönder; sayfanı açık tut.');busy()}
else if(!upstream)dial();
});
local.on('connection',conn=>{if(peer===local)receiveConnection(conn);else conn.close()});
local.on('error',error=>{
if(peer!==local)return;
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
by('copyInvite').onclick=async()=>{
if(!joined)return;const url=new URL(location.origin+location.pathname);url.searchParams.set('room',code);url.hash='lobi';
try{await navigator.clipboard.writeText(url.href);status('Davet bağlantısı kopyalandı.')}catch(e){status('Davet bağlantısı: '+url.href)}
};
const invite=new URLSearchParams(location.search).get('room');if(invite&&/^[A-Z2-9]{10}$/.test(invite))by('roomCodeInput').value=invite;
setInterval(()=>{
if(!joined)return;
if(host)broadcast();else if(upstream?.open){
send(upstream,{type:'presence',version:1,timer:live()});
if(Date.now()-lastMessage>120000){const old=upstream;upstream=null;old.close();retryJoin('Oda sahibinden yanıt gelmiyor; tekrar deneniyor…')}
else if(Date.now()-lastMessage>20000)status('Oda sahibi yanıt vermiyor. Son alınan durum gösteriliyor.');
}render();
},5000);
setInterval(()=>{if(joined){const timer=live();by('roomTime').textContent=LobbyModel.clock(timer.left);by('roomPhase').textContent='Senin sayacın · '+(timer.phase==='focus'?'Odak':'Mola')}},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&joined){if(host)broadcast();else send(upstream,{type:'presence',version:1,timer:live()});render()}});
window.addEventListener('pagehide',()=>{if(peer){if(host)for(const m of members.values())send(m.conn,{type:'closed'});else send(upstream,{type:'leave',version:1});clear()}});
sessionStorage.removeItem('focus_room');busy();status('Ücretsiz lobi hazır. Oda aç veya kodla katıl.');
})();
