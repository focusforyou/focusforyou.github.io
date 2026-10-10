const {test,before,after}=require('node:test'),fs=require('node:fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,deleteDoc,serverTimestamp,collection,getDocs,query,where,writeBatch,updateDoc}=require('firebase/firestore');
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-focus-moderation',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}})});
after(async()=>{await env?.cleanup()});

test('moderation enforces global admin, room leader, kick renewal, room bans, app bans and deletion rights',async()=>{
 const now=Math.floor(Date.now()/1000),account=(uid,email=uid+'@example.com',verified=true)=>env.authenticatedContext(uid,{email_verified:verified,email,auth_time:now}).firestore();
 const a=account('modAlice'),b=account('modBob'),c=account('modCharlie'),admin=account('modAdmin','efeozbilgin550@gmail.com'),unverifiedAdmin=account('modFakeAdmin','efeozbilgin550@gmail.com',false);
 const uidA='modAlice',uidB='modBob',uidC='modCharlie',uidAdmin='modAdmin',rid='moderation_room_12345',privateRid='private_mod_room_123';
 const profile=(uid,username)=>({uid,username,name:username,photo:'',exam:'',cosmetics:{tag:username==='efe'?'doctor':'none',nameStyle:'plain',frame:'none',plate:'none'}});
 for(const [db,uid,handle] of [[a,uidA,'mod_alice'],[b,uidB,'mod_bob'],[c,uidC,'mod_charlie'],[admin,uidAdmin,'efe']]){const batch=writeBatch(db);batch.set(doc(db,'usernames',handle),{uid});batch.set(doc(db,'publicProfiles',uid),profile(uid,handle));await assertSucceeds(batch.commit())}
 const timer={phase:'focus',running:true,left:1500,total:1500,worked:800,roomWorked:400,focus:1500,rest:300,rounds:0};
 const join=(db,uid,id=rid,name='Moderation')=>{const batch=writeBatch(db);batch.set(doc(db,'users',uid,'rooms',id),{name});batch.set(doc(db,'rooms',id,'members',uid),{uid,joinedAt:serverTimestamp(),presenceAt:serverTimestamp(),online:true,timer});return batch.commit()};
 await assertSucceeds(setDoc(doc(a,'rooms',rid),{name:'Moderation',ownerUid:uidA,locked:false,salt:'',exam:'',createdAt:serverTimestamp()}));
 await assertSucceeds(join(a,uidA));await assertSucceeds(join(b,uidB));await assertSucceeds(join(c,uidC));await assertSucceeds(join(admin,uidAdmin));
 const msg=(db,uid,id)=>setDoc(doc(db,'rooms',rid,'messages',id),{uid,text:'study message',image:'',time:serverTimestamp()});
 await assertSucceeds(msg(a,uidA,'A'.repeat(20)));await assertSucceeds(msg(b,uidB,'B'.repeat(20)));
 const moderation=by=>({by,at:serverTimestamp()}),kick=doc(a,'rooms',rid,'kicks',uidB),ban=doc(a,'rooms',rid,'bans',uidB);
 await assertFails(setDoc(doc(c,'rooms',rid,'kicks',uidB),moderation(uidC)));
 await assertFails(setDoc(doc(a,'rooms',rid,'kicks',uidAdmin),moderation(uidA)));
 await assertFails(setDoc(doc(a,'rooms',rid,'bans',uidAdmin),moderation(uidA)));
 await assertFails(setDoc(doc(a,'appBans',uidB),moderation(uidA)));
 await assertFails(setDoc(doc(unverifiedAdmin,'appBans',uidB),moderation('modFakeAdmin')));
 await assertFails(setDoc(kick,{by:uidC,at:serverTimestamp()}));await assertFails(setDoc(kick,{by:uidA,at:serverTimestamp(),reason:'unexpected'}));
 await assertSucceeds(setDoc(kick,moderation(uidA)));
 await assertFails(getDocs(collection(b,'rooms',rid,'messages')));await assertFails(getDocs(collection(b,'rooms',rid,'members')));await assertFails(msg(b,uidB,'C'.repeat(20)));
 await assertFails(updateDoc(doc(b,'rooms',rid,'members',uidB),{timer,presenceAt:serverTimestamp(),online:true}));
 await assertSucceeds(getDoc(doc(b,'rooms',rid,'kicks',uidB)));await assertSucceeds(getDoc(doc(b,'rooms',rid,'members',uidB)));
 await assertSucceeds(getDocs(query(collection(b,'rooms',rid,'messages'),where('uid','==',uidB))));
 await assertFails(updateDoc(doc(b,'rooms',rid,'members',uidB),{joinedAt:serverTimestamp(),timer:{...timer,roomWorked:0},presenceAt:serverTimestamp(),online:true}));
 await assertSucceeds(updateDoc(doc(b,'rooms',rid,'members',uidB),{joinedAt:serverTimestamp(),timer,presenceAt:serverTimestamp(),online:true}));
 await assertSucceeds(getDocs(collection(b,'rooms',rid,'messages')));await assertSucceeds(msg(b,uidB,'D'.repeat(20)));
 // A non-kicked member cannot arbitrarily reset joinedAt.
 await assertFails(updateDoc(doc(c,'rooms',rid,'members',uidC),{joinedAt:serverTimestamp(),timer,presenceAt:serverTimestamp(),online:true}));
 await assertSucceeds(setDoc(ban,moderation(uidA)));
 await assertFails(getDocs(collection(b,'rooms',rid,'messages')));await assertFails(msg(b,uidB,'E'.repeat(20)));
 await assertFails(updateDoc(doc(b,'rooms',rid,'members',uidB),{joinedAt:serverTimestamp(),timer,presenceAt:serverTimestamp(),online:true}));
 await assertFails(deleteDoc(doc(b,'rooms',rid,'bans',uidB)));await assertSucceeds(deleteDoc(ban));
 await assertSucceeds(getDocs(collection(b,'rooms',rid,'messages')));
 // Admin moderates a private room and bypasses its password without membership.
 await assertSucceeds(setDoc(doc(a,'rooms',privateRid),{name:'Private',ownerUid:uidA,locked:true,salt:'salt',exam:'',createdAt:serverTimestamp()}));await assertSucceeds(join(a,uidA,privateRid,'Private'));
 await assertSucceeds(getDocs(collection(admin,'rooms',privateRid,'members')));await assertSucceeds(setDoc(doc(admin,'rooms',privateRid,'kicks',uidA),moderation(uidAdmin)));
 await assertSucceeds(join(admin,uidAdmin,privateRid,'Private'));
 await assertFails(setDoc(doc(a,'rooms',privateRid,'bans',uidAdmin),moderation(uidA)));
 // App bans stop online operations and personal cloud writes, while preserving export/deletion reads.
 const meta=doc(b,'users',uidB,'meta','main');await assertSucceeds(setDoc(meta,{days:{},fields:{},profile:{uid:uidB,name:'Bob',photo:''}}));
 await assertSucceeds(setDoc(doc(admin,'appBans',uidB),moderation(uidAdmin)));
 await assertSucceeds(getDoc(doc(b,'appBans',uidB)));await assertFails(deleteDoc(doc(b,'appBans',uidB)));
 await assertFails(getDocs(collection(b,'rooms')));await assertFails(getDoc(doc(b,'publicProfiles',uidA)));await assertSucceeds(getDoc(doc(b,'publicProfiles',uidB)));
 await assertFails(updateDoc(doc(b,'publicProfiles',uidB),{name:'Banned rename'}));await assertFails(updateDoc(meta,{days:{'2026-10-11':30}}));
 await assertFails(setDoc(doc(b,'users',uidB,'devices','device_123'),{days:{}}));await assertSucceeds(getDoc(meta));await assertSucceeds(getDocs(collection(b,'users',uidB,'rooms')));
 await assertFails(updateDoc(doc(b,'rooms',rid,'members',uidB),{timer,presenceAt:serverTimestamp(),online:true}));await assertFails(msg(b,uidB,'F'.repeat(20)));await assertFails(getDocs(collection(b,'rooms',rid,'messages')));
 await assertSucceeds(getDocs(query(collection(b,'rooms',rid,'messages'),where('uid','==',uidB))));await assertSucceeds(deleteDoc(doc(b,'rooms',rid,'messages','B'.repeat(20))));
 await assertFails(setDoc(doc(admin,'appBans',uidAdmin),moderation(uidAdmin)));
 // Deleting a banned account removes its target sanctions while Auth is still available.
 await assertSucceeds(setDoc(doc(a,'rooms',rid,'bans',uidB),moderation(uidA)));
 await assertSucceeds(setDoc(doc(b,'deletions',uidB),{startedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(a,'rooms',rid,'bans',uidB),moderation(uidA)));await assertFails(setDoc(doc(admin,'appBans',uidB),moderation(uidAdmin)));
 await assertSucceeds(deleteDoc(doc(b,'rooms',rid,'bans',uidB)));await assertSucceeds(deleteDoc(doc(b,'rooms',rid,'kicks',uidB)));await assertSucceeds(deleteDoc(doc(b,'appBans',uidB)));
 await assertSucceeds(deleteDoc(doc(b,'rooms',rid,'members',uidB)));await assertSucceeds(deleteDoc(doc(b,'users',uidB,'rooms',rid)));await assertSucceeds(deleteDoc(meta));
 await assertFails(updateDoc(doc(b,'publicProfiles',uidB),{name:'Revive after ban removed'}));
});

