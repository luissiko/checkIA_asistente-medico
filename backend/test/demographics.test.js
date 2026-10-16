import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialInterview,advanceInterview,QUESTIONS} from '../src/interview-v2.js';
import {initialInterview as initialLegacy} from '../src/legacy-interview.js';
import {parseMeasurement} from '../src/demographics.js';
import {LegacyStore as FirestoreStore} from '../test-support/legacy-store.js';
import {FakeDB} from '../test-support/fake-db.js';
test('paso 14: orden completo, edad única, alarmas después de datos básicos',()=>{
 let s=initialInterview(); const visited=[];
 const answers={name:'Caso A',age:'33',sex:'Masculino',weight:'70,5 kg',height:'1,75 m',alarm_screen:'No',reason:'dolor de cabeza',onset:'desde ayer',onset_evolution:'sigue igual',location:'cabeza',location_detail:'frente',severity:'6',associated:'nose',history:'ninguno referido',medications:'ninguno',allergies:'ninguna'};
 while(s.pendingQuestions.length){
  const id=s.pendingQuestions[0].id;visited.push(id);
  assert.ok(id in answers,id);s=advanceInterview(s,id,answers[id],randomUUID(),1).clinicalState;
 }
 assert.deepEqual(visited,['name','age','sex','weight','height','alarm_screen','reason','onset','onset_evolution','location','location_detail','severity','associated','history','medications','allergies']);
 assert.equal(visited.filter(q=>q==='age').length,1);assert.equal(s.facts.length,13);assert.equal(s.phase,'complete');
 assert.equal(s.facts.find(f=>f.key==='height').text,'1,75 m');assert.equal(s.facts.find(f=>f.key==='height').measurement.value,175);
 assert.equal(s.facts.find(f=>f.key==='weight').measurement.value,70.5);assert.equal(s.assessment,null);
});
test('unidades válidas y datos inválidos no avanzan ni alteran el estado',()=>{
 for(const text of ['175','175 cm','1.75 m','1,75 metros']) assert.equal(parseMeasurement('height',text).value,175,text);
 for(const text of ['0','-70','70 lb','abc','1001']) assert.throws(()=>parseMeasurement('weight',text),{status:400},text);
 for(const text of ['1.75','0 cm','301 cm','2 pies']) assert.throws(()=>parseMeasurement('height',text),{status:400},text);
 let s=initialInterview();
 s=advanceInterview(s,'name','Caso A','a',1).clinicalState;
 assert.throws(()=>advanceInterview(s,'age','121','b',2),{status:400});assert.equal(s.pendingQuestions[0].id,'age');
 s=advanceInterview(s,'age','33','b',2).clinicalState;
 assert.throws(()=>advanceInterview(s,'sex','supuesto por nombre','c',3),{status:400});
 s=advanceInterview(s,'sex','No sé','c',3).clinicalState;
 assert.equal(s.facts.at(-1).status,'unknown');assert.equal(s.facts.at(-1).codedValue,undefined);
});
test('campos básicos desconocidos y omitidos conservan estado sin inferencias',()=>{
 let s=initialInterview();
 for(const id of ['name','age','sex','weight','height']){
  s=advanceInterview(s,id,id==='name'?'Prefiero no responder':'nose',randomUUID(),1).clinicalState;
  assert.equal(s.facts.at(-1).status,id==='name'?'declined':'unknown');assert.equal(s.facts.at(-1).measurement,undefined);
 }
 assert.equal(s.pendingQuestions[0].id,'alarm_screen');
});
test('persistencia, correcciones y alarma antes de completar los datos básicos',async()=>{
 const db=new FakeDB(),store=new FirestoreStore(db),s=await store.create('A');
 assert.equal(s.clinicalState.pendingQuestions[0].id,'name');
 for(const [id,text] of [['name','Caso A'],['age','33'],['sex','Masculino'],['weight','70'],['height','175']]) await store.append(s.id,'A',text,randomUUID(),id);
 let recovered=await new FirestoreStore(db).get(s.id,'A');
 assert.equal(recovered.clinicalState.pendingQuestions[0].id,'alarm_screen');
 await store.correct(s.id,'A','72',randomUUID(),'weight',recovered.clinicalState.revision);
 recovered=await store.get(s.id,'A');assert.equal(recovered.clinicalState.facts.find(f=>f.key==='weight').measurement.value,72);
 assert.equal(recovered.clinicalState.facts.find(f=>f.key==='weight').revisions[0].text,'70');
 assert.equal(recovered.clinicalState.pendingQuestions[0].id,'alarm_screen');
 const early=await store.create('A');await store.append(early.id,'A','No puedo respirar',randomUUID(),'name');
 const flagged=await new FirestoreStore(db).get(early.id,'A');assert.equal(flagged.clinicalState.phase,'safety_alert');
 assert.equal(flagged.clinicalState.facts.length,0);assert.equal(flagged.clinicalState.assessment.reportedText,'No puedo respirar');
 await assert.rejects(store.append(early.id,'A','Caso B',randomUUID(),'name'),{status:409});
});
test('consulta v1 mantiene el orden anterior mediante el despacho del paso 14',()=>{
 let s=initialLegacy();s=advanceInterview(s,'alarm_screen','No','a',1).clinicalState;
 assert.equal(s.pendingQuestions[0].id,'reason');s=advanceInterview(s,'reason','tos','b',2).clinicalState;
 assert.equal(s.pendingQuestions[0].id,'age');assert.equal(s.protocolId,'intake-demo-v1');
});
test('entrevista v2 completa con medicamentos y alergias conserva aclaraciones',()=>{
 let s=initialInterview();
 const answers={name:'Caso A',age:'33',sex:'Prefiero no responder',weight:'No sé',height:'No sé',alarm_screen:'No',reason:'dolor de cabeza',onset:'solo persiste',onset_when:'desde ayer',location:'cabeza',location_detail:'frente',severity:'6',associated:'nose',history:'ninguno referido',medications:'paracetamol',medications_formulation:'No sé',medications_amount:'No sé',medications_frequency:'No sé',allergies:'salpullido',allergies_substance:'No sé',allergies_reaction:'salpullido leve',allergies_since:'desde niño',allergies_when:'no recuerdo'};
 while(s.pendingQuestions.length){const id=s.pendingQuestions[0].id;assert.ok(id in answers,id);s=advanceInterview(s,id,answers[id],randomUUID(),1).clinicalState;}
 assert.equal(s.facts.length,13);assert.equal(s.phase,'complete');
 assert.equal(s.facts.find(f=>f.key==='medications').clarifications.length,3);
 assert.equal(s.facts.find(f=>f.key==='allergies').clarifications.at(-1).status,'unknown');
});
