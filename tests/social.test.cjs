const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const LobbyModel=require('../lobby-model.js');
const OPEN='open_room_123456789',LOCKED='locked_room_1234567';
const profile=(uid,username=uid)=>({uid,username,name:uid,photo:'',exam:'',cosmetics:{tag:'none',nameStyle:'plain',frame:'none',plate:'none'}});
const timer=(extra={})=>({phase:'focus',running:true,left:1500,total:1500,worked:0,roomWorked:0,focus:1500,rest:300,rounds:0,...extra});

function fixture(){
 const records=new Map(),nodes=new Map(),subscriptions=[],intervals=[],events=[],sessions=new Map(),chat={received:[],retained:[],resets:0};let seconds=0,clock=Date.now(),offline=false,failDelete=false;
 class Element{
  constructor(){this.children=[];this.value='';this.hidden=false;this.checked=false;this.disabled=false;this._text='';this.classList={add(){},toggle(){}}}
  set textContent(v){this._text=String(v);this.children=[]}get textContent(){return this._text+this.children.map(n=>n.textContent).join('')}
  append(...nodes){this.children.push(...nodes)}prepend(...nodes){this.children.unshift(...nodes)}replaceChildren(...nodes){this._text='';this.children=[...nodes]}click(){return this.onclick?.()}
 }
 const node=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)};
 const ref=(path,kind='doc')=>({path,kind,clauses:[],id:path.split('/').at(-1)});
 const snapshot=path=>({id:path.split('/').at(-1),ref:ref(path),exists:()=>records.has(path),data:()=>records.get(path)});
 const select=q=>{
  if(q.kind==='doc')return snapshot(q.path);
  let paths=[...records.keys()].filter(p=>p.startsWith(q.path+'/')&&p.split('/').length===q.path.split('/').length+1);
  for(const c of q.clauses||[]){
   if(c.type==='where')paths=paths.filter(p=>c.op==='array-contains'?records.get(p)[c.field]?.includes(c.value):records.get(p)[c.field]===c.value);
   if(c.type==='order')paths.sort((a,b)=>(records.get(b)[c.field]?.toMillis?.()||0)-(records.get(a)[c.field]?.toMillis?.()||0));
   if(c.type==='after'){const at=paths.indexOf(c.cursor.ref.path);paths=paths.slice(at+1)}
   if(c.type==='limit')paths=paths.slice(0,c.value);
  }
  return {docs:paths.map(snapshot),empty:!paths.length};
 };
 const emit=()=>{for(const s of [...subscriptions])if(s.active)s.fn(select(s.q))};
 const notify=()=>queueMicrotask(emit);
 const apply=(op,r,data)=>{
  if(offline)throw Object.assign(Error('offline'),{code:'unavailable'});
  events.push(`${op}:${r.path}`);
  if(op==='delete'){if(failDelete){failDelete=false;throw Error('interrupted')}records.delete(r.path)}
  else records.set(r.path,op==='update'?{...records.get(r.path),...data}:data);
 };
 const ctx={console,URL,URLSearchParams,TextEncoder,Uint8Array,crypto:crypto.webcrypto,LobbyModel,Date:class extends Date{static now(){return clock}},
  location:{href:'https://focusforyou.github.io/#lobi',origin:'https://focusforyou.github.io',pathname:'/',search:''},history:{state:null,replaceState:(_,__,url)=>{ctx.location.href=url;ctx.location.search=new URL(url).search}},
  navigator:{clipboard:{writeText:async v=>events.push('clipboard:'+v)}},sessionStorage:{getItem:k=>sessions.get(k)||null,setItem:(k,v)=>sessions.set(k,v),removeItem:k=>sessions.delete(k)},
  document:{hidden:false,getElementById:node,createElement:()=>new Element(),createTextNode:text=>{const n=new Element();n.textContent=text;return n},querySelector:()=>node('chat-note'),addEventListener(){}},
  addEventListener(){},setInterval:f=>intervals.push(f),
  doc:(_, ...p)=>ref(p.join('/')),collection:(_, ...p)=>ref(p.join('/'),'collection'),query:(base,...clauses)=>({...base,clauses:[...base.clauses,...clauses]}),
  where:(field,op,value)=>({type:'where',field,op,value}),orderBy:field=>({type:'order',field}),limit:value=>({type:'limit',value}),startAfter:cursor=>({type:'after',cursor}),
  getDoc:async r=>select(r),getDocFromServer:async r=>{if(offline)throw Error('offline');return select(r)},getDocs:async q=>select(q),getDocsFromServer:async q=>{if(offline)throw Error('offline');return select(q)},
  onSnapshot:(q,fn)=>{const s={q,fn,active:true};subscriptions.push(s);queueMicrotask(()=>{if(s.active)fn(select(q))});return ()=>s.active=false},
  serverTimestamp:()=>({toMillis:()=>clock}),
  setDoc:async(r,data)=>{if(r.path.includes('/roomProofs/')){const rid=r.path.split('/').at(-1);if(data.hash!==records.get('rooms/'+rid+'/secrets/password')?.hash)throw Object.assign(Error('wrong-password'),{code:'permission-denied'})}apply('set',r,data);notify()},
  updateDoc:async(r,data)=>{apply('update',r,data);notify()},deleteDoc:async r=>{apply('delete',r);notify()},
  writeBatch:()=>{const writes=[];return {set:(r,data)=>writes.push(['set',r,data]),delete:r=>writes.push(['delete',r]),commit:async()=>{for(const w of writes)apply(...w);notify()}}},
  runTransaction:async(_,fn)=>{const writes=[];const result=await fn({get:async r=>select(r),set:(r,data)=>writes.push(['set',r,data]),update:(r,data)=>writes.push(['update',r,data])});for(const w of writes)apply(...w);notify();return result},
  Study:{localSeconds:()=>seconds,liveSession:()=>timer({worked:seconds})},
  FocusAccount:{profile:()=>({uid:ctx.auth.currentUser?.uid,name:ctx.auth.currentUser?.uid||'Alice',photo:''})},FocusTemporaryRoom:{leaveNow:()=>events.push('temporary-left')},FocusNative:{room:id=>events.push('native:'+id)},
  RoomChat:{receive:(...args)=>chat.received.push(args),retain:ids=>chat.retained.push([...ids]),reset:()=>{chat.resets++},configure:fn=>{chat.transport=fn},state(){},rejected:()=>events.push('chat-rejected')},auth:{currentUser:null},
 };
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('social-model.js','utf8'),ctx);
 vm.runInContext(fs.readFileSync('social.js','utf8').replace(/^\uFEFF/,'').replace(/^import .*;\r?\n/gm,'').replace('export function','function'),ctx);ctx.initSocial({db:{},auth:ctx.auth});
 const settle=async()=>{for(let i=0;i<40;i++)await Promise.resolve()};
 return {ctx,records,node,events,sessions,chat,subscriptions,emit,settle,
  put:(path,data)=>records.set(path,data),
  async login(uid='alice',registered=true){ctx.auth.currentUser={uid,emailVerified:true,email:uid+'@example.com'};if(registered&&!records.has('publicProfiles/'+uid))records.set('publicProfiles/'+uid,profile(uid));await ctx.FocusSocial.bind(ctx.auth.currentUser);await settle()},
  async join(id,password=''){node('roomSearch').value=id;node('joinPassword').value=password;await node('joinPermanent').onclick();await settle()},
  work:n=>{seconds+=n;clock+=n*1000},tick:async()=>{for(const f of intervals)f();await settle()},set offline(value){offline=value},failNextDelete:()=>{failDelete=true},
 };
}

test('open room membership survives switching and accrued seconds flush only into the previous room',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'First',ownerUid:'alice',locked:false});f.put('rooms/'+LOCKED,{name:'Second',ownerUid:'bob',locked:false});await f.login();await f.join(OPEN);
 assert.equal(f.ctx.FocusSocial.active(),OPEN);assert.equal(f.sessions.get('focus_active_room_alice'),OPEN);f.work(47);await f.join(LOCKED);
 assert.equal(f.records.get(`rooms/${OPEN}/members/alice`).timer.roomWorked,47);assert.equal(f.records.get(`rooms/${OPEN}/members/alice`).online,false);
 assert.equal(f.records.get(`rooms/${LOCKED}/members/alice`).timer.roomWorked,0);assert.equal(f.records.has(`users/alice/rooms/${OPEN}`),true);assert.equal(f.records.has(`users/alice/rooms/${LOCKED}`),true);
 await f.ctx.FocusSocial.pauseRoom();assert.equal(f.ctx.FocusSocial.active(),'');assert.equal(f.sessions.has('focus_active_room_alice'),false);assert.equal(f.records.has(`rooms/${LOCKED}/members/alice`),true);
});

test('password join derives the proof and wrong passwords cannot create a membership',async()=>{
 const f=fixture(),salt='test-room-salt',password='correct-password',hash=crypto.pbkdf2Sync(password,salt,150000,32,'sha256').toString('hex');
 f.put('rooms/'+LOCKED,{name:'Private',ownerUid:'bob',locked:true,salt});f.put(`rooms/${LOCKED}/secrets/password`,{hash});await f.login();await f.join(LOCKED,'wrong-password');
 assert.equal(f.ctx.FocusSocial.active(),'');assert.equal(f.records.has(`rooms/${LOCKED}/members/alice`),false);assert.match(f.node('socialStatus').textContent,/izin yok/);
 await f.join(LOCKED,password);assert.equal(f.ctx.FocusSocial.active(),LOCKED);assert.equal(f.records.get(`users/alice/roomProofs/${LOCKED}`).hash,hash);
});

test('username registration normalizes @ names and collision preserves the existing claim',async()=>{
 const f=fixture();await f.login('alice',false);f.node('socialUsername').value='@My_Name';await f.node('saveIdentity').onclick();await f.settle();
 assert.equal(f.records.get('usernames/my_name').uid,'alice');assert.equal(f.records.get('publicProfiles/alice').username,'my_name');assert.equal(f.node('socialUsername').readOnly,true);
 await f.login('bob',false);f.node('socialUsername').value='my_name';await f.node('saveIdentity').onclick();await f.settle();assert.equal(f.records.get('usernames/my_name').uid,'alice');assert.equal(f.records.has('publicProfiles/bob'),false);assert.match(f.node('socialStatus').textContent,/alınmış/);
});

test('offline members stay visible but never count as active or accrue projected work',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Focus',ownerUid:'alice',locked:false});await f.login();await f.join(OPEN);
 f.put(`rooms/${OPEN}/members/bob`,{uid:'bob',online:false,presenceAt:{toMillis:()=>Date.now()},timer:timer({roomWorked:100})});f.put('publicProfiles/bob',profile('bob'));f.emit();await f.settle();
 assert.match(f.node('roomInfo').textContent,/1 kişi aktif · 2 kayıtlı/);assert.match(f.node('roomMembers').textContent,/Çevrimdışı/);assert.equal(f.node('roomTotal').textContent,LobbyModel.hours(100));
});

test('only a leader with explicit consent can clear all chat pages, retaining room memberships',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Focus',ownerUid:'alice',locked:false});await f.login();await f.join(OPEN);
 for(let i=0;i<310;i++)f.put(`rooms/${OPEN}/messages/message${i}`,{uid:i%2?'alice':'bob',text:'study',image:'data:image/jpeg;base64,YQ==',time:{toMillis:()=>i}});
 await f.node('clearRoomChat').onclick();assert.equal([...f.records.keys()].filter(p=>p.includes('/messages/')).length,310);
 f.node('clearChatConsent').checked=true;await f.node('clearRoomChat').onclick();await f.settle();assert.equal([...f.records.keys()].filter(p=>p.includes('/messages/')).length,0);assert.equal(f.records.has(`rooms/${OPEN}/members/alice`),true);assert.equal(f.records.has(`users/alice/rooms/${OPEN}`),true);assert.equal(f.node('clearChatConsent').checked,false);assert.equal(f.node('clearRoomChat').disabled,false);
 f.put(`rooms/${OPEN}/messages/other`,{uid:'bob',text:'keep'});f.records.get('rooms/'+OPEN).ownerUid='bob';f.emit();await f.settle();f.node('clearChatConsent').checked=true;await f.node('clearRoomChat').onclick();assert.equal(f.records.has(`rooms/${OPEN}/messages/other`),true);
});

test('failed chat deletion enables retry and does not remove saved membership',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Focus',ownerUid:'alice',locked:false});await f.login();await f.join(OPEN);f.put(`rooms/${OPEN}/messages/own`,{uid:'alice',text:'retry'});f.node('clearChatConsent').checked=true;f.failNextDelete();await f.node('clearRoomChat').onclick();assert.equal(f.node('clearRoomChat').disabled,false);assert.equal(f.records.has(`users/alice/rooms/${OPEN}`),true);assert.equal(f.records.has(`rooms/${OPEN}/messages/own`),true);await f.node('clearRoomChat').onclick();assert.equal(f.records.has(`rooms/${OPEN}/messages/own`),false);
});

test('snapshot binding populates saved rooms/friends/invitations and export filters other authors',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Focus',ownerUid:'bob',locked:false});f.put(`users/alice/rooms/${OPEN}`,{name:'Focus'});f.put(`rooms/${OPEN}/messages/own`,{uid:'alice',text:'my data'});f.put(`rooms/${OPEN}/messages/other`,{uid:'bob',text:'private to other'});f.put('friendships/alice_bob',{from:'alice',to:'bob',uids:['alice','bob'],state:'accepted'});f.put('publicProfiles/bob',profile('bob'));f.put('roomInvites/invite',{from:'bob',to:'alice',roomId:OPEN});await f.login();
 assert.match(f.node('savedRooms').textContent,/Focus/);assert.match(f.node('friendList').textContent,/bob/);assert.match(f.node('roomInvitations').textContent,/Daveti kabul et/);
 const data=await f.ctx.FocusSocial.exportData();assert.equal(data.profile.uid,'alice');assert.equal(data.rooms.length,1);assert.equal(data.rooms[0].messages.length,1);assert.equal(data.rooms[0].messages[0].text,'my data');assert.equal(data.friends.length,1);assert.equal(data.invitations.length,1);
 f.ctx.FocusSocial.stop();assert.equal(f.subscriptions.some(s=>s.active),false);assert.equal(f.node('savedRooms').textContent,'');assert.equal(Object.keys(await f.ctx.FocusSocial.exportData()).length,0);
});

test('a saved member restores the active room after reload without recreating membership',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Focus',ownerUid:'bob',locked:true,salt:'private'});f.put(`rooms/${OPEN}/members/alice`,{uid:'alice',online:false,presenceAt:{toMillis:()=>Date.now()},timer:timer({roomWorked:125})});f.put(`users/alice/rooms/${OPEN}`,{name:'Focus'});f.sessions.set('focus_active_room_alice',OPEN);
 await f.login();await f.settle();assert.equal(f.ctx.FocusSocial.active(),OPEN);assert.equal(f.records.get(`rooms/${OPEN}/members/alice`).timer.roomWorked,125);assert.equal(f.records.has(`users/alice/roomProofs/${OPEN}`),false);
});

test('an invited user can join a private room without a password proof',async()=>{
 const f=fixture();f.put('rooms/'+LOCKED,{name:'Private',ownerUid:'bob',locked:true,salt:'private'});f.put('roomInvites/'+LOCKED+'_alice',{roomId:LOCKED,from:'bob',to:'alice'});await f.login();await f.join(LOCKED);
 assert.equal(f.ctx.FocusSocial.active(),LOCKED);assert.equal(f.records.has(`users/alice/roomProofs/${LOCKED}`),false);assert.equal(f.records.has(`rooms/${LOCKED}/members/alice`),true);
});

test('transactional work flush retains server totals and a failed write can retry without double counting',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Focus',ownerUid:'alice',locked:false});await f.login();await f.join(OPEN);f.records.get(`rooms/${OPEN}/members/alice`).timer.roomWorked=100;
 f.work(25);f.offline=true;await f.tick();assert.equal(f.records.get(`rooms/${OPEN}/members/alice`).timer.roomWorked,100);
 f.offline=false;await f.tick();assert.equal(f.records.get(`rooms/${OPEN}/members/alice`).timer.roomWorked,125);await f.ctx.FocusSocial.pauseRoom();assert.equal(f.records.get(`rooms/${OPEN}/members/alice`).timer.roomWorked,125);
});

test('account switching aborts a delayed join without joining as the new account or overwriting its UI',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Focus',ownerUid:'alice',locked:false});await f.login();const original=f.ctx.getDocFromServer;let release;
 f.ctx.getDocFromServer=async r=>r.path==='rooms/'+OPEN?new Promise(resolve=>{release=()=>resolve(original(r))}):original(r);
 const joining=f.join(OPEN);await f.settle();await f.login('bob',false);const newStatus=f.node('socialStatus').textContent;release();await joining;
 assert.equal(f.ctx.FocusSocial.active(),'');assert.equal(f.records.has(`rooms/${OPEN}/members/alice`),false);assert.equal(f.records.has(`rooms/${OPEN}/members/bob`),false);assert.equal(f.node('socialStatus').textContent,newStatus);
});

test('a delayed username transaction cannot register its old name on a new account',async()=>{
 const f=fixture();await f.login('alice',false);const original=f.ctx.runTransaction;let release;
 f.ctx.runTransaction=async(db,fn)=>original(db,tx=>fn({...tx,get:async r=>r.path==='publicProfiles/alice'?new Promise(resolve=>{release=()=>resolve(tx.get(r))}):tx.get(r)}));
 f.node('socialUsername').value='alice_handle';const saving=f.node('saveIdentity').onclick();await f.settle();await f.login('bob',false);release();await saving;
 assert.equal(f.records.has('usernames/alice_handle'),false);assert.equal(f.records.has('publicProfiles/alice'),false);assert.equal(f.records.has('publicProfiles/bob'),false);
});

test('transaction retries after rebinding are checked before their reads or writes',async()=>{
 const f=fixture();await f.login('alice',false);const original=f.ctx.runTransaction;let release;
 f.ctx.runTransaction=async(db,fn)=>{await new Promise(resolve=>release=resolve);return original(db,fn)};
 f.node('socialUsername').value='alice_handle';const saving=f.node('saveIdentity').onclick();await f.settle();await f.login('bob',false);release();await saving;
 assert.equal(f.events.some(e=>e==='set:usernames/alice_handle'),false);assert.equal(f.records.has('publicProfiles/bob'),false);
});

test('password room creation stops before committing if the account changes during key derivation',async()=>{
 const f=fixture();await f.login();let release;const subtle=crypto.webcrypto.subtle;
 f.ctx.crypto={randomUUID:crypto.randomUUID,subtle:{importKey:(...a)=>subtle.importKey(...a),deriveBits:(...a)=>new Promise(resolve=>{release=()=>resolve(subtle.deriveBits(...a))})}};
 f.node('permanentName').value='Private';f.node('permanentPassword').value='long-password';const creating=f.node('createPermanent').onclick();await f.settle();await f.login('bob');release();await creating;
 assert.equal([...f.records.keys()].some(p=>p.startsWith('rooms/')),false);assert.equal(f.ctx.FocusSocial.active(),'');
});

test('admin seeding stops on account changes instead of assigning general rooms to another account',async()=>{
 const f=fixture();const original=f.ctx.runTransaction;let release;
 f.ctx.runTransaction=async(db,fn)=>original(db,tx=>fn({...tx,get:async r=>r.path==='rooms/YKS'?new Promise(resolve=>{release=()=>resolve(tx.get(r))}):tx.get(r)}));
 f.ctx.auth.currentUser={uid:'admin',emailVerified:true,email:'efeozbilgin550@gmail.com'};const binding=f.ctx.FocusSocial.bind(f.ctx.auth.currentUser);await f.settle();await f.login('bob');release();await binding;
 assert.equal(f.records.has('rooms/YKS'),false);assert.equal(f.records.has('rooms/LGS'),false);assert.equal(f.records.has('rooms/TUS'),false);assert.equal(f.records.get('publicProfiles/bob').username,'bob');
});

test('rebinding even the same account aborts a stale clear-chat request and resets its control',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Focus',ownerUid:'alice',locked:false});await f.login();await f.join(OPEN);f.put(`rooms/${OPEN}/messages/own`,{uid:'alice',text:'keep'});const original=f.ctx.getDocsFromServer;let release;
 f.ctx.getDocsFromServer=async q=>q.path===`rooms/${OPEN}/messages`?new Promise(resolve=>{release=()=>resolve(original(q))}):original(q);
 f.node('clearChatConsent').checked=true;const clearing=f.node('clearRoomChat').onclick();await f.settle();await f.login();release();await clearing;
 assert.equal(f.records.has(`rooms/${OPEN}/messages/own`),true);assert.equal(f.node('clearRoomChat').disabled,false);
});

test('export includes own membership totals and sent invitations and aborts on an account change',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Focus',ownerUid:'alice',locked:false});f.put(`users/alice/rooms/${OPEN}`,{name:'Focus'});f.put(`rooms/${OPEN}/members/alice`,{uid:'alice',timer:timer({roomWorked:246})});f.put('roomInvites/sent',{from:'alice',to:'bob',roomId:OPEN});await f.login();
 const data=await f.ctx.FocusSocial.exportData();assert.equal(data.rooms[0].membership.timer.roomWorked,246);assert.equal(data.sentInvitations[0].to,'bob');
 const original=f.ctx.getDocFromServer;let release;f.ctx.getDocFromServer=async r=>r.path===`rooms/${OPEN}/members/alice`?new Promise(resolve=>{release=()=>resolve(original(r))}):original(r);
 const exporting=f.ctx.FocusSocial.exportData();await f.settle();await f.login('bob');release();await assert.rejects(exporting,/account-changed/);
});

