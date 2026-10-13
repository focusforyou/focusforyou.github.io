const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const message=()=>({id:'Z'.repeat(20),text:'A message',image:'',sender:'Alice',avatar:'',time:10000});
const touch=(x=0,y=0)=>({touches:[{clientX:x,clientY:y}],changedTouches:[{clientX:x,clientY:y}]});
test('a selected quote alone cannot send an empty message rejected by the database',()=>{
 const f=setup();f.chat.state(true);f.chat.receive(message());let sends=0;f.chat.configure(()=>{sends++;return true});
 f.list.children[0].children.find(c=>c.className==='chat-actions').children[0].onclick({stopPropagation(){}});
 f.node('chatForm').onsubmit({preventDefault(){}});assert.equal(sends,0);assert.equal(f.node('replyDraft').hidden,false);
});
test('long press offers reply, suppresses release click and still allows choosing an action',()=>{
 const f=setup();f.chat.receive(message());const item=f.list.children[0];
 item.dispatch('touchstart',touch());f.runTimers(450);
 const picker=item.children.find(c=>c.className==='reaction-picker');assert.ok(picker);
 assert.equal(picker.children[0].textContent,'↩ Yanıtla');
 item.dispatch('touchend',touch());let prevented=0;
 item.dispatch('click',{preventDefault(){prevented++},stopPropagation(){}});assert.equal(prevented,1);
 picker.children[0].onclick({stopPropagation(){}});
 assert.equal(f.node('replyDraft').hidden,false);assert.equal(f.node('replyDraftSender').textContent,'Alice');
});
test('scrolling, cancelled touches and removed rows cannot open a delayed menu',()=>{
 for(const action of ['move','cancel','retain','reset']){
  const f=setup();f.chat.receive(message());const item=f.list.children[0];item.dispatch('touchstart',touch());
  if(action==='move')item.dispatch('touchmove',touch(0,30));
  if(action==='cancel')item.dispatch('touchcancel',touch());
  if(action==='retain')f.chat.retain([]);
  if(action==='reset')f.chat.reset();
  f.runTimers(450);assert.equal(item.children.some(c=>c.className==='reaction-picker'),false,action);
 }
});
test('failed sends restore the quoted message and IME confirmation never submits',()=>{
 const f=setup();f.chat.state(true);f.chat.receive(message());
 f.list.children[0].children.find(c=>c.className==='chat-actions').children[0].onclick({stopPropagation(){}});
 f.node('chatText').value='My reply';let sent;f.chat.configure(m=>{sent=m;return true});
 f.node('chatForm').onsubmit({preventDefault(){}});assert.equal(f.node('replyDraft').hidden,true);
 f.chat.rejected(sent.id,'Failed');assert.equal(f.node('chatText').value,'My reply');assert.equal(f.node('replyDraftSender').textContent,'Alice');assert.equal(f.node('replyDraft').hidden,false);
 let submits=0;f.node('chatForm').requestSubmit=()=>submits++;
 f.node('chatText').onkeydown({key:'Enter',isComposing:true,preventDefault(){}});assert.equal(submits,0);
 f.node('chatText').onkeydown({key:'Enter',preventDefault(){}});assert.equal(submits,1);
});
test('late photo processing cannot restore a removed photo or cross room boundaries',async()=>{
 for(const reset of [false,true]){
  let finish,closed=false;const f=setup({createImageBitmap:()=>new Promise(resolve=>finish=resolve)});f.chat.state(true);
  const preparing=f.node('chatPhoto').onchange({target:{files:[{type:'image/jpeg',size:100}]}});
  if(reset){f.chat.reset();f.chat.state(true)}else f.node('removePhoto').onclick();
  finish({width:100,height:100,close(){closed=true}});await preparing;
  assert.equal(f.node('photoDraft').hidden,true);assert.equal(f.node('chatPreview').src,undefined);assert.equal(f.node('sendChat').disabled,false);assert.equal(closed,true);
 }
});
function setup(options={}){
 const timers=new Map();let timerId=0;
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.parentNode=null;this.className='';this._text='';this.scrollHeight=100;this.scrollTop=100;this.clientHeight=100;this.open=false;this.value='';this.classList={add:n=>this.toggleClass(n,true),toggle:(n,on)=>this.toggleClass(n,on)}}
  toggleClass(name,on){const classes=new Set(this.className.split(/\s+/).filter(Boolean));if(on)classes.add(name);else classes.delete(name);this.className=[...classes].join(' ')}
  set textContent(value){this._text=value;this.replaceChildren()}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('')}
  append(...items){for(const item of items){item.parentNode=this;this.children.push(item)}}
  prepend(item){item.parentNode=this;this.children.unshift(item)}
  replaceChildren(){for(const c of this.children)c.parentNode=null;this.children=[]}
  remove(){if(this.parentNode){const p=this.parentNode;p.children=p.children.filter(c=>c!==this);this.parentNode=null}}
  setAttribute(key,value){this[key]=value}
  removeAttribute(key){delete this[key]}
  close(){this.open=false}
  focus(){this.focused=true}
  getContext(){return {fillRect(){},drawImage(){}}}
  toDataURL(){return 'data:image/jpeg;base64,YQ=='}
  addEventListener(type,fn){(this.listeners??={})[type]??=[];this.listeners[type].push(fn)}
  removeEventListener(type,fn){if(this.listeners?.[type])this.listeners[type]=this.listeners[type].filter(f=>f!==fn)}
  dispatch(type,event={}){for(const fn of this.listeners?.[type]||[])fn(event)}
 }
 const elements=new Map(),document={getElementById(id){if(!elements.has(id))elements.set(id,new Element('div'));return elements.get(id)},createElement:tag=>new Element(tag)};
 document.addEventListener=()=>{};document.removeEventListener=()=>{};
 const context=vm.createContext({document,window:{},URL,Date,crypto:require('node:crypto').webcrypto,Uint8Array,clearTimeout:id=>timers.delete(id),setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId},...options});
 for(const file of ['lobby-model.js','social-model.js','chat.js'])vm.runInContext(fs.readFileSync(''+file,'utf8'),context);
 return {chat:vm.runInContext('RoomChat',context),list:document.getElementById('chatMessages'),node:id=>document.getElementById(id),runTimers(ms){for(const [id,t] of [...timers])if(t.ms===ms){timers.delete(id);t.fn()}}};
}
test('existing messages update cloud identity and cosmetics in place without duplicating body or losing delete actions',()=>{
 const {chat,list}=setup();let deleted=0;
 const message={id:'A'.repeat(20),text:'Original body',image:'data:image/jpeg;base64,YQ==',sender:'First',avatar:'https://lh3.googleusercontent.com/first',time:10000};
 const identity=(name,cosmetics)=>({name,username:'unique_name',cosmetics});
 const plain={tag:'none',nameStyle:'plain',frame:'none',plate:'none'},gold={tag:'doctor',nameStyle:'gold',frame:'gold',plate:'gold'};
 chat.receive(message,identity('First',plain),()=>deleted++);
 const item=list.children[0],label=item.children.find(c=>c.tagName==='strong'),body=item.children.find(c=>c.tagName==='p'),imageButton=item.children.find(c=>c.className==='chat-image-button'),deleteButton=item.children.find(c=>c.className==='chat-delete'),date=item.children.find(c=>c.tagName==='small');
 chat.receive({...message,sender:'Renamed',avatar:'https://lh4.googleusercontent.com/new',text:'Must not replace body'},identity('Renamed',gold));
 assert.equal(list.children.length,1);assert.equal(list.children[0],item);assert.equal(body.textContent,'Original body');assert(item.children.includes(imageButton));assert(item.children.includes(date));
 assert.match(label.textContent,/Renamed/);assert.match(label.textContent,/\[DOKTOR\]/);assert.match(label.textContent,/@unique_name/);assert.match(label.className,/name-gold/);assert.match(label.className,/plate-gold/);
 assert.equal(item.children.filter(c=>c.className.includes('chat-avatar')).length,1);assert.equal(item.children[0].src,'https://lh4.googleusercontent.com/new');assert.match(item.children[0].className,/frame-gold/);
 chat.receive({...message,sender:'Plain',avatar:''},identity('Plain',plain));
 assert.equal(list.children.length,1);assert.equal(label.textContent,'Plain @unique_name');assert.equal(label.className,'identity');assert.equal(item.children.filter(c=>c.className.includes('chat-avatar')).length,1);assert.match(item.children[0].className,/chat-avatar-fallback/);assert.equal(item.children[0].textContent,'P');
 assert(item.children.includes(deleteButton));deleteButton.onclick();assert.equal(deleted,1);
 // A late transport duplicate without a cloud identity must not strip it.
 chat.receive(message);assert.equal(label.textContent,'Plain @unique_name');
 chat.receive({...message,sender:'Gold again'},identity('Gold again',gold));chat.receive({...message,sender:'Gold again'},identity('Gold again',gold));
 assert.equal(label.children.filter(c=>c.className==='doctor-tag').length,1);assert.equal(label.children.filter(c=>c.className==='username').length,1);
});
test('retain and reset clear identity rows so a later same-ID message is created cleanly',()=>{
 const {chat,list}=setup(),message={id:'B'.repeat(20),text:'Body',image:'',sender:'First',avatar:'',time:10000};
 const identity={username:'first',cosmetics:{tag:'none',nameStyle:'plain',frame:'none',plate:'none'}};
 chat.receive(message,identity);const original=list.children[0];chat.retain([]);assert.equal(list.children.length,0);
 chat.receive({...message,sender:'Second'},identity);assert.equal(list.children.length,1);assert.notEqual(list.children[0],original);
 chat.reset();assert.equal(list.children.length,0);chat.receive({...message,sender:'Third'},identity);assert.equal(list.children.length,1);assert.match(list.children[0].textContent,/Third/);
});
test('zero-width encoded reply metadata extracts cleanly and renders reply quote with action buttons',()=>{
 const {chat,list}=setup();
 const meta=JSON.stringify({id:'A'.repeat(20),sender:'Original Author',text:'Original message snippet'});
 const rawText='\u200B\u200C'+meta+'\u200C\u200BReply message content';
 const message={id:'C'.repeat(20),text:rawText,image:'',sender:'Replier',avatar:'',time:20000};
 chat.receive(message);
 assert.equal(list.children.length,1);
 const item=list.children[0];
 const quote=item.children.find(c=>c.className==='chat-reply-quote');
 assert.ok(quote);
 assert.equal(quote.children[0].textContent,'Original Author');
 assert.equal(quote.children[1].textContent,'Original message snippet');
 const body=item.children.find(c=>c.tagName==='p');
 assert.equal(body.textContent,'Reply message content');
 const actions=item.children.find(c=>c.className==='chat-actions');
 assert.ok(actions);
 assert.equal(actions.children.length,2);
});
test('empty-text reply or structured replyTo is not dropped and reactions render properly',()=>{
 const {chat,list}=setup();
 const msg1={id:'D'.repeat(20),text:'',image:'',replyTo:{id:'A'.repeat(20),sender:'Alice',text:'Previous comment'},sender:'Bob',avatar:'',time:30000};
 chat.receive(msg1);
 assert.equal(list.children.length,1);
 const item1=list.children[0];
 const quote1=item1.children.find(c=>c.className==='chat-reply-quote');
 assert.ok(quote1);
 assert.equal(quote1.children[0].textContent,'Alice');
 assert.equal(quote1.children[1].textContent,'Previous comment');

 chat.updateReactions(msg1.id,{'👍':['uid1','uid2'],'🔥':['uid1']});
 const reactionsBox=item1.children.find(c=>c.className==='chat-reactions');
 assert.ok(reactionsBox);
 assert.equal(reactionsBox.children.length,2);
 assert.match(reactionsBox.children[0].textContent,/👍 2/);
 assert.match(reactionsBox.children[1].textContent,/🔥 1/);
});


test('touch message menu exposes the room moderation hook and its close action',()=>{
 let called,close;const f=setup({window:{FocusRoomTools:{menu:(picker,m,done)=>{called={picker,m};close=done}}}});f.chat.receive(message());const item=f.list.children[0];item.dispatch('touchstart',touch());f.runTimers(450);assert.equal(called.m.id,message().id);assert.equal(called.picker.className,'reaction-picker');close();assert.equal(item.children.some(c=>c.className==='reaction-picker'),false);
});
