'use strict';
const LobbyModel=(()=>{
const cleanName=value=>typeof value==='string'&&value.trim().length>=1&&value.trim().length<=30?value.trim():null;
function cleanTimer(input){
const t=input&&typeof input==='object'?input:{};
const total=Number.isFinite(t.total)&&t.total>=60&&t.total<=10800?t.total:1500;
return {phase:t.phase==='break'?'break':'focus',running:t.running===true,
left:Number.isFinite(t.left)?Math.max(0,Math.min(total,t.left)):total,total,
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
function clock(seconds){const s=Math.ceil(seconds);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function describe(timer){const t=cleanTimer(timer);return (t.phase==='focus'?'Odak':'Mola')+' '+clock(t.left)+(t.running?' · çalışıyor':' · duraklatıldı')+' · '+t.rounds+' tur'}
return {cleanName,cleanTimer,cleanRoster,clock,describe};
})();
if(typeof module!=='undefined')module.exports=LobbyModel;
