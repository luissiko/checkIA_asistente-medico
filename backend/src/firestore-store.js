import {answersConfirmed} from './interview-v8.js';
import {advanceAdditional,availableClarifications,reviewQuestion} from './adaptive.js';
import { buildSummary } from './summary.js';
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
    await this.ref(id).create(s); return { ...s, messages: [], summary:buildSummary(s) };
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
      return { ...s, messages: messages.docs.map(d => d.data()), summary:buildSummary(s) };
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
      if ((await tx.get(botRef)).exists)fail(409,'La solicitud ya se utilizó para otra operación.');
      if (s.status !== 'open') fail(409, 'La sesión está cerrada.');
      if (s.messageCount + 2 > 200) fail(409, 'Límite de prueba alcanzado. Crea otra sesión.');
      const transition = assessIncoming(s.clinicalState, message, questionId, userRef.id, at) || advanceAdditional(s.clinicalState, questionId, message, userRef.id, at) || advanceInterview(s.clinicalState, questionId, message, userRef.id, at);
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
      if((await tx.get(botRef)).exists)fail(409,'La solicitud ya se utilizó para otra operación.');
      if(s.status !== 'open') fail(409,'La consulta está cerrada.');
      if(s.messageCount + 2 > 200) fail(409,'Límite de prueba alcanzado.');
      const alert=assessIncoming(s.clinicalState,answer,null,userRef.id,at);
      if(!alert && s.clinicalState.pendingQuestions?.[0]?.customFlow)fail(409,'Termina la pregunta pendiente antes de corregir otra respuesta.');
      if(!alert && (s.clinicalState.revision||0) !== expectedRevision) fail(409,'La consulta cambió. Recarga antes de corregir.');
      const {reply,clinicalState,needsClarification}=alert || correctInterview(s.clinicalState,factKey,answer,userRef.id,at);
      clinicalState.revision=(s.clinicalState.revision||0)+1;
      tx.create(userRef,{id:userRef.id,role:'user',operation:'correction',factKey,expectedRevision,text:answer,createdAt:at,sequence:s.messageCount});
      tx.create(botRef,{id:botRef.id,role:'assistant',kind:clinicalState.phase==='safety_alert' ? 'safety_alert' : needsClarification ? 'clarification' : 'correction',nextQuestionId:clinicalState.pendingQuestions?.[0]?.id || null,text:reply,createdAt:at,sequence:s.messageCount+1});
      tx.update(ref,{clinicalState,messageCount:s.messageCount+2,updatedAt:at});
      return {reply,duplicate:false,needsClarification};
    });
  }
  async beginAdditional(id,uid,{expectedRevision,requestId}={},mode) {
    if(!['review','adaptive'].includes(mode))fail(400,'Operación no válida.');
    if(!Number.isInteger(expectedRevision)||expectedRevision<0||typeof requestId!=='string'||!/^[a-f0-9-]{36}$/.test(requestId))fail(400,'Recarga la consulta antes de continuar.');
    const ref=this.ref(id),messageRef=ref.collection('messages').doc(requestId+'-assistant'),userRef=ref.collection('messages').doc(requestId+'-user'),at=this.now();
    return this.db.runTransaction(async tx=>{
      const session=this.owned(await tx.get(ref),uid),previous=await tx.get(messageRef),userMessage=await tx.get(userRef),state=session.clinicalState;
      if(previous.exists){const p=previous.data();if(p.kind!=='additional_start'||p.mode!==mode||p.expectedRevision!==expectedRevision)fail(409,'La solicitud ya se utilizó. Recarga la consulta.');return {duplicate:true};}
      if(userMessage.exists)fail(409,'La solicitud ya se utilizó. Recarga la consulta.');
      if(session.status!=='open'||state?.phase!=='complete'||state.assessment?.type==='safety_alert')fail(409,'No se puede iniciar esta revisión en el estado actual.');
      if(!answersConfirmed(state))fail(409,'Revisa y corrige tus respuestas y confirma que son verdaderas antes de continuar.');
      if((state.revision||0)!==expectedRevision)fail(409,'La consulta cambió. Recarga antes de continuar.');
      if(session.messageCount>=200)fail(409,'Esta consulta alcanzó su límite de mensajes.');
      let pending,next={...state};
      if(mode==='review')pending=reviewQuestion(state);
      else {
        const completed=state.adaptive?.completed||[];
        if(completed.length>=2)fail(409,'Se completaron las dos rondas de aclaraciones. Puedes revisar y corregir el resumen.');
        if(session.orientation?.status!=='ready'||session.orientation.basedOnRevision!==expectedRevision)fail(409,'Primero genera una orientación con tus respuestas actuales.');
        const available=availableClarifications(state),requested=session.orientation.result.aclaraciones_sugeridas||[];
        const chosen=available.filter(q=>requested.includes(q.id)).slice(0,3);
        if(!chosen.length)fail(409,'No quedan aclaraciones disponibles para esta orientación.');
        const questions=chosen.map((q,i)=>({id:'adaptive_'+requestId+'_'+i,kind:'text',customFlow:true,target:q.id,parentKey:q.parentKey,parentSourceMessageId:state.facts.find(f=>f.key===q.parentKey)?.sourceMessageId||null,text:q.question,number:'A'+((state.additionalAnswers||[]).length+i+1)}));
        const active={id:requestId,status:'collecting',questions,index:0,startedAt:at,basedOnRevision:expectedRevision};
        next.adaptive={completed,active};pending=questions[0];
      }
      next={...next,phase:'collecting',pendingQuestions:[pending],revision:expectedRevision+1};
      tx.create(messageRef,{id:messageRef.id,role:'assistant',kind:'additional_start',mode,expectedRevision,nextQuestionId:pending.id,text:pending.text,createdAt:at,sequence:session.messageCount});
      tx.update(ref,{clinicalState:next,messageCount:session.messageCount+1,updatedAt:at});return {duplicate:false};
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
