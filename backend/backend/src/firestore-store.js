import { randomUUID } from 'node:crypto';
import { initialInterview, advanceInterview, correctInterview } from './interview.js';
import { assessIncoming } from './safety.js';
export function fail(status, message) { throw Object.assign(new Error(message), { status }); }
export class FirestoreStore {
  constructor(db, { now = () => Date.now(), ttlMs = 24 * 60 * 60 * 1000 } = {}) {
    this.db = db; this.now = now; this.ttlMs = ttlMs; this.collection = db.collection('checkia_sessions');
  }
  ref(id) {
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) fail(404, 'Sesión no disponible.');
    return this.collection.doc(id);
  }
  owned(snapshot, uid, { allowExpired = false } = {}) {
    const s = snapshot.exists ? snapshot.data() : null;
    if (!s || s.ownerUid !== uid) fail(404, 'Sesión no disponible.');
    if (!allowExpired && s.expiresAt <= this.now()) fail(410, 'La sesión expiró. Puedes eliminarla o crear otra.');
    return s;
  }
  async create(uid) {
    const id = randomUUID(), now = this.now();
    const s = { id, ownerUid: uid, createdAt: now, updatedAt: now, expiresAt: now + this.ttlMs,
      status: 'open', messageCount: 0, clinicalState: initialInterview() };
    await this.ref(id).create(s); return { ...s, messages: [] };
  }
  async list(uid) {
    const snap = await this.collection.where('ownerUid', '==', uid).limit(20).get();
    return snap.docs.map(d => d.data()).sort((a,b) => b.createdAt - a.createdAt);
  }
  async get(id, uid) {
    const ref = this.ref(id);
    return this.db.runTransaction(async tx => {
      const s = this.owned(await tx.get(ref), uid);
      const messages = await tx.get(ref.collection('messages').orderBy('sequence').limit(200));
      return { ...s, messages: messages.docs.map(d => d.data()) };
    });
  }
  async append(id, uid, message, requestId, questionId) {
    const ref = this.ref(id), at = this.now();
    if (typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(requestId)) fail(400, 'requestId debe ser un UUID.');
    const userRef = ref.collection('messages').doc(requestId + '-user');
    const botRef = ref.collection('messages').doc(requestId + '-assistant');
    return this.db.runTransaction(async tx => {
      const s = this.owned(await tx.get(ref), uid);
      const previous = await tx.get(userRef);
      if (previous.exists) {
        if (previous.data().operation === 'correction' || previous.data().text !== message || previous.data().questionId !== questionId) fail(409, 'requestId ya fue usado para otra respuesta.');
        const oldBot = await tx.get(botRef);
        if (!oldBot.exists) fail(409, 'Respuesta incompleta. Recarga la consulta.');
        return { reply: oldBot.data().text, duplicate: true, needsClarification: oldBot.data().kind === 'clarification' };
      }
      if (s.status !== 'open') fail(409, 'La sesión está cerrada.');
      if (s.messageCount >= 200) fail(409, 'Límite de prueba alcanzado. Crea otra sesión.');
      const transition = assessIncoming(s.clinicalState, message, questionId, userRef.id, at) || advanceInterview(s.clinicalState, questionId, message, userRef.id, at);
      const { reply, clinicalState, needsClarification } = transition;
      clinicalState.revision = (s.clinicalState.revision || 0) + 1;
      tx.create(userRef, { id: userRef.id, role: 'user', operation: 'answer', ...(typeof questionId === 'string' ? {questionId} : {}), text: message, createdAt: at, sequence: s.messageCount });
      tx.create(botRef, { id: botRef.id, role: 'assistant', kind: clinicalState.phase === 'safety_alert' ? 'safety_alert' : needsClarification ? 'clarification' : 'question_or_completion', nextQuestionId: clinicalState.pendingQuestions?.[0]?.id || null, text: reply, createdAt: at, sequence: s.messageCount + 1 });
      tx.update(ref, { messageCount: s.messageCount + 2, updatedAt: at, clinicalState });
      return { reply, duplicate: false, needsClarification };
    });
  }
  async correct(id, uid, answer, requestId, factKey, expectedRevision) {
    const ref=this.ref(id), at=this.now();
    if(typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(requestId)) fail(400,'requestId debe ser un UUID.');
    if(!Number.isInteger(expectedRevision) || expectedRevision < 0) fail(400,'expectedRevision debe ser un entero no negativo.');
    const userRef=ref.collection('messages').doc(requestId+'-user'),botRef=ref.collection('messages').doc(requestId+'-assistant');
    return this.db.runTransaction(async tx=>{
      const s=this.owned(await tx.get(ref),uid),previous=await tx.get(userRef);
      if(previous.exists) {
        const p=previous.data();
        if(p.operation !== 'correction' || p.text !== answer || p.factKey !== factKey || p.expectedRevision !== expectedRevision) fail(409,'requestId ya fue usado para otra operación.');
        const bot=await tx.get(botRef);
        if(!bot.exists) fail(409,'Corrección incompleta. Recarga la consulta.');
        return {reply:bot.data().text,duplicate:true,needsClarification:bot.data().kind==='clarification'};
      }
      if(s.status !== 'open') fail(409,'La consulta está cerrada.');
      if(s.messageCount >= 200) fail(409,'Límite de prueba alcanzado.');
      const alert=assessIncoming(s.clinicalState,answer,null,userRef.id,at);
      if(!alert && (s.clinicalState.revision||0) !== expectedRevision) fail(409,'La consulta cambió. Recarga antes de corregir.');
      const {reply,clinicalState,needsClarification}=alert || correctInterview(s.clinicalState,factKey,answer,userRef.id,at);
      clinicalState.revision=(s.clinicalState.revision||0)+1;
      tx.create(userRef,{id:userRef.id,role:'user',operation:'correction',factKey,expectedRevision,text:answer,createdAt:at,sequence:s.messageCount});
      tx.create(botRef,{id:botRef.id,role:'assistant',kind:clinicalState.phase==='safety_alert' ? 'safety_alert' : needsClarification ? 'clarification' : 'correction',nextQuestionId:clinicalState.pendingQuestions?.[0]?.id || null,text:reply,createdAt:at,sequence:s.messageCount+1});
      tx.update(ref,{clinicalState,messageCount:s.messageCount+2,updatedAt:at});
      return {reply,duplicate:false,needsClarification};
    });
  }
  async close(id, uid) {
    const ref = this.ref(id);
    await this.db.runTransaction(async tx => {
      this.owned(await tx.get(ref), uid);
      tx.update(ref, { status: 'closed', updatedAt: this.now() });
    });
  }
  async delete(id, uid) {
    const ref = this.ref(id);
    await this.db.runTransaction(async tx => {
      this.owned(await tx.get(ref), uid, { allowExpired: true });
      const messages = await tx.get(ref.collection('messages').limit(201));
      if (messages.docs.length > 200) fail(409, 'Sesión fuera del límite de borrado de esta etapa.');
      for (const m of messages.docs) tx.delete(m.ref);
      tx.delete(ref);
    });
  }
}
