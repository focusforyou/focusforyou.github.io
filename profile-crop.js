(function(root){
 'use strict';
 const MAX_FILE=20*1024*1024,MAX_PHOTO=40000;
 function geometry(width,height,zoom=1,x=width/2,y=height/2){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('invalid-image');
  zoom=Math.max(1,Math.min(4,Number(zoom)||1));
  const size=Math.min(width,height)/zoom,half=size/2;
  const cx=Math.max(half,Math.min(width-half,Number.isFinite(x)?x:width/2));
  const cy=Math.max(half,Math.min(height-half,Number.isFinite(y)?y:height/2));
  return {x:cx-half,y:cy-half,size,cx,cy,zoom};
 }
 function isGif(file){return file?.type==='image/gif'||/\.gif$/i.test(file?.name||'')}
 function validate(file){if(!file||!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)||file.size>MAX_FILE||file.size<=0)throw Error('20 MB’tan küçük bir JPEG, PNG, WebP veya GIF seç.');return file}
 function encode(canvas){for(const quality of [.88,.76,.6,.45,.3,.18]){const value=canvas.toDataURL('image/jpeg',quality);if(value.length<=MAX_PHOTO&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return value}throw Error('Fotoğraf kaydedilemedi. Başka bir görsel dene.')}
 const api={geometry,validate,isGif,encode};
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(!root?.document)return;
 let current=null,revision=0;
 async function decode(file){
  if(typeof root.createImageBitmap==='function')return root.createImageBitmap(file);
  const url=URL.createObjectURL(file),image=new Image();
  try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url});return image}finally{URL.revokeObjectURL(url)}
 }
 api.cancel=()=>{revision++;current?.()};
 api.open=async function(file){
  validate(file);const ticket=++revision;current?.();
  const gif=isGif(file),image=gif?null:await decode(file);
  if(ticket!==revision){image?.close?.();return null}
  const doc=root.document,dialog=doc.createElement('dialog');dialog.className='profile-crop-dialog';
  dialog.setAttribute('aria-labelledby','avatarCropTitle');
  const heading=doc.createElement('h2');heading.id='avatarCropTitle';heading.textContent=gif?'Animasyonlu profil fotoğrafı':'Profil fotoğrafını kırp';
  const description=doc.createElement('p');description.textContent=gif?'GIF’in hareketini korumak için kırpma uygulanmaz. Görsel profilinde ortalanarak gösterilir.':'Görseli sürükleyerek yerleştir, kaydırıcıyla yakınlaştır.';
  const stage=doc.createElement('div');stage.className='profile-crop-stage';
  const preview=doc.createElement(gif?'img':'canvas');preview.className='profile-crop-preview';
  let gifUrl='';if(gif){gifUrl=URL.createObjectURL(file);preview.src=gifUrl;preview.alt='Animasyonlu fotoğraf önizlemesi'}else{preview.width=preview.height=480;preview.tabIndex=0;preview.setAttribute('role','img');preview.setAttribute('aria-label','Kırpılacak fotoğraf. Ok tuşlarıyla konumunu değiştir.');preview.style.touchAction='none'}
  stage.append(preview);dialog.append(heading,description,stage);
  const status=doc.createElement('p');status.className='profile-crop-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  let state=image?geometry(image.width,image.height):null;
  const draw=()=>{if(!state)return;const ctx=preview.getContext('2d');ctx.fillStyle='#111c35';ctx.fillRect(0,0,480,480);ctx.drawImage(image,state.x,state.y,state.size,state.size,0,0,480,480)};
  const move=(dx,dy)=>{state=geometry(image.width,image.height,state.zoom,state.cx+dx,state.cy+dy);draw()};
  if(!gif){
   const controls=doc.createElement('div');controls.className='profile-crop-controls';
   const label=doc.createElement('label');label.textContent='Yakınlaştır';label.htmlFor='avatarCropZoom';
   const slider=doc.createElement('input');slider.type='range';slider.id='avatarCropZoom';slider.min='1';slider.max='4';slider.step='.01';slider.value='1';slider.setAttribute('aria-label','Fotoğraf yakınlaştırma');
   slider.addEventListener('input',()=>{state=geometry(image.width,image.height,Number(slider.value),state.cx,state.cy);draw()});
   const reset=doc.createElement('button');reset.type='button';reset.textContent='Ortala';reset.addEventListener('click',()=>{state=geometry(image.width,image.height);slider.value='1';draw()});
   controls.append(label,slider,reset);dialog.append(controls);
   let pointer=null,lastX=0,lastY=0;
   preview.addEventListener('pointerdown',event=>{if(event.button!==0)return;pointer=event.pointerId;lastX=event.clientX;lastY=event.clientY;preview.setPointerCapture(pointer);preview.focus();event.preventDefault()});
   preview.addEventListener('pointermove',event=>{if(pointer!==event.pointerId)return;const scale=state.size/preview.getBoundingClientRect().width;move(-(event.clientX-lastX)*scale,-(event.clientY-lastY)*scale);lastX=event.clientX;lastY=event.clientY});
   const release=()=>{pointer=null};preview.addEventListener('pointerup',release);preview.addEventListener('pointercancel',release);preview.addEventListener('lostpointercapture',release);
   preview.addEventListener('keydown',event=>{const keys={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(keys[event.key]){event.preventDefault();const step=state.size*(event.shiftKey ? .1 : .025);move(keys[event.key][0]*step,keys[event.key][1]*step)}});
   draw();
  }
  const actions=doc.createElement('div');actions.className='profile-crop-actions';const cancel=doc.createElement('button'),apply=doc.createElement('button');cancel.type=apply.type='button';cancel.textContent='İptal';apply.textContent=gif?'Bu GIF’i kullan':'Kırpmayı uygula';apply.className='profile-crop-apply';actions.append(cancel,apply);dialog.append(status,actions);doc.body.append(dialog);
  return new Promise(resolve=>{
   let done=false,busy=false;
   const finish=value=>{if(done)return;done=true;if(current===abort)current=null;dialog.close();dialog.remove();image?.close?.();if(gifUrl)URL.revokeObjectURL(gifUrl);resolve(value)};
   const abort=()=>finish(null);current=abort;
   cancel.addEventListener('click',abort);dialog.addEventListener('cancel',event=>{event.preventDefault();abort()});dialog.addEventListener('close',()=>finish(null));dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)abort()}});
   apply.addEventListener('click',async()=>{if(busy||done)return;busy=true;apply.disabled=true;status.textContent='Fotoğraf hazırlanıyor…';try{let output;if(gif){if(!root.FocusGifMedia?.load)throw Error('GIF yükleme şu anda kullanılamıyor.');output=await root.FocusGifMedia.load(file,'avatar')}else{const canvas=doc.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#111c35';ctx.fillRect(0,0,128,128);ctx.drawImage(image,state.x,state.y,state.size,state.size,0,0,128,128);output=encode(canvas)}if(!done)finish(output)}catch(error){if(!done)status.textContent=gif&&root.FocusGifMedia?.message?root.FocusGifMedia.message(error):error.message||'Fotoğraf hazırlanamadı.'}finally{busy=false;if(!done)apply.disabled=false}});
   dialog.showModal();cancel.focus();
  });
 };
 root.FocusAvatarCrop=api;
})(typeof window!=='undefined'?window:null);

