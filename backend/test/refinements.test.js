import test from 'node:test';
import assert from 'node:assert/strict';
import {initialInterview,advanceInterview,QUESTIONS,followupsFor} from '../src/interview-v2.js';
import {SCREEN_QUESTION} from '../src/safety.js';
const atQuestion=key=>({...initialInterview(),facts:QUESTIONS.slice(0,QUESTIONS.findIndex(q=>q.id===key)).map(q=>({key:q.id,text:'dato referido'})),pendingQuestions:[QUESTIONS.find(q=>q.id===key)]});
const step=(s,text)=>advanceInterview(s,s.pendingQuestions[0].id,text,'mensaje',123);
test('nombre opcional, contexto de sexo y antes de continuar',()=>{
 assert.match(QUESTIONS[0].text,/opcional/);assert.match(QUESTIONS.find(q=>q.id==='sex').text,/no permite deducir anatomía/);
 assert.match(SCREEN_QUESTION.text,/Antes de continuar/);
});
test('inicio con fecha sin evolución pregunta cambio y conserva respuesta original',()=>{
 const original=atQuestion('onset');let result=step(original,'desde ayer');
 assert.equal(result.clinicalState.pendingQuestions[0].id,'onset_evolution');
 const unclear=step(result.clinicalState,'ayer');assert.equal(unclear.clinicalState.pendingQuestions[0].id,'onset_evolution');
 result=step(unclear.clinicalState,'sigue igual');
 assert.equal(result.clinicalState.facts.at(-1).text,'desde ayer');
 assert.equal(result.clinicalState.facts.at(-1).clarifications[0].text,'sigue igual');
 assert.equal(original.clarificationContext,null);
 assert.deepEqual(followupsFor('onset','desde ayer y empeoró hoy','reported'),[]);
});
test('ubicación general pide zona; ubicación específica y desconocimiento no se inventan',()=>{
 let result=step(atQuestion('location'),'cabeza');assert.equal(result.clinicalState.pendingQuestions[0].id,'location_detail');
 result=step(result.clinicalState,'frente');assert.equal(result.clinicalState.facts.at(-1).text,'cabeza');assert.equal(result.clinicalState.facts.at(-1).clarifications[0].text,'frente');
 assert.deepEqual(followupsFor('location','lado derecho de la frente','reported'),[]);
 assert.deepEqual(followupsFor('location','No sé','unknown'),[]);
});
test('desde niño es antecedente separado de última reacción y queda referido',()=>{
 let s=step(atQuestion('allergies'),'salpullido').clinicalState;
 for(const text of ['cacahuate','salpullido leve','desde niño']) s=step(s,text).clinicalState;
 assert.equal(s.pendingQuestions[0].id,'allergies_when');
 assert.equal(s.clarificationContext.draft.clarifications.at(-1).key,'allergies_since');
 assert.equal(s.clarificationContext.draft.clarifications.at(-1).text,'desde niño');
 s=step(s,'No sé').clinicalState;assert.equal(s.phase,'complete');assert.equal(s.facts.at(-1).clarifications.length,4);
 assert.equal(s.facts.at(-1).clarifications.at(-1).status,'unknown');assert.equal(s.assessment,null);
});
