const {test,before,after}=require('node:test'),fs=require('node:fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,deleteDoc,serverTimestamp,collection,getDocs}=require('firebase/firestore');
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-focus-deletion',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}})});
after(async()=>{await env?.cleanup()});
test('deletion lock enforces ownership, recent authentication and permanent write blockade',async()=>{
 const now=Math.floor(Date.now()/1000),a=env.authenticatedContext('alice',{email_verified:true,auth_time:now}).firestore(),b=env.authenticatedContext('bob',{email_verified:true,auth_time:now}).firestore(),stale=env.authenticatedContext('alice',{email_verified:true,auth_time:now-3600}).firestore();
 const data={days:{'2026-10-10':50},fields:{},profile:{uid:'alice',name:'Alice',photo:''}};
 await assertSucceeds(setDoc(doc(a,'users/alice/meta/main'),data));await assertSucceeds(setDoc(doc(a,'users/alice/devices/device-a'),{days:{'2026-10-10':20}}));
 await assertFails(deleteDoc(doc(a,'users/alice/meta/main')));await assertFails(setDoc(doc(b,'deletions/alice'),{startedAt:serverTimestamp()}));await assertFails(setDoc(doc(stale,'deletions/alice'),{startedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(a,'deletions/alice'),{startedAt:serverTimestamp(),email:'private@example.com'}));
 await assertSucceeds(setDoc(doc(a,'deletions/alice'),{startedAt:serverTimestamp()}));
 await assertFails(getDoc(doc(b,'deletions/alice')));await assertFails(getDocs(collection(a,'deletions')));
 await assertFails(setDoc(doc(stale,'users/alice/devices/device-a'),{days:{'2026-10-10':90}}));await assertFails(setDoc(doc(a,'users/alice/meta/main'),data));await assertFails(deleteDoc(doc(a,'deletions/alice')));
 await assertFails(deleteDoc(doc(b,'users/alice/devices/device-a')));await assertFails(deleteDoc(doc(b,'users/alice/meta/main')));
 await assertSucceeds(getDocs(collection(a,'users/alice/devices')));await assertSucceeds(deleteDoc(doc(a,'users/alice/devices/device-a')));await assertSucceeds(deleteDoc(doc(a,'users/alice/meta/main')));
 await assertFails(setDoc(doc(stale,'users/alice/meta/main'),data));await assertFails(setDoc(doc(stale,'users/alice/devices/offline'),{days:{}}));
 const guest=env.unauthenticatedContext().firestore();await assertFails(getDoc(doc(guest,'deletions/alice')));
});
test('an unverified account may lock and finish its own cleanup, but cannot read another account',async()=>{
 const db=env.authenticatedContext('unverified',{email_verified:false,auth_time:Math.floor(Date.now()/1000)}).firestore();
 await assertFails(setDoc(doc(db,'users/unverified/devices/device-a'),{days:{}}));await assertSucceeds(setDoc(doc(db,'deletions/unverified'),{startedAt:serverTimestamp()}));await assertSucceeds(getDocs(collection(db,'users/unverified/devices')));await assertSucceeds(deleteDoc(doc(db,'users/unverified/meta/main')));await assertFails(getDocs(collection(db,'users/alice/devices')));
});

test('device writes reject malformed IDs, oversized fields and forged field timestamps',async()=>{
 const uid='limits',db=env.authenticatedContext(uid,{email_verified:true,auth_time:Math.floor(Date.now()/1000)}).firestore();
 const ref=id=>doc(db,'users',uid,'devices',id),valid={days:{},preferences:{value:'{"focus":25}',at:serverTimestamp()},tasks:{value:'{"t":[],"a":null}',at:serverTimestamp()},forest:{value:'{"f":0,"l":0}',at:serverTimestamp()},exam:{value:'',at:serverTimestamp()}};
 await assertSucceeds(setDoc(ref('device-ok'),valid));
 for(const id of ['a','bad id abc','x'.repeat(65)])await assertFails(setDoc(ref(id),{days:{}}));
 for(const [key,max] of [['preferences',2048],['tasks',65536],['forest',4096],['exam',256]]){
  await assertFails(setDoc(ref('device-ok'),{days:{},[key]:{value:'x'.repeat(max+1),at:serverTimestamp()}}));
  await assertFails(setDoc(ref('device-ok'),{days:{},[key]:{value:[],at:serverTimestamp()}}));
  await assertFails(setDoc(ref('device-ok'),{days:{},[key]:{value:'',at:0}}));
  await assertFails(setDoc(ref('device-ok'),{days:{},[key]:{value:'',at:serverTimestamp(),extra:true}}));
 }
 await assertFails(setDoc(doc(db,'users',uid,'meta','main'),{days:{},fields:{tasks:'x'.repeat(65537)},profile:{uid,name:'limits',photo:''}}));
});
