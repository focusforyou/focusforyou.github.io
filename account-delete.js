import {doc,setDoc,serverTimestamp,getDocFromServer,getDocsFromServer,collection,query,limit,writeBatch,deleteDoc} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import {deleteUser} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';

// An immutable lock prevents still-valid tokens and old/offline clients from recreating data.
export async function eraseAccount({db,user,locked,assertCurrent,onLocked}){
 assertCurrent();
 if(!locked)await setDoc(doc(db,'deletions',user.uid),{startedAt:serverTimestamp()});
 assertCurrent();await onLocked();
 for(let page=0;page<1000;page++){
  assertCurrent();const rows=await getDocsFromServer(query(collection(db,'users',user.uid,'devices'),limit(200)));
  if(rows.empty)break;
  const batch=writeBatch(db);for(const row of rows.docs)batch.delete(row.ref);await batch.commit();
  if(page===999)throw Error('cleanup-limit');
 }
 assertCurrent();await deleteDoc(doc(db,'users',user.uid,'meta','main'));
 // Fresh server reads must confirm cleanup; failures leave Auth available for retry.
 assertCurrent();
 const remaining=await getDocsFromServer(query(collection(db,'users',user.uid,'devices'),limit(1)));
 assertCurrent();const metadata=await getDocFromServer(doc(db,'users',user.uid,'meta','main'));
 if(!remaining.empty||metadata.exists())throw Error('cleanup-not-empty');
 // Auth is last: a failed/interrupted cleanup can be resumed by the same account.
 assertCurrent();await deleteUser(user);
}
