'use strict';
const SocialModel=(()=>{
 const exams=['YKS','LGS','TUS'];
 const username=value=>typeof value==='string'&&/^[a-z0-9_]{3,24}$/.test(value)?value:null;
 const pair=(a,b)=>[a,b].sort().join('_');
 const roomId=value=>typeof value==='string'&&/^(YKS|LGS|TUS|[1-9][0-9]{7}|[A-Za-z0-9_-]{16,40})$/.test(value.replace(/^#/,''))?value.replace(/^#/,''):null;
 const cosmetics=input=>({tag:input?.tag==='doctor'?'doctor':'none',nameStyle:['plain','gold'].includes(input?.nameStyle)?input.nameStyle:'plain',frame:input?.frame==='gold'?'gold':'none',plate:input?.plate==='gold'?'gold':'none'});
 function decorate(node,profile){
  const c=cosmetics(profile?.cosmetics);node.classList.add('identity');node.classList.toggle('name-gold',c.nameStyle==='gold');node.classList.toggle('plate-gold',c.plate==='gold');
  if(c.tag==='doctor'){const tag=document.createElement('span');tag.className='doctor-tag';tag.textContent='[DOKTOR]';node.prepend(tag)}
  if(profile?.username){const handle=document.createElement('small');handle.className='username';handle.textContent=' @'+profile.username;node.append(handle)}
 }
 return {exams,username,pair,roomId,cosmetics,decorate};
})();
if(typeof module!=='undefined')module.exports=SocialModel;
else window.SocialModel=SocialModel;
