const {test,before,after}=require('node:test'),fs=require('node:fs');
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,updateDoc,serverTimestamp,collection,getDocs,query,orderBy,limit,writeBatch}=require('firebase/firestore');
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-focus-lobby-profile',firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules','utf8')}})});
after(async()=>{await env?.cleanup()});

test('eight digit room creation, collision protection, legacy access and lobby directory',async()=>{
 const account=uid=>env.authenticatedContext(uid,{email_verified:true,email:uid+'@example.com'}).firestore();
 const a=account('lobbyA'),b=account('lobbyB');
 const room=()=>({name:'Duplicate room name',ownerUid:'lobbyA',locked:false,salt:'',exam:'',createdAt:serverTimestamp()});
 for(const rid of ['10000000','99999999'])await assertSucceeds(setDoc(doc(a,'rooms',rid),room()));
 // Room names can collide, IDs cannot overwrite an existing owner's room.
 await assertFails(setDoc(doc(b,'rooms','10000000'),{...room(),ownerUid:'lobbyB'}));
 for(const rid of ['1234567','123456789','01234567','abcdefgh','legacy_room_123456789','YKS','OTHER'])await assertFails(setDoc(doc(a,'rooms',rid),room()));
 await assertSucceeds(getDocs(query(collection(b,'rooms'),orderBy('createdAt','desc'),limit(24))));
 const rid='legacy_room_123456789';
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'rooms',rid),room())});
 await assertSucceeds(getDoc(doc(b,'rooms',rid)));
 const timer={phase:'focus',running:false,left:1500,total:1500,worked:0,roomWorked:0,focus:1500,rest:300,rounds:0};
 const batch=writeBatch(b);
 batch.set(doc(b,'users','lobbyB','rooms',rid),{name:'Duplicate room name'});
 batch.set(doc(b,'rooms',rid,'members','lobbyB'),{uid:'lobbyB',joinedAt:serverTimestamp(),presenceAt:serverTimestamp(),online:true,timer});
 await assertSucceeds(batch.commit());
});

test('public cloud profiles accept Other and synchronize owned cosmetics securely across devices',async()=>{
 const context=uid=>env.authenticatedContext(uid,{email_verified:true,email:uid+'@example.com'}).firestore();
 const a=context('profileA'),otherDevice=context('profileA'),viewer=context('profileViewer');
 const plain={tag:'none',nameStyle:'plain',frame:'none',plate:'none'};
 const profile={uid:'profileA',username:'profile_a',name:'Display name',photo:'',exam:'OTHER',cosmetics:plain};
 const register=writeBatch(a);register.set(doc(a,'usernames','profile_a'),{uid:'profileA'});register.set(doc(a,'publicProfiles','profileA'),profile);
 await assertSucceeds(register.commit());
 await assertSucceeds(getDoc(doc(otherDevice,'publicProfiles','profileA')));
 await assertSucceeds(getDoc(doc(viewer,'publicProfiles','profileA')));
 await assertFails(updateDoc(doc(viewer,'publicProfiles','profileA'),{name:'Not mine'}));
 await assertFails(updateDoc(doc(a,'publicProfiles','profileA'),{exam:'UNSUPPORTED'}));
 await assertFails(updateDoc(doc(a,'publicProfiles','profileA'),{cosmetics:{...plain,frame:'gold'}}));
 // A trusted store grants ownership; clients may only equip granted cosmetics.
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'entitlements','profileA'),{nameStyles:['plain','gold'],frames:['none','gold'],plates:['none','gold']})});
 const equipped={tag:'none',nameStyle:'gold',frame:'gold',plate:'gold'};
 await assertSucceeds(updateDoc(doc(a,'publicProfiles','profileA'),{cosmetics:equipped}));
 const synced=await assertSucceeds(getDoc(doc(otherDevice,'publicProfiles','profileA')));
 require('node:assert/strict').deepEqual(synced.data().cosmetics,equipped);
 const visible=await assertSucceeds(getDoc(doc(viewer,'publicProfiles','profileA')));
 require('node:assert/strict').deepEqual(visible.data().cosmetics,equipped);
 await assertFails(updateDoc(doc(a,'publicProfiles','profileA'),{cosmetics:{...equipped,tag:'doctor'}}));
 await assertFails(setDoc(doc(a,'entitlements','profileA'),{nameStyles:['gold'],frames:['gold'],plates:['gold']}));
});
