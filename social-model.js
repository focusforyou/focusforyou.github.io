'use strict';
const SocialModel=(()=>{
 const exams=['YKS','LGS','TUS'];
 const username=value=>typeof value==='string'&&/^[a-z0-9_]{3,24}$/.test(value)?value:null;
 const pair=(a,b)=>[a,b].sort().join('_');
 const roomId=value=>typeof value==='string'&&/^(YKS|LGS|TUS|[1-9][0-9]{7}|[A-Za-z0-9_-]{16,40})$/.test(value.replace(/^#/,''))?value.replace(/^#/,''):null;
 const palette=['gold','ruby','ice','violet','emerald'];
 const fonts=['fredoka','cinzel','space-mono'];
 const cosmetics=input=>({font:fonts.includes(input?.font)?input.font:'default',tag:['doctor','system'].includes(input?.tag)||(typeof input?.tag==='string'&&input.tag.startsWith('custom:')&&input.tag.slice(7).trim().length>0&&input.tag.slice(7).length<=24&&!/[\u0000-\u001f\u007f]/.test(input.tag))?input.tag:'none',nameStyle:palette.includes(input?.nameStyle)?input.nameStyle:'plain',frame:palette.includes(input?.frame)?input.frame:'none',plate:palette.includes(input?.plate)?input.plate:'none'});
 function decorate(node,profile){
  const c=cosmetics(profile?.cosmetics);node.classList.add('identity');for(const font of fonts)node.classList.toggle('font-'+font,c.font===font);for(const value of palette){node.classList.toggle('name-'+value,c.nameStyle===value);node.classList.toggle('plate-'+value,c.plate===value)}
  if(c.tag==='doctor'){const tag=document.createElement('span');tag.className='doctor-tag';tag.textContent='[DOKTOR]';node.prepend(tag)}
  else if(c.tag==='system'){const tag=document.createElement('span');tag.className='system-tag';tag.textContent='[SİSTEM]';node.prepend(tag)}
  else if(c.tag.startsWith('custom:')){const tag=document.createElement('span');tag.className='custom-tag';tag.textContent='['+c.tag.slice(7)+']';node.prepend(tag)}
  if(profile?.username){const handle=document.createElement('small');handle.className='username';handle.textContent=' @'+profile.username;node.append(handle)}
 }
 return {exams,username,pair,roomId,cosmetics,decorate};
})();
if(typeof module!=='undefined')module.exports=SocialModel;
else window.SocialModel=SocialModel;

