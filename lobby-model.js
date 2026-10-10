'use strict';
const LobbyModel=(()=>{
const cleanName=value=>typeof value==='string'&&value.trim().length>=1&&value.trim().length<=30?value.trim():null;
function cleanTimer(input){
const t=input&&typeof input==='object'?input:{};
const total=Number.isFinite(t.total)&&t.total>=60&&t.total<=10800?t.total:1500;
return {phase:t.phase==='break'?'break':'focus',running:t.running===true,
left:Number.isFinite(t.left)?Math.max(0,Math.min(total,t.left)):total,total,
worked:seconds(t.worked),roomWorked:seconds(t.roomWorked),
focus:Number.isFinite(t.focus)&&t.focus>=60&&t.focus<=10800?t.focus:1500,
rest:Number.isFinite(t.rest)&&t.rest>=60&&t.rest<=3600?t.rest:300,
rounds:Number.isInteger(t.rounds)&&t.rounds>=0&&t.rounds<=100000?t.rounds:0};
}
function cleanRoster(packet,code,hostId,ownId){
if(!packet||packet.type!=='roster'||packet.version!==1||packet.code!==code||!Array.isArray(packet.members)||packet.members.length<1||packet.members.length>8)return null;
const ids=new Set(),out=[];
for(const member of packet.members){
if(!member||typeof member.id!=='string'||member.id.length>150||ids.has(member.id)||!cleanName(member.name))return null;
ids.add(member.id);out.push({id:member.id,name:cleanName(member.name),host:member.id===hostId,timer:cleanTimer(member.timer)});
}
return ids.has(hostId)&&ids.has(ownId)?out:null;
}
function seconds(n){return Number.isFinite(n)?Math.max(0,Math.min(315360000,n)):0}
function avatar(value){if(typeof value!=='string')return '';if(value.length<=40000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return value;try{const u=new URL(value);return value.length<1500&&u.protocol==='https:'&&/^lh\d+\.googleusercontent\.com$/.test(u.hostname)?value:''}catch(e){return ''}}
function profile(value){return {uid:typeof value?.uid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value.uid)?value.uid:'',name:cleanName(value?.name)||'',photo:avatar(value?.photo)}}
function project(input,elapsed){const t=cleanTimer(input);let age=t.running?Math.min(15,Math.max(0,elapsed)):0;while(age>0){const used=Math.min(age,t.left);t.left-=used;age-=used;if(t.phase==='focus'){t.worked+=used;t.roomWorked+=used}if(t.left<=0){if(t.phase==='focus')t.rounds++;t.phase=t.phase==='focus'?'break':'focus';t.total=t.phase==='focus'?t.focus:t.rest;t.left=t.total}}return t}
function hours(value){const s=Math.floor(seconds(value));return Math.floor(s/3600)+' sa '+String(Math.floor(s%3600/60)).padStart(2,'0')+' dk '+String(s%60).padStart(2,'0')+' sn'}
function content(data){if(!data||typeof data.id!=='string'||!/^[A-Z2-9]{20}$/.test(data.id)||typeof data.text!=='string'||data.text.length>2000)return null;const image=data.image||'';if(typeof image!=='string'||image.length>1500000||image&&!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image))return null;const text=data.text.trim();return text||image?{id:data.id,text,image}:null}
function chat(data){const body=content(data);return body&&cleanName(data.sender)&&Number.isFinite(data.time)?{...body,sender:cleanName(data.sender),time:data.time,avatar:avatar(data.avatar)}:null}
function clock(seconds){const s=Math.ceil(seconds);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function describe(timer){const t=cleanTimer(timer);return (t.phase==='focus'?'Odak':'Mola')+' '+clock(t.left)+(t.running?' · çalışıyor':' · duraklatıldı')+' · '+t.rounds+' tur'}
return {cleanName,cleanTimer,cleanRoster,clock,describe,seconds,project,hours,content,chat,avatar,profile};
})();
if(typeof module!=='undefined')module.exports=LobbyModel;
