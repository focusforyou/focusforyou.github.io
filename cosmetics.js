'use strict';
const FocusCosmetics=(()=>{
 const cost=3600000,palette=['gold','ruby','ice','violet','emerald'],colors={gold:'#f9d66b',ruby:'#ff7591',ice:'#90d9ff',violet:'#d2a3ff',emerald:'#7de0af'},labels={gold:'Altın',ruby:'Yakut',ice:'Buz',violet:'Ametist',emerald:'Zümrüt'},fields={name:'nameStyles',frame:'frames',plate:'plates'};
 const catalog=Object.entries(fields).flatMap(([kind,field])=>palette.map(value=>Object.freeze({id:kind+':'+value,kind,field,value,cost,color:colors[value],label:labels[value]+' '+({name:'isim stili',frame:'çerçeve',plate:'isim plakası'}[kind])})));
 const find=id=>catalog.find(item=>item.id===id)||null;
 const normalize=input=>({nameStyles:Array.isArray(input?.nameStyles)?[...new Set(input.nameStyles.filter(v=>v==='plain'||palette.includes(v)))]:[],frames:Array.isArray(input?.frames)?[...new Set(input.frames.filter(v=>v==='none'||palette.includes(v)))]:[],plates:Array.isArray(input?.plates)?[...new Set(input.plates.filter(v=>v==='none'||palette.includes(v)))]:[],tags:Array.isArray(input?.tags)?[...new Set(input.tags.filter(validTag))]:[]});
 function validTag(value){return typeof value==='string'&&value.startsWith('custom:')&&value.slice(7).trim().length>=1&&value.slice(7).length<=24&&!/[\u0000-\u001f\u007f]/.test(value)}
 const balance=wallet=>Math.max(0,Math.floor(Number(wallet?.earnedSeconds)||0)-Math.floor(Number(wallet?.spentSeconds)||0));
 const owned=(input,id)=>{const item=find(id);return !!item&&normalize(input)[item.field].includes(item.value)};
 const grant=(input,id)=>{const item=find(id);if(!item)throw Error('unknown-item');const result=normalize(input);if(!result[item.field].includes(item.value))result[item.field].push(item.value);return result};
 return Object.freeze({cost,palette,colors,catalog:()=>catalog.slice(),find,normalize,validTag,balance,owned,grant});
})();
if(typeof module!=='undefined')module.exports=FocusCosmetics;else window.FocusCosmetics=FocusCosmetics;
