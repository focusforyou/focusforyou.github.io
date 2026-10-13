(function(root){
 'use strict';
 const text=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
 function phase(session,now=Date.now()){
  const focus=Math.max(60,Math.min(10800,Number(session.focus)||1500)),rest=Math.max(60,Math.min(3600,Number(session.rest)||300));
  if(session.status!=='running'||!Number.isFinite(session.startedAt))return {phase:'ready',left:focus,round:0};
  const elapsed=Math.max(0,Math.floor((now-session.startedAt)/1000)),cycle=focus+rest,position=elapsed%cycle;
  return {phase:position<focus?'focus':'break',left:position<focus?focus-position:cycle-position,round:Math.floor(elapsed/cycle)+1};
 }
 function event(title,when,now=Date.now()){const startsAt=Number(when);if(!text(title,80)||!Number.isFinite(startsAt)||startsAt<now+60000||startsAt>now+90*86400000)throw Error('Etkinlik zamanı en az 1 dakika sonra ve en fazla 90 gün içinde olmalı.');return {title:text(title,80),startsAt};}
 function duration(v,max){const n=Number(v);if(!Number.isInteger(n)||n<1||n>max)throw Error('Geçerli bir dakika süresi seç.');return n*60;}
 function contribution(previous,goalId,amount){const old=previous?.goalId===goalId?Math.max(0,Number(previous.seconds)||0):0;return Math.min(604800,Math.floor(old+Math.max(0,Number(amount)||0)));}
 const api={phase,event,duration,text,contribution};root.RoomActivitiesModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
