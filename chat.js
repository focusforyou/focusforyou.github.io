'use strict';
const RoomChat=(()=>{
const by=id=>document.getElementById(id);
let transport=null,onReaction=null,photo='',processing=false,joined=false,persistent=false;
let activeReply=null,openPicker=null;
const seen=new Set(),pending=new Map(),rows=[];
const EMOJIS=['👍','❤️','🔥','👏','🎯','💡','🎉'];

function state(value){
  joined=value;
  by('sendChat').disabled=!joined||processing;
  by('chatPhoto').disabled=!joined;
  by('chatCamera').disabled=!joined;
}

function remove(){
  photo='';
  by('photoDraft').hidden=true;
  by('chatPreview').removeAttribute('src');
  by('chatPhoto').value='';
  by('chatCamera').value='';
}

function clearReply(){
  activeReply=null;
  if(by('replyDraft'))by('replyDraft').hidden=true;
}

function setReply(msg){
  activeReply={id:msg.id,sender:msg.sender||'',text:(msg.text||(msg.image?'Fotoğraf':'')).slice(0,140)};
  if(by('replyDraft')){
    by('replyDraftSender').textContent=activeReply.sender;
    by('replyDraftSnippet').textContent=activeReply.text;
    by('replyDraft').hidden=false;
  }
  const input=by('chatText');
  if(input)input.focus();
}

function scrollToBottom(smooth=false){
  const list=by('chatMessages');
  if(!list)return;
  if(smooth&&typeof list.scrollTo==='function'){
    list.scrollTo({top:list.scrollHeight,behavior:'smooth'});
  }else{
    list.scrollTop=list.scrollHeight;
  }
}

function closePicker(){
  if(openPicker){
    openPicker.remove();
    openPicker=null;
  }
}

function showPicker(parent,message){
  closePicker();
  const picker=document.createElement('div');
  picker.className='reaction-picker';
  for(const emoji of EMOJIS){
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='reaction-emoji';
    btn.textContent=emoji;
    btn.onclick=e=>{
      e.stopPropagation();
      closePicker();
      if(onReaction)onReaction(message.id,emoji);
    };
    picker.append(btn);
  }
  parent.append(picker);
  openPicker=picker;
  setTimeout(()=>{
    if(typeof document.addEventListener==='function'){
      document.addEventListener('click',closePicker,{once:true});
    }
  },50);
}

function renderReactions(row,reactions){
  let box=row.reactionsBox;
  if(!reactions||!Object.keys(reactions).length){
    if(box){box.remove();row.reactionsBox=null}
    return;
  }
  if(!box){
    box=document.createElement('div');
    box.className='chat-reactions';
    row.item.append(box);
    row.reactionsBox=box;
  }
  box.replaceChildren();
  const myUid=window.FocusSocial?.uid?.()||'';
  for(const [emoji,users] of Object.entries(reactions)){
    if(!Array.isArray(users)||!users.length)continue;
    const pill=document.createElement('button');
    pill.type='button';
    pill.className='reaction-pill'+(users.includes(myUid)?' has-me':'');
    pill.textContent=emoji+' '+users.length;
    pill.onclick=e=>{
      e.stopPropagation();
      if(onReaction)onReaction(row.id,emoji);
    };
    box.append(pill);
  }
}

function reset(){
  closePicker();
  clearReply();
  seen.clear();
  rows.length=0;
  for(const task of pending.values())clearTimeout(task.task);
  pending.clear();
  by('chatMessages').replaceChildren();
  by('chatStatus').textContent='';
  remove();
  state(false);
  if(by('imageViewer').open)by('imageViewer').close();
  by('fullPhoto').removeAttribute('src');
}

function header(row,message,identity){
  row.label.textContent=message.sender;
  row.label.className='';
  if(identity)SocialModel.decorate(row.label,identity);
  if(message.avatar){
    if(!row.avatar){
      row.avatar=document.createElement('img');
      row.avatar.width=row.avatar.height=28;
      row.avatar.alt='';
      row.avatar.referrerPolicy='no-referrer';
      row.item.prepend(row.avatar);
    }
    row.avatar.className='chat-avatar'+(identity?.cosmetics?.frame==='gold'?' frame-gold':'');
    row.avatar.src=message.avatar;
    if(row.avatar.style)row.avatar.style.cursor='pointer';
    row.avatar.onclick=e=>{
      e.stopPropagation();
      (window.openMemberProfile||window.FocusSocial?.openMemberProfile)?.(message.uid||'',message.sender);
    };
  }else if(row.avatar){
    row.avatar.remove();
    row.avatar=null;
  }
}

function receive(input,identity,onDelete){
  const message=LobbyModel.chat(input);
  if(!message)return;
  if(seen.has(message.id)){
    const row=rows.find(r=>r.id===message.id);
    if(row){
      if(identity)header(row,message,identity);
      if(message.reactions)renderReactions(row,message.reactions);
    }
    return;
  }
  seen.add(message.id);
  if(pending.has(message.id)){
    clearTimeout(pending.get(message.id).task);
    pending.delete(message.id);
    by('chatStatus').textContent='Mesaj gönderildi.';
  }
  const list=by('chatMessages');
  const bottom=list.scrollHeight-list.scrollTop-list.clientHeight<100;
  const item=document.createElement('article');
  item.className='chat-message';
  item.setAttribute('data-id',message.id);

  if(message.replyTo){
    const quote=document.createElement('div');
    quote.className='chat-reply-quote';
    const qSender=document.createElement('strong');
    qSender.textContent=message.replyTo.sender;
    const qText=document.createElement('p');
    qText.textContent=message.replyTo.text;
    quote.append(qSender,qText);
    quote.onclick=()=>{
      const target=rows.find(r=>r.id===message.replyTo.id);
      if(target?.item&&typeof target.item.scrollIntoView==='function'){
        target.item.scrollIntoView({behavior:'smooth',block:'center'});
        target.item.classList.add('reply-triggered');
        setTimeout(()=>target.item.classList.remove('reply-triggered'),1000);
      }
    };
    item.append(quote);
  }

  const label=document.createElement('strong');
  label.textContent=message.sender;
  if(label.style)label.style.cursor='pointer';
  label.onclick=e=>{
    e.stopPropagation();
    (window.openMemberProfile||window.FocusSocial?.openMemberProfile)?.(message.uid||'',message.sender);
  };

  const date=document.createElement('small');
  date.textContent=' · '+new Date(message.time).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});
  item.append(label,date);

  const row={id:message.id,item,label,avatar:null,reactionsBox:null,size:message.image.length};
  header(row,message,identity);

  if(onDelete){
    const remove=document.createElement('button');
    remove.className='chat-delete';
    remove.type='button';
    remove.textContent='Sil';
    remove.setAttribute('aria-label','Kendi mesajını sil');
    remove.onclick=onDelete;
    item.append(remove);
  }

  const actions=document.createElement('div');
  actions.className='chat-actions';
  const replyBtn=document.createElement('button');
  replyBtn.className='chat-action-btn';
  replyBtn.type='button';
  replyBtn.textContent='↩';
  replyBtn.title='Yanıtla';
  replyBtn.onclick=e=>{e.stopPropagation();setReply(message)};
  const reactBtn=document.createElement('button');
  reactBtn.className='chat-action-btn';
  reactBtn.type='button';
  reactBtn.textContent='😊';
  reactBtn.title='Tepki ver';
  reactBtn.onclick=e=>{e.stopPropagation();showPicker(item,message)};
  actions.append(replyBtn,reactBtn);
  item.append(actions);

  if(typeof item.addEventListener==='function'){
    let startX=0,startY=0,swiping=false,pressTimer=null;
    item.addEventListener('touchstart',e=>{
      if(!e.touches?.[0])return;
      startX=e.touches[0].clientX;
      startY=e.touches[0].clientY;
      swiping=true;
      pressTimer=setTimeout(()=>{
        showPicker(item,message);
        if(typeof navigator!=='undefined'&&navigator.vibrate)navigator.vibrate(25);
      },450);
    },{passive:true});

    item.addEventListener('touchmove',e=>{
      if(!e.touches?.[0])return;
      const dx=e.touches[0].clientX-startX;
      const dy=e.touches[0].clientY-startY;
      if(Math.abs(dx)>10||Math.abs(dy)>10)clearTimeout(pressTimer);
      if(swiping&&dx>15&&Math.abs(dx)>Math.abs(dy)){
        if(item.style)item.style.transform='translateX('+Math.min(60,dx*0.35)+'px)';
      }
    },{passive:true});

    const endTouch=e=>{
      clearTimeout(pressTimer);
      if(!swiping)return;
      swiping=false;
      const touch=e.changedTouches?.[0];
      const dx=touch?touch.clientX-startX:0;
      const dy=touch?touch.clientY-startY:0;
      if(item.style)item.style.transform='';
      if(dx>50&&Math.abs(dx)>Math.abs(dy)){
        setReply(message);
        item.classList.add('reply-triggered');
        setTimeout(()=>item.classList.remove('reply-triggered'),600);
      }
    };
    item.addEventListener('touchend',endTouch,{passive:true});
    item.addEventListener('touchcancel',()=>{clearTimeout(pressTimer);swiping=false;if(item.style)item.style.transform=''},{passive:true});
  }

  if(message.text){
    const text=document.createElement('p');
    text.textContent=message.text;
    item.append(text);
  }

  if(message.image){
    const button=document.createElement('button');
    button.type='button';
    button.className='chat-image-button';
    button.setAttribute('aria-label','Fotoğrafı büyüt');
    const image=document.createElement('img');
    image.className='chat-image';
    image.loading='lazy';
    image.decoding='async';
    image.src=message.image;
    image.alt=message.text||message.sender+' tarafından paylaşılan fotoğraf';
    button.append(image);
    button.onclick=()=>{by('fullPhoto').src=message.image;by('imageViewer').showModal()};
    item.append(button);
  }

  if(message.reactions)renderReactions(row,message.reactions);

  list.append(item);
  rows.push(row);
  while(rows.length>60||rows.filter(r=>r.size>0).length>(persistent?20:8)||rows.reduce((n,r)=>n+r.size,0)>(persistent?9000000:4500000)){
    const old=rows.shift();
    old.item.remove();
    seen.delete(old.id);
  }
  if(bottom||onDelete)scrollToBottom(true);
}

function updateReactions(messageId,reactions){
  const row=rows.find(r=>r.id===messageId);
  if(row)renderReactions(row,reactions);
}

function retain(ids){
  const keep=new Set(ids);
  for(let i=rows.length-1;i>=0;i--)if(!keep.has(rows[i].id)){
    rows[i].item.remove();
    seen.delete(rows[i].id);
    rows.splice(i,1);
  }
}

function rejected(id,message){
  const p=pending.get(id);
  if(!p)return;
  clearTimeout(p.task);
  pending.delete(id);
  if(!by('chatText').value)by('chatText').value=p.message.text;
  if(!photo&&p.message.image){
    photo=p.message.image;
    by('chatPreview').src=photo;
    by('photoDraft').hidden=false;
  }
  by('chatStatus').textContent=message;
}

async function prepare(file){
  if(!file)return;
  if(!file.type.startsWith('image/')||file.size>20*1024*1024){
    by('chatStatus').textContent='En fazla 20 MB boyutunda bir fotoğraf seç.';
    return;
  }
  processing=true;
  state(joined);
  by('chatStatus').textContent='Fotoğraf hazırlanıyor…';
  let bitmap;
  try{
    bitmap=await createImageBitmap(file);
    const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*ratio));
    canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
    const context=canvas.getContext('2d');
    context.fillStyle='#fff';
    context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    let image=canvas.toDataURL('image/jpeg',.82);
    if(image.length>1500000)image=canvas.toDataURL('image/jpeg',.6);
    if(image.length>1500000)throw Error('Fotoğraf çok büyük. Daha küçük bir görüntü seç.');
    if(!joined)return;
    photo=image;
    by('chatPreview').src=photo;
    by('photoDraft').hidden=false;
    by('chatStatus').textContent='Fotoğraf hazır. İstersen mesaj ekle, sonra Gönder’e bas.';
  }catch(error){
    by('chatStatus').textContent=error.message||'Fotoğraf açılamadı. JPEG veya PNG ile tekrar dene.';
  }finally{
    bitmap?.close();
    processing=false;
    state(joined);
  }
}

by('chatPhoto').onchange=e=>prepare(e.target.files[0]);
by('chatCamera').onchange=e=>prepare(e.target.files[0]);
by('removePhoto').onclick=remove;
const cancelReplyBtn=by('cancelReply');
if(cancelReplyBtn)cancelReplyBtn.onclick=clearReply;

by('chatForm').onsubmit=e=>{
  e.preventDefault();
  if(!joined||processing)return;
  const bytes=crypto.getRandomValues(new Uint8Array(20)),letters='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const message={
    id:[...bytes].map(n=>letters[n%32]).join(''),
    text:by('chatText').value.trim(),
    image:photo,
    replyTo:activeReply||undefined
  };
  if(!LobbyModel.content(message)){
    by('chatStatus').textContent='Bir mesaj yaz veya fotoğraf ekle.';
    return;
  }
  const task=setTimeout(()=>rejected(message.id,'Gönderim onayı gelmedi. Taslağın geri getirildi; bağlantıyı kontrol edip tekrar dene.'),20000);
  pending.set(message.id,{task,message});
  by('chatStatus').textContent='Gönderiliyor…';
  if(!transport?.(message)){
    clearTimeout(task);
    pending.delete(message.id);
    by('chatStatus').textContent='Oda bağlantısı hazır değil. Tekrar bağlanmayı bekle.';
    return;
  }
  by('chatText').value='';
  remove();
  clearReply();
  scrollToBottom(true);
};

by('chatText').onkeydown=e=>{
  if(e.key==='Enter'&&!e.shiftKey){
    e.preventDefault();
    by('chatForm').requestSubmit();
  }
};
by('chatText').onfocus=()=>{
  setTimeout(()=>scrollToBottom(true),250);
};

by('imageViewer').onclose=()=>by('fullPhoto').removeAttribute('src');
state(false);

return {
  state,
  reset,
  receive,
  updateReactions,
  retain,
  rejected,
  scrollToBottom,
  configure:(fn,options={})=>{
    transport=fn;
    persistent=options.persistent===true;
    onReaction=options.onReaction||null;
  }
};
})();
