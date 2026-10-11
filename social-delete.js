import {doc,collection,collectionGroup,query,where,limit,getDocsFromServer,getDocFromServer,writeBatch,deleteDoc,updateDoc} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';

// Membership bookmarks are mandatory and outlive membership cleanup. They let
// an interrupted deletion find every room containing this user's messages.
export async function eraseSocial({db,uid,assertCurrent}){
 const checked=async(operation)=>{assertCurrent();const result=await operation();assertCurrent();return result};
 const readDocs=q=>checked(()=>getDocsFromServer(q));
 const readDoc=ref=>checked(()=>getDocFromServer(ref));
 const remove=ref=>checked(()=>deleteDoc(ref));
 const drain=async(q)=>{
  for(let page=0;page<10000;page++){
   const rows=await readDocs(query(q,limit(150)));
   if(rows.empty)return;
   const batch=writeBatch(db);for(const row of rows.docs)batch.delete(row.ref);
   await checked(()=>batch.commit());
  }
  throw Error('social-cleanup-limit');
 };
 // Find legacy orphan messages too. A missing index safely preserves Auth and
 // the deletion lock for a later retry instead of abandoning personal data.
 const allOwnMessages=query(collectionGroup(db,'messages'),where('uid','==',uid));
 await drain(allOwnMessages);
 if(!(await readDocs(query(allOwnMessages,limit(1)))).empty)throw Error('social-messages-remain');
 const ownRooms=query(collection(db,'rooms'),where('ownerUid','==',uid));
 const owned=await readDocs(ownRooms);
 for(const r of owned.docs){
  const others=await readDocs(query(collection(db,'rooms',r.id,'members'),limit(2)));
  const next=others.docs.find(m=>m.id!==uid);
  if(next)await checked(()=>updateDoc(r.ref,{ownerUid:next.id}));
  else{
   await drain(collection(db,'rooms',r.id,'bans'));
   await drain(collection(db,'rooms',r.id,'kicks'));
   await remove(doc(db,'rooms',r.id,'secrets','password'));
   await remove(r.ref);
  }
 }
 const bookmarks=await readDocs(collection(db,'users',uid,'rooms'));
 for(const r of bookmarks.docs){
  const ownMessages=query(collection(db,'rooms',r.id,'messages'),where('uid','==',uid));
  await drain(ownMessages);
  if(!(await readDocs(query(ownMessages,limit(1)))).empty)throw Error('social-messages-remain');
  for(const kind of ['bans','kicks']){
   const moderation=doc(db,'rooms',r.id,kind,uid);await remove(moderation);
   if((await readDoc(moderation)).exists())throw Error('social-moderation-remains');
  }
  // Delete the bookmark last so a retry still knows where messages belonged.
  await remove(doc(db,'rooms',r.id,'members',uid));
  await remove(r.ref);
 }
 await drain(collection(db,'users',uid,'roomProofs'));
 await drain(query(collection(db,'friendships'),where('uids','array-contains',uid)));
 await drain(query(collection(db,'roomInvites'),where('from','==',uid)));
 await drain(query(collection(db,'roomInvites'),where('to','==',uid)));
 const profileRef=doc(db,'publicProfiles',uid),profile=await readDoc(profileRef);
 if(profile.exists()){
  const claim=doc(db,'usernames',profile.data().username);
  if((await readDoc(claim)).exists())await remove(claim);
  // Retain the profile until its handle is confirmed gone, including on retries
  // by accounts whose verified-email token is no longer available.
  if((await readDoc(claim)).exists())throw Error('social-username-remains');
 }
 await remove(profileRef);await remove(doc(db,'entitlements',uid));
 await remove(doc(db,'appBans',uid));
 for(const q of [allOwnMessages,collection(db,'users',uid,'rooms'),collection(db,'users',uid,'roomProofs'),ownRooms,query(collection(db,'friendships'),where('uids','array-contains',uid)),query(collection(db,'roomInvites'),where('from','==',uid)),query(collection(db,'roomInvites'),where('to','==',uid))]){
  if(!(await readDocs(query(q,limit(1)))).empty)throw Error('social-cleanup-not-empty');
 }
 if((await readDoc(profileRef)).exists()||(await readDoc(doc(db,'entitlements',uid))).exists()||(await readDoc(doc(db,'appBans',uid))).exists())throw Error('social-profile-remains');
}

