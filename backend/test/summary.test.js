import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {buildSummary} from '../src/summary.js';
import {LegacyStore as FirestoreStore} from '../test-support/legacy-store.js';
import {initialInterview,advanceInterview,QUESTIONS} from '../src/interview-v2.js';
import {detailIssue} from '../src/response-quality.js';
import {FakeDB} from '../test-support/fake-db.js';
import {createApp} from '../src/app.js';
const fact=(key,text,status='reported')=>({key,text,status,source:'user_report',sourceMessageId:key+'-message',clarifications:[]});
test('resumen usa hechos referidos, conserva desconocimiento y no interpreta mensajes',()=>{
 const state=initialInterview();state.facts=[fact('name','Caso A'),fact('reason','me duele el brazo'),fact('location','cabeza'),fact('associated','No sé','unknown')];
 const session={id:'id',status:'open',ownerUid:'private-owner',clinicalState:state,messages:[{text:'tengo otra enfermedad que no fue registrada como hecho'}]};
 const before=structuredClone(session),summary=buildSummary(session);
 assert.deepEqual(session,before);assert.equal(summary.warnings.length,1);assert.deepEqual(summary.warnings[0].keys,['reason','location']);
 assert.equal(summary.groups[1].fields.find(f=>f.key==='associated').status,'unknown');
 assert.equal(summary.groups[1].fields.find(f=>f.key==='history').status,'not_collected');
 assert.equal(summary.clinicalInterpretation,false);assert.equal(summary.ownerUid,undefined);
 assert.doesNotMatch(JSON.stringify(summary),/otra enfermedad que no fue registrada/);
 state.facts[2]=fact('location','brazo');assert.equal(buildSummary(session).warnings.length,0);
 state.facts[1]=fact('reason','no me duele el brazo');state.facts[2]=fact('location','cabeza');assert.equal(buildSummary(session).warnings.length,0);
});
test('borrador y datos desconocidos son provisionales, sin duplicar un hecho corregido',()=>{
 const state=initialInterview();state.facts=[fact('medications','paracetamol')];
 state.clarificationContext={draft:{...fact('medications','aspirina'),clarifications:[{key:'medications_formulation',text:'No sé',status:'unknown'}]}};
 const summary=buildSummary({id:'id',status:'open',clinicalState:state}),meds=summary.groups[1].fields.filter(f=>f.key==='medications');
 assert.equal(meds.length,1);assert.equal(meds[0].text,'aspirina');assert.equal(meds[0].provisional,true);assert.equal(meds[0].details[0].status,'unknown');
});
test('fechas aproximadas aceptan el año pasado sin confundir reacción con fecha',()=>{
 for(const text of ['el año pasado','El mes pasado','la semana pasada','en marzo','2025','hace un año']) assert.equal(detailIssue('allergies_when',text),null,text);
 assert.ok(detailIssue('allergies_when','salieron granos'));assert.ok(detailIssue('allergies_when','desde niño'));
});
test('H M X se registran como identidad referida y X recibe respuesta neutral',()=>{
 for(const [text,code] of [['H','male'],['M','female'],['X','other']]){
  const state=initialInterview();state.facts=QUESTIONS.slice(0,2).map(q=>fact(q.id,'dato'));state.pendingQuestions=[QUESTIONS[2]];
  const result=advanceInterview(state,'sex',text,'identity-message',123);
  assert.equal(result.clinicalState.facts.at(-1).codedValue,code);assert.equal(result.clinicalState.facts.at(-1).dataType,'self_reported_identity');
  assert.equal(result.clinicalState.pendingQuestions[0].id,'weight');
  if(text==='X'){assert.match(result.reply,/sin inferir anatomía/);assert.doesNotMatch(result.reply,/no existe|primaria|biología/i);}
 }
});
test('resumen se actualiza tras corregir, conserva revisión y respeta propietario',async()=>{
 const db=new FakeDB(),store=new FirestoreStore(db),s=await store.create('A');
 assert.equal(s.summary.progress.expected,15);assert.equal(s.summary.groups[0].fields[0].status,'not_collected');
 await store.append(s.id,'A','Caso A',randomUUID(),'name');await store.append(s.id,'A','33',randomUUID(),'age');
 const first=await store.get(s.id,'A');await store.correct(s.id,'A','34',randomUUID(),'age',first.clinicalState.revision);
 const fresh=await new FirestoreStore(db).get(s.id,'A');const age=fresh.summary.groups[0].fields.find(f=>f.key==='age');
 assert.equal(age.text,'34');assert.equal(age.correctionCount,1);assert.equal(fresh.summary.revision,fresh.clinicalState.revision);
 assert.equal(db.data.get('checkia_sessions/'+s.id).summary,undefined);
 await assert.rejects(store.get(s.id,'B'),{status:404});
});
test('ruta de resumen exige token y no devuelve consulta ajena',async t=>{
 const store=new FirestoreStore(new FakeDB()),s=await store.create('A');
 const server=createApp({store,verifyToken:async token=>{if(!['A','B'].includes(token))throw Error();return{uid:token};}}).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const url=`http://127.0.0.1:${server.address().port}/api/sessions/${s.id}/summary`;
 assert.equal((await fetch(url)).status,401);assert.equal((await fetch(url,{headers:{Authorization:'Bearer B'}})).status,404);
 const result=await fetch(url,{headers:{Authorization:'Bearer A'}});assert.equal(result.status,200);assert.equal((await result.json()).version,2);
});
