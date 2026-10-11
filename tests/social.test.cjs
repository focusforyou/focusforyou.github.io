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
  localStorage:{getItem:k=>sessions.get(k)||null,setItem:(k,v)=>sessions.set(k,v),removeItem:k=>sessions.delete(k)},
  document:{hidden:false,getElementById:node,createElement:()=>new Element(),createTextNode:text=>{const n=new Element();n.textContent=text;return n},querySelector:()=>node('chat-note'),addEventListener(){}},
  addEventListener(){},setInterval:f=>intervals.push(f),
  doc:(_, ...p)=>ref(p.join('/')),collection:(_, ...p)=>ref(p.join('/'),'collection'),query:(base,...clauses)=>({...base,clauses:[...base.clauses,...clauses]}),
  where:(field,op,value)=>({type:'where',field,op,value}),orderBy:field=>({type:'order',field}),limit:value=>({type:'limit',value}),startAfter:cursor=>({type:'after',cursor}),
  getDoc:async r=>select(r),getDocFromServer:async r=>{if(offline)throw Error('offline');return select(r)},getDocs:async q=>select(q),getDocsFromServer:async q=>{if(offline)throw Error('offline');return select(q)},
  onSnapshot:(q,fn)=>{const s={q,fn,active:true};subscriptions.push(s);queueMicrotask(()=>{if(s.active)fn(select(q))});return ()=>s.active=false},
  serverTimestamp:()=>{const at=clock;return {toMillis:()=>at}},
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

test('admin joins a password room without deriving a password and can moderate any member',async()=>{
 const f=fixture();f.put('rooms/'+LOCKED,{name:'Private',ownerUid:'bob',locked:true,salt:'secret'});f.put('publicProfiles/admin',profile('admin','efe'));f.ctx.auth.currentUser={uid:'admin',emailVerified:true,email:'efeozbilgin550@gmail.com'};await f.ctx.FocusSocial.bind(f.ctx.auth.currentUser);await f.settle();await f.join(LOCKED);
 assert.equal(f.ctx.FocusSocial.active(),LOCKED);assert.equal(f.records.has(`users/admin/roomProofs/${LOCKED}`),false);assert.equal(f.node('permanentRoomSettings').hidden,false);
 f.put(`rooms/${LOCKED}/members/bob`,{uid:'bob',online:true,joinedAt:{toMillis:()=>0},presenceAt:{toMillis:()=>Date.now()},timer:timer()});f.put('publicProfiles/bob',profile('bob'));f.emit();await f.settle();
 const member=f.node('roomMembers').children.find(x=>x.textContent.includes('bob'));
 await member.children.at(-1).children.find(x=>x.textContent==='Uygulamadan yasakla').onclick();assert.equal(f.records.get('appBans/bob').by,'admin');
});

test('leaders can kick and room-ban but never moderate the protected admin',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Focus',ownerUid:'alice',locked:false});await f.login();await f.join(OPEN);
 for(const [uid,name] of [['bob','bob'],['admin','efe']]){f.put(`rooms/${OPEN}/members/${uid}`,{uid,joinedAt:{toMillis:()=>0},online:true,presenceAt:{toMillis:()=>Date.now()},timer:timer()});f.put('publicProfiles/'+uid,profile(uid,name))}f.emit();await f.settle();
 const adminMember=f.node('roomMembers').children.find(x=>x.textContent.includes('@efe'));assert.ok(adminMember);assert.equal(adminMember.children.some(x=>x.className==='moderation-actions'),false);
 const bob=f.node('roomMembers').children.find(x=>x.textContent.includes('bob'));const controls=bob.children.at(-1).children;assert.equal(controls.some(x=>x.textContent==='Uygulamadan yasakla'),false);await controls.find(x=>x.textContent==='Odadan at').onclick();assert.equal(f.records.get(`rooms/${OPEN}/kicks/bob`).by,'alice');await controls.find(x=>x.textContent==='Odadan yasakla').onclick();assert.equal(f.records.get(`rooms/${OPEN}/bans/bob`).by,'alice');
});

test('kick disconnects immediately, explicit rejoin preserves room totals, subsequent kick still disconnects',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Focus',ownerUid:'bob',locked:false});await f.login();await f.join(OPEN);f.records.get(`rooms/${OPEN}/members/alice`).timer.roomWorked=55;
 f.work(1);f.put(`rooms/${OPEN}/kicks/alice`,{by:'bob',at:{toMillis:()=>Date.now()+100}});f.emit();await f.settle();assert.equal(f.ctx.FocusSocial.active(),'');
 f.work(2);await f.join(OPEN);assert.equal(f.ctx.FocusSocial.active(),OPEN);assert.equal(f.records.get(`rooms/${OPEN}/members/alice`).timer.roomWorked,55);
 f.work(5);f.put(`rooms/${OPEN}/kicks/alice`,{by:'bob',at:{toMillis:()=>Date.now()+7000}});f.emit();await f.settle();assert.equal(f.ctx.FocusSocial.active(),'');
});

test('room ban prevents rejoin and global ban removes social access without stopping personal study',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Focus',ownerUid:'bob',locked:false});await f.login();await f.join(OPEN);f.put(`rooms/${OPEN}/bans/alice`,{by:'bob',at:{toMillis:()=>Date.now()}});f.emit();await f.settle();assert.equal(f.ctx.FocusSocial.active(),'');await f.join(OPEN);assert.equal(f.ctx.FocusSocial.active(),'');assert.match(f.node('socialStatus').textContent,/yasaklandın/);
 f.put('appBans/alice',{by:'admin',at:{toMillis:()=>Date.now()}});f.emit();await f.settle();assert.equal(f.ctx.FocusSocial.banned(),true);assert.equal(f.node('createRoom').disabled,true);assert.equal(f.node('joinRoom').disabled,true);f.work(30);assert.equal(f.ctx.Study.localSeconds(),30);assert.match(f.node('socialStatus').textContent,/Hesabımı sil/);
});


test('new room codes are eight digits and a collision retries without replacing the existing room',async()=>{
 const f=fixture();await f.login();let n=0;f.ctx.crypto={randomUUID:()=>crypto.randomUUID(),subtle:crypto.webcrypto.subtle,getRandomValues:a=>{a[0]=n++;return a}};
 f.put('rooms/10000000',{name:'Existing',ownerUid:'bob',locked:false,salt:'',exam:''});f.node('permanentName').value='New room';await f.node('createPermanent').onclick();await f.settle();
 assert.equal(f.records.get('rooms/10000000').name,'Existing');assert.equal(f.records.get('rooms/10000001').name,'New room');assert.equal(f.ctx.FocusSocial.active(),'10000001');
});
test('cloud cosmetic selections hydrate on another device and saving OTHER keeps the selected appearance without joining an exam room',async()=>{
 const cloud=profile('alice');cloud.cosmetics={tag:'none',nameStyle:'gold',frame:'gold',plate:'gold'};
 const first=fixture(),second=fixture();for(const f of [first,second]){f.put('publicProfiles/alice',cloud);await f.login();assert.equal(f.node('nameStyle').value,'gold');assert.equal(f.node('avatarFrame').value,'gold');}
 second.node('examCategory').value='OTHER';await second.ctx.FocusSocial.saveIdentity();await second.settle();assert.equal(second.records.get('publicProfiles/alice').exam,'OTHER');assert.equal(second.records.get('publicProfiles/alice').cosmetics.plate,'gold');assert.equal(second.ctx.FocusSocial.active(),'');
});
test('saved lobby creator cards track cloud profile changes and the directory excludes pinned exam rooms',async()=>{
 const f=fixture();f.put('rooms/12345678',{name:'Night',ownerUid:'bob',locked:false,salt:'',exam:''});f.put('rooms/TUS',{name:'TUS',ownerUid:'bob',locked:false,salt:'',exam:'TUS'});f.put('users/alice/rooms/12345678',{name:'Night'});f.put('publicProfiles/bob',profile('bob'));await f.login();assert.match(f.node('savedRooms').textContent,/bob/);assert.doesNotMatch(f.node('roomResults').textContent,/TUS/);
 f.put('publicProfiles/bob',{...profile('bob'),name:'New name',photo:'https://example.com/avatar.png'});f.emit();await f.settle();assert.match(f.node('savedRooms').textContent,/New name/);const owner=f.node('savedRooms').children[0].children[2];assert.equal(owner.children[0].src,'https://example.com/avatar.png');
});
test('saved lobby cards render Lobiyi sil for owner and Lobiden ayrıl for non-owner',async()=>{
 const f=fixture();
 f.put('rooms/11111111',{name:'Alice Room',ownerUid:'alice',locked:false,salt:'',exam:''});
 f.put('rooms/22222222',{name:'Bob Room',ownerUid:'bob',locked:false,salt:'',exam:''});
 f.put('users/alice/rooms/11111111',{name:'Alice Room'});
 f.put('users/alice/rooms/22222222',{name:'Bob Room'});
 f.put('publicProfiles/alice',profile('alice'));
 f.put('publicProfiles/bob',profile('bob'));
 await f.login('alice');
 const cards=f.node('savedRooms').children;
 assert.equal(cards.length,2);
 const aliceCard=cards[0];
 const bobCard=cards[1];
 assert.match(aliceCard.textContent,/Lobiyi sil/);
 assert.match(bobCard.textContent,/Lobiden ayrıl/);
});

test('exam rooms render Focus For You as creator with permanent unlimited status',async()=>{
 const f=fixture();
 f.put('rooms/YKS',{name:'YKS çalışma odası',ownerUid:'focusforyou',locked:false,salt:'',exam:'YKS',unlimited:true});
 f.put('users/alice/rooms/YKS',{name:'YKS çalışma odası'});
 f.put('publicProfiles/alice',profile('alice'));
 await f.login('alice');
 const cards=f.node('savedRooms').children;
 assert.equal(cards.length,1);
 const yksCard=cards[0];
 assert.match(yksCard.textContent,/Focus For You/);
 assert.match(yksCard.textContent,/Sürekli açık · Limitsiz/);
 assert.match(yksCard.textContent,/Lobiden ayrıl/);
 assert.doesNotMatch(yksCard.textContent,/Lobiyi sil/);
});

test('admin can delete any room while non-admin can only delete their own room',async()=>{
 const f=fixture();
 f.put('rooms/33333333',{name:'Bob Secret Room',ownerUid:'bob',locked:false,salt:'',exam:''});
 f.put('users/admin/rooms/33333333',{name:'Bob Secret Room'});
 f.put('publicProfiles/admin',profile('admin'));
 f.put('publicProfiles/bob',profile('bob'));
 f.ctx.auth.currentUser={uid:'admin',emailVerified:true,email:'efeozbilgin550@gmail.com'};
 await f.ctx.FocusSocial.bind(f.ctx.auth.currentUser);
 await f.settle();
 const cards=f.node('savedRooms').children;
 assert.equal(cards.length,1);
 assert.match(cards[0].textContent,/Lobiyi sil/);
});

test('reopening app restores last joined room from storage',async()=>{
 const f=fixture();
 f.put('rooms/44444444',{name:'Study Room',ownerUid:'alice',locked:false,salt:'',exam:''});
 f.put('publicProfiles/alice',profile('alice'));
 await f.login('alice');
 await f.join('44444444');
 assert.equal(f.ctx.FocusSocial.active(),'44444444');
 assert.equal(f.ctx.localStorage.getItem('focus_last_room_alice'),'44444444');
 // Simulate app reopen by clearing active state & session, then rebinding
 f.ctx.sessionStorage.removeItem('focus_active_room_alice');
 f.ctx.location.search='';
 await f.ctx.FocusSocial.bind(f.ctx.auth.currentUser);
 await f.settle();
 assert.equal(f.ctx.FocusSocial.active(),'44444444');
});

