const {test,before,after}=require('node:test'),fs=require('node:fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,updateDoc,deleteDoc,serverTimestamp}=require('firebase/firestore');
let env;const rid='73849102',sid='abcdef0123456789abcd',eid='1234567890abcdef1234';
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-focus-activities',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}});await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await setDoc(doc(db,'rooms',rid),{name:'Activities',ownerUid:'lead',deleting:false});for(const uid of ['lead','alice','bob'])await setDoc(doc(db,'rooms',rid,'members',uid),{uid,joinedAt:serverTimestamp(),online:true,presenceAt:serverTimestamp()});})});
after(async()=>env?.cleanup());
const db=uid=>env.authenticatedContext(uid,{email:uid+'@example.com',email_verified:true,auth_time:Math.floor(Date.now()/1000)}).firestore();
const session=uid=>({title:'Soru çözümü',ownerUid:uid,focus:1500,rest:300,status:'ready',startedAt:0,createdAt:serverTimestamp()});
test('ordinary members create independent groups; strangers cannot read/join or impersonate ownership',async()=>{
 const a=db('alice'),b=db('bob'),x=db('outsider');await assertSucceeds(setDoc(doc(a,'rooms',rid,'studySessions',sid),session('alice')));
 await assertSucceeds(setDoc(doc(b,'rooms',rid,'studySessions','0123456789abcdef0123'),session('bob')));
 await assertFails(getDoc(doc(x,'rooms',rid,'studySessions',sid)));await assertFails(setDoc(doc(x,'rooms',rid,'studySessions','11111111111111111111'),session('outsider')));
 await assertFails(setDoc(doc(b,'rooms',rid,'studySessions','22222222222222222222'),session('alice')));
 const member={uid:'bob',joinedAt:serverTimestamp()};await assertSucceeds(setDoc(doc(b,'rooms',rid,'studySessions',sid,'participants','bob'),member));await assertFails(setDoc(doc(a,'rooms',rid,'studySessions',sid,'participants','bob'),member));
 await assertFails(updateDoc(doc(b,'rooms',rid,'studySessions',sid),{status:'running',startedAt:Date.now()}));await assertSucceeds(updateDoc(doc(a,'rooms',rid,'studySessions',sid),{status:'running',startedAt:Date.now()}));await assertFails(updateDoc(doc(a,'rooms',rid,'studySessions',sid),{focus:1}));
 await assertSucceeds(deleteDoc(doc(b,'rooms',rid,'studySessions',sid,'participants','bob')));
});
test('appointment attendees opt in themselves; creator can cancel, others cannot edit or forge',async()=>{
 const a=db('alice'),b=db('bob'),ref=doc(a,'rooms',rid,'studyEvents',eid),event={title:'Akşam çalışma',ownerUid:'alice',startsAt:Date.now()+3600000,cancelled:false,createdAt:serverTimestamp()};await assertSucceeds(setDoc(ref,event));
 await assertFails(setDoc(doc(a,'rooms',rid,'studyEvents','aaaaaaaaaaaaaaaaaaaa'),{...event,startsAt:Date.now()-1000}));
 const attendee={uid:'bob',joinedAt:serverTimestamp()};await assertSucceeds(setDoc(doc(b,'rooms',rid,'studyEvents',eid,'attendees','bob'),attendee));await assertFails(setDoc(doc(a,'rooms',rid,'studyEvents',eid,'attendees','bob'),attendee));
 await assertFails(updateDoc(doc(b,'rooms',rid,'studyEvents',eid),{cancelled:true}));await assertFails(updateDoc(ref,{startsAt:Date.now()+7200000}));await assertSucceeds(updateDoc(ref,{cancelled:true}));
 await assertFails(setDoc(doc(b,'rooms',rid,'studyEvents',eid,'attendees','bob'),attendee));await assertSucceeds(deleteDoc(doc(b,'rooms',rid,'studyEvents',eid,'attendees','bob')));
});
test('room goals are leader-owned while contributions are self-owned, monotonic and current-goal scoped',async()=>{
 const lead=db('lead'),a=db('alice'),b=db('bob'),gid='33333333333333333333',goal={title:'Haftalık ortak hedef',targetSeconds:360000,ownerUid:'lead',startedAt:serverTimestamp(),endsAt:Date.now()+6*86400000,goalId:gid};
 await assertFails(setDoc(doc(a,'rooms',rid,'studyGoals','current'),{...goal,ownerUid:'alice'}));await assertSucceeds(setDoc(doc(lead,'rooms',rid,'studyGoals','current'),goal));
 const data={uid:'alice',goalId:gid,seconds:60,updatedAt:serverTimestamp()},path=doc(a,'rooms',rid,'studyGoals','current','contributions','alice');await assertSucceeds(setDoc(path,data));
 await assertFails(setDoc(doc(b,'rooms',rid,'studyGoals','current','contributions','alice'),data));await assertFails(updateDoc(path,{seconds:30,updatedAt:serverTimestamp()}));await assertFails(updateDoc(path,{goalId:'44444444444444444444',updatedAt:serverTimestamp()}));await assertSucceeds(updateDoc(path,{seconds:120,updatedAt:serverTimestamp()}));
 await assertSucceeds(deleteDoc(path));
});
