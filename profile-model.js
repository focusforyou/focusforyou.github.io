'use strict';
const ProfileModel=(()=>{
 function banner(value){if(typeof FocusGifMedia!=='undefined'&&FocusGifMedia.valid(value,'banner'))return value;return typeof value==='string'&&value.length<=40000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)?value:''}
 function draft(){let uid='',value='',dirty=false,revision=0;return {
  load(p){const next=p?.uid||'';if(next!==uid){uid=next;dirty=false;revision++}if(!dirty)value=banner(p?.banner)},
  ticket(){return {uid,revision}},
  set(input,ticket){if(!uid||ticket?.uid!==uid||ticket?.revision!==revision)return false;value=banner(input);dirty=true;revision++;return true},
  value(fallback=''){return dirty?value:banner(fallback)||value},
  saved(){dirty=false;revision++},
  get uid(){return uid}
 }}
 return {banner,draft};
})();
if(typeof module!=='undefined')module.exports=ProfileModel;

