import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {FirestoreStore as CurrentStore} from '../src/firestore-store.js';
import {initialInterview as v4Initial} from '../src/direct-interview.js';
class FirestoreStore extends CurrentStore {async create(uid){const s=await super.create(uid);s.clinicalState=v4Initial();this.db.data.set('checkia_sessions/'+s.id,structuredClone(s));return s;}}
import {FakeDB} from '../test-support/fake-db.js';
import {initialInterview as oldInitial} from '../src/interview-v3.js';
import {directMeasurement} from '../src/direct-input-v4.js';
const inputs={name:'Luis Alejandro',age:'33',sex:'m',weight:'70',height:'175',alarm_screen:'No',reason:'dolor de cabeza',onset:'ayer',location:'frente derecha',severity:'6',associated:'ninguno',history:'ninguna',medications:'ninguno',allergies:'no'};
async function until(store,s,id,values={}) {
 let state=(await store.get(s.id,'A')).clinicalState;
 for(let n=0;state.pendingQuestions.length&&state.pendingQuestions[0].id!==id;n++) {
  assert.ok(n<30,'flujo sin bucles');const q=state.pendingQuestions[0];
  assert.ok(q.id in {...inputs,...values},q.id);
  await store.append(s.id,'A',({...inputs,...values})[q.id],randomUUID(),q.id);
  state=(await store.get(s.id,'A')).clinicalState;
 }
 return state;
}
test('peso solo número, altura solo número en cm y validación atómica',async()=>{
 for(const text of ['175','175,5'])assert.equal(directMeasurement('height',text).unit,'cm');
 for(const text of ['1.75','175 cm','1,75 m'])assert.throws(()=>directMeasurement('height',text),{status:400});
 assert.throws(()=>directMeasurement('weight','70 kg'),{status:400});
 const store=new FirestoreStore(new FakeDB()),s=await store.create('A');
 const state=await until(store,s,'height');assert.match(state.pendingQuestions[0].text,/Luis Alejandro/);
 const before=await store.get(s.id,'A');
 await assert.rejects(store.append(s.id,'A','1.75',randomUUID(),'height'),{status:400});
 const after=await store.get(s.id,'A');assert.equal(after.messageCount,before.messageCount);assert.equal(after.clinicalState.revision,before.clinicalState.revision);
});
test('13 sí activa únicamente 13.1 y no repetir detalles; no salta a alergias',async()=>{
 for(const text of ['sí','paracetamol','paracetamol tableta 500 mg, una diaria desde ayer']) {
 const store=new FirestoreStore(new FakeDB()),s=await store.create('A');await until(store,s,'medications');
 await store.append(s.id,'A',text,randomUUID(),'medications');
 assert.equal((await store.get(s.id,'A')).clinicalState.pendingQuestions[0].id,'medications_formulation');
 await store.append(s.id,'A','No sé',randomUUID(),'medications_formulation');
 assert.equal((await store.get(s.id,'A')).clinicalState.pendingQuestions[0].id,'allergies');
 }
});
test('sin medicamentos ni alergias termina formulario conservando consulta e historial',async()=>{
 const store=new FirestoreStore(new FakeDB()),s=await store.create('A');
 await until(store,s,'medications');await store.append(s.id,'A','no',randomUUID(),'medications');
 assert.equal((await store.get(s.id,'A')).clinicalState.pendingQuestions[0].id,'allergies');
 await store.append(s.id,'A','no soy alérgico a nada',randomUUID(),'allergies');
 const fresh=await store.get(s.id,'A');assert.equal(fresh.clinicalState.phase,'complete');assert.equal(fresh.status,'open');
 assert.equal(fresh.summary.supported,true);assert.equal(fresh.summary.progress.autoSkipped,2);assert.equal(fresh.summary.progress.expected,15);
 assert.ok(fresh.messages.some(m=>m.text==='no soy alérgico a nada'));
 await store.correct(s.id,'A','cacahuate',randomUUID(),'allergies',fresh.clinicalState.revision);
 assert.equal((await store.get(s.id,'A')).clinicalState.pendingQuestions[0].id,'allergy_reaction');
});
test('alergia sí o identificada pregunta reacción y última vez, conservando año pasado',async()=>{
 for(const text of ['sí','cacahuate','salpullido']) {
 const store=new FirestoreStore(new FakeDB()),s=await store.create('A');await until(store,s,'allergies');
 await store.append(s.id,'A',text,randomUUID(),'allergies');
 assert.equal((await store.get(s.id,'A')).clinicalState.pendingQuestions[0].id,'allergy_reaction');
 await store.append(s.id,'A','ronchas; no tomo nada',randomUUID(),'allergy_reaction');
 assert.equal((await store.get(s.id,'A')).clinicalState.pendingQuestions[0].id,'allergy_timing');
 await store.append(s.id,'A','desde niño; la última vez fue el año pasado',randomUUID(),'allergy_timing');
 assert.equal((await store.get(s.id,'A')).clinicalState.phase,'complete');
 }
});
test('sí y letras a-g detienen formulario y conservan alerta al recargar',async()=>{
 for(const answer of ['Sí','a','b','c','d','e','f','g']){
 const db=new FakeDB(),store=new FirestoreStore(db),s=await store.create('A');await until(store,s,'alarm_screen');
 await store.append(s.id,'A',answer,randomUUID(),'alarm_screen');
 const fresh=await new FirestoreStore(db).get(s.id,'A');assert.equal(fresh.clinicalState.phase,'safety_alert');
 assert.match(fresh.clinicalState.assessment.reply,/911/);assert.equal(fresh.clinicalState.assessment.clinicallyValidated,false);
 }
});
test('sesión v3 guardada mantiene unidades anteriores y aclaraciones originales',async()=>{
 const db=new FakeDB(),store=new FirestoreStore(db),s=await store.create('A');
 db.data.get('checkia_sessions/'+s.id).clinicalState=oldInitial();
 for(const [id,answer] of [['name','Caso A'],['age','33'],['sex','m'],['weight','70 kg'],['height','1.75 m']])await store.append(s.id,'A',answer,randomUUID(),id);
 const fresh=await store.get(s.id,'A');assert.equal(fresh.clinicalState.protocolId,'intake-demo-v3');
 assert.equal(fresh.clinicalState.facts.find(f=>f.key==='height').measurement.value,175);
 assert.equal(fresh.summary.supported,true);
});

test('12 Sí pide 12.1, persiste aclaración y sigue a medicamentos al responder',async()=>{
 const db=new FakeDB(),store=new FirestoreStore(db),s=await store.create('A');await until(store,s,'history');
 await store.append(s.id,'A','Sí',randomUUID(),'history');
 let fresh=await new FirestoreStore(db).get(s.id,'A');assert.equal(fresh.clinicalState.pendingQuestions[0].id,'history_detail');
 await store.append(s.id,'A','sí',randomUUID(),'history_detail');
 fresh=await store.get(s.id,'A');assert.equal(fresh.clinicalState.pendingQuestions[0].id,'history_detail');
 await store.append(s.id,'A','asma en la infancia',randomUUID(),'history_detail');
 fresh=await store.get(s.id,'A');assert.equal(fresh.clinicalState.pendingQuestions[0].id,'medications');
 assert.equal(fresh.clinicalState.facts.find(f=>f.key==='history').clarifications[0].text,'asma en la infancia');
 assert.equal(fresh.summary.groups[1].fields.find(f=>f.key==='history').details[0].label,'Enfermedad o dolor anterior');
});

test('12 No o enfermedad identificada continúa sin repetir 12.1',async()=>{
 for(const answer of ['No','ninguna','asma','No sé']){
 const store=new FirestoreStore(new FakeDB()),s=await store.create('A');await until(store,s,'history');
 await store.append(s.id,'A',answer,randomUUID(),'history');
 assert.equal((await store.get(s.id,'A')).clinicalState.pendingQuestions[0].id,'medications');
 }
});
