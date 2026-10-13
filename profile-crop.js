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
 function rectangle(width,height,ratio=1,zoom=1,x=width/2,y=height/2){
  if(!Number.isFinite(ratio)||ratio<=0)throw Error('invalid-image');
  const square=geometry(width,height,zoom,x,y),w=Math.min(width,height*ratio)/square.zoom,h=w/ratio;
  const cx=Math.max(w/2,Math.min(width-w/2,x)),cy=Math.max(h/2,Math.min(height-h/2,y));
  return {x:cx-w/2,y:cy-h/2,width:w,height:h,cx,cy,zoom:square.zoom};
 }
 const api={geometry,rectangle,validate,isGif,encode};
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(!root?.document)return;
 let current=null,revision=0;
 async function decode(file){
  if(typeof root.createImageBitmap==='function')return root.createImageBitmap(file);
  const url=URL.createObjectURL(file),image=new Image();
  try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url});return image}finally{URL.revokeObjectURL(url)}
 }
 api.cancel=()=>{revision++;current?.()};
 api.open=async function(file,options={}){
  validate(file);const ticket=++revision;current?.();
  const gif=isGif(file),banner=options.kind==='banner',kind=banner?'banner':'avatar',ratio=banner?8/3:1;
  let gifUrl='',image;
  if(gif){const header=new Uint8Array(await file.slice(0,13).arrayBuffer()),w=header[6]|header[7]<<8,h=header[8]|header[9]<<8;if(header.length<13||!['GIF87a','GIF89a'].includes(String.fromCharCode(...header.slice(0,6))))throw Error('gif-invalid');if(!w||!h||w>2048||h>2048||w*h>1500000)throw Error('gif-dimensions');if(ticket!==revision)return null;gifUrl=URL.createObjectURL(file);image=new Image();try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('gif-invalid'));image.src=gifUrl})}catch(error){URL.revokeObjectURL(gifUrl);throw error}}
  else image=await decode(file);
  if(ticket!==revision){image?.close?.();if(gifUrl)URL.revokeObjectURL(gifUrl);return null}
  const doc=root.document,dialog=doc.createElement('dialog');dialog.className='profile-crop-dialog';
  dialog.setAttribute('aria-labelledby','avatarCropTitle');
  const heading=doc.createElement('h2');heading.id='avatarCropTitle';heading.textContent=(banner?'Bannerı':'Profil fotoğrafını')+' kırp';
  const description=doc.createElement('p');description.textContent='Görseli sürükleyerek yerleştir, kaydırıcıyla yakınlaştır.'+(gif?' Animasyon korunur; GIF hızlı yüklenmesi için küçültülür.':'');
  const stage=doc.createElement('div');stage.className='profile-crop-stage'+(banner?' banner-crop':'');stage.style.aspectRatio=String(ratio);
  const preview=doc.createElement(gif?'img':'canvas');preview.className='profile-crop-preview';
  preview.tabIndex=0;preview.style.touchAction='none';preview.setAttribute('aria-label','Kırpılacak görsel. Ok tuşlarıyla konumunu değiştir.');
  if(gif){preview.src=gifUrl;preview.alt='Animasyonlu görsel önizlemesi'}else{preview.width=480;preview.height=Math.round(480/ratio);preview.setAttribute('role','img')}
  stage.append(preview);dialog.append(heading,description,stage);
  const status=doc.createElement('p');status.className='profile-crop-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
  let state=rectangle(width,height,ratio);
  const draw=()=>{if(gif){preview.style.width=(width/state.width*100)+'%';preview.style.height=(height/state.height*100)+'%';preview.style.left=(-state.x/state.width*100)+'%';preview.style.top=(-state.y/state.height*100)+'%';preview.style.position='absolute';preview.style.maxWidth='none'}else{const ctx=preview.getContext('2d');ctx.fillStyle='#111c35';ctx.fillRect(0,0,preview.width,preview.height);ctx.drawImage(image,state.x,state.y,state.width,state.height,0,0,preview.width,preview.height)}};
  const move=(dx,dy)=>{state=rectangle(width,height,ratio,state.zoom,state.cx+dx,state.cy+dy);draw()};
  {
   const controls=doc.createElement('div');controls.className='profile-crop-controls';
   const label=doc.createElement('label');label.textContent='Yakınlaştır';label.htmlFor='avatarCropZoom';
   const slider=doc.createElement('input');slider.type='range';slider.id='avatarCropZoom';slider.min='1';slider.max='4';slider.step='.01';slider.value='1';slider.setAttribute('aria-label','Fotoğraf yakınlaştırma');
   slider.addEventListener('input',()=>{state=rectangle(width,height,ratio,Number(slider.value),state.cx,state.cy);draw()});
   const reset=doc.createElement('button');reset.type='button';reset.textContent='Ortala';reset.addEventListener('click',()=>{state=rectangle(width,height,ratio);slider.value='1';draw()});
   controls.append(label,slider,reset);dialog.append(controls);
   let pointer=null,lastX=0,lastY=0;
   preview.addEventListener('pointerdown',event=>{if(event.button!==0)return;pointer=event.pointerId;lastX=event.clientX;lastY=event.clientY;preview.setPointerCapture(pointer);preview.focus();event.preventDefault()});
   preview.addEventListener('pointermove',event=>{if(pointer!==event.pointerId)return;const scale=state.width/stage.getBoundingClientRect().width;move(-(event.clientX-lastX)*scale,-(event.clientY-lastY)*scale);lastX=event.clientX;lastY=event.clientY});
   const release=()=>{pointer=null};preview.addEventListener('pointerup',release);preview.addEventListener('pointercancel',release);preview.addEventListener('lostpointercapture',release);
   preview.addEventListener('keydown',event=>{const keys={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(keys[event.key]){event.preventDefault();const step=state.width*(event.shiftKey ? .1 : .025);move(keys[event.key][0]*step,keys[event.key][1]*step)}});
   draw();
  }
  const actions=doc.createElement('div');actions.className='profile-crop-actions';const cancel=doc.createElement('button'),apply=doc.createElement('button');cancel.type=apply.type='button';cancel.textContent='İptal';apply.textContent=gif?'Bu GIF’i kullan':'Kırpmayı uygula';apply.className='profile-crop-apply';actions.append(cancel,apply);dialog.append(status,actions);doc.body.append(dialog);
  return new Promise(resolve=>{
   let done=false,busy=false;const controller=new AbortController();
   const finish=value=>{if(done)return;done=true;controller.abort();if(current===abort)current=null;dialog.close();dialog.remove();image?.close?.();if(gifUrl)URL.revokeObjectURL(gifUrl);resolve(value)};
   const abort=()=>finish(null);current=abort;
   cancel.addEventListener('click',abort);dialog.addEventListener('cancel',event=>{event.preventDefault();abort()});dialog.addEventListener('close',()=>finish(null));dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)abort()}});
   apply.addEventListener('click',async()=>{if(busy||done)return;busy=true;apply.disabled=true;status.textContent=gif?'Animasyon hazırlanıyor… İstersen iptal edebilirsin.':'Görsel hazırlanıyor…';try{let output;if(gif){if(!root.FocusGifMedia?.crop)throw Error('gif-worker');output=await root.FocusGifMedia.crop(file,state,kind,controller.signal)}else{const canvas=doc.createElement('canvas');for(const size of (banner?[640,480,320]:[128])){canvas.width=size;canvas.height=Math.round(size/ratio);const ctx=canvas.getContext('2d');ctx.fillStyle='#111c35';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,state.x,state.y,state.width,state.height,0,0,canvas.width,canvas.height);try{output=encode(canvas);break}catch(error){if(size===(banner?320:128))throw error}}}if(!done)finish(output)}catch(error){if(!done)status.textContent=gif&&root.FocusGifMedia?.message?root.FocusGifMedia.message(error):error.message||'Görsel hazırlanamadı.'}finally{busy=false;if(!done)apply.disabled=false}});
   dialog.showModal();cancel.focus();
  });
 };
 root.FocusAvatarCrop=api;
})(typeof window!=='undefined'?window:null);
