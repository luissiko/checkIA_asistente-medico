import {answersConfirmed} from './interview-v8.js';
import {RAG_VERSION,bindEvidence} from './rag.js';
import {availableClarifications,safetyReviewCurrent} from './adaptive.js';
import {randomUUID} from 'node:crypto';
import {buildSummary} from './summary.js';
import {validateOrientation} from './openai-client.js';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function orientationContext(session) {
 const summary=buildSummary(session);
 const context={availableClarifications:availableClarifications(session.clinicalState),purpose:'Preparar una evaluación profesional con información referida; no diagnóstico ni triaje.',safety:{status:summary.safety.status,screenAnswer:summary.safety.screenText},reviewNotes:summary.warnings.map(w=>w.text),fields:summary.groups.flatMap(g=>g.fields).filter(f=>f.key!=='name').map(f=>({key:f.key,label:f.label,answer:f.text,status:f.status,omitted:f.autoSkipped,measurement:f.measurement,pain:f.pain,clarifications:f.details.map(d=>({label:d.label,answer:d.text,status:d.status}))}))};
 if(JSON.stringify(context).length>32000)fail(400,'La consulta contiene demasiado texto para esta orientación. Revisa y resume tus respuestas.');
 return context;
}
export class OrientationService {
 constructor(store,client,{now=()=>Date.now(),leaseMs=90000,retriever=null}={}){this.store=store;this.client=client;this.now=now;this.leaseMs=leaseMs;this.retriever=retriever;}
 async generate(id,uid,{consent,expectedRevision}={}){
  if(consent!==true)fail(400,'Confirma el envío de tus respuestas para generar la orientación.');
  if(!Number.isInteger(expectedRevision)||expectedRevision<0)fail(400,'Recarga la consulta antes de generar la orientación.');
  const ref=this.store.ref(id),token=randomUUID(),at=this.now();
  const claim=await this.store.db.runTransaction(async tx=>{
   const session=this.store.owned(await tx.get(ref),uid),state=session.clinicalState;
   if(state?.phase==='safety_alert'||state?.assessment?.type==='safety_alert')fail(409,'Esta consulta tiene una alerta. Busca ayuda y sigue las indicaciones de emergencia.');
   if(state?.phase!=='complete')fail(409,'Termina la entrevista antes de generar la orientación.');
   if((state.revision||0)!==expectedRevision)fail(409,'Tus respuestas cambiaron. Recarga la consulta y revísalas.');
   if(!answersConfirmed(state))fail(409,'Revisa y corrige tus respuestas y confirma que son verdaderas antes de generar orientación.');
   if(this.retriever)this.retriever.ensureReady();
   if(session.orientation?.status==='ready'&&session.orientation.basedOnRevision===expectedRevision&&session.orientation.promptVersion===(this.client?.promptVersion||'orientation-rag-v1')&&session.orientation.retrievalVersion===(this.retriever?.version||'disabled'))return {cached:session.orientation};
   if(!safetyReviewCurrent(state))fail(409,'Antes de generar la orientación, comprueba nuevamente las señales actuales.');
   if(session.status!=='open')fail(409,'La consulta está cerrada. Puedes revisar la orientación guardada.');
   if(!this.client?.configured)fail(503,'La orientación no está disponible en este momento. Puedes seguir consultando tu resumen.');
   if(session.orientationRun?.status==='pending'&&session.orientationRun.expiresAt>at)fail(409,'Tu orientación se está preparando. Espera y recarga la consulta.');
   if((session.orientationAttempts||0)>=5)fail(429,'Esta consulta alcanzó el límite de solicitudes de orientación.');
   if(session.orientationRun?.status==='failed'&&at-session.orientationRun.updatedAt<15000)fail(429,'Espera unos segundos antes de intentarlo nuevamente.');
   const context=orientationContext(session);
   tx.update(ref,{orientationAttempts:(session.orientationAttempts||0)+1,orientationRun:{status:'pending',token,basedOnRevision:expectedRevision,expiresAt:at+this.leaseMs,updatedAt:at},orientationConsent:{provider:'OpenAI',version:'22.2',acceptedAt:at,basedOnRevision:expectedRevision}});
   return {context};
  });
  if(claim.cached)return {orientation:claim.cached,cached:true};
  try {
   const evidence=this.retriever?await this.retriever.retrieve(claim.context):{version:RAG_VERSION,status:'insufficient_evidence',retrieved:[],sources:[],usage:{inputTokens:0}};
   // La consulta puede cambiar mientras responde el servicio de embeddings.
   const fresh=await this.store.get(id,uid);
   if(fresh.status!=='open'||fresh.clinicalState?.phase!=='complete'||fresh.clinicalState.revision!==expectedRevision||fresh.clinicalState.assessment?.type==='safety_alert')fail(409,'Tus respuestas cambiaron durante la búsqueda. Revisa el resumen antes de generar la orientación.');
   const context={...claim.context,evidence:{status:evidence.status,retrieved:evidence.retrieved.map(c=>({id:c.id,title:c.title,section:c.section,text:c.text,checkedAt:c.checkedAt}))}};
   const generated=await this.client.generate(context);
   const validated=validateOrientation(generated.result);
   const allowed=new Set(claim.context.availableClarifications.map(q=>q.id));
   const {result,rag}=bindEvidence({...validated,aclaraciones_sugeridas:validated.aclaraciones_sugeridas.filter(id=>allowed.has(id))},evidence);
   const orientation={status:'ready',retrievalVersion:this.retriever?.version||'disabled',rag,basedOnRevision:expectedRevision,createdAt:this.now(),provider:'OpenAI',model:generated.model,promptVersion:generated.promptVersion,result,usage:generated.usage,clinicallyValidated:false};
   await this.store.db.runTransaction(async tx=>{
    const session=this.store.owned(await tx.get(ref),uid),state=session.clinicalState;
    if(session.orientationRun?.token!==token)fail(409,'La solicitud cambió. Recarga la consulta.');
    if(session.status!=='open'||state?.phase!=='complete'||(state.revision||0)!==expectedRevision||state.assessment?.type==='safety_alert')fail(409,'Tus respuestas cambiaron durante la generación. Revisa el resumen antes de intentarlo nuevamente.');
    tx.update(ref,{orientation,orientationRun:{status:'ready',token,basedOnRevision:expectedRevision,updatedAt:this.now()},updatedAt:this.now()});
   });
   return {orientation,cached:false};
  } catch(error) {
   try{await this.store.db.runTransaction(async tx=>{const snap=await tx.get(ref);if(snap.exists&&snap.data().orientationRun?.token===token)tx.update(ref,{orientationRun:{status:'failed',token,basedOnRevision:expectedRevision,updatedAt:this.now()}});});}catch{}
   throw error;
  }
 }
}
