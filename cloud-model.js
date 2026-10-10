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
