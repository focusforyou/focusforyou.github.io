const {test,before,after}=require('node:test'),fs=require('node:fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,updateDoc,deleteDoc,writeBatch,serverTimestamp,Timestamp}=require('firebase/firestore');
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-focus-nudge-target',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}})});
after(async()=>{await env?.cleanup()});
const account=(uid,email=uid+'@example.com')=>env.authenticatedContext(uid,{email,email_verified:true,auth_time:Math.floor(Date.now()/1000)}).firestore();
const timer={phase:'focus',running:false,left:1500,total:1500,worked:0,roomWorked:0,focus:1500,rest:300,rounds:0};
async function setup(name,adminTarget=false){
 const rid='YKS',aUid=name+'Sender',bUid=name+'Target',a=account(aUid),b=account(bUid,adminTarget?'efeozbilgin550@gmail.com':bUid+'@example.com');
 await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await setDoc(doc(db,'rooms',rid),{ownerUid:aUid,name:'YKS',locked:false,deleting:false});for(const uid of [aUid,bUid])await setDoc(doc(db,'rooms',rid,'members',uid),{uid,online:uid===aUid,joinedAt:Timestamp.fromMillis(Date.now()-120000),presenceAt:Timestamp.fromMillis(Date.now()-120000),timer});await setDoc(doc(db,'publicProfiles',bUid),{uid:bUid,username:adminTarget?'efe':name.toLowerCase()+'_target'})});
 const receipt=db=>doc(db,'rooms',rid,'nudges',bUid);
 const poke=(extra={})=>{const batch=writeBatch(a);batch.update(doc(a,'rooms',rid,'members',aUid),{presenceAt:serverTimestamp()});batch.set(receipt(a),{from:aUid,to:bUid,at:serverTimestamp(),...extra});return batch.commit()};
 const seed=(path,data)=>env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),...path),data));
 return {rid,aUid,bUid,a,b,receipt,poke,seed};
}

test('nudge heartbeat and target checks fit per-operation document budget; plain writes cannot spoof heartbeat',async()=>{
 const f=await setup('budget');await assertFails(setDoc(f.receipt(f.a),{from:f.aUid,to:f.bUid,at:serverTimestamp()}));await assertSucceeds(f.poke());await assertSucceeds(getDoc(f.receipt(f.a)));await assertSucceeds(getDoc(f.receipt(f.b)));await assertFails(f.poke());
 // The recipient was seeded online:false: background notifications remain valid.
 await assertFails(getDoc(f.receipt(account('unrelatedReader'))));
 const renewed=await setup('budgetRenewed');await renewed.seed(['rooms',renewed.rid,'kicks',renewed.bUid],{by:renewed.aUid,at:Timestamp.fromMillis(Date.now()-1000)});await assertSucceeds(updateDoc(doc(renewed.b,'rooms',renewed.rid,'members',renewed.bUid),{joinedAt:serverTimestamp(),presenceAt:serverTimestamp()}));await assertSucceeds(renewed.poke());await assertSucceeds(getDoc(renewed.receipt(renewed.a)));
});
test('accepted receipt becomes unreadable to sender after target global-ban, room-ban, kick or deletion; self reads remain',async()=>{
 for(const state of ['appBan','roomBan','kick','delete']){const f=await setup('gate'+state);await assertSucceeds(f.poke());await assertSucceeds(getDoc(f.receipt(f.a)));
  const data={by:f.aUid,at:Timestamp.fromMillis(Date.now()-1000)};
  if(state==='appBan')await f.seed(['appBans',f.bUid],data);
  if(state==='roomBan')await f.seed(['rooms',f.rid,'bans',f.bUid],data);
  if(state==='kick')await f.seed(['rooms',f.rid,'kicks',f.bUid],data);
  if(state==='delete')await f.seed(['deletions',f.bUid],{startedAt:Timestamp.now()});
  await assertFails(getDoc(f.receipt(f.a)));await assertSucceeds(getDoc(f.receipt(f.b)));
 }
});
test('target sanctions forbid new atomic nudges; sender sanctions also deny the independent member heartbeat',async()=>{
 for(const who of ['target','sender'])for(const state of ['appBan','roomBan','kick','delete']){const f=await setup('write'+who+state),uid=who==='target'?f.bUid:f.aUid,data={by:'moderator',at:Timestamp.fromMillis(Date.now()-1000)};
  if(state==='appBan')await f.seed(['appBans',uid],data);
  if(state==='roomBan')await f.seed(['rooms',f.rid,'bans',uid],data);
  if(state==='kick')await f.seed(['rooms',f.rid,'kicks',uid],data);
  if(state==='delete')await f.seed(['deletions',uid],{startedAt:Timestamp.now()});
  await assertFails(f.poke());
 }
});
test('explicit target rejoin clears kick cutoff; protected admin still cannot bypass deletion or missing membership',async()=>{
 const f=await setup('renew');await assertSucceeds(f.poke());await f.seed(['rooms',f.rid,'kicks',f.bUid],{by:f.aUid,at:Timestamp.fromMillis(Date.now()-1000)});await assertFails(getDoc(f.receipt(f.a)));await assertSucceeds(updateDoc(doc(f.b,'rooms',f.rid,'members',f.bUid),{joinedAt:serverTimestamp(),presenceAt:serverTimestamp()}));await assertSucceeds(getDoc(f.receipt(f.a)));
 const admin=await setup('immune',true);for(const path of [['appBans',admin.bUid],['rooms',admin.rid,'bans',admin.bUid],['rooms',admin.rid,'kicks',admin.bUid]])await admin.seed(path,{by:'moderator',at:Timestamp.fromMillis(Date.now()-1000)});await assertSucceeds(admin.poke());await assertSucceeds(getDoc(admin.receipt(admin.a)));await admin.seed(['deletions',admin.bUid],{startedAt:Timestamp.now()});await assertFails(getDoc(admin.receipt(admin.a)));await assertSucceeds(getDoc(admin.receipt(admin.b)));
 const missing=await setup('missingMember');await assertSucceeds(missing.poke());await env.withSecurityRulesDisabled(ctx=>deleteDoc(doc(ctx.firestore(),'rooms',missing.rid,'members',missing.bUid)));await assertFails(getDoc(missing.receipt(missing.a)));
});
