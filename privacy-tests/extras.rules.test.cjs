const {test,before,after}=require('node:test'),fs=require('node:fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,updateDoc,deleteDoc,writeBatch,serverTimestamp,collection,getDocs,query,where}=require('firebase/firestore');
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-focus-extras',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}})});
after(async()=>{await env?.cleanup()});
const account=(uid,email=uid+'@example.com')=>env.authenticatedContext(uid,{email,email_verified:true,auth_time:Math.floor(Date.now()/1000)}).firestore();
const timer={phase:'focus',running:true,left:1500,total:1500,worked:100,roomWorked:100,focus:1500,rest:300,rounds:0};

test('banner is owner-only bounded JPEG; legacy profiles, removal and privacy locks remain valid',async()=>{
 const uid='bannerUser',a=account(uid),b=account('bannerSpy');await setup('87123456',[uid]);const r=doc(a,'publicProfiles',uid),jpg='data:image/jpeg;base64,YWJjZA==';
 await assertSucceeds(updateDoc(r,{banner:jpg}));await assertFails(updateDoc(doc(b,'publicProfiles',uid),{banner:jpg}));await assertSucceeds(getDoc(doc(b,'publicProfiles',uid)));
 for(const banner of ['https://example.com/a.jpg','data:image/svg+xml;base64,YWJjZA==',42,'data:image/jpeg;base64,'+'a'.repeat(40000)])await assertFails(updateDoc(r,{banner}));
 await assertSucceeds(updateDoc(r,{banner:''}));await assertSucceeds(setDoc(doc(a,'deletions',uid),{startedAt:serverTimestamp()}));await assertFails(updateDoc(r,{banner:jpg}));
});
async function setup(rid,ids){await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await setDoc(doc(db,'rooms',rid),{name:'Extras',ownerUid:ids[0],locked:false,salt:'',exam:'',createdAt:serverTimestamp()});for(const uid of ids){await setDoc(doc(db,'publicProfiles',uid),{uid,username:uid.startsWith('admin')?'efe':uid.toLowerCase(),name:uid,photo:'',exam:'',cosmetics:{tag:'none',nameStyle:'plain',frame:'none',plate:'none'}});await setDoc(doc(db,'usernames',uid.toLowerCase()),{uid});await setDoc(doc(db,'rooms',rid,'members',uid),{uid,joinedAt:serverTimestamp(),presenceAt:serverTimestamp(),online:true,timer});await setDoc(doc(db,'users',uid,'rooms',rid),{name:'Extras'})}})}

test('leader assigns moderator without self/peer escalation and moderator cannot obtain password, room theme, leader/admin/peer sanctions',async()=>{
 const rid='19283746',a=account('roleLeader'),b=account('roleMod'),c=account('roleUser'),peer=account('rolePeer');await setup(rid,['roleLeader','roleMod','roleUser','rolePeer','adminProtected']);
 await assertFails(updateDoc(doc(b,'rooms',rid,'members','roleMod'),{role:'moderator'}));
 await assertSucceeds(updateDoc(doc(a,'rooms',rid,'members','roleMod'),{role:'moderator'}));await assertSucceeds(updateDoc(doc(a,'rooms',rid,'members','rolePeer'),{role:'moderator'}));
 await assertFails(updateDoc(doc(b,'rooms',rid,'members','roleUser'),{role:'moderator'}));await assertFails(updateDoc(doc(a,'rooms',rid,'members','roleLeader'),{role:'moderator'}));await assertFails(updateDoc(doc(a,'rooms',rid,'members','adminProtected'),{role:'member'}));
 await assertFails(updateDoc(doc(a,'rooms',rid,'members','roleUser'),{role:'moderator',online:false}));
 await assertSucceeds(setDoc(doc(a,'rooms',rid,'secrets','password'),{hash:'a'.repeat(64)}));await assertFails(getDoc(doc(b,'rooms',rid,'secrets','password')));await assertSucceeds(getDoc(doc(a,'rooms',rid,'secrets','password')));
 await assertFails(updateDoc(doc(b,'rooms',rid),{theme:'aurora'}));await assertFails(deleteDoc(doc(b,'rooms',rid)));
 for(const uid of ['roleLeader','rolePeer','adminProtected']){await assertFails(setDoc(doc(b,'rooms',rid,'kicks',uid),{by:'roleMod',at:serverTimestamp()}));await assertFails(setDoc(doc(b,'rooms',rid,'bans',uid),{by:'roleMod',at:serverTimestamp()}));await assertFails(deleteDoc(doc(b,'rooms',rid,'members',uid)))}
 await assertSucceeds(setDoc(doc(b,'rooms',rid,'bans','roleUser'),{by:'roleMod',at:serverTimestamp()}));await assertSucceeds(deleteDoc(doc(b,'rooms',rid,'bans','roleUser')));
 await assertSucceeds(setDoc(doc(b,'rooms',rid,'kicks','roleUser'),{by:'roleMod',at:serverTimestamp()}));
 // A leader-kicked moderator who explicitly rejoins retains role and permissions within the access-call limit.
 await assertSucceeds(setDoc(doc(a,'rooms',rid,'kicks','roleMod'),{by:'roleLeader',at:serverTimestamp()}));
 await assertSucceeds(updateDoc(doc(b,'rooms',rid,'members','roleMod'),{joinedAt:serverTimestamp(),timer,presenceAt:serverTimestamp(),online:true}));
 await assertSucceeds(setDoc(doc(b,'rooms',rid,'bans','roleUser'),{by:'roleMod',at:serverTimestamp()}));
 await assertFails(setDoc(doc(b,'roomInvites',rid+'_roleUser'),{from:'roleMod',to:'roleUser',roomId:rid}));
});

test('theme changes are leader-only, bounded, and cannot mutate room ownership or arbitrary metadata',async()=>{
 const rid='29384756',a=account('themeLeader'),b=account('themeUser');await setup(rid,['themeLeader','themeUser']);
 await assertSucceeds(updateDoc(doc(a,'rooms',rid),{theme:'ocean'}));await assertFails(updateDoc(doc(a,'rooms',rid),{theme:'invalid'}));
 await assertFails(updateDoc(doc(b,'rooms',rid),{theme:'sunset'}));await assertFails(updateDoc(doc(a,'rooms',rid),{theme:'aurora',ownerUid:'themeUser'}));
});

test('member preview writes only add/remove self, reject injected foreign IDs, duplicates, oversized lists and survive deletion-lock cleanup',async()=>{
 const rid='39485766',a=account('previewLeader'),b=account('previewUser'),outside=account('previewOutside');await setup(rid,['previewLeader','previewUser']);
 const ra=doc(a,'rooms',rid),rb=doc(b,'rooms',rid);
 await assertFails(updateDoc(doc(outside,'rooms',rid),{previewUids:['previewOutside']}));
 await assertSucceeds(updateDoc(ra,{previewUids:['previewLeader']}));await assertSucceeds(updateDoc(rb,{previewUids:['previewLeader','previewUser']}));
 await assertFails(updateDoc(rb,{previewUids:['previewUser']}));await assertFails(updateDoc(rb,{previewUids:['previewLeader','previewUser','foreign']}));await assertFails(updateDoc(rb,{previewUids:['previewLeader','previewUser','previewUser']}));
 await assertFails(updateDoc(ra,{previewUids:['previewLeader','previewUser','x','y','z']}));await assertFails(updateDoc(rb,{previewUids:['previewLeader'],theme:'sunset'}));
 await assertSucceeds(setDoc(doc(b,'deletions','previewUser'),{startedAt:serverTimestamp()}));
 await assertSucceeds(getDocs(query(collection(b,'rooms'),where('previewUids','array-contains','previewUser'))));await assertSucceeds(updateDoc(rb,{previewUids:['previewLeader']}));
 await assertFails(updateDoc(rb,{previewUids:['previewLeader','previewUser']}));await assertFails(updateDoc(rb,{previewUids:[]}));
});

test('quiet mode is self-only integer time capped at twenty-four hours and is preserved through normal heartbeat updates',async()=>{
 const rid='49586776',a=account('quietLeader'),b=account('quietUser');await setup(rid,['quietLeader','quietUser']);const r=doc(b,'rooms',rid,'members','quietUser'),until=Date.now()+3600000;
 await assertSucceeds(updateDoc(r,{quietUntil:until}));await assertSucceeds(updateDoc(r,{quietUntil:0}));
 await assertFails(updateDoc(r,{quietUntil:Date.now()+90000000}));await assertFails(updateDoc(r,{quietUntil:-1}));await assertFails(updateDoc(r,{quietUntil:1.5}));await assertFails(updateDoc(r,{quietUntil:'tomorrow'}));
 await assertFails(updateDoc(doc(a,'rooms',rid,'members','quietUser'),{quietUntil:until}));
 await assertSucceeds(updateDoc(r,{timer,presenceAt:serverTimestamp(),online:true,quietUntil:until}));
 await assertFails(updateDoc(r,{role:'moderator',quietUntil:0}));
});

test('profile showcases validate fields, privacy booleans, bounded biography and earned milestone thresholds',async()=>{
 const uid='showcaseUser',a=account(uid),b=account('showcaseSpy');await setup('59687786',[uid]);const r=doc(a,'publicProfiles',uid),valid={bio:'Birlikte çalışalım',showHours:false,seconds:36000,badges:['first','ten']};
 await assertSucceeds(updateDoc(r,{showcase:valid}));await assertFails(updateDoc(doc(b,'publicProfiles',uid),{showcase:valid}));
 for(const patch of [{bio:'x'.repeat(161)},{showHours:'yes'},{seconds:-1},{seconds:315360001},{badges:['unknown']},{badges:['first','first']},{badges:['first','ten','fifty','hundred']},{seconds:0},{isAdmin:true}])await assertFails(updateDoc(r,{showcase:{...valid,...patch}}));
});

test('questions start unsolved and only author or moderator can resolve without changing text, author or question classification',async()=>{
 const rid='69788796',a=account('questionLeader'),b=account('questionAuthor'),c=account('questionUser'),mod=account('questionMod');await setup(rid,['questionLeader','questionAuthor','questionUser','questionMod']);await assertSucceeds(updateDoc(doc(a,'rooms',rid,'members','questionMod'),{role:'moderator'}));
 const id='Q'.repeat(20),r=doc(b,'rooms',rid,'messages',id),body={uid:'questionAuthor',text:'Bu soruyu nasıl çözebilirim?',image:'',time:serverTimestamp(),question:true,solved:false};
 await assertFails(setDoc(r,{...body,solved:true}));await assertFails(setDoc(r,{...body,question:'true'}));await assertSucceeds(setDoc(r,body));
 await assertFails(updateDoc(doc(c,'rooms',rid,'messages',id),{solved:true}));await assertSucceeds(updateDoc(r,{solved:true}));await assertSucceeds(updateDoc(doc(mod,'rooms',rid,'messages',id),{solved:false}));
 await assertFails(updateDoc(r,{solved:'yes'}));await assertFails(updateDoc(r,{solved:true,text:'Changed text'}));await assertFails(updateDoc(r,{question:false}));
 await assertSucceeds(setDoc(doc(b,'rooms',rid,'messages','R'.repeat(20)),{uid:'questionAuthor',text:'Normal message',image:'',time:serverTimestamp()}));await assertFails(updateDoc(doc(b,'rooms',rid,'messages','R'.repeat(20)),{solved:true}));
});

test('only active room moderators pin existing messages, members read pins, and pin writes preserve immutable message fields',async()=>{
 const rid='79888796',leader=account('pinLeader'),author=account('pinAuthor'),mod=account('pinMod'),admin=account('adminPin','efeozbilgin550@gmail.com'),outside=account('pinOutside');
 await setup(rid,['pinLeader','pinAuthor','pinMod','adminPin']);
 await assertSucceeds(updateDoc(doc(leader,'rooms',rid,'members','pinMod'),{role:'moderator'}));
 const id='P'.repeat(20),body={uid:'pinAuthor',text:'Paylaşılan bilgi',image:'',time:serverTimestamp()},r=doc(author,'rooms',rid,'messages',id);
 await assertFails(setDoc(r,{...body,pinned:true}));await assertFails(setDoc(r,{...body,pinned:'false'}));await assertSucceeds(setDoc(r,{...body,pinned:false}));
 // Legacy messages without pinned remain pinnable too.
 const legacy='S'.repeat(20);await assertSucceeds(setDoc(doc(author,'rooms',rid,'messages',legacy),body));
 await assertFails(updateDoc(r,{pinned:true}));await assertFails(updateDoc(doc(outside,'rooms',rid,'messages',id),{pinned:true}));
 const mr=doc(mod,'rooms',rid,'messages',id);
 await assertSucceeds(updateDoc(mr,{pinned:true}));await assertSucceeds(getDoc(r));
 await assertSucceeds(getDocs(query(collection(author,'rooms',rid,'messages'),where('pinned','==',true))));
 await assertSucceeds(updateDoc(doc(leader,'rooms',rid,'messages',id),{pinned:false}));await assertSucceeds(updateDoc(doc(admin,'rooms',rid,'messages',legacy),{pinned:true}));
 for(const patch of [{pinned:'true'},{pinned:true,text:'Changed'},{pinned:true,uid:'pinMod'},{pinned:true,time:serverTimestamp()},{pinned:true,reactions:{'👍':['pinMod']}}])await assertFails(updateDoc(mr,patch));
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'rooms',rid,'bans','pinMod'),{by:'pinLeader',at:serverTimestamp()})});
 await assertFails(updateDoc(mr,{pinned:true}));
 await assertSucceeds(setDoc(doc(leader,'deletions','pinLeader'),{startedAt:serverTimestamp()}));await assertFails(updateDoc(doc(leader,'rooms',rid,'messages',id),{pinned:true}));
 await env.withSecurityRulesDisabled(async ctx=>{await updateDoc(doc(ctx.firestore(),'rooms',rid),{deleting:true})});
 await assertFails(updateDoc(doc(admin,'rooms',rid,'messages',id),{pinned:true}));
});
