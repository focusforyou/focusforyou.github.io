const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
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
 }
 const elements=new Map(),document={getElementById(id){if(!elements.has(id))elements.set(id,new Element('div'));return elements.get(id)},createElement:tag=>new Element(tag)};
 const context=vm.createContext({document,window:{},URL,Date,clearTimeout,setTimeout});
 for(const file of ['lobby-model.js','social-model.js','chat.js'])vm.runInContext(fs.readFileSync(''+file,'utf8'),context);
 return {chat:vm.runInContext('RoomChat',context),list:document.getElementById('chatMessages')};
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
 assert.equal(list.children.length,1);assert.equal(label.textContent,'Plain @unique_name');assert.equal(label.className,'identity');assert.equal(item.children.filter(c=>c.className.includes('chat-avatar')).length,0);
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
