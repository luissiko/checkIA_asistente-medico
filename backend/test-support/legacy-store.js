// Regression fixtures deliberately create the v5 protocol saved before step 22.
// New-protocol tests import FirestoreStore directly and exercise v6 creation.
import {FirestoreStore as CurrentStore} from '../src/firestore-store.js';
import {initialInterview} from '../src/interview-v5.js';
import {buildSummary} from '../src/summary.js';
export class LegacyStore extends CurrentStore {
 async create(uid){const session=await super.create(uid);const state=initialInterview();await this.db.runTransaction(async tx=>{await tx.get(this.ref(session.id));tx.update(this.ref(session.id),{clinicalState:state});});return {...session,clinicalState:state,summary:buildSummary({...session,clinicalState:state})};}
}
