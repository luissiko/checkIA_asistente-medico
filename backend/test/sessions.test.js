import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { FirestoreStore as CurrentStore } from '../src/firestore-store.js';
test('paso 13: aclaración persiste e idempotencia no duplica eventos; respuesta final separada',async()=>{
 const db=new FakeDB(),store=new FirestoreStore(db),s=await store.create('A');
 await store.append(s.id,'A','No',randomUUID(),'alarm_screen');
 const requestId=randomUUID();
 await store.append(s.id,'A','NO',requestId,'reason');
 await store.append(s.id,'A','NO',requestId,'reason');
 const recovered=await new FirestoreStore(db).get(s.id,'A');
 assert.equal(recovered.clinicalState.qualityEvents.length,1);
 assert.equal(recovered.clinicalState.facts.length,0);
 assert.equal(recovered.clinicalState.pendingQuestions[0].id,'reason');
 assert.equal(recovered.messages.at(-1).nextQuestionId,'reason');
 await store.append(s.id,'A','dolor de cabeza',randomUUID(),'reason');
 const corrected=await store.get(s.id,'A');
 assert.equal(corrected.clinicalState.facts[0].text,'dolor de cabeza');
 assert.equal(corrected.clinicalState.qualityEvents[0].text,'NO');
 await assert.rejects(store.get(s.id,'B'),{status:404});
});
import {initialInterview as initialLegacy} from '../src/legacy-interview.js';
// Estos casos prueban sesiones v1 mediante el adaptador actual y su despacho compatible.
class FirestoreStore extends CurrentStore {
  async create(uid) { const s=await super.create(uid);s.clinicalState=initialLegacy();this.db.data.set('checkia_sessions/'+s.id,structuredClone(s));return s; }
}
// Sustituto en memoria para probar lógica; no reproduce locks ni índices de Firestore.
import {FakeDB} from '../test-support/fake-db.js';
// Estos casos conservan fixtures de consultas creadas antes de la comprobación inicial.
async function createLegacy(store,uid) {
  const s=await store.create(uid);
  const stored=store.db.data.get('checkia_sessions/'+s.id);
  stored.clinicalState.pendingQuestions=[{id:'reason',kind:'text',text:'Motivo de consulta'}];
  delete stored.clinicalState.safety;stored.clinicalState.validationVersion=3;
  return {...structuredClone(stored),messages:[]};
}
test('propiedad, persistencia del adaptador, orden, idempotencia, cierre y borrado', async () => {
  const db = new FakeDB(), store = new FirestoreStore(db), a = await createLegacy(store,'A'), b = await createLegacy(store,'B');
  await assert.rejects(store.get(a.id,'B'), { status:404 });
  await assert.rejects(store.append(a.id,'B','ficticio',randomUUID()), { status:404 });
  await assert.rejects(store.close(a.id,'B'), { status:404 });
  await assert.rejects(store.delete(a.id,'B'), { status:404 });
  const rid = randomUUID(); await store.append(a.id,'A','texto ficticio',rid,'reason');
  assert.equal((await store.append(a.id,'A','texto ficticio',rid,'reason')).duplicate,true);
  const recovered = await new FirestoreStore(db).get(a.id,'A');
  assert.equal(recovered.messages.length,2); assert.equal(recovered.messages[0].role,'user');
  assert.equal(recovered.messageCount,2); assert.equal(recovered.clinicalState.assessment,null);
  assert.equal((await store.list('B'))[0].id,b.id);
  await store.close(a.id,'A'); await assert.rejects(store.append(a.id,'A','otro',randomUUID(),'age'),{status:409});
  await store.delete(a.id,'A'); await assert.rejects(store.get(a.id,'A'),{status:404});
  assert.equal([...db.data.keys()].filter(k=>k.includes(a.id)).length,0);
});
test('expiración impide acceso y permite borrar; requestId inválido', async () => {
  let now = 0; const store = new FirestoreStore(new FakeDB(), { now:()=>now,ttlMs:10 });
  const s = await createLegacy(store,'A');
  await assert.rejects(store.append(s.id,'A','texto','invalid'), {status:400});
  now=10; await assert.rejects(store.get(s.id,'A'), {status:410}); await store.delete(s.id,'A');
});

test('entrevista completa, validación atómica, pregunta obsoleta y recuperación', async () => {
  const db = new FakeDB(), store = new FirestoreStore(db), session = await createLegacy(store,'A');
  const id = session.id;
  assert.equal(session.clinicalState.pendingQuestions[0].id,'reason');
  const request = randomUUID();
  const first = await store.append(id,'A','Caso ficticio: molestia',request,'reason');
  assert.equal((await store.append(id,'A','Caso ficticio: molestia',request,'reason')).reply,first.reply);
  await assert.rejects(store.append(id,'A','Texto diferente',request,'reason'),{status:409});
  await assert.rejects(store.append(id,'A','25',randomUUID(),'reason'),{status:409});
  await assert.rejects(store.append(id,'A','veinticinco',randomUUID(),'age'),{status:400});
  assert.equal((await store.get(id,'A')).messageCount,2);
  assert.equal((await store.get(id,'A')).clinicalState.facts.length,1);
  await new FirestoreStore(db).append(id,'A','25',randomUUID(),'age');
  for (const [key,text] of [['onset','Hace dos días'],['location','No aplica']]) await store.append(id,'A',text,randomUUID(),key);
  await assert.rejects(store.append(id,'A','11',randomUUID(),'severity'),{status:400});
  for (const [key,text] of [['severity','No sé'],['associated','Prefiero no responder'],['history','Ninguno referido'],['medications','Ninguno referido'],['allergies','No sé']]) await store.append(id,'A',text,randomUUID(),key);
  const result = await new FirestoreStore(db).get(id,'A');
  assert.equal(result.clinicalState.phase,'complete');
  assert.equal(result.clinicalState.pendingQuestions.length,0);
  assert.equal(result.clinicalState.facts.length,9);
  assert.equal(result.clinicalState.facts[4].status,'unknown');
  assert.equal(result.clinicalState.facts[5].status,'declined');
  assert.equal(result.clinicalState.assessment,null);
  assert.equal(result.messageCount,18);
  assert.deepEqual(result.messages.map(m=>m.sequence),Array.from({length:18},(_,i)=>i));
  for(const fact of result.clinicalState.facts) assert.equal(result.messages.find(m=>m.id===fact.sourceMessageId).text,fact.text);
  await assert.rejects(store.append(id,'A','Otra respuesta',randomUUID(),'allergies'),{status:409});
});
test('sesiones anteriores conservan lectura sin reinterpretar sus mensajes', async () => {
  const db = new FakeDB(), store = new FirestoreStore(db), session = await createLegacy(store,'A');
  db.data.get('checkia_sessions/'+session.id).clinicalState = {schemaVersion:1,facts:[],pendingQuestions:[],assessment:null};
  assert.equal((await store.get(session.id,'A')).clinicalState.schemaVersion,1);
  await assert.rejects(store.append(session.id,'A','Hola',randomUUID(),'reason'),{status:409});
  await store.close(session.id,'A');await store.delete(session.id,'A');
});

test('saludo solicita aclaración sin registrar motivo; reintento y recuperación', async () => {
  const db = new FakeDB(), store = new FirestoreStore(db), session = await createLegacy(store,'A');
  const id=session.id, rid=randomUUID();
  const result=await store.append(id,'A','¡Hola, qué tal! 👋',rid,'reason');
  assert.equal(result.needsClarification,true);
  const duplicate=await store.append(id,'A','¡Hola, qué tal! 👋',rid,'reason');
  assert.equal(duplicate.duplicate,true);assert.equal(duplicate.needsClarification,true);assert.equal(duplicate.reply,result.reply);
  const recovered=await new FirestoreStore(db).get(id,'A');
  assert.equal(recovered.messageCount,2);
  assert.equal(recovered.messages[0].text,'¡Hola, qué tal! 👋');
  assert.equal(recovered.messages[1].kind,'clarification');
  assert.equal(recovered.clinicalState.facts.length,0);
  assert.equal(recovered.clinicalState.pendingQuestions[0].id,'reason');
  assert.equal(recovered.clinicalState.validationVersion,5);
  await store.append(id,'A','Hola, me duele el abdomen',randomUUID(),'reason');
  const updated=await store.get(id,'A');
  assert.equal(updated.messageCount,4);assert.equal(updated.clinicalState.facts.length,1);
  assert.equal(updated.clinicalState.facts[0].text,'Hola, me duele el abdomen');
  assert.equal(updated.clinicalState.pendingQuestions[0].id,'age');
  assert.equal(updated.messages[3].kind,'question_or_completion');
});
async function answerPending(store,id,text) {
  const s=await store.get(id,'A');
  return store.append(id,'A',text,randomUUID(),s.clinicalState.pendingQuestions[0].id);
}
async function basicTo(store,id,target) {
  const answers={alarm_screen:'No',reason:'Caso ficticio: dolor',age:'34',onset:'desde ayer',location:'abdomen',severity:'6',associated:'No sé',history:'No sé',medications:'Ninguno referido',allergies:'Ninguna'};
  while((await store.get(id,'A')).clinicalState.pendingQuestions[0]?.id!==target) {
    const pending=(await store.get(id,'A')).clinicalState.pendingQuestions[0];
    if(!pending) break;
    assert.ok(answers[pending.id],pending.id);await answerPending(store,id,answers[pending.id]);
  }
}
test('inicio ambiguo pide fecha, persiste borrador y registra desconocimiento',async()=>{
  const db=new FakeDB(),store=new FirestoreStore(db),s=await createLegacy(store,'A');
  await basicTo(store,s.id,'onset');await answerPending(store,s.id,'solo persiste');
  const pending=await new FirestoreStore(db).get(s.id,'A');
  assert.equal(pending.clinicalState.facts.length,2);assert.equal(pending.clinicalState.pendingQuestions[0].id,'onset_when');
  assert.equal(pending.clinicalState.clarificationContext.draft.text,'solo persiste');
  await assert.rejects(store.append(s.id,'A','ayer',randomUUID(),'onset'),{status:409});
  await answerPending(new FirestoreStore(db),s.id,'No sé');
  const done=await store.get(s.id,'A');assert.equal(done.clinicalState.pendingQuestions[0].id,'location');
  assert.equal(done.clinicalState.facts[2].text,'solo persiste');assert.equal(done.clinicalState.facts[2].clarifications[0].status,'unknown');
});
test('medicamentos y alergias se desglosan sin completar datos desconocidos',async()=>{
  const store=new FirestoreStore(new FakeDB()),s=await createLegacy(store,'A');await basicTo(store,s.id,'medications');
  await answerPending(store,s.id,'paracetamol a diario');
  assert.equal((await store.get(s.id,'A')).clinicalState.pendingQuestions[0].id,'medications_formulation');
  await answerPending(store,s.id,'No sé');await answerPending(store,s.id,'Prefiero no responder');await answerPending(store,s.id,'a diario');
  let state=(await store.get(s.id,'A')).clinicalState;
  assert.equal(state.facts.length,8);assert.equal(state.facts[7].text,'paracetamol a diario');
  assert.deepEqual(state.facts[7].clarifications.map(d=>d.status),['unknown','declined','reported']);
  await answerPending(store,s.id,'salpullido');await answerPending(store,s.id,'No sé');await answerPending(store,s.id,'salpullido leve');await answerPending(store,s.id,'No recuerdo');
  state=(await store.get(s.id,'A')).clinicalState;
  assert.equal(state.phase,'complete');assert.equal(state.facts.length,9);assert.equal(state.assessment,null);
  assert.equal(state.facts[8].status,'reported');assert.equal(state.facts[8].clarifications[0].status,'unknown');
});
test('No corresponde no se convierte en ausencia confirmada de alergias',async()=>{
  const store=new FirestoreStore(new FakeDB()),s=await createLegacy(store,'A');await basicTo(store,s.id,'allergies');
  await answerPending(store,s.id,'a las zorras');await answerPending(store,s.id,'No corresponde');
  const state=(await store.get(s.id,'A')).clinicalState;
  assert.equal(state.phase,'complete');assert.equal(state.facts[8].text,'a las zorras');assert.equal(state.facts[8].status,'not_applicable');
  assert.equal(state.facts[8].clarifications.length,1);assert.equal(state.assessment,null);
});
test('corregir conserva historial, versiones y autorización; rechaza estado obsoleto',async()=>{
  const db=new FakeDB(),store=new FirestoreStore(db),s=await createLegacy(store,'A');await basicTo(store,s.id,'complete');
  const before=await store.get(s.id,'A'),revision=before.clinicalState.revision,rid=randomUUID();
  await assert.rejects(store.correct(s.id,'B','35',rid,'age',revision),{status:404});
  await assert.rejects(store.correct(s.id,'A','999',randomUUID(),'age',revision),{status:400});
  assert.equal((await store.get(s.id,'A')).messageCount,before.messageCount);
  await store.correct(s.id,'A','35',rid,'age',revision);
  assert.equal((await store.correct(s.id,'A','35',rid,'age',revision)).duplicate,true);
  const after=await new FirestoreStore(db).get(s.id,'A');
  assert.equal(after.clinicalState.facts[1].text,'35');assert.equal(after.clinicalState.facts[1].revisions[0].text,'34');
  assert.ok(after.messages.some(m=>m.text==='34' && m.role==='user'));
  assert.equal(after.messageCount,before.messageCount+2);assert.equal(after.clinicalState.phase,'complete');
  await assert.rejects(store.correct(s.id,'A','36',randomUUID(),'age',revision),{status:409});
  await store.close(s.id,'A');await assert.rejects(store.correct(s.id,'A','36',randomUUID(),'age',after.clinicalState.revision),{status:409});
});
test('corrección de medicamento reabre aclaraciones y restaura recopilación terminada',async()=>{
  const db=new FakeDB(),store=new FirestoreStore(db),s=await createLegacy(store,'A');await basicTo(store,s.id,'complete');
  const before=await store.get(s.id,'A');await store.correct(s.id,'A','paracetamol',randomUUID(),'medications',before.clinicalState.revision);
  let state=(await store.get(s.id,'A')).clinicalState;
  assert.equal(state.phase,'collecting');assert.equal(state.facts.length,9);assert.equal(state.pendingQuestions[0].id,'medications_formulation');
  await assert.rejects(store.correct(s.id,'A','40',randomUUID(),'age',state.revision),{status:409});
  await answerPending(new FirestoreStore(db),s.id,'No sé');await answerPending(store,s.id,'No sé');await answerPending(store,s.id,'No sé');
  state=(await store.get(s.id,'A')).clinicalState;
  assert.equal(state.phase,'complete');assert.equal(state.pendingQuestions.length,0);assert.equal(state.clarificationContext,null);
  assert.equal(state.facts[7].clarifications.length,3);assert.equal(state.facts[7].revisions[0].text,'Ninguno referido');
});
test('corrección durante entrevista restaura pregunta suspendida',async()=>{
  const store=new FirestoreStore(new FakeDB()),s=await createLegacy(store,'A');await basicTo(store,s.id,'location');
  const before=await store.get(s.id,'A');await store.correct(s.id,'A','solo persiste',randomUUID(),'onset',before.clinicalState.revision);
  await answerPending(store,s.id,'No sé');const state=(await store.get(s.id,'A')).clinicalState;
  assert.equal(state.pendingQuestions[0].id,'location');assert.equal(state.facts.length,3);assert.equal(state.phase,'collecting');
});
test('consulta nueva: cribado negativo no asigna nivel bajo y permite recopilar',async()=>{
  const store=new FirestoreStore(new FakeDB()),s=await store.create('A');
  assert.equal(s.clinicalState.pendingQuestions[0].id,'alarm_screen');
  await answerPending(store,s.id,'No');let state=(await store.get(s.id,'A')).clinicalState;
  assert.equal(state.facts.length,0);assert.equal(state.pendingQuestions[0].id,'reason');assert.equal(state.safety.status,'user_denied_listed_signs');assert.equal(state.assessment,null);
  await answerPending(store,s.id,'dolor de cabeza');state=(await store.get(s.id,'A')).clinicalState;
  assert.equal(state.pendingQuestions[0].id,'age');assert.equal(state.facts.length,1);
});
test('alarma interrumpe antes de validar edad, persiste y no se elimina por corrección',async()=>{
  const db=new FakeDB(),store=new FirestoreStore(db),s=await store.create('A');
  await answerPending(store,s.id,'No');await answerPending(store,s.id,'dolor de cabeza');
  const rid=randomUUID(),before=await store.get(s.id,'A');
  await store.append(s.id,'A','No puedo respirar',rid,'age');
  assert.equal((await store.append(s.id,'A','No puedo respirar',rid,'age')).duplicate,true);
  const saved=await new FirestoreStore(db).get(s.id,'A');
  assert.equal(saved.clinicalState.phase,'safety_alert');assert.equal(saved.clinicalState.facts.length,1);
  assert.equal(saved.messageCount,before.messageCount+2);assert.equal(saved.messages.at(-1).kind,'safety_alert');
  assert.equal(saved.clinicalState.assessment.reportedText,'No puedo respirar');
  await assert.rejects(store.append(s.id,'A','34',randomUUID(),'age'),{status:409});
  await assert.rejects(store.correct(s.id,'A','Otro motivo',randomUUID(),'reason',saved.clinicalState.revision),{status:409});
  await store.close(s.id,'A');const closed=await store.get(s.id,'A');assert.equal(closed.clinicalState.assessment.type,'safety_alert');
});
test('afirmación inicial y desconocimiento quedan diferenciados',async()=>{
  const store=new FirestoreStore(new FakeDB()),a=await store.create('A'),b=await store.create('A');
  await answerPending(store,a.id,'Sí');assert.equal((await store.get(a.id,'A')).clinicalState.phase,'safety_alert');
  await answerPending(store,b.id,'No sé');const state=(await store.get(b.id,'A')).clinicalState;
  assert.equal(state.safety.status,'unknown');assert.equal(state.assessment,null);assert.equal(state.pendingQuestions[0].id,'reason');
});
test('alerta en aclaración y en corrección mantiene borrador y registro anterior',async()=>{
  const store=new FirestoreStore(new FakeDB()),s=await store.create('A');await basicTo(store,s.id,'medications');
  await answerPending(store,s.id,'paracetamol');const before=await store.get(s.id,'A');
  await answerPending(store,s.id,'Estoy vomitando sangre');const alerted=await store.get(s.id,'A');
  assert.equal(alerted.clinicalState.phase,'safety_alert');assert.deepEqual(alerted.clinicalState.clarificationContext,before.clinicalState.clarificationContext);
  const c=await store.create('A');await answerPending(store,c.id,'No');await answerPending(store,c.id,'dolor de cabeza');
  const current=await store.get(c.id,'A');await store.correct(c.id,'A','Me duele el pecho ahora',randomUUID(),'reason',current.clinicalState.revision);
  const corrected=await store.get(c.id,'A');assert.equal(corrected.clinicalState.phase,'safety_alert');assert.equal(corrected.clinicalState.facts[0].text,'dolor de cabeza');
  await assert.rejects(store.get(c.id,'B'),{status:404});
});
