import {randomUUID} from 'node:crypto';
import {FirestoreStore,fail} from '../src/firestore-store.js';
import {advance,addExtraInformation} from './engine.mjs';
import {isPaso23,initialIntegrated,clinicalState,correctedIntegrated,jsonSafe} from './integrated-protocol.mjs';
const uuid=x=>typeof x==='string'&&/^[a-f0-9-]{36}$/.test(x);
const bounded=x=>{const clean=jsonSafe(x);if(Buffer.byteLength(JSON.stringify(clean))>850000)fail(400,'La consulta contiene demasiado texto. Exporta la información y crea otra prueba.');return clean;};
export class IntegratedStore extends FirestoreStore{
 async create(uid){
  const id=randomUUID(),now=this.now();const s={id,ownerUid:uid,createdAt:now,updatedAt:now,expiresAt:now+this.ttlMs,status:'open',messageCount:0,clinicalState:initialIntegrated()};
  await this.ref(id).create(s);return this.get(id,uid);
 }
 async append(id,uid,message,requestId,questionId){
  const session=await this.get(id,uid);
  if(!isPaso23(session.clinicalState))return super.append(id,uid,message,requestId,questionId);
  return this.mutate(id,uid,{requestId,text:message,operation:'answer',questionId},s=>clinicalState(advance(s.clinicalState.paso23,questionId,message)));
 }
 async correct(id,uid,answer,requestId,factKey,expectedRevision){
  const session=await this.get(id,uid);
  if(!isPaso23(session.clinicalState))return super.correct(id,uid,answer,requestId,factKey,expectedRevision);
  return this.mutate(id,uid,{requestId,text:answer,operation:'correction',factKey,expectedRevision},s=>correctedIntegrated(s.clinicalState,factKey,answer,s.orientation??null));
 }
 async addExtra(id,uid,{text,requestId,expectedRevision}={}){
  return this.mutate(id,uid,{text,requestId,expectedRevision,operation:'extra'},s=>{
   const raw=structuredClone(s.clinicalState.paso23);
   if(s.orientation?.status==='ready'&&s.orientation.basedOnRevision===s.clinicalState.revision)raw.orientation=s.orientation;
   return clinicalState(addExtraInformation(raw,text));
  });
 }
 async mutate(id,uid,op,update){
  if(!uuid(op.requestId))fail(400,'requestId debe ser un UUID.');
  if(typeof op.text!=='string'||!op.text.trim()||op.text.length>4000)fail(400,'Escribe una respuesta de 1 a 4000 caracteres.');
  if(op.operation!=='answer'&&(!Number.isInteger(op.expectedRevision)||op.expectedRevision<0))fail(400,'Recarga la consulta antes de continuar.');
  const ref=this.ref(id),userRef=ref.collection('messages').doc(op.requestId+'-user'),botRef=ref.collection('messages').doc(op.requestId+'-assistant');
  return this.db.runTransaction(async tx=>{
   const s=this.owned(await tx.get(ref),uid),prior=await tx.get(userRef),previousBot=await tx.get(botRef);
   if(prior.exists){const p=prior.data();if(['operation','text','questionId','factKey','expectedRevision'].some(k=>p[k]!==op[k]))fail(409,'La solicitud ya se usó para otra respuesta.');if(!previousBot.exists)fail(409,'Respuesta incompleta. Recarga la consulta.');return{duplicate:true,reply:previousBot.data().text};}
   if(previousBot.exists)fail(409,'La solicitud ya se utilizó.');
   if(!isPaso23(s.clinicalState))fail(409,'Esta consulta utiliza el formulario anterior. Crea una nueva para usar estas preguntas.');
   if(s.status!=='open')fail(409,'La consulta está cerrada.');
   if(s.messageCount+2>200)fail(409,'Límite de mensajes de prueba alcanzado. Crea otra consulta.');
   if(op.operation!=='answer'&&s.clinicalState.revision!==op.expectedRevision)fail(409,'La consulta cambió. Recarga antes de continuar.');
   const state=bounded(update(s)),at=this.now();
   const reply=state.pendingQuestions[0]?.text??(state.emergency?'Solicita ayuda de emergencia sin esperar la respuesta de IA.':'Respuestas guardadas.');
   tx.create(userRef,jsonSafe({id:userRef.id,role:'user',...op,createdAt:at,sequence:s.messageCount}));
   tx.create(botRef,{id:botRef.id,role:'assistant',text:reply,kind:state.paso23.inputNotice?'clarification':'question_or_completion',nextQuestionId:state.pendingQuestions[0]?.id??null,createdAt:at,sequence:s.messageCount+1});
   tx.update(ref,{clinicalState:state,messageCount:s.messageCount+2,updatedAt:at});
   return{duplicate:false,reply,needsClarification:Boolean(state.paso23.inputNotice)};
  });
 }
}
