'use strict';
const http=require('node:http'),crypto=require('node:crypto');
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const token=()=>crypto.randomBytes(24).toString('base64url');
const fail=(status,message)=>Object.assign(new Error(message),{status});
const duration=(n,max,fallback)=>Number.isInteger(n)&&n>=1&&n<=max?n*60:fallback*60;
function createLobbyServer(options={}){
const rooms=new Map(),rates=new Map(),clock=options.clock||Date.now;
const origins=new Set(options.origins||['https://focusforyou.github.io']);
function sync(room,now){
if(!room.timer.running)return;
while(now>=room.timer.end){
const end=room.timer.end;
if(room.timer.phase==='focus'){room.timer.phase='break';room.timer.rounds++}
else room.timer.phase='focus';
room.timer.remaining=room.timer.phase==='focus'?room.focus:room.break;
room.timer.end=end+room.timer.remaining*1000;
}
}
function sweep(now){
for(const [code,room] of rooms){
const host=room.members.get(room.host);
if(!host||now-host.seen>300000||now-room.created>86400000){rooms.delete(code);continue}
for(const [id,member] of room.members){if(id!==room.host&&now-member.seen>60000)room.members.delete(id)}
}
for(const [ip,rate] of rates)if(now-rate.start>60000)rates.delete(ip);
}
function snapshot(room,member,now){
sync(room,now);
return {code:room.code,host:member.id===room.host,serverTime:now,focus:room.focus,break:room.break,
timer:{...room.timer,remaining:room.timer.running?Math.max(0,(room.timer.end-now)/1000):room.timer.remaining},
members:[...room.members.values()].map(m=>({id:m.id,name:m.name,host:m.id===room.host}))};
}
const server=http.createServer(async(req,res)=>{
const origin=req.headers.origin;
if(origin&&!origins.has(origin)){res.writeHead(403);return res.end()}
if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
res.setHeader('Vary','Origin');res.setHeader('Cache-Control','no-store');
res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
res.setHeader('X-Content-Type-Options','nosniff');
if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value))};
try{
const now=clock();sweep(now);
const url=new URL(req.url,'http://localhost');
if(url.pathname==='/health'&&req.method==='GET')return json(200,{ok:true});
const ip=req.socket.remoteAddress;
const rate=rates.get(ip)||{start:now,n:0};
if(now-rate.start>60000){rate.start=now;rate.n=0}
rate.n++;rates.set(ip,rate);if(rate.n>600)throw fail(429,'Çok fazla istek. Bir dakika sonra tekrar dene.');
let body={};
if(req.method==='POST'){
let size=0,chunks=[];
for await(const chunk of req){size+=chunk.length;if(size>8192)throw fail(413,'İstek çok büyük.');chunks.push(chunk)}
try{body=JSON.parse(Buffer.concat(chunks).toString()||'{}')}catch(e){throw fail(400,'İstek geçersiz.')}
if(!body||typeof body!=='object'||Array.isArray(body))throw fail(400,'İstek geçersiz.');
}
const name=()=>{if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>30)throw fail(400,'1–30 karakterlik bir takma ad yaz.');return body.name.trim()};
if(url.pathname==='/rooms'&&req.method==='POST'){
if(rooms.size>=128)throw fail(503,'Odalar şu an dolu. Biraz sonra tekrar dene.');
let code;do{code=Array.from(crypto.randomBytes(10),v=>ALPHABET[v%ALPHABET.length]).join('')}while(rooms.has(code));
const member={id:token(),token:token(),name:name(),seen:now};
const room={code,host:member.id,created:now,focus:duration(body.focus,180,25),break:duration(body.break,60,5),members:new Map([[member.id,member]])};
room.timer={phase:'focus',running:false,remaining:room.focus,end:null,rounds:0};rooms.set(code,room);
return json(201,{token:member.token,...snapshot(room,member,now)});
}
const match=url.pathname.match(/^\/rooms\/([A-Z2-9]{10})(?:\/(join|action|leave))?$/);
if(!match)throw fail(404,'Adres bulunamadı.');
const room=rooms.get(match[1]);if(!room)throw fail(404,'Oda kapalı veya kod yanlış.');
if(match[2]==='join'&&req.method==='POST'){
if(room.members.size>=12)throw fail(409,'Bu oda dolu (en fazla 12 kişi).');
const member={id:token(),token:token(),name:name(),seen:now};room.members.set(member.id,member);
return json(200,{token:member.token,...snapshot(room,member,now)});
}
const supplied=(req.headers.authorization||'').replace(/^Bearer /,'');
const member=[...room.members.values()].find(m=>m.token===supplied);
if(!member)throw fail(401,'Oturum sona erdi. Odaya yeniden katıl.');
member.seen=now;
if(!match[2]&&req.method==='GET')return json(200,snapshot(room,member,now));
if(match[2]==='leave'&&req.method==='POST'){
if(member.id===room.host)rooms.delete(room.code);else room.members.delete(member.id);
return json(200,{left:true});
}
if(match[2]==='action'&&req.method==='POST'){
if(member.id!==room.host)throw fail(403,'Ortak sayacı yalnızca oda sahibi yönetebilir.');
sync(room,now);
if(body.action==='toggle'){
if(room.timer.running){room.timer.remaining=Math.max(0,(room.timer.end-now)/1000);room.timer.running=false;room.timer.end=null}
else{room.timer.running=true;room.timer.end=now+room.timer.remaining*1000}
}else if(['focus','break','reset'].includes(body.action)){
room.timer.phase=body.action==='break'?'break':'focus';room.timer.running=false;
room.timer.remaining=room.timer.phase==='focus'?room.focus:room.break;room.timer.end=null;
}else throw fail(400,'Komut geçersiz.');
return json(200,snapshot(room,member,now));
}
throw fail(405,'Yöntem desteklenmiyor.');
}catch(error){json(error.status||500,{error:error.status?error.message:'Sunucu şu an yanıt veremiyor.'})}
});
return server;
}
module.exports={createLobbyServer};
if(require.main===module)createLobbyServer().listen(Number(process.env.PORT)||3000,'0.0.0.0');

