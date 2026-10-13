'use strict';
(function(root){
 const day=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 const finite=n=>Number.isFinite(n)&&n>=0;
 function task(k){if(!k||!Number.isSafeInteger(k.id)||typeof k.name!=='string'||k.name.length>500||!finite(k.left)||k.left>36000)return null;return {id:k.id,name:k.name,done:!!k.done,left:k.left,estimate:finite(k.estimate)?Math.min(36000,k.estimate):k.left,worked:finite(k.worked)?Math.min(31536000,k.worked):0,completedAt:typeof k.completedAt==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(k.completedAt)?k.completedAt:''}}
 function consume(k,seconds){if(!k||k.done||!finite(seconds))return;k.worked=(k.worked||0)+seconds;k.left=Math.max(0,k.left-seconds)}
 function complete(k,date=new Date()){if(!k||k.done)return null;k.done=true;k.completedAt=day(date);return {id:k.id,name:k.name.slice(0,160),date:k.completedAt,worked:Math.round(k.worked||0)}}
 function histories(value){return (Array.isArray(value)?value:[]).filter(k=>k&&Number.isSafeInteger(k.id)&&typeof k.name==='string'&&k.name.length<=160&&/^\d{4}-\d{2}-\d{2}$/.test(k.date)&&finite(k.worked)).slice(-180).map(k=>({id:k.id,name:k.name,date:k.date,worked:Math.min(31536000,k.worked)}))}
 function notes(value){return (Array.isArray(value)?value:[]).slice(0,8).filter(n=>n&&typeof n.id==='string'&&n.id.length<=64).map(n=>({id:n.id,title:String(n.title||'Yeni not').slice(0,60),text:String(n.text||'').slice(0,1200),strokes:(Array.isArray(n.strokes)?n.strokes:[]).slice(-32).map(s=>(Array.isArray(s)?s:[]).slice(0,64).filter(p=>Array.isArray(p)&&p.length===2&&p.every(x=>Number.isFinite(x)&&x>=0&&x<=1)).map(p=>p.map(x=>Math.round(x*1000)/1000)))}))}
 function week(days,history,today=new Date(),offset=0){const start=new Date(today.getFullYear(),today.getMonth(),today.getDate());start.setDate(start.getDate()-((start.getDay()+6)%7)+offset*7);return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);const date=day(d);return {date,label:d.toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'short'}),seconds:finite(days?.[date])?days[date]:0,tasks:histories(history).filter(t=>t.date===date)}})}
 const api={task,consume,complete,histories,notes,week,day};root.FocusPlannerModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
