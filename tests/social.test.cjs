const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const LobbyModel=require('../lobby-model.js');
const OPEN='open_room_123456789',LOCKED='locked_room_1234567';
const profile=(uid,username=uid)=>({uid,username,name:uid,photo:'',exam:'',cosmetics:{tag:'none',nameStyle:'plain',frame:'none',plate:'none'}});
const timer=(extra={})=>({phase:'focus',running:true,left:1500,total:1500,worked:0,roomWorked:0,focus:1500,rest:300,rounds:0,...extra});
test('room invite button acknowledges the saved invite and sends push only after the authoritative write',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Study',ownerUid:'alice',locked:false});f.put('friendships/alice_bob',{from:'alice',to:'bob',uids:['alice','bob'],state:'accepted'});f.put('publicProfiles/bob',profile('bob'));await f.login();await f.join(OPEN);f.emit();await f.settle();
 let sent=0;f.ctx.FocusPush={invite:async(room,uid)=>{assert.equal(f.records.get('roomInvites/'+OPEN+'_bob').to,'bob');assert.equal(room,OPEN);assert.equal(uid,'bob');sent++;return true}};
 const card=f.node('friendList').children[0],button=card.children.find(n=>n.textContent==='Odaya davet et');assert.ok(button);await button.onclick();assert.equal(sent,1);assert.equal(button.textContent,'Davet edildi ✓');assert.match(f.node('friendsStatus').textContent,/davet edildi/);assert.match(f.node('nudgeNotice').textContent,/davet edildi/);
});
test('profile save commits private identity and public cosmetics/showcase together',async()=>{
 const f=fixture(),jpg='data:image/jpeg;base64,YWJjZA==';f.put('users/alice/meta/main',{profile:{uid:'alice',name:'Old',photo:''},days:{keep:7}});await f.login();
 f.ctx.FocusExtras={profileDraft:()=>({bio:'New bio',badges:[],showHours:false,seconds:0})};f.ctx.FocusProfileStudio={banner:()=>jpg};
 await f.ctx.FocusSocial.saveIdentity({uid:'alice',name:'New',photo:jpg});
 assert.equal(f.records.get('users/alice/meta/main').profile.name,'New');assert.equal(f.records.get('users/alice/meta/main').profile.photo,jpg);assert.equal(f.records.get('users/alice/meta/main').days.keep,7);
 assert.equal(f.records.get('publicProfiles/alice').name,'New');assert.equal(f.records.get('publicProfiles/alice').photo,jpg);assert.equal(f.records.get('publicProfiles/alice').banner,jpg);assert.equal(f.records.get('publicProfiles/alice').showcase.bio,'New bio');
});
test('missing private profile or conflicting username leaves both identities unchanged',async()=>{
 const f=fixture();await f.login();await assert.rejects(f.ctx.FocusSocial.saveIdentity({uid:'alice',name:'New',photo:''}),/profile-not-ready/);assert.equal(f.records.get('publicProfiles/alice').name,'alice');
 f.put('users/alice/meta/main',{profile:{uid:'alice',name:'Old',photo:''}});f.put('usernames/alice',{uid:'bob'});await assert.rejects(f.ctx.FocusSocial.saveIdentity({uid:'alice',name:'New',photo:''}),/username-taken/);assert.equal(f.records.get('users/alice/meta/main').profile.name,'Old');assert.equal(f.records.get('publicProfiles/alice').name,'alice');
});
test('identity edits preserve legacy banners and save/remove the studio draft without losing showcase',async()=>{
 const f=fixture(),jpg='data:image/jpeg;base64,YWJjZA==';f.put('publicProfiles/alice',{...profile('alice'),banner:jpg,showcase:{bio:'Hello',badges:[],showHours:false,seconds:0}});await f.login();
 await f.ctx.FocusSocial.saveIdentity();assert.equal(f.records.get('publicProfiles/alice').banner,jpg);
 f.ctx.FocusProfileStudio={banner:()=>''};await f.ctx.FocusSocial.saveIdentity();assert.equal(f.records.get('publicProfiles/alice').banner,'');assert.equal(f.records.get('publicProfiles/alice').showcase.bio,'Hello');
 f.ctx.FocusProfileStudio.banner=()=>jpg;await f.ctx.FocusSocial.saveIdentity();assert.equal(f.records.get('publicProfiles/alice').banner,jpg);
});
test('own presence does not require room membership and respects a disconnected browser',async()=>{
 const f=fixture();await f.login();assert.equal(f.ctx.FocusSocial.memberState('alice'),'Odaklanıyor');assert.equal(f.ctx.FocusSocial.memberState('bob'),'Çevrimdışı');f.ctx.navigator.onLine=false;assert.equal(f.ctx.FocusSocial.memberState('alice'),'Çevrimdışı');
});
test('sending from old history returns to live messages so delivery is acknowledged',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Room',ownerUid:'alice',locked:false});
 for(let i=0;i<25;i++)f.put(`rooms/${OPEN}/messages/${String.fromCharCode(65+i).repeat(20)}`,{uid:'alice',text:'Message '+i,image:'',time:{toMillis:()=>1000+i}});
 await f.login();await f.join(OPEN);await f.node('olderMessages').onclick();await f.settle();
 const id='2'.repeat(20);assert.equal(f.chat.transport({id,text:'Sent from history',image:''}),true);await f.settle();
 assert.ok(f.chat.received.some(([m])=>m.id===id));
});

test('repeated live snapshots preserve lobby cards and pending confirmation while changed room data refreshes',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Stable',ownerUid:'alice',locked:false});await f.login();await f.join(OPEN);
 f.emit();await f.settle();
 const list=f.node('savedRooms'),directory=f.node('roomResults'),card=list.children[0],before=list.replacements,dirBefore=directory.replacements;
 for(let i=0;i<4;i++){f.work(1);f.emit();await f.settle()}
 assert.equal(list.children[0],card);assert.equal(list.replacements,before);assert.equal(directory.replacements,dirBefore);
 f.put('rooms/'+OPEN,{name:'Renamed',ownerUid:'alice',locked:true});f.emit();await f.settle();assert.match(list.textContent,/Renamed/);assert.match(list.textContent,/Şifreli/);
 await f.login('bob');assert.notEqual(list.children[0],card);
});

function fixture(){
 const records=new Map(),nodes=new Map(),subscriptions=[],intervals=[],events=[],sessions=new Map(),chat={received:[],retained:[],resets:0};let seconds=0,clock=Date.now(),offline=false,failDelete=false;
 class Element{
  constructor(){this.children=[];this.value='';this.hidden=false;this.checked=false;this.disabled=false;this._text='';this.replacements=0;this.paintVisible=true;this.classList={add(){},toggle(){}}}
  get options(){return this.children}
  getClientRects(){return this.paintVisible?[{}]:[]}
  set textContent(v){this._text=String(v);this.children=[]}get textContent(){return this._text+this.children.map(n=>n.textContent).join('')}
  append(...nodes){this.children.push(...nodes)}prepend(...nodes){this.children.unshift(...nodes)}replaceChildren(...nodes){this.replacements++;this._text='';this.children=[...nodes]}click(){return this.onclick?.()}
 }
 const node=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)};
 const ref=(path,kind='doc')=>({path,kind,clauses:[],id:path.split('/').at(-1)});
 const snapshot=path=>({id:path.split('/').at(-1),ref:ref(path),exists:()=>records.has(path),data:()=>records.get(path)});
 const select=q=>{
  if(q.kind==='doc')return snapshot(q.path);
  let paths=[...records.keys()].filter(p=>q.group?p.split('/').at(-2)===q.path:p.startsWith(q.path+'/')&&p.split('/').length===q.path.split('/').length+1);
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
  addEventListener(){},setInterval:f=>intervals.push(f),setTimeout(){return 1},
  doc:(_, ...p)=>ref(p.join('/')),collection:(_, ...p)=>ref(p.join('/'),'collection'),collectionGroup:(_,name)=>({...ref(name,'collection'),group:true}),query:(base,...clauses)=>({...base,clauses:[...base.clauses,...clauses]}),
  where:(field,op,value)=>({type:'where',field,op,value}),orderBy:field=>({type:'order',field}),limit:value=>({type:'limit',value}),startAfter:cursor=>({type:'after',cursor}),
  getDoc:async r=>select(r),getDocFromServer:async r=>{if(offline)throw Error('offline');return select(r)},getDocs:async q=>select(q),getDocsFromServer:async q=>{if(offline)throw Error('offline');return select(q)},
  onSnapshot:(q,fn)=>{const s={q,fn,active:true};subscriptions.push(s);queueMicrotask(()=>{if(s.active)fn(select(q))});return ()=>s.active=false},
  serverTimestamp:()=>{const at=clock;return {toMillis:()=>at}},
  setDoc:async(r,data)=>{if(r.path.includes('/roomProofs/')){const rid=r.path.split('/').at(-1);if(data.hash!==records.get('rooms/'+rid+'/secrets/password')?.hash)throw Object.assign(Error('wrong-password'),{code:'permission-denied'})}apply('set',r,data);notify()},
  updateDoc:async(r,data)=>{apply('update',r,data);notify()},deleteDoc:async r=>{apply('delete',r);notify()},
  writeBatch:()=>{const writes=[];return {set:(r,data)=>writes.push(['set',r,data]),update:(r,data)=>writes.push(['update',r,data]),delete:r=>writes.push(['delete',r]),commit:async()=>{for(const w of writes)apply(...w);notify()}}},
  runTransaction:async(_,fn)=>{const writes=[];const result=await fn({get:async r=>select(r),set:(r,data)=>writes.push(['set',r,data]),update:(r,data)=>writes.push(['update',r,data])});for(const w of writes)apply(...w);notify();return result},
  Study:{totalSeconds:()=>seconds,localSeconds:()=>seconds,liveSession:()=>timer({worked:seconds})},
  FocusAccount:{profile:()=>({uid:ctx.auth.currentUser?.uid,name:ctx.auth.currentUser?.uid||'Alice',photo:''})},FocusTemporaryRoom:{leaveNow:()=>events.push('temporary-left')},FocusNative:{room:id=>events.push('native:'+id)},
  RoomChat:{receive:(...args)=>chat.received.push(args),retain:ids=>chat.retained.push([...ids]),reset:()=>{chat.resets++},configure:fn=>{chat.transport=fn},state(){},rejected:()=>events.push('chat-rejected')},auth:{currentUser:null},
 };
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('extras-model.js','utf8'),ctx);vm.runInContext(fs.readFileSync('cosmetics.js','utf8'),ctx);vm.runInContext(fs.readFileSync('social-model.js','utf8'),ctx);
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
 assert.match(yksCard.textContent,/\[SİSTEM\]/);
 assert.doesNotMatch(yksCard.textContent,/\[DOKTOR\]/);
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

test('obsolete rooms are excluded while #72775905 and exams are preserved',async()=>{
 const f=fixture();
 f.put('rooms/21795044',{name:'Obsolete 1',ownerUid:'bob',locked:false,salt:'',exam:''});
 f.put('rooms/72775905',{name:'Valid Room',ownerUid:'bob',locked:false,salt:'',exam:''});
 f.put('rooms/YKS',{name:'YKS çalışma odası',ownerUid:'focusforyou',locked:false,salt:'',exam:'YKS',unlimited:true});
 f.put('users/alice/rooms/21795044',{name:'Obsolete 1'});
 f.put('users/alice/rooms/72775905',{name:'Valid Room'});
 f.put('users/alice/rooms/YKS',{name:'YKS çalışma odası'});
 f.put('publicProfiles/alice',profile('alice'));
 await f.login('alice');
 const cards=f.node('savedRooms').children;
 assert.equal(cards.length,2);
 assert.match(cards[0].textContent,/Valid Room/);
 assert.match(cards[1].textContent,/YKS/);
 assert.doesNotMatch(f.node('savedRooms').textContent,/Obsolete 1/);
});

test('admin can permanently delete room by ID using admin moderation tool',async()=>{
 const f=fixture();
 f.put('rooms/99999999',{name:'Unwanted Room',ownerUid:'bob',locked:false,salt:'',exam:''});
 f.put('publicProfiles/admin',profile('admin'));
 f.put('publicProfiles/bob',profile('bob'));
 f.ctx.auth.currentUser={uid:'admin',emailVerified:true,email:'efeozbilgin550@gmail.com'};
 await f.ctx.FocusSocial.bind(f.ctx.auth.currentUser);
 await f.settle();
 f.node('adminDeleteRoomId').value='99999999';
 await f.node('adminDeleteRoomBtn').onclick();
 await f.settle();
 assert.equal(f.records.has('rooms/99999999'),false);
});

test('lobby owner can delete their own lobby with two-step confirmation button',async()=>{
 const f=fixture();
 f.put('rooms/55555555',{name:'My Room',ownerUid:'alice',locked:false,salt:'',exam:''});
 f.put('users/alice/rooms/55555555',{name:'My Room'});
 f.put('publicProfiles/alice',profile('alice'));
 await f.login('alice');
 const card=f.node('savedRooms').children[0];
 const actions=card.children.find(n=>n.className==='lobby-tile-footer').children.find(n=>n.className==='lobby-tile-actions');
 const delBtn=actions.children[0];
 assert.ok(delBtn);
 assert.equal(delBtn.textContent,'Lobiyi sil');
 await delBtn.onclick();
 assert.equal(delBtn.textContent,'Emin misin? Sil');
 assert.equal(f.records.has('rooms/55555555'),true);
 await delBtn.onclick();
 await f.settle();
 assert.equal(f.records.has('rooms/55555555'),false);
 assert.match(f.node('savedRooms').textContent,/Henüz bir odan yok/);
});




test('reserved system username cannot register a profile or acquire a handle',async()=>{const f=fixture();await f.login('alice',false);f.node('socialUsername').value='@FocusForYou';await assert.rejects(f.ctx.FocusSocial.saveIdentity(),/reserved-username/);assert.equal(f.records.has('publicProfiles/alice'),false);assert.equal(f.records.has('usernames/focusforyou'),false);assert.match(f.node('socialStatus').textContent,/sistem hesabına/)});
test('room randomness covers the full eight-digit range rather than 256 possible codes',async()=>{const f=fixture();await f.login();f.ctx.crypto={randomUUID:()=>crypto.randomUUID(),getRandomValues:a=>{assert.equal(a.BYTES_PER_ELEMENT,4);a[0]=89999999;return a}};f.node('permanentName').value='Random';await f.node('createPermanent').onclick();await f.settle();assert.equal(f.records.get('rooms/99999999').name,'Random')});
test('failed room cleanup keeps the parent and bookmark and never reports success',async()=>{const f=fixture();f.put('rooms/'+OPEN,{name:'Safe',ownerUid:'alice',locked:false});f.put('users/alice/rooms/'+OPEN,{name:'Safe'});f.put('rooms/'+OPEN+'/messages/msg',{uid:'alice',text:'keep'});await f.login();f.node('adminDeleteRoomId').value=OPEN;f.node('deleteRoomConsent').checked=true;await f.join(OPEN);f.node('deleteRoomConsent').checked=true;f.failNextDelete();await f.node('deleteRoomAction').onclick();assert.equal(f.records.has('rooms/'+OPEN),true);assert.equal(f.records.has('users/alice/rooms/'+OPEN),true);assert.equal(f.records.get('rooms/'+OPEN).deleting,true);assert.doesNotMatch(f.node('socialStatus').textContent,/kalıcı olarak silindi/)});
test('opening a fresh account does not restore another account global room cache',async()=>{const f=fixture();f.put('rooms/'+OPEN,{name:'Old private context',ownerUid:'bob',locked:false});f.sessions.set('focus_last_room',OPEN);await f.login('alice');assert.equal(f.ctx.FocusSocial.active(),'');assert.equal(f.records.has('rooms/'+OPEN+'/members/alice'),false)});
test('leaving a saved room removes own messages before membership and bookmark while preserving other authors',async()=>{const f=fixture();f.put('rooms/12345678',{name:'Shared',ownerUid:'bob',locked:false});f.put('users/alice/rooms/12345678',{name:'Shared'});f.put('rooms/12345678/members/alice',{uid:'alice',timer:timer()});f.put('rooms/12345678/messages/mine',{uid:'alice',text:'mine'});f.put('rooms/12345678/messages/theirs',{uid:'bob',text:'keep'});await f.login();const card=f.node('savedRooms').children[0],leave=card.children.find(n=>n.className==='lobby-tile-footer').children.find(n=>n.className==='lobby-tile-actions').children[0];await leave.onclick();await leave.onclick();await f.settle();assert.equal(f.records.has('rooms/12345678/messages/mine'),false);assert.equal(f.records.has('rooms/12345678/messages/theirs'),true);assert.equal(f.records.has('users/alice/rooms/12345678'),false);assert.ok(f.events.indexOf('delete:rooms/12345678/messages/mine')<f.events.indexOf('delete:users/alice/rooms/12345678'))});

test('legacy general-room membership repairs its saved card and remains directly leaveable',async()=>{const f=fixture();f.put('rooms/TUS',{name:'TUS çalışma odası',ownerUid:'focusforyou',locked:false,exam:'TUS',unlimited:true});f.put('rooms/TUS/members/alice',{uid:'alice',joinedAt:{toMillis:()=>1},presenceAt:{toMillis:()=>1},online:false,timer:timer()});await f.login();await f.join('TUS');assert.equal(f.records.get('users/alice/rooms/TUS').name,'TUS çalışma odası');assert.match(f.node('savedRooms').textContent,/TUS/);const card=f.node('savedRooms').children.find(c=>c.textContent.includes('#TUS')),leave=card.children.find(n=>n.className==='lobby-tile-footer').children.find(n=>n.className==='lobby-tile-actions').children.find(b=>b.textContent==='Lobiden ayrıl');assert.ok(leave);await leave.onclick();await leave.onclick();await f.settle();assert.equal(f.ctx.FocusSocial.active(),'');assert.equal(f.records.has('rooms/TUS/members/alice'),false);assert.equal(f.records.has('users/alice/rooms/TUS'),false);assert.equal(f.sessions.has('focus_last_room_alice'),false);});

test('cached lobby cards appear during security hydration only for the actual account',async()=>{const f=fixture();f.sessions.set('focus_room_cards_alice',JSON.stringify([{id:'TUS',name:'Cached TUS'}]));f.sessions.set('focus_room_cards_bob',JSON.stringify([{id:'LGS',name:'Other account LGS'}]));const original=f.ctx.getDocFromServer;let resolveLock;f.ctx.getDocFromServer=r=>r.path==='deletions/alice'?new Promise(resolve=>{resolveLock=()=>original(r).then(resolve)}):original(r);const pending=f.login();await f.settle();assert.match(f.node('savedRooms').textContent,/Cached TUS/);assert.doesNotMatch(f.node('savedRooms').textContent,/Other account LGS/);assert.equal(f.ctx.FocusSocial.active(),'');resolveLock();await pending;assert.match(f.node('savedRooms').textContent,/Henüz bir odan yok/);});

test('live timer ticks preserve keyed member DOM across all three views and keep aggregate totals current',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Live',ownerUid:'alice',locked:false});await f.login();await f.join(OPEN);
 const lists=['roomMembers','homeLobbyList','chatRosterList'].map(id=>f.node(id)),rows=lists.map(list=>list.children[0]),replacements=lists.map(list=>list.replacements);
 for(let i=0;i<5;i++){f.work(1);await f.tick()}
 for(let i=0;i<lists.length;i++){assert.equal(lists[i].children[0],rows[i]);assert.equal(lists[i].replacements,replacements[i])}
 assert.equal(f.node('roomTotal').textContent,LobbyModel.hours(5));assert.match(rows[0].textContent,/bu odada 0 sa 00 dk 05 sn/);
});

test('profile changes refresh only affected identity rows and unused member profile listeners are released',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Profiles',ownerUid:'alice',locked:false});await f.login();await f.join(OPEN);
 f.put('publicProfiles/bob',profile('bob'));f.put(`rooms/${OPEN}/members/bob`,{uid:'bob',online:true,presenceAt:{toMillis:()=>f.ctx.Date.now()},timer:timer()});f.emit();await f.settle();
 const aliceRow=f.node('roomMembers').children[0],bobRow=f.node('roomMembers').children[1],profileSub=f.subscriptions.find(s=>s.active&&s.q.path==='publicProfiles/bob');assert.ok(profileSub);
 const before=f.node('roomMembers').replacements;profileSub.fn({exists:()=>true,data:()=>profile('bob')});await f.settle();assert.equal(f.node('roomMembers').replacements,before);
 profileSub.fn({exists:()=>true,data:()=>({...profile('bob'),name:'Renamed Bob',cosmetics:{tag:'doctor',nameStyle:'gold',frame:'gold',plate:'gold'}})});await f.settle();
 assert.equal(f.node('roomMembers').children[0],aliceRow);assert.notEqual(f.node('roomMembers').children[1],bobRow);assert.match(f.node('roomMembers').textContent,/Renamed Bob/);assert.match(f.node('chatRosterList').textContent,/Renamed Bob/);
 f.records.delete(`rooms/${OPEN}/members/bob`);f.emit();await f.settle();assert.equal(f.node('roomMembers').children.length,1);assert.equal(profileSub.active,false);
});

test('hidden documents and hidden tab views skip roster painting and resume with the latest timer when shown',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Visibility',ownerUid:'alice',locked:false});await f.login();await f.join(OPEN);
 const lists=['roomMembers','homeLobbyList','chatRosterList'].map(id=>f.node(id)),original=f.node('roomTotal').textContent;
 f.ctx.document.hidden=true;f.work(3);await f.tick();assert.equal(f.node('roomTotal').textContent,original);
 f.ctx.document.hidden=false;for(const list of lists)list.paintVisible=false;f.work(3);await f.tick();assert.equal(f.node('roomTotal').textContent,original);
 const rows=lists.map(list=>list.children[0]);for(const list of lists)list.paintVisible=true;await f.tick();assert.equal(f.node('roomTotal').textContent,LobbyModel.hours(6));for(let i=0;i<lists.length;i++)assert.equal(lists[i].children[0],rows[i]);
});
test('friend name opens profile and separate friendship controls keep their action',async()=>{
 const f=fixture();f.put('friendships/alice_bob',{from:'alice',to:'bob',uids:['alice','bob'],state:'accepted'});f.put('publicProfiles/bob',profile('bob'));await f.login();const row=f.node('friendList').children[0];let target='';f.ctx.openMemberProfile=uid=>target=uid;row.children[0].click();assert.equal(target,'bob');await row.children.at(-1).click();await f.settle();assert.equal(f.records.has('friendships/alice_bob'),false);
});
test('poke allows offline room members and throttles writes',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Focus',ownerUid:'alice',locked:false});await f.login();await f.join(OPEN);f.put(`rooms/${OPEN}/members/bob`,{uid:'bob',online:true,presenceAt:{toMillis:()=>f.ctx.Date.now()},timer:timer()});f.emit();await f.settle();assert.equal(await f.ctx.FocusSocial.poke('alice'),false);assert.equal(await f.ctx.FocusSocial.poke('outsider'),false);assert.equal(await f.ctx.FocusSocial.poke('bob'),true);const n=f.records.get(`rooms/${OPEN}/nudges/bob`);assert.equal(n.from,'alice');assert.equal(n.to,'bob');assert.equal(await f.ctx.FocusSocial.poke('bob'),false);f.work(11);assert.equal(await f.ctx.FocusSocial.poke('bob'),true);f.records.get(`rooms/${OPEN}/members/bob`).online=false;f.emit();await f.settle();f.work(11);assert.equal(await f.ctx.FocusSocial.poke('bob'),true);
});
test('nudge atomically refreshes the sender heartbeat without changing its timer',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Focus',ownerUid:'alice',locked:false});await f.login();await f.join(OPEN);
 f.put(`rooms/${OPEN}/members/bob`,{uid:'bob',online:false,timer:timer()});f.emit();await f.settle();f.work(2);
 const before=f.records.get(`rooms/${OPEN}/members/alice`).timer,original=f.ctx.writeBatch,writes=[];let commits=0;
 f.ctx.writeBatch=(...args)=>{const batch=original(...args),update=batch.update,set=batch.set,commit=batch.commit;batch.update=(r,data)=>{writes.push(['update',r.path,data]);return update(r,data)};batch.set=(r,data)=>{writes.push(['set',r.path,data]);return set(r,data)};batch.commit=async()=>{commits++;return commit()};return batch};
 assert.equal(await f.ctx.FocusSocial.poke('bob'),true);assert.equal(commits,1);assert.equal(writes.length,2);
 assert.equal(writes[0][0],'update');assert.equal(writes[0][1],`rooms/${OPEN}/members/alice`);assert.deepEqual(Object.keys(writes[0][2]),['presenceAt']);
 assert.equal(writes[1][1],`rooms/${OPEN}/nudges/bob`);assert.equal(writes[0][2].presenceAt.toMillis(),writes[1][2].at.toMillis());
 assert.equal(f.records.get(`rooms/${OPEN}/members/alice`).timer,before);
});
test('delayed nudge sends once, paints success after acknowledgment and expires with hidden rosters',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Focus',ownerUid:'alice',locked:false});await f.login();await f.join(OPEN);
 f.put(`rooms/${OPEN}/members/bob`,{uid:'bob',online:false,timer:timer()});f.emit();await f.settle();
 const button=f.node('memberProfilePokeBtn');f.ctx.FocusSocial.setupPokeButton('bob');
 let release;const gate=new Promise(resolve=>release=resolve),original=f.ctx.writeBatch;let writes=0;
 f.ctx.writeBatch=(...args)=>{const batch=original(...args),set=batch.set,commit=batch.commit;let nudge=false;batch.set=(r,data)=>{nudge ||= r.path.includes('/nudges/');return set(r,data)};batch.commit=async()=>{if(nudge){writes++;await gate}return commit()};return batch};
 const send=f.ctx.FocusSocial.poke('bob');await f.settle();assert.equal(button.disabled,true);assert.equal(button.textContent,'Gönderiliyor…');
 assert.equal(await f.ctx.FocusSocial.poke('bob'),false);assert.equal(writes,1);release();assert.equal(await send,true);assert.match(button.textContent,/Dürtüldü ✓/);
 for(const id of ['roomMembers','homeLobbyList','chatRosterList'])f.node(id).paintVisible=false;
 f.work(11);await f.tick();assert.equal(button.disabled,false);assert.equal(button.textContent,'Dürt');
});
test('failed nudge offers an immediate retry without consuming the cooldown',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Focus',ownerUid:'alice',locked:false});await f.login();await f.join(OPEN);
 f.put(`rooms/${OPEN}/members/bob`,{uid:'bob',online:false,timer:timer()});f.emit();await f.settle();
 const button=f.node('memberProfilePokeBtn');f.ctx.FocusSocial.setupPokeButton('bob');const original=f.ctx.writeBatch;let fail=true;
 f.ctx.writeBatch=(...args)=>{const batch=original(...args),set=batch.set,commit=batch.commit;let nudge=false;batch.set=(r,data)=>{nudge ||= r.path.includes('/nudges/');return set(r,data)};batch.commit=async()=>{if(nudge&&fail){fail=false;throw Error('network-failure')}return commit()};return batch};
 await button.onclick();assert.equal(button.disabled,false);assert.equal(button.textContent,'Tekrar dene');
 await button.onclick();assert.match(button.textContent,/Dürtüldü ✓/);assert.equal(f.records.get(`rooms/${OPEN}/nudges/bob`).from,'alice');
});
test('account switch releases a pending join immediately and old completion cannot unlock the next join',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Focus',ownerUid:'alice',locked:false});await f.login();
 const control=f.node('joinPermanent');control.textContent='Katıl';control.value=OPEN;f.node('roomSearch').value=OPEN;
 const original=f.ctx.getDocFromServer;const releases=[];f.ctx.getDocFromServer=async r=>{if(r.path==='rooms/'+OPEN)await new Promise(resolve=>releases.push(resolve));return original(r)};
 const first=control.onclick();await f.settle();assert.equal(control.disabled,true);
 await f.login('bob');assert.equal(control.disabled,false);assert.equal(control._pending,false);assert.equal(control.textContent,'Katıl');
 const second=control.onclick();await f.settle();assert.equal(control.disabled,true);assert.equal(releases.length,2);
 releases[0]();await first;assert.equal(control.disabled,true);assert.equal(control.textContent,'Bağlanılıyor…');
 releases[1]();await second;await f.settle();assert.equal(control.disabled,false);assert.equal(control.textContent,'Katıl');assert.equal(f.ctx.FocusSocial.uid(),'bob');
});
test('late nudge acknowledgment from the previous account does not start the new account cooldown',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Focus',ownerUid:'alice',locked:false});await f.login();await f.join(OPEN);
 f.put(`rooms/${OPEN}/members/bob`,{uid:'bob',online:false,timer:timer()});f.emit();await f.settle();
 const original=f.ctx.writeBatch;let release,hold=true;
 f.ctx.writeBatch=(...args)=>{const batch=original(...args),set=batch.set,commit=batch.commit;let nudge=false;batch.set=(r,data)=>{nudge ||= r.path.includes('/nudges/');return set(r,data)};batch.commit=async()=>{if(nudge&&hold){hold=false;await new Promise(resolve=>release=resolve)}return commit()};return batch};
 const previous=f.ctx.FocusSocial.poke('bob');const rejected=assert.rejects(previous,/account-changed/);await f.settle();await f.login('bob');await f.join(OPEN);
 f.ctx.FocusSocial.setupPokeButton('alice');assert.equal(f.node('memberProfilePokeBtn').disabled,false);
 release();await rejected;assert.equal(f.node('memberProfilePokeBtn').disabled,false);assert.equal(await f.ctx.FocusSocial.poke('alice'),true);
});
test('nudge receiver ignores initial cache and duplicate events, sound is limited to once per 10s',async()=>{
 const f=fixture();let sounds=0;f.ctx.FocusSound={play:type=>{assert.equal(type,'nudge');sounds++}};f.put('rooms/'+OPEN,{name:'Focus',ownerUid:'alice',locked:false});f.put(`rooms/${OPEN}/nudges/alice`,{from:'bob',to:'alice',at:{toMillis:()=>f.ctx.Date.now()}});await f.login();await f.join(OPEN);assert.equal(sounds,0);f.work(1);const at=f.ctx.Date.now();f.put(`rooms/${OPEN}/nudges/alice`,{from:'bob',to:'alice',at:{toMillis:()=>at}});f.emit();await f.settle();assert.equal(sounds,1);f.emit();assert.equal(sounds,1);f.work(1);const next=f.ctx.Date.now();f.put(`rooms/${OPEN}/nudges/alice`,{from:'charlie',to:'alice',at:{toMillis:()=>next}});f.emit();assert.equal(sounds,1);f.work(11);const last=f.ctx.Date.now();f.put(`rooms/${OPEN}/nudges/alice`,{from:'bob',to:'alice',at:{toMillis:()=>last}});f.emit();assert.equal(sounds,2);assert.match(f.node('nudgeNotice').textContent,/dürttü/);const sub=f.subscriptions.find(s=>s.q.path===`rooms/${OPEN}/nudges/alice`);await f.ctx.FocusSocial.pauseRoom();f.work(11);sub.fn({exists:()=>true,data:()=>({from:'bob',to:'alice',at:{toMillis:()=>f.ctx.Date.now()}})});assert.equal(sounds,2);
});
test('owned cosmetic select options unlock while unowned options remain disabled and custom tag saves',async()=>{
 const f=fixture();for(const id of ['nameStyle','avatarFrame','namePlate']){for(const value of ['plain','none','gold','ruby','ice']){const option=f.ctx.document.createElement('option');option.value=value;f.node(id).append(option)}}f.put('entitlements/alice',{nameStyles:['gold'],frames:['ruby'],plates:['ice'],tags:['custom:UZMAN']});await f.login();assert.equal(f.node('nameStyle').options.find(o=>o.value==='gold').disabled,false);assert.equal(f.node('nameStyle').options.find(o=>o.value==='ruby').disabled,true);assert.equal(f.node('avatarFrame').options.find(o=>o.value==='ruby').disabled,false);assert.equal(f.node('namePlate').options.find(o=>o.value==='ice').disabled,false);assert.equal(f.node('profileTag').options.some(o=>o.value==='custom:UZMAN'&&o.textContent==='[UZMAN]'),true);assert.equal(f.node('profileTag').options.some(o=>o.value==='doctor'),false);f.node('profileTag').value='custom:UZMAN';f.node('nameStyle').value='gold';f.node('avatarFrame').value='ruby';f.node('namePlate').value='ice';await f.ctx.FocusSocial.saveIdentity();assert.equal(f.records.get('publicProfiles/alice').cosmetics.tag,'custom:UZMAN');assert.equal(f.records.get('publicProfiles/alice').cosmetics.frame,'ruby');
});


test('room leaders assign moderator roles, ordinary members cannot self-promote or change themes',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Roles',ownerUid:'alice',locked:false});await f.login();await f.join(OPEN);f.put(`rooms/${OPEN}/members/bob`,{uid:'bob',timer:timer()});f.put('publicProfiles/bob',profile('bob'));f.emit();await f.settle();
 await f.ctx.FocusSocial.setRole('bob','moderator');assert.equal(f.records.get(`rooms/${OPEN}/members/bob`).role,'moderator');await assert.rejects(f.ctx.FocusSocial.setRole('alice','moderator'));
 await f.ctx.FocusSocial.setTheme('ocean');assert.equal(f.records.get('rooms/'+OPEN).theme,'ocean');await f.login('bob');await f.join(OPEN);await assert.rejects(f.ctx.FocusSocial.setTheme('sunset'));await assert.rejects(f.ctx.FocusSocial.setRole('bob','moderator'));
 await f.ctx.FocusSocial.moderate('alice','kick');assert.equal(f.records.has(`rooms/${OPEN}/kicks/alice`),false);
});
test('question transport persists flags and only author or moderator resolves questions',async()=>{
 const f=fixture();f.put('rooms/'+OPEN,{name:'Questions',ownerUid:'bob',locked:false});await f.login();await f.join(OPEN);const id='3'.repeat(20);f.chat.transport({id,text:'Question',image:'',question:true});await f.settle();assert.equal(f.records.get(`rooms/${OPEN}/messages/${id}`).question,true);assert.equal(f.records.get(`rooms/${OPEN}/messages/${id}`).solved,false);await f.ctx.FocusSocial.resolveQuestion(id,true);assert.equal(f.records.get(`rooms/${OPEN}/messages/${id}`).solved,true);
 f.put(`rooms/${OPEN}/messages/${'4'.repeat(20)}`,{uid:'other',text:'Another',question:true,solved:false});await assert.rejects(f.ctx.FocusSocial.resolveQuestion('4'.repeat(20),true));
 f.ctx.FocusSocial.watchQuestions(true);await f.settle();await f.login('next');assert.equal(f.subscriptions.filter(s=>s.active&&s.q.path===`rooms/${OPEN}/messages`&&s.q.clauses.some(c=>c.field==='question')).length,0);
});
test('showcase hours opt-out shares only selected milestone thresholds and timer writes preserve quiet setting',async()=>{
 const f=fixture();await f.login();f.work(50000);await f.ctx.FocusSocial.saveShowcase({bio:'Hi',showHours:false,seconds:50000,badges:['ten','hundred']});const s=f.records.get('publicProfiles/alice').showcase;assert.equal(s.seconds,36000);assert.deepEqual([...s.badges],['ten']);
 f.put('rooms/'+OPEN,{name:'Quiet',ownerUid:'alice',locked:false});await f.join(OPEN);f.ctx.FocusExtras={quietUntil:()=>Date.now()+60000};await f.ctx.FocusSocial.syncQuiet();const until=f.records.get(`rooms/${OPEN}/members/alice`).quietUntil;f.work(20);await f.tick();assert.equal(f.records.get(`rooms/${OPEN}/members/alice`).quietUntil,until);
});


test('pinning updates the message, streams pinned history, and unsubscribes when leaving',async()=>{
 const f=fixture(),seen=[];f.ctx.FocusRoomTools={state(){},pins:rows=>seen.push(rows),close(){}};
 const id='A'.repeat(20);f.put('rooms/'+OPEN,{name:'Pinned',ownerUid:'alice',locked:false});f.put(`rooms/${OPEN}/messages/${id}`,{uid:'alice',text:'Important',image:'',time:{toMillis:()=>1000}});
 await f.login();await f.join(OPEN);await f.ctx.FocusSocial.pinMessage(id,true);await f.settle();assert.equal(f.records.get(`rooms/${OPEN}/messages/${id}`).pinned,true);assert.equal(seen.at(-1)[0].id,id);
 await f.ctx.FocusSocial.pinMessage(id,false);await f.settle();assert.equal(seen.at(-1).length,0);
 await f.ctx.FocusSocial.pauseRoom();const after=seen.length;f.emit();await f.settle();assert.equal(seen.length,after);assert.equal(f.subscriptions.some(s=>s.active&&s.q.path===`rooms/${OPEN}/messages`),false);
});
test('ordinary members cannot pin, moderators can, and mixed profile updates keep unaffected lobby cards',async()=>{
 const f=fixture(),id='B'.repeat(20);f.put('rooms/'+OPEN,{name:'First',ownerUid:'bob',locked:false});f.put('rooms/'+LOCKED,{name:'Second',ownerUid:'carol',locked:false});f.put('publicProfiles/bob',profile('bob'));f.put('publicProfiles/carol',profile('carol'));f.put('users/alice/rooms/'+OPEN,{name:'First'});f.put('users/alice/rooms/'+LOCKED,{name:'Second'});f.put(`rooms/${OPEN}/messages/${id}`,{uid:'bob',text:'Pinned',image:'',time:{toMillis:()=>1000}});
 await f.login();await f.join(OPEN);await assert.rejects(f.ctx.FocusSocial.pinMessage(id,true),/pin-not-allowed/);
 const second=f.node('savedRooms').children[1];f.put('publicProfiles/bob',{...profile('bob'),name:'Updated'});f.emit();await f.settle();assert.equal(f.node('savedRooms').children[1],second);
 f.put(`rooms/${OPEN}/members/alice`,{...f.records.get(`rooms/${OPEN}/members/alice`),role:'moderator'});f.emit();await f.settle();await f.ctx.FocusSocial.pinMessage(id,true);assert.equal(f.records.get(`rooms/${OPEN}/messages/${id}`).pinned,true);
});

test('unchanged room ticks do not rewrite room tools and overlays defer member painting without stopping presence',async()=>{
 const f=fixture();let tools=0,extras=0;f.ctx.FocusRoomTools={state(){tools++}};f.ctx.FocusExtras={room(){extras++}};
 f.put('rooms/'+OPEN,{name:'Room',ownerUid:'alice',locked:false});await f.login();await f.join(OPEN);
 const baseline=[tools,extras];for(let i=0;i<4;i++){f.work(1);await f.tick()}assert.deepEqual([tools,extras],baseline);
 const before=f.node('roomMembers').textContent;f.ctx.FocusOverlayOpen=true;f.work(35);await f.tick();assert.equal(f.node('roomMembers').textContent,before);
 assert.ok(f.records.get(`rooms/${OPEN}/members/alice`).timer.roomWorked>=35,'presence still flushes while profile is open');
 f.ctx.FocusOverlayOpen=false;await f.tick();assert.notEqual(f.node('roomMembers').textContent,before);
 f.put('rooms/'+OPEN,{name:'Renamed',ownerUid:'alice',locked:false});f.emit();await f.settle();assert.ok(tools>baseline[0]);
});

 test('blocking hides room messages, removes friendship, persists privately and account switches reset controls',async()=>{const f=fixture();f.put('rooms/'+OPEN,{name:'Room',ownerUid:'alice',locked:false});f.put('friendships/alice_bob',{from:'bob',to:'alice',uids:['alice','bob'],state:'accepted'});f.put('rooms/'+OPEN+'/messages/'+'B'.repeat(20),{uid:'bob',text:'Hidden',image:'',time:{toMillis:()=>1}});await f.login();await f.join(OPEN);await f.ctx.FocusSocial.setContact('bob','blocked',true);await f.settle();assert.equal(f.ctx.FocusSocial.blocked('bob'),true);assert.equal(f.records.get('users/alice/controls/bob').blocked,true);assert.equal(f.records.has('friendships/alice_bob'),false);assert.equal(f.chat.retained.at(-1).includes('B'.repeat(20)),false);await f.login('carol');assert.equal(f.ctx.FocusSocial.blocked('bob'),false)});
 test('mute and unmute preserve friendship and blocked state independently',async()=>{const f=fixture();f.put('friendships/alice_bob',{from:'bob',to:'alice',uids:['alice','bob'],state:'accepted'});await f.login();await f.ctx.FocusSocial.setContact('bob','muted',true);assert.equal(f.ctx.FocusSocial.muted('bob'),true);assert.equal(f.records.has('friendships/alice_bob'),true);await f.ctx.FocusSocial.setContact('bob','muted',false);assert.equal(f.ctx.FocusSocial.muted('bob'),false)});
 test('question answer subscriptions are on demand, bounded, persist parent identity and stop on leave',async()=>{const f=fixture(),qid='Q'.repeat(20);f.put('rooms/'+OPEN,{name:'Room',ownerUid:'alice',locked:false});f.put('rooms/'+OPEN+'/messages/'+qid,{uid:'bob',text:'Question',image:'',question:true,time:{toMillis:()=>1}});await f.login();await f.join(OPEN);let answers=[];const stop=f.ctx.FocusSocial.watchThread(qid,rows=>answers=rows);await f.ctx.FocusSocial.sendAnswer(qid,'My answer');await f.settle();assert.equal(answers.length,1);assert.equal(answers[0].text,'My answer');assert.equal(answers[0].threadId,qid);assert.equal(answers[0].replyTo.id,qid);const sub=f.subscriptions.find(s=>s.q.clauses?.some(c=>c.field==='threadId'));assert.equal(sub.q.clauses.find(c=>c.type==='limit').value,60);stop();assert.equal(sub.active,false);f.ctx.FocusSocial.watchThread(qid,()=>{});await f.ctx.FocusSocial.pauseRoom();assert.equal(f.subscriptions.filter(s=>s.active&&s.q.clauses?.some(c=>c.field==='threadId')).length,0)});

