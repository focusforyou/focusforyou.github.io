'use strict';
const RoomChat=(()=>{
const by=id=>document.getElementById(id);let transport=null,photo='',processing=false,joined=false,persistent=false;const seen=new Set(),pending=new Map(),rows=[];
function state(value){joined=value;by('sendChat').disabled=!joined||processing;by('chatPhoto').disabled=!joined;by('chatCamera').disabled=!joined}
function remove(){photo='';by('photoDraft').hidden=true;by('chatPreview').removeAttribute('src');by('chatPhoto').value='';by('chatCamera').value=''}
function reset(){seen.clear();rows.length=0;for(const task of pending.values())clearTimeout(task.task);pending.clear();by('chatMessages').replaceChildren();by('chatStatus').textContent='';remove();state(false);if(by('imageViewer').open)by('imageViewer').close();by('fullPhoto').removeAttribute('src')}
function receive(input,identity,onDelete){
const message=LobbyModel.chat(input);if(!message||seen.has(message.id))return;seen.add(message.id);
if(pending.has(message.id)){clearTimeout(pending.get(message.id).task);pending.delete(message.id);by('chatStatus').textContent='Mesaj gönderildi.'}
const list=by('chatMessages'),bottom=list.scrollHeight-list.scrollTop-list.clientHeight<60;
const item=document.createElement('article');item.className='chat-message';const label=document.createElement('strong');label.textContent=message.sender;const date=document.createElement('small');date.textContent=' · '+new Date(message.time).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});item.append(label,date);
if(identity)SocialModel.decorate(label,identity);
if(onDelete){const remove=document.createElement('button');remove.className='chat-delete';remove.type='button';remove.textContent='Sil';remove.setAttribute('aria-label','Kendi mesajını sil');remove.onclick=onDelete;item.append(remove)}
if(message.avatar){const avatar=document.createElement('img');avatar.className='chat-avatar'+(identity?.cosmetics?.frame==='gold'?' frame-gold':'');avatar.width=avatar.height=28;avatar.src=message.avatar;avatar.alt='';avatar.referrerPolicy='no-referrer';item.prepend(avatar)}
if(message.text){const text=document.createElement('p');text.textContent=message.text;item.append(text)}
if(message.image){const button=document.createElement('button');button.type='button';button.className='chat-image-button';button.setAttribute('aria-label','Fotoğrafı büyüt');const image=document.createElement('img');image.className='chat-image';image.loading='lazy';image.decoding='async';image.src=message.image;image.alt=message.text||message.sender+' tarafından paylaşılan fotoğraf';button.append(image);button.onclick=()=>{by('fullPhoto').src=message.image;by('imageViewer').showModal()};item.append(button)}
list.append(item);rows.push({id:message.id,item,size:message.image.length});while(rows.length>60||rows.filter(r=>r.size>0).length>(persistent?20:8)||rows.reduce((n,r)=>n+r.size,0)>(persistent?9000000:4500000)){const old=rows.shift();old.item.remove();seen.delete(old.id)}if(bottom)list.scrollTop=list.scrollHeight;
}
function retain(ids){const keep=new Set(ids);for(let i=rows.length-1;i>=0;i--)if(!keep.has(rows[i].id)){rows[i].item.remove();seen.delete(rows[i].id);rows.splice(i,1)}}
function rejected(id,message){const p=pending.get(id);if(!p)return;clearTimeout(p.task);pending.delete(id);if(!by('chatText').value)by('chatText').value=p.message.text;if(!photo&&p.message.image){photo=p.message.image;by('chatPreview').src=photo;by('photoDraft').hidden=false}by('chatStatus').textContent=message}
async function prepare(file){
if(!file)return;if(!file.type.startsWith('image/')||file.size>20*1024*1024){by('chatStatus').textContent='En fazla 20 MB boyutunda bir fotoğraf seç.';return}
processing=true;state(joined);by('chatStatus').textContent='Fotoğraf hazırlanıyor…';let bitmap;
try{
bitmap=await createImageBitmap(file);const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
let image=canvas.toDataURL('image/jpeg',.82);if(image.length>1500000)image=canvas.toDataURL('image/jpeg',.6);if(image.length>1500000)throw Error('Fotoğraf çok büyük. Daha küçük bir görüntü seç.');
if(!joined)return;photo=image;by('chatPreview').src=photo;by('photoDraft').hidden=false;by('chatStatus').textContent='Fotoğraf hazır. İstersen mesaj ekle, sonra Gönder’e bas.';
}catch(error){by('chatStatus').textContent=error.message||'Fotoğraf açılamadı. JPEG veya PNG ile tekrar dene.'}finally{bitmap?.close();processing=false;state(joined)}
}
by('chatPhoto').onchange=e=>prepare(e.target.files[0]);by('chatCamera').onchange=e=>prepare(e.target.files[0]);by('removePhoto').onclick=remove;
by('chatForm').onsubmit=e=>{
e.preventDefault();if(!joined||processing)return;const bytes=crypto.getRandomValues(new Uint8Array(20)),letters='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const message={id:[...bytes].map(n=>letters[n%32]).join(''),text:by('chatText').value.trim(),image:photo};
if(!LobbyModel.content(message)){by('chatStatus').textContent='Bir mesaj yaz veya fotoğraf ekle.';return}
const task=setTimeout(()=>rejected(message.id,'Gönderim onayı gelmedi. Taslağın geri getirildi; bağlantıyı kontrol edip tekrar dene.'),20000);pending.set(message.id,{task,message});by('chatStatus').textContent='Gönderiliyor…';
if(!transport?.(message)){clearTimeout(task);pending.delete(message.id);by('chatStatus').textContent='Oda bağlantısı hazır değil. Tekrar bağlanmayı bekle.';return}
by('chatText').value='';remove();
};
by('chatText').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();by('chatForm').requestSubmit()}};
by('imageViewer').onclose=()=>by('fullPhoto').removeAttribute('src');state(false);return {state,reset,receive,retain,rejected,configure:(fn,options={})=>{transport=fn;persistent=options.persistent===true}};
})();

