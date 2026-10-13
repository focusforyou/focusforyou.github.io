const {test,before,after}=require('node:test'),fs=require('node:fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,updateDoc,deleteDoc,writeBatch,serverTimestamp,Timestamp,collectionGroup,getDocs,query,where}=require('firebase/firestore');
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-focus-store',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}})});
after(async()=>{await env?.cleanup()});
const account=(uid,email=uid+'@example.com')=>env.authenticatedContext(uid,{email,email_verified:true,auth_time:Math.floor(Date.now()/1000)}).firestore();
const wallet=(earned=0,running=false)=>({earnedSeconds:earned,spentSeconds:0,running,checkpoint:serverTimestamp(),lastPurchase:''});
const owned=()=>({nameStyles:[],frames:[],plates:[],tags:[]});

test('fonts require atomic payment or trusted gift and only the owner can equip and sync them',async()=>{
 const uid='fontBuyer',a=account(uid),admin=account('fontAdmin','efeozbilgin550@gmail.com'),viewer=account('fontViewer'),other=account(uid),plain={tag:'none',nameStyle:'plain',frame:'none',plate:'none'};
 const register=writeBatch(a);register.set(doc(a,'usernames','font_buyer'),{uid});register.set(doc(a,'publicProfiles',uid),{uid,username:'font_buyer',name:'Çağrı',photo:'',exam:'',cosmetics:plain});await assertSucceeds(register.commit());
 const profile=doc(a,'publicProfiles',uid),e=doc(a,'entitlements',uid),w=doc(a,'wallets',uid);
 await assertFails(updateDoc(profile,{cosmetics:{...plain,font:'fredoka'}}));await assertFails(updateDoc(profile,{cosmetics:{...plain,font:'evil'}}));await assertFails(setDoc(e,{...owned(),fonts:['fredoka']}));
 await env.withSecurityRulesDisabled(async ctx=>setDoc(doc(ctx.firestore(),'wallets',uid),wallet(7200000)));
 const buy=(data)=>{const batch=writeBatch(a);batch.update(w,{spentSeconds:18000,lastPurchase:'font:fredoka'});batch.set(e,data);return batch.commit()};
 await assertFails(buy({...owned(),fonts:['fredoka','cinzel']}));await assertFails(buy({...owned(),fonts:['fredoka'],nameStyles:['gold']}));await assertSucceeds(buy({...owned(),fonts:['fredoka']}));
 const equipped={...plain,nameStyle:'plain',font:'fredoka'};await assertSucceeds(updateDoc(profile,{cosmetics:equipped}));await assertFails(updateDoc(doc(viewer,'publicProfiles',uid),{cosmetics:equipped}));
 for(const db of [other,viewer])require('node:assert/strict').deepEqual((await assertSucceeds(getDoc(doc(db,'publicProfiles',uid)))).data().cosmetics,equipped);
 await assertSucceeds(setDoc(doc(admin,'entitlements',uid),{...owned(),fonts:['fredoka','cinzel']}));await assertSucceeds(updateDoc(profile,{cosmetics:{...plain,font:'cinzel'}}));await assertFails(updateDoc(profile,{cosmetics:{...plain,font:'space-mono'}}));
});

test('wallet cannot mint initial credit, advance faster than server time, double-count device credit or reset spent balance',async()=>{
 const uid='storeClock',a=account(uid),b=account(uid),r=doc(a,'wallets',uid);
 await assertFails(setDoc(r,wallet(3600000)));await assertSucceeds(setDoc(r,wallet()));
 await assertFails(updateDoc(r,{earnedSeconds:10,checkpoint:serverTimestamp()}));
 await assertSucceeds(updateDoc(r,{running:true,checkpoint:serverTimestamp()}));
 await assertFails(updateDoc(r,{earnedSeconds:60,checkpoint:serverTimestamp()}));
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'wallets',uid),{...wallet(100,true),checkpoint:Timestamp.fromMillis(Date.now()-120000)})});
 await assertFails(updateDoc(r,{earnedSeconds:161,checkpoint:serverTimestamp()}));await assertSucceeds(updateDoc(r,{earnedSeconds:150,checkpoint:serverTimestamp()}));
 // The second device cannot use the first device's stale 120-second window.
 await assertFails(updateDoc(doc(b,'wallets',uid),{earnedSeconds:200,checkpoint:serverTimestamp()}));
 await assertFails(updateDoc(r,{earnedSeconds:100,checkpoint:serverTimestamp()}));
 await assertFails(updateDoc(r,{spentSeconds:1,lastPurchase:'frame:gold'}));
 await assertFails(getDoc(doc(account('storeSpy'),'wallets',uid)));
});

test('atomic purchase charges catalog-specific exact prices for exactly one owned catalog item',async()=>{
 const uid='storeBuyer',a=account(uid),w=doc(a,'wallets',uid),e=doc(a,'entitlements',uid);
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'wallets',uid),wallet(7200000))});
 await assertFails(setDoc(e,{...owned(),frames:['ruby']}));
 const buy=(spent,id,data)=>{const batch=writeBatch(a);batch.update(w,{spentSeconds:spent,lastPurchase:id});batch.set(e,data);return batch.commit()};
 await assertFails(buy(1,'frame:ruby',{...owned(),frames:['ruby']}));
 await assertFails(buy(72000,'frame:ruby',{...owned(),frames:['ruby','gold']}));
 await assertFails(buy(72000,'frame:ruby',{...owned(),frames:['ruby'],tags:['custom:Free tag']}));
 await assertSucceeds(buy(72000,'frame:ruby',{...owned(),frames:['ruby']}));
 await assertFails(updateDoc(w,{spentSeconds:0}));
 await assertFails(buy(144000,'frame:ruby',{...owned(),frames:['ruby']}));
 await assertSucceeds(buy(108000,'name:ice',{...owned(),frames:['ruby'],nameStyles:['ice']}));
 await assertFails(buy(10800000,'plate:emerald',{...owned(),frames:['ruby'],nameStyles:['ice'],plates:['emerald']}));
});

test('only verified admin can gift inventory and custom tags; recipients can equip owned variants but cannot grant or impersonate doctor',async()=>{
 const uid='storeGifted',a=account(uid),admin=account('storeAdmin','efeozbilgin550@gmail.com'),plain={tag:'none',nameStyle:'plain',frame:'none',plate:'none'};
 const register=writeBatch(a);register.set(doc(a,'usernames','store_gifted'),{uid});register.set(doc(a,'publicProfiles',uid),{uid,username:'store_gifted',name:'Gifted',photo:'',exam:'',cosmetics:plain});await assertSucceeds(register.commit());
 const data={...owned(),frames:['emerald'],nameStyles:['violet'],plates:['ruby'],tags:['custom:Müthiş']};
 await assertFails(setDoc(doc(a,'entitlements',uid),data));await assertSucceeds(setDoc(doc(admin,'entitlements',uid),data));await assertSucceeds(getDoc(doc(admin,'entitlements',uid)));
 await assertSucceeds(updateDoc(doc(a,'publicProfiles',uid),{cosmetics:{tag:'custom:Müthiş',nameStyle:'violet',frame:'emerald',plate:'ruby'}}));
 await assertFails(updateDoc(doc(a,'publicProfiles',uid),{cosmetics:{tag:'doctor',nameStyle:'violet',frame:'emerald',plate:'ruby'}}));
 await assertFails(updateDoc(doc(a,'publicProfiles',uid),{cosmetics:{tag:'custom:Ungifted',nameStyle:'violet',frame:'emerald',plate:'ruby'}}));
 await assertFails(updateDoc(doc(a,'publicProfiles',uid),{cosmetics:{...plain,frame:'ice'}}));
 await assertSucceeds(setDoc(doc(a,'wallets',uid),wallet()));await assertSucceeds(setDoc(doc(a,'deletions',uid),{startedAt:serverTimestamp()}));
 await assertFails(setDoc(doc(admin,'entitlements',uid),data));await assertSucceeds(deleteDoc(doc(a,'wallets',uid)));await assertSucceeds(deleteDoc(doc(a,'entitlements',uid)));
});

test('nudges require same active room, server cooldown and own identity, and locked participants can clean orphan receipts',async()=>{
 const a=account('nudgeA'),b=account('nudgeB'),c=account('nudgeOutside'),rid='89012345',receipt=doc(a,'rooms',rid,'nudges','nudgeB');
 const timer={phase:'focus',running:false,left:1500,total:1500,worked:0,roomWorked:0,focus:1500,rest:300,rounds:0};
 await env.withSecurityRulesDisabled(async ctx=>{const db=ctx.firestore();await setDoc(doc(db,'rooms',rid),{name:'Nudges',ownerUid:'nudgeA',locked:false,salt:'',exam:'',createdAt:serverTimestamp()});for(const uid of ['nudgeA','nudgeB'])await setDoc(doc(db,'rooms',rid,'members',uid),{uid,online:true,presenceAt:serverTimestamp(),joinedAt:serverTimestamp(),timer})});
 await assertFails(setDoc(doc(c,'rooms',rid,'nudges','nudgeB'),{from:'nudgeOutside',to:'nudgeB',at:serverTimestamp()}));
 await assertFails(setDoc(receipt,{from:'nudgeB',to:'nudgeB',at:serverTimestamp()}));
 const poke=()=>{const batch=writeBatch(a);batch.update(doc(a,'rooms',rid,'members','nudgeA'),{presenceAt:serverTimestamp()});batch.set(receipt,{from:'nudgeA',to:'nudgeB',at:serverTimestamp()});return batch.commit()};
 await assertSucceeds(poke());await assertSucceeds(getDoc(doc(b,'rooms',rid,'nudges','nudgeB')));
 await assertFails(poke());
 await assertSucceeds(setDoc(doc(a,'deletions','nudgeA'),{startedAt:serverTimestamp()}));
 const result=await assertSucceeds(getDocs(query(collectionGroup(a,'nudges'),where('from','==','nudgeA'))));require('node:assert/strict').equal(result.size,1);
 await assertFails(getDocs(query(collectionGroup(a,'nudges'),where('from','==','nudgeB'))));await assertSucceeds(deleteDoc(receipt));
});


test('playful fonts require ownership and paid purchases remain atomic',async()=>{
 for(const [i,font]of ['bungee','pacifico','chelaone'].entries()){
  const uid='playfulBuyer'+i,a=account(uid),plain={tag:'none',nameStyle:'plain',frame:'none',plate:'none'},register=writeBatch(a);
  register.set(doc(a,'usernames','playful_buyer'+i),{uid});register.set(doc(a,'publicProfiles',uid),{uid,username:'playful_buyer'+i,name:'Buyer',photo:'',exam:'',cosmetics:plain});await assertSucceeds(register.commit());
  await assertFails(updateDoc(doc(a,'publicProfiles',uid),{cosmetics:{...plain,font}}));
  await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'wallets',uid),wallet(3600000))});
  const buy=writeBatch(a);buy.update(doc(a,'wallets',uid),{spentSeconds:18000,lastPurchase:'font:'+font});buy.set(doc(a,'entitlements',uid),{...owned(),fonts:[font]});await assertSucceeds(buy.commit());
  await assertSucceeds(updateDoc(doc(a,'publicProfiles',uid),{cosmetics:{...plain,font}}));
 }
});

test('new theme and animated frames use exact server catalog costs; discounted or overpaid grants fail',async()=>{for(const [i,id] of ['frame:ember','plate:robot-silver','frame:pulse','frame:robot-gold','frame:robot-duo','font:orbitron'].entries()){const uid='themeBuyer'+i,a=account(uid),model=require('../cosmetics.js'),item=model.find(id),w=doc(a,'wallets',uid),e=doc(a,'entitlements',uid);await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),'wallets',uid),wallet(1000000)));const buy=spent=>{const batch=writeBatch(a);batch.update(w,{spentSeconds:spent,lastPurchase:id});batch.set(e,model.grant({},id));return batch.commit()};await assertFails(buy(item.cost-1));await assertFails(buy(item.cost+1));await assertSucceeds(buy(item.cost))}});
