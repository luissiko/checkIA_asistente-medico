import {randomUUID} from 'node:crypto';
import {OrientationService} from '../src/orientation.js';
import {validateOrientation} from '../src/openai-client.js';
import {bindEvidence} from '../src/rag.js';
import {contextFor,canGenerate} from './engine.mjs';
import {isPaso23,jsonSafe} from './integrated-protocol.mjs';
import {retrieveForPaso23} from './local-retrieval.mjs';
import {fail} from '../src/firestore-store.js';
export class IntegratedOrientationService{
 constructor(store,client,{retriever,legacyClient=client,now=()=>Date.now()}={}){Object.assign(this,{store,client,retriever,now});this.legacy=new OrientationService(store,legacyClient,{retriever,now});}
 async generate(id,uid,{consent,expectedRevision}={}){
  const existing=await this.store.get(id,uid);
  if(!isPaso23(existing.clinicalState))return this.legacy.generate(id,uid,{consent,expectedRevision});
  if(consent!==true)fail(400,'Confirma el envío de tus respuestas para generar la orientación.');
  if(!Number.isInteger(expectedRevision)||expectedRevision<0)fail(400,'Recarga antes de generar la orientación.');
  const ref=this.store.ref(id),token=randomUUID();
  const claim=await this.store.db.runTransaction(async tx=>{
   const s=this.store.owned(await tx.get(ref),uid);
   if(s.status!=='open'||!canGenerate(s.clinicalState.paso23))fail(409,'Completa y confirma el formulario o la ruta especial de emergencia.');
   if(s.clinicalState.revision!==expectedRevision)fail(409,'Tus respuestas cambiaron. Recarga la consulta.');
   if(!this.client?.configured)fail(503,'La orientación no está disponible en este momento. Puedes seguir consultando tu resumen.');
   this.retriever?.ensureReady?.();if(!this.retriever?.status.ready)fail(503,'La base de información necesita preparación o revisión. Tu entrevista y resumen siguen disponibles.');
   if(s.orientation?.status==='ready'&&s.orientation.basedOnRevision===expectedRevision&&s.orientation.promptVersion===this.client.promptVersion&&s.orientation.retrievalVersion===this.retriever.version)return{cached:s.orientation};
   if(s.orientationRun?.status==='pending'&&s.orientationRun.expiresAt>this.now())fail(409,'Tu orientación se está preparando. Espera y recarga la consulta.');
   if((s.orientationAttempts??0)>=12)fail(429,'Esta consulta alcanzó el límite de solicitudes de orientación.');
   const context=contextFor(s.clinicalState.paso23);if(JSON.stringify(context).length>64000)fail(400,'La consulta contiene demasiado texto para esta orientación. Revisa y resume tus respuestas.');
   tx.update(ref,{orientationAttempts:(s.orientationAttempts??0)+1,orientationRun:{status:'pending',token,basedOnRevision:expectedRevision,expiresAt:this.now()+120000,updatedAt:this.now()},orientationConsent:{provider:'OpenAI',version:'paso23-local',acceptedAt:this.now(),basedOnRevision:expectedRevision}});
   return{context};
  });
  if(claim.cached)return{orientation:claim.cached,cached:true};
  const current=s=>s.status==='open'&&s.clinicalState.revision===expectedRevision&&Boolean(canGenerate(s.clinicalState.paso23));
  try{
   const evidence=await retrieveForPaso23(this.retriever,claim.context);
   if(!current(await this.store.get(id,uid)))fail(409,'Tus respuestas cambiaron durante la búsqueda. Recarga la consulta.');
   const generated=await this.client.generate({...claim.context,evidence:{status:evidence.status,retrieved:evidence.retrieved.map(c=>({id:c.id,title:c.title,section:c.section,text:c.text,checkedAt:c.checkedAt}))}});
   const checked=validateOrientation(generated.result),bound=bindEvidence({...checked,aclaraciones_sugeridas:[]},evidence);
   const orientation=jsonSafe({...bound,status:'ready',basedOnRevision:expectedRevision,createdAt:this.now(),provider:'OpenAI',model:generated.model,promptVersion:generated.promptVersion,usage:generated.usage,retrievalVersion:this.retriever.version,clinicallyValidated:false});
   await this.store.db.runTransaction(async tx=>{const s=this.store.owned(await tx.get(ref),uid);if(!current(s)||s.orientationRun?.token!==token)fail(409,'Tus respuestas cambiaron durante la generación. Recarga la consulta.');tx.update(ref,{orientation,orientationRun:{status:'ready',token,basedOnRevision:expectedRevision,updatedAt:this.now()},updatedAt:this.now()});});
   return{orientation,cached:false};
  }catch(e){try{await this.store.db.runTransaction(async tx=>{const snapshot=await tx.get(ref);if(snapshot.exists&&snapshot.data().orientationRun?.token===token)tx.update(ref,{orientationRun:{status:'failed',token,updatedAt:this.now()}});});}catch{}throw e;}
 }
}
