'use strict';
const CloudModel=(()=>{
const keys=['preferences','tasks','forest','exam'];
function days(input){const out={};if(!input||typeof input!=='object'||Array.isArray(input))return out;for(const [date,n] of Object.entries(input))if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(n)&&n>=0&&n<=86400)out[date]=n;return out}
const time=value=>typeof value?.toMillis==='function'?value.toMillis():0;
function combine(base,devices){
 const total=days(base?.days),fields={...(base?.fields||{})},latest={};
 for(const device of devices){for(const [date,n] of Object.entries(days(device.days)))total[date]=Math.min(86400,(total[date]||0)+n);
 for(const key of keys)if(typeof device[key]?.value==='string'&&time(device[key].at)>=(latest[key]||0)){fields[key]=device[key].value;latest[key]=time(device[key].at)}}
 return {days:total,fields};
}
function photo(value){if(typeof value!=='string')return '';if(value.length<=40000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return value;try{const url=new URL(value);return value.length<1500&&url.protocol==='https:'&&/^lh\d+\.googleusercontent\.com$/.test(url.hostname)?value:''}catch(e){return ''}}
function profile(input){return {uid:typeof input?.uid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(input.uid)?input.uid:'',name:typeof input?.name==='string'?input.name.trim().slice(0,30):'',photo:photo(input?.photo)}}
return {days,combine,photo,profile,keys};
})();
if(typeof module!=='undefined')module.exports=CloudModel;
if(typeof window!=='undefined'){
 function offlineCache(change){const uid=localStorage.getItem('focus_current_uid');if(!uid)return;try{const cache=JSON.parse(localStorage.getItem('focus_account_'+uid)||'null')||{days:{},dirty:{}};cache.days=CloudModel.days(cache.days);cache.dirty=cache.dirty||{};change(cache);localStorage.setItem('focus_account_'+uid,JSON.stringify(cache))}catch(e){}}
 window.FocusAccount={offline:true,record:(date,seconds)=>offlineCache(cache=>{cache.days[date]=Math.min(86400,(cache.days[date]||0)+seconds)})};
 function offlineFields(){if(!window.FocusAccount?.offline)return;offlineCache(cache=>{const values=window.FocusData?.fields();if(!values)return;for(const [key,value] of Object.entries(values))if(typeof cache.observed?.[key]==='string'&&value!==cache.observed[key])cache.dirty[key]=value;cache.observed=values})}
 setInterval(offlineFields,5000);addEventListener('pagehide',offlineFields);
}
