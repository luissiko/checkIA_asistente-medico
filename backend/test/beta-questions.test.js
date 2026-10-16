import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {LegacyStore as FirestoreStore} from '../test-support/legacy-store.js';
import {initialInterview as initialV4} from '../src/direct-interview.js';
import {orientationContext} from '../src/orientation.js';
import {FakeDB} from '../test-support/fake-db.js';
import {WELCOME} from '../../frontend/src/interview-client.mjs';
const answers={name:'Luis Alejandro',age:'33',sex:'M',weight:'70',height:'175',alarm_screen:'No',reason:'dolor de cabeza',onset:'ayer',onset_when:'desde ayer',location:'cabeza',location_detail:'No sé',location_description:'Presión continua en la frente',severity:'6',associated:'No sé',history:'ninguna',medications:'No',medications_identity:'Genérico, paracetamol',remedies_use:'No',remedies_detail:'Té de manzanilla, contiene manzanilla y agua',remedies_since:'Desde ayer, por la molestia',allergies:'ninguna'};
async function setup(){const db=new FakeDB(),store=new FirestoreStore(db),s=await store.create('A');return {db,store,id:s.id};}
async function send(ctx,answer){const s=await ctx.store.get(ctx.id,'A'),q=s.clinicalState.pendingQuestions[0];await ctx.store.append(ctx.id,'A',answer,randomUUID(),q.id);return ctx.store.get(ctx.id,'A');}
async function until(ctx,target,values={}){const visited=[];let s=await ctx.store.get(ctx.id,'A');while(s.clinicalState.pendingQuestions.length&&s.clinicalState.pendingQuestions[0].id!==target){const id=s.clinicalState.pendingQuestions[0].id;assert.ok(visited.length<40,'sin bucles');assert.ok(id in {...answers,...values},id);visited.push(id);s=await send(ctx,({...answers,...values})[id]);}return {s,visited};}
test('v5: saludo cero, textos nuevos, edad única, 9.1 y 9.2 antes de intensidad',async()=>{
 const ctx=await setup();assert.match(WELCOME,/^0\./);assert.equal((await ctx.store.get(ctx.id,'A')).clinicalState.protocolId,'intake-demo-v5');
 const {s,visited}=await until(ctx,'severity');assert.equal(visited.filter(id=>id==='age').length,1);assert.deepEqual(visited.slice(-3),['location','location_detail','location_description']);
 const location=s.clinicalState.facts.find(f=>f.key==='location');assert.equal(location.clarifications.length,2);assert.equal(location.clarifications[0].status,'unknown');assert.equal(location.clarifications[1].text,answers.location_description);
 assert.equal(s.summary.groups[1].fields.find(f=>f.key==='location').details[1].label,'Descripción del dolor o afectación');assert.match(orientationContext(s).fields.find(f=>f.key==='location').clarifications[1].answer,/Presión/);
});
test('medicamentos No: remedios No, desconocidos u omitidos no confirman uso',async()=>{
 for(const value of ['No','No sé','Prefiero no responder']){
 const ctx=await setup();await until(ctx,'medications');let s=await send(ctx,'No');assert.equal(s.clinicalState.pendingQuestions[0].id,'remedies_use');s=await send(ctx,value);assert.equal(s.clinicalState.pendingQuestions[0].id,'allergies');
 const fact=s.clinicalState.facts.find(f=>f.key==='medications');assert.equal(fact.status,'none_reported');assert.equal(fact.clarifications.length,1);assert.equal(fact.clarifications[0].status,value==='No'?'none_reported':value==='No sé'?'unknown':'declined');
 }
});
test('remedios Sí: pregunta ingredientes y desde cuándo/por qué; persiste y llega al LLM',async()=>{
 const ctx=await setup();await until(ctx,'remedies_use');let s=await send(ctx,'Sí');assert.equal(s.clinicalState.pendingQuestions[0].id,'remedies_detail');
 s=await new FirestoreStore(ctx.db).get(ctx.id,'A');assert.equal(s.clinicalState.clarificationContext.draft.clarifications[0].text,'Sí');
 s=await send(ctx,answers.remedies_detail);assert.equal(s.clinicalState.pendingQuestions[0].id,'remedies_since');s=await send(ctx,answers.remedies_since);assert.equal(s.clinicalState.pendingQuestions[0].id,'allergies');
 const fact=s.clinicalState.facts.find(f=>f.key==='medications');assert.equal(fact.text,'No');assert.deepEqual(fact.clarifications.map(d=>d.key),['remedies_use','remedies_detail','remedies_since']);
 const context=orientationContext(s).fields.find(f=>f.key==='medications');assert.ok(context.clarifications.some(c=>c.answer.includes('manzanilla')));assert.ok(context.clarifications.some(c=>c.answer===answers.remedies_since));
});
test('medicamento referido: identidad sin exigir presentación/concentración anteriores',async()=>{
 for(const text of ['paracetamol','Sí']){const ctx=await setup();await until(ctx,'medications');let s=await send(ctx,text);assert.match(s.clinicalState.pendingQuestions[0].text,/principio activo/);assert.equal(s.clinicalState.pendingQuestions[0].id,'medications_identity');
 s=await send(ctx,'Genérico, paracetamol');assert.equal(s.clinicalState.pendingQuestions[0].id,'allergies');const f=s.clinicalState.facts.find(f=>f.key==='medications');assert.equal(f.clarifications[0].text,'Genérico, paracetamol');assert.equal(f.clarifications.some(c=>c.key==='remedies_use'),false);}
});
test('corregir medicamentos cambia de rama y conserva las versiones anteriores',async()=>{
 const ctx=await setup();await until(ctx,null,{remedies_use:'Sí'});let s=await ctx.store.get(ctx.id,'A');assert.equal(s.clinicalState.phase,'complete');
 await ctx.store.correct(ctx.id,'A','paracetamol',randomUUID(),'medications',s.clinicalState.revision);s=await ctx.store.get(ctx.id,'A');assert.equal(s.clinicalState.pendingQuestions[0].id,'medications_identity');
 s=await send(ctx,'No sé');assert.equal(s.clinicalState.phase,'complete');let fact=s.clinicalState.facts.find(f=>f.key==='medications');assert.equal(fact.clarifications.length,1);assert.ok(fact.revisions[0].clarifications.some(c=>c.key==='remedies_detail'));
 await ctx.store.correct(ctx.id,'A','No',randomUUID(),'medications',s.clinicalState.revision);s=await ctx.store.get(ctx.id,'A');assert.equal(s.clinicalState.pendingQuestions[0].id,'remedies_use');s=await send(ctx,'No');assert.equal(s.clinicalState.phase,'complete');assert.equal(s.clinicalState.facts.find(f=>f.key==='medications').clarifications[0].text,'No');
});
test('T y therian: aclaración neutral, sin registrar sexo ni cambiar revisión',async()=>{
 const ctx=await setup();await until(ctx,'sex');let before=await ctx.store.get(ctx.id,'A');
 for(const value of ['T','therian']){await assert.rejects(send(ctx,value),e=>e.status===400&&!/veterinario|biologia|primaria/i.test(e.message));const after=await ctx.store.get(ctx.id,'A');assert.equal(after.clinicalState.revision,before.clinicalState.revision);assert.equal(after.messageCount,before.messageCount);assert.equal(after.clinicalState.pendingQuestions[0].id,'sex');}
 const s=await send(ctx,'Prefiero no responder');assert.equal(s.clinicalState.facts.find(f=>f.key==='sex').status,'declined');assert.equal(s.clinicalState.pendingQuestions[0].id,'weight');
});
test('alarma dentro de remedios conserva ayuda roja y detiene la entrevista',async()=>{
 const ctx=await setup();await until(ctx,'remedies_use');await send(ctx,'Sí');const s=await send(ctx,'No puedo respirar');assert.equal(s.clinicalState.phase,'safety_alert');assert.match(s.clinicalState.assessment.reply,/911/);
});
test('consultas v4 conservan la rama anterior al recuperarse',async()=>{
 const ctx=await setup();ctx.db.data.get('checkia_sessions/'+ctx.id).clinicalState=initialV4();await until(ctx,'medications');const s=await send(ctx,'No');assert.equal(s.clinicalState.protocolId,'intake-demo-v4');assert.equal(s.clinicalState.pendingQuestions[0].id,'allergies');assert.equal(s.summary.supported,true);
});
test('nuevo inicio ambiguo aclara fecha y conserva la respuesta original',async()=>{
 const ctx=await setup();await until(ctx,'onset');let s=await send(ctx,'solo persiste');assert.equal(s.clinicalState.pendingQuestions[0].id,'onset_when');assert.match(s.clinicalState.pendingQuestions[0].text,/aproximado/);s=await send(ctx,'ayer');assert.equal(s.clinicalState.facts.find(f=>f.key==='onset').text,'solo persiste');assert.equal(s.clinicalState.pendingQuestions[0].id,'location');
});
