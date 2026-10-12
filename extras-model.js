'use strict';
const ExtrasModel=(()=>{
 const themes={night:'Gece',aurora:'Kutup ışıkları',ocean:'Okyanus',sunset:'Gün batımı'};
 const milestones=[{id:'first',hours:1,name:'İlk adım',icon:'🌱'},{id:'ten',hours:10,name:'Ritim yakalandı',icon:'✨'},{id:'fifty',hours:50,name:'İstikrarlı',icon:'📚'},{id:'hundred',hours:100,name:'Yüz saat',icon:'🏅'},{id:'fivehundred',hours:500,name:'Uzun yol',icon:'💎'},{id:'thousand',hours:1000,name:'Bin saat',icon:'🌟'}];
 const tips=['Biraz ayağa kalkıp bulunduğun ortamda kısa bir tur at.','Ekrandan uzaklaş ve birkaç dakika başka bir yere bak.','Su molası ver; sonraki tur için masanı toparla.','Pencereden dışarı bakıp birkaç dakika dinlen.'];
 const state=(timer,online=true)=>!online?'Çevrimdışı':timer?.running&&timer?.phase==='focus'?'Odaklanıyor':'Molada';
 const earned=seconds=>milestones.filter(m=>Number.isFinite(seconds)&&seconds>=m.hours*3600);
 function showcase(value){const s=value&&typeof value==='object'?value:{};return {bio:typeof s.bio==='string'?s.bio.slice(0,160):'',showHours:s.showHours===true,seconds:Number.isFinite(s.seconds)?Math.max(0,Math.min(315360000,s.seconds)):0,badges:Array.isArray(s.badges)?[...new Set(s.badges)].filter(id=>milestones.some(m=>m.id===id)).slice(0,3):[]}}
 function calendar(days,end=new Date(),weeks=12){const last=new Date(end);last.setHours(0,0,0,0);const count=Math.min(26,Math.max(1,weeks))*7,out=[];for(let ago=count-1;ago>=0;ago--){const day=new Date(last);day.setDate(day.getDate()-ago);const key=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-'),value=days?.[key],seconds=Number.isFinite(value)&&value>0?Math.min(86400,value):0;out.push({key,minutes:Math.floor(seconds/60),level:seconds<=0?0:seconds<1800?1:seconds<3600?2:seconds<7200?3:4})}return out}
 const role=(room,uid,members,admin=false)=>admin?'Yönetici':room?.ownerUid===uid?'Lider':members?.find(m=>m.uid===uid)?.role==='moderator'?'Moderatör':'Üye';
 return {themes,milestones,tips,state,earned,showcase,calendar,role};
})();
if(typeof module!=='undefined')module.exports=ExtrasModel;else window.ExtrasModel=ExtrasModel;
