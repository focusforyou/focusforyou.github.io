'use strict';
const RoomChat=(()=>{
const by=id=>document.getElementById(id);let transport=null,photo='',processing=false,joined=false;const seen=new Set(),pending=new Map();
function state(value){joined=value;by('sendChat').disabled=!joined||processing;by('chatPhoto').disabled=!joined;by('chatCamera').disabled=!joined}
function remove(){photo='';by('photoDraft').hidden=true;by('chatPreview').removeAttribute('src');by('chatPhoto').value='';by('chatCamera').value=''}
function reset(){seen.clear();for(const task of pending.values())clearTimeout(task);pending.clear();by('chatMessages').replaceChildren();by('chatStatus').textContent='';remove();state(false);if(by('imageViewer').open)by('imageViewer').close();by('fullPhoto').removeAttribute('src')}
function receive(input){
const message=LobbyModel.chat(input);if(!message||seen.has(message.id))return;seen.add(message.id);
if(pending.has(message.id)){clearTimeout(pending.get(message.id));pending.delete(message.id);by('chatStatus').textContent='Mesaj gönderildi.'}
const list=by('chatMessages'),bottom=list.scrollHeight-list.scrollTop-list.clientHeight<60;
const item=document.createElement('article');item.className='chat-message';const label=document.createElement('strong');label.textContent=message.sender;const date=document.createElement('small');date.textContent=' · '+new Date(message.time).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});item.append(label,date);
if(message.text){const text=document.createElement('p');text.textContent=message.text;item.append(text)}
if(message.image){const button=document.createElement('button');button.type='button';button.className='chat-image-button';button.setAttribute('aria-label','Fotoğrafı büyüt');const image=document.createElement('img');image.className='chat-image';image.src=message.image;image.alt=message.text||message.sender+' tarafından paylaşılan fotoğraf';button.append(image);button.onclick=()=>{by('fullPhoto').src=message.image;by('imageViewer').showModal()};item.append(button)}
list.append(item);while(list.children.length>60){list.firstElementChild.remove();seen.delete(seen.values().next().value)}if(bottom)list.scrollTop=list.scrollHeight;
}
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
const task=setTimeout(()=>{pending.delete(message.id);by('chatStatus').textContent='Gönderim onayı gelmedi. Bağlantıyı kontrol edip tekrar dene.'},20000);pending.set(message.id,task);by('chatStatus').textContent='Gönderiliyor…';
if(!transport?.(message)){clearTimeout(task);pending.delete(message.id);by('chatStatus').textContent='Oda bağlantısı hazır değil. Tekrar bağlanmayı bekle.';return}
by('chatText').value='';remove();
};
by('chatText').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();by('chatForm').requestSubmit()}};
state(false);return {state,reset,receive,configure:fn=>transport=fn};
})();
