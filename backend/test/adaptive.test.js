import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {LegacyStore as FirestoreStore} from '../test-support/legacy-store.js';
import {OrientationService,orientationContext} from '../src/orientation.js';
import {availableClarifications,safetyReviewCurrent} from '../src/adaptive.js';
import {validateOrientation} from '../src/openai-client.js';
import {FakeDB} from '../test-support/fake-db.js';
const result={fuentes_usadas:[],resumen:'Datos referidos',datos_por_aclarar:['Inicio y medicamentos'],orientacion_general:'Revisa tus respuestas.',siguiente_paso:'Solicita evaluación profesional.',preguntas_para_profesional:[],aclaraciones_sugeridas:['onset_time','medication_amount','medication_frequency']};
async function setup(){
 const db=new FakeDB(),store=new FirestoreStore(db),s=await store.create('A');
 const answers={location_detail:'No sé',location_description:'Molestia continua',remedies_use:'No',name:'Caso A',age:'33',sex:'M',weight:'70',height:'175',alarm_screen:'No',reason:'molestia en el abdomen',onset:'desde ayer',location:'parte superior del abdomen',severity:'4',associated:'ninguno',history:'ninguna',medications:'aspirina',medications_identity:'No sé',allergies:'ninguna'};
 let fresh=s;
 for(let i=0;fresh.clinicalState.pendingQuestions.length;i++){assert.ok(i<25);const q=fresh.clinicalState.pendingQuestions[0];assert.ok(q.id in answers,q.id);await store.append(s.id,'A',answers[q.id],randomUUID(),q.id);fresh=await store.get(s.id,'A');}
 const client={configured:true,promptVersion:'orientation-rag-v1',generate:async()=>({result,model:'modelo-simulado',promptVersion:'orientation-rag-v1',usage:{inputTokens:10,outputTokens:10}})};
 return {db,store,id:s.id,client,service:new OrientationService(store,client)};
}
async function review(ctx,answer='No'){
 let s=await ctx.store.get(ctx.id,'A');await ctx.store.beginAdditional(ctx.id,'A',{expectedRevision:s.clinicalState.revision,requestId:randomUUID()},'review');
 await ctx.store.append(ctx.id,'A',answer,randomUUID(),'alarm_recheck');return ctx.store.get(ctx.id,'A');
}
async function orient(ctx){const s=await review(ctx);return ctx.service.generate(ctx.id,'A',{consent:true,expectedRevision:s.clinicalState.revision});}
test('exige revalidar señales con la revisión actual; No sé no descarta alarmas',async()=>{
 const ctx=await setup(),s=await ctx.store.get(ctx.id,'A');
 await assert.rejects(ctx.service.generate(ctx.id,'A',{consent:true,expectedRevision:s.clinicalState.revision}),{status:409});
 const reviewed=await review(ctx,'No sé');assert.equal(safetyReviewCurrent(reviewed.clinicalState),true);assert.equal(reviewed.clinicalState.safety.status,'unknown');
 assert.equal(reviewed.clinicalState.safety.reviewHistory.length,1);
 await ctx.service.generate(ctx.id,'A',{consent:true,expectedRevision:reviewed.clinicalState.revision});
 await ctx.store.correct(ctx.id,'A','72',randomUUID(),'weight',reviewed.clinicalState.revision);
 assert.equal(safetyReviewCurrent((await ctx.store.get(ctx.id,'A')).clinicalState),false);
});
test('revisión de señales acepta Sí y letras a-g y bloquea el LLM',async()=>{
 for(const answer of ['Sí','a','b','c','d','e','f','g']){
 const ctx=await setup(),s=await review(ctx,answer);assert.equal(s.clinicalState.phase,'safety_alert');assert.match(s.clinicalState.assessment.reply,/911/);
 await assert.rejects(ctx.service.generate(ctx.id,'A',{consent:true,expectedRevision:s.clinicalState.revision}),{status:409});
 }
});
test('iniciar ronda es idempotente, comprueba propiedad y no acepta revisión obsoleta',async()=>{
 const ctx=await setup();await orient(ctx);const s=await ctx.store.get(ctx.id,'A'),body={expectedRevision:s.clinicalState.revision,requestId:randomUUID()};
 await assert.rejects(ctx.store.beginAdditional(ctx.id,'B',body,'adaptive'),{status:404});
 await assert.rejects(ctx.store.beginAdditional(ctx.id,'A',{...body,expectedRevision:0},'adaptive'),{status:409});
 await ctx.store.beginAdditional(ctx.id,'A',body,'adaptive');const before=await ctx.store.get(ctx.id,'A');
 assert.equal((await ctx.store.beginAdditional(ctx.id,'A',body,'adaptive')).duplicate,true);
 const after=await ctx.store.get(ctx.id,'A');assert.equal(after.messageCount,before.messageCount);assert.equal(after.clinicalState.revision,before.clinicalState.revision);
 await assert.rejects(ctx.store.beginAdditional(ctx.id,'A',body,'review'),{status:409});
});
test('aclaraciones persisten, mantienen originales y actualizan contexto sin repetir preguntas',async()=>{
 const ctx=await setup();await orient(ctx);let s=await ctx.store.get(ctx.id,'A');const original=structuredClone(s.clinicalState.facts);
 await ctx.store.beginAdditional(ctx.id,'A',{expectedRevision:s.clinicalState.revision,requestId:randomUUID()},'adaptive');
 for(const answer of ['desde ayer a las 10','No sé','diario']){
  s=await new FirestoreStore(ctx.db).get(ctx.id,'A');const q=s.clinicalState.pendingQuestions[0];
  const requestId=randomUUID();await ctx.store.append(ctx.id,'A',answer,requestId,q.id);const before=(await ctx.store.get(ctx.id,'A')).messageCount;
  await ctx.store.append(ctx.id,'A',answer,requestId,q.id);assert.equal((await ctx.store.get(ctx.id,'A')).messageCount,before);
 }
 s=await ctx.store.get(ctx.id,'A');assert.equal(s.clinicalState.phase,'complete');assert.equal(s.clinicalState.adaptive.completed.length,1);
 assert.deepEqual(s.clinicalState.facts,original);assert.equal(s.clinicalState.additionalAnswers.length,3);
 assert.equal(availableClarifications(s.clinicalState).some(q=>q.id==='medication_amount'),false);
 assert.ok(orientationContext(s).fields.find(f=>f.key==='medications').clarifications.some(d=>d.answer==='No sé'&&d.status==='unknown'));
 assert.equal(safetyReviewCurrent(s.clinicalState),false);assert.notEqual(s.orientation.basedOnRevision,s.clinicalState.revision);
 await review(ctx);await ctx.service.generate(ctx.id,'A',{consent:true,expectedRevision:(await ctx.store.get(ctx.id,'A')).clinicalState.revision});
 const fresh=await ctx.store.get(ctx.id,'A');assert.deepEqual(fresh.orientation.result.aclaraciones_sugeridas,[]);
});
test('alarma en respuesta adicional interrumpe; correcciones normales esperan aclaración',async()=>{
 const ctx=await setup();await orient(ctx);let s=await ctx.store.get(ctx.id,'A');
 await ctx.store.beginAdditional(ctx.id,'A',{expectedRevision:s.clinicalState.revision,requestId:randomUUID()},'adaptive');s=await ctx.store.get(ctx.id,'A');
 await assert.rejects(ctx.store.correct(ctx.id,'A','72',randomUUID(),'weight',s.clinicalState.revision),{status:409});
 await ctx.store.append(ctx.id,'A','No puedo respirar',randomUUID(),s.clinicalState.pendingQuestions[0].id);
 s=await ctx.store.get(ctx.id,'A');assert.equal(s.clinicalState.phase,'safety_alert');assert.equal((s.clinicalState.additionalAnswers||[]).length,0);
});
test('al corregir el dato principal, sus aclaraciones previas quedan fuera del contexto vigente',async()=>{
 const ctx=await setup();await orient(ctx);let s=await ctx.store.get(ctx.id,'A');
 await ctx.store.beginAdditional(ctx.id,'A',{expectedRevision:s.clinicalState.revision,requestId:randomUUID()},'adaptive');
 for(const answer of ['ayer a las 10','una pastilla','cada 24 horas']){s=await ctx.store.get(ctx.id,'A');await ctx.store.append(ctx.id,'A',answer,randomUUID(),s.clinicalState.pendingQuestions[0].id);}
 s=await ctx.store.get(ctx.id,'A');await ctx.store.correct(ctx.id,'A','ninguno',randomUUID(),'medications',s.clinicalState.revision);
 s=await ctx.store.get(ctx.id,'A');assert.equal(s.clinicalState.additionalAnswers.length,3);
 const meds=orientationContext(s).fields.find(f=>f.key==='medications');assert.equal(meds.answer,'ninguno');assert.equal(meds.clarifications.length,0);
 assert.ok(s.messages.some(m=>m.text==='una pastilla'));
});
test('máximo dos rondas; consultas cerradas y propuestas no permitidas no inician preguntas',async()=>{
 const ctx=await setup();
 const groups=[['onset_time','medication_amount','medication_frequency'],['onset_course','medication_since']];
 for(const group of groups){ctx.client.generate=async()=>({result:{...result,aclaraciones_sugeridas:group},model:'fake',promptVersion:'orientation-rag-v1',usage:{inputTokens:1,outputTokens:1}});await orient(ctx);let s=await ctx.store.get(ctx.id,'A');await ctx.store.beginAdditional(ctx.id,'A',{expectedRevision:s.clinicalState.revision,requestId:randomUUID()},'adaptive');
  while((s=await ctx.store.get(ctx.id,'A')).clinicalState.phase==='collecting')await ctx.store.append(ctx.id,'A','No sé',randomUUID(),s.clinicalState.pendingQuestions[0].id);
 }
 await review(ctx);let s=await ctx.store.get(ctx.id,'A');
 await assert.rejects(ctx.store.beginAdditional(ctx.id,'A',{expectedRevision:s.clinicalState.revision,requestId:randomUUID()},'adaptive'),{status:409});
 await ctx.store.close(ctx.id,'A');await assert.rejects(ctx.store.beginAdditional(ctx.id,'A',{expectedRevision:s.clinicalState.revision,requestId:randomUUID()},'review'),{status:409});
 assert.throws(()=>validateOrientation({...result,aclaraciones_sugeridas:['inventado']}),{status:502});
 assert.throws(()=>validateOrientation({...result,aclaraciones_sugeridas:['onset_time','onset_time']}),{status:502});
});
test('un mensaje de inicio no permite superar el límite al guardar un par de mensajes',async()=>{
 const ctx=await setup();let s=await ctx.store.get(ctx.id,'A');await ctx.store.beginAdditional(ctx.id,'A',{expectedRevision:s.clinicalState.revision,requestId:randomUUID()},'review');
 ctx.db.data.get('checkia_sessions/'+ctx.id).messageCount=199;
 await assert.rejects(ctx.store.append(ctx.id,'A','No',randomUUID(),'alarm_recheck'),{status:409});
});
