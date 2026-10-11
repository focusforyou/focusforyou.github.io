const {test,before,after}=require('node:test'),fs=require('node:fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,updateDoc,deleteDoc,writeBatch,serverTimestamp,collection,collectionGroup,getDocs,query,where}=require('firebase/firestore');
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-focus-audit',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}})});
after(async()=>{await env?.cleanup()});
const account=(uid,email=uid+'@example.com',verified=true)=>env.authenticatedContext(uid,{email,email_verified:verified,auth_time:Math.floor(Date.now()/1000)}).firestore();
const plain={tag:'none',nameStyle:'plain',frame:'none',plate:'none'};
const profile=(uid,username)=>({uid,username,name:username,photo:'',exam:'',cosmetics:plain});
async function register(db,uid,handle){const batch=writeBatch(db);batch.set(doc(db,'usernames',handle),{uid});batch.set(doc(db,'publicProfiles',uid),profile(uid,handle));return batch.commit()}
const timer={phase:'focus',running:false,left:1500,total:1500,worked:0,roomWorked:0,focus:1500,rest:300,rounds:0};
async function join(db,uid,rid){const batch=writeBatch(db);batch.set(doc(db,'users',uid,'rooms',rid),{name:'Audit'});batch.set(doc(db,'rooms',rid,'members',uid),{uid,joinedAt:serverTimestamp(),presenceAt:serverTimestamp(),online:true,timer});return batch.commit()}

test('reserved system handle and UID, verified admin and partial cosmetic grants',async()=>{
 const a=account('auditProfile'),admin=account('auditAdmin','efeozbilgin550@gmail.com'),fake=account('auditFake','efeozbilgin550@gmail.com',false),synthetic=account('focusforyou');
 await assertFails(register(a,'auditProfile','focusforyou'));await assertFails(register(admin,'auditAdmin','focusforyou'));await assertFails(register(a,'auditProfile','efe'));await assertFails(register(fake,'auditFake','efe'));
 await assertFails(register(synthetic,'focusforyou','normal_name'));await assertSucceeds(register(a,'auditProfile','audit_profile'));await assertSucceeds(register(admin,'auditAdmin','efe'));
 await assertFails(updateDoc(doc(a,'publicProfiles','auditProfile'),{cosmetics:{...plain,tag:'doctor'}}));
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'entitlements','auditProfile'),{frames:['gold']})});
 await assertSucceeds(updateDoc(doc(a,'publicProfiles','auditProfile'),{cosmetics:{...plain,frame:'gold'}}));
 await assertFails(updateDoc(doc(a,'publicProfiles','auditProfile'),{cosmetics:{...plain,nameStyle:'gold',frame:'gold'}}));
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'entitlements','auditProfile'),{frames:'gold'})});
 await assertFails(updateDoc(doc(a,'publicProfiles','auditProfile'),{name:'Invalid ownership'}));
 await assertSucceeds(setDoc(doc(admin,'deletions','auditAdmin'),{startedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(admin,'appBans','auditProfile'),{by:'auditAdmin',at:serverTimestamp()}));
});

test('reactions may only change the caller vote, cannot forge other users or mutate messages',async()=>{
 const a=account('reactA'),b=account('reactB'),c=account('reactC'),rid='45678901';
 await assertSucceeds(setDoc(doc(a,'rooms',rid),{name:'Audit',ownerUid:'reactA',locked:false,salt:'',exam:'',createdAt:serverTimestamp()}));
 await assertSucceeds(join(a,'reactA',rid));await assertSucceeds(join(b,'reactB',rid));
 const id='A'.repeat(20),message=doc(a,'rooms',rid,'messages',id),body={uid:'reactA',text:'Original',image:'',time:serverTimestamp()};
 await assertFails(setDoc(message,{...body,reactions:{'👍':['reactB']}}));
 await assertFails(setDoc(message,{...body,replyTo:{id:'x'.repeat(10000),sender:'a',text:'a'}}));
 await assertSucceeds(setDoc(message,body));
 await assertSucceeds(updateDoc(message,{reactions:{'👍':['reactA']}}));
 await assertSucceeds(updateDoc(doc(b,'rooms',rid,'messages',id),{reactions:{'👍':['reactA','reactB']}}));
 await assertFails(updateDoc(doc(b,'rooms',rid,'messages',id),{reactions:{'👍':['reactB']}}));
 await assertFails(updateDoc(doc(b,'rooms',rid,'messages',id),{reactions:{'👍':['reactA','reactB','reactC']}}));
 await assertFails(updateDoc(doc(b,'rooms',rid,'messages',id),{reactions:{'👍':['reactA','reactB','reactB']}}));
 await assertFails(updateDoc(doc(b,'rooms',rid,'messages',id),{reactions:{'👍':['reactA','reactB'],other:['reactB']}}));
 await assertFails(updateDoc(doc(b,'rooms',rid,'messages',id),{text:'Replaced',reactions:{'👍':['reactA']}}));
 await assertFails(updateDoc(doc(c,'rooms',rid,'messages',id),{reactions:{'👍':['reactA','reactB'],'🔥':['reactC']}}));
 await assertSucceeds(updateDoc(doc(b,'rooms',rid,'messages',id),{reactions:{'👍':['reactA'],'🔥':['reactB']}}));
 await assertSucceeds(updateDoc(message,{reactions:{'🔥':['reactB']}}));
});

test('leader cannot directly remove admin membership; room deletion is atomic; bookmark removal needs member removal',async()=>{
 const a=account('immuneLeader'),admin=account('immuneAdmin','efeozbilgin550@gmail.com'),rid='56789012';
 // Admin reservation from another test is unique globally, so seed this separate fixture.
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'publicProfiles','immuneAdmin'),profile('immuneAdmin','efe'))});
 await assertSucceeds(setDoc(doc(a,'rooms',rid),{name:'Audit',ownerUid:'immuneLeader',locked:false,salt:'',exam:'',createdAt:serverTimestamp()}));
 await assertSucceeds(join(a,'immuneLeader',rid));await assertSucceeds(join(admin,'immuneAdmin',rid));
 await assertFails(deleteDoc(doc(a,'rooms',rid,'members','immuneAdmin')));
 await assertFails(deleteDoc(doc(a,'users','immuneLeader','rooms',rid)));
 const batch=writeBatch(a);batch.delete(doc(a,'rooms',rid,'members','immuneLeader'));batch.delete(doc(a,'users','immuneLeader','rooms',rid));batch.delete(doc(a,'rooms',rid,'members','immuneAdmin'));batch.delete(doc(a,'rooms',rid));
 await assertSucceeds(batch.commit());
});

test('locked users can delete orphan own messages through collection group but cannot read or delete another author',async()=>{
 const a=account('orphanA'),b=account('orphanB');
 await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await setDoc(doc(db,'rooms','goneRoot','messages','B'.repeat(20)),{uid:'orphanA',text:'orphan',image:'',time:serverTimestamp()});await setDoc(doc(db,'rooms','anotherGone','messages','C'.repeat(20)),{uid:'orphanB',text:'private',image:'',time:serverTimestamp()})});
 await assertSucceeds(setDoc(doc(a,'deletions','orphanA'),{startedAt:serverTimestamp()}));
 const own=await assertSucceeds(getDocs(query(collectionGroup(a,'messages'),where('uid','==','orphanA'))));require('node:assert/strict').equal(own.size,1);
 await assertFails(getDocs(query(collectionGroup(a,'messages'),where('uid','==','orphanB'))));await assertFails(getDocs(collectionGroup(a,'messages')));
 await assertSucceeds(deleteDoc(doc(a,'rooms','goneRoot','messages','B'.repeat(20))));await assertFails(deleteDoc(doc(a,'rooms','anotherGone','messages','C'.repeat(20))));
});

test('deletion locks prevent fresh friend/invite races and allow a deleting leader to clear owned room children',async()=>{
 const a=account('cleanupLeader'),b=account('cleanupTarget'),rid='67890123';
 await assertSucceeds(register(a,'cleanupLeader','cleanup_leader'));await assertSucceeds(register(b,'cleanupTarget','cleanup_target'));
 await assertSucceeds(setDoc(doc(a,'rooms',rid),{name:'Audit',ownerUid:'cleanupLeader',locked:false,salt:'',exam:'',createdAt:serverTimestamp()}));
 await assertSucceeds(join(a,'cleanupLeader',rid));await assertSucceeds(join(b,'cleanupTarget',rid));
 await assertSucceeds(setDoc(doc(b,'rooms',rid,'messages','D'.repeat(20)),{uid:'cleanupTarget',text:'Remove with room',image:'',time:serverTimestamp()}));
 await assertSucceeds(setDoc(doc(a,'rooms',rid,'kicks','cleanupTarget'),{by:'cleanupLeader',at:serverTimestamp()}));
 await assertSucceeds(setDoc(doc(b,'deletions','cleanupTarget'),{startedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(a,'friendships','cleanupLeader_cleanupTarget'),{uids:['cleanupLeader','cleanupTarget'],from:'cleanupLeader',to:'cleanupTarget',state:'pending'}));
 await assertFails(setDoc(doc(a,'roomInvites',rid+'_cleanupTarget'),{from:'cleanupLeader',to:'cleanupTarget',roomId:rid}));
 await assertSucceeds(setDoc(doc(a,'deletions','cleanupLeader'),{startedAt:serverTimestamp()}));
 await assertSucceeds(deleteDoc(doc(a,'rooms',rid,'messages','D'.repeat(20))));
 await assertSucceeds(deleteDoc(doc(a,'rooms',rid,'kicks','cleanupTarget')));
 await assertSucceeds(deleteDoc(doc(a,'rooms',rid,'members','cleanupTarget')));
 await assertSucceeds(deleteDoc(doc(a,'rooms',rid,'members','cleanupLeader')));
 await assertSucceeds(deleteDoc(doc(a,'users','cleanupLeader','rooms',rid)));
 await assertSucceeds(deleteDoc(doc(a,'rooms',rid)));
});

test('room deletion barrier is one-way and blocks arrivals, new messages and reactions while cleanup remains possible',async()=>{
 const a=account('barrierLeader'),b=account('barrierMember'),c=account('barrierArrival'),rid='78901234';
 const room=doc(a,'rooms',rid);
 await assertSucceeds(setDoc(room,{name:'Audit',ownerUid:'barrierLeader',locked:false,salt:'',exam:'',createdAt:serverTimestamp()}));
 await assertSucceeds(join(a,'barrierLeader',rid));await assertSucceeds(join(b,'barrierMember',rid));
 const id='E'.repeat(20),message=doc(b,'rooms',rid,'messages',id);
 await assertSucceeds(setDoc(message,{uid:'barrierMember',text:'Before closure',image:'',time:serverTimestamp()}));
 await assertFails(updateDoc(doc(b,'rooms',rid),{deleting:true}));
 await assertFails(updateDoc(room,{deleting:true,ownerUid:'barrierMember'}));
 await assertSucceeds(updateDoc(room,{deleting:true}));await assertSucceeds(updateDoc(room,{deleting:true}));
 await assertFails(updateDoc(room,{deleting:false}));
 await assertFails(join(c,'barrierArrival',rid));
 await assertFails(setDoc(doc(b,'rooms',rid,'messages','F'.repeat(20)),{uid:'barrierMember',text:'Too late',image:'',time:serverTimestamp()}));
 await assertFails(updateDoc(message,{reactions:{'👍':['barrierMember']}}));
 await assertSucceeds(getDocs(collection(a,'rooms',rid,'messages')));await assertSucceeds(deleteDoc(doc(a,'rooms',rid,'messages',id)));
 await assertSucceeds(deleteDoc(doc(a,'rooms',rid,'members','barrierMember')));
 const batch=writeBatch(a);batch.delete(doc(a,'rooms',rid,'members','barrierLeader'));batch.delete(doc(a,'users','barrierLeader','rooms',rid));batch.delete(room);await assertSucceeds(batch.commit());
});
