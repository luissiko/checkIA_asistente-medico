import test from 'node:test';
import assert from 'node:assert/strict';
import {answerStatus,reasonIssue,detailIssue} from '../src/response-quality.js';
import {initialInterview,advanceInterview,correctInterview,QUESTIONS} from '../src/legacy-interview.js';
const atQuestion = key => ({...initialInterview(),facts:QUESTIONS.slice(0,QUESTIONS.findIndex(q=>q.id===key)).map(q=>({key:q.id,text:'dato referido'})),pendingQuestions:[QUESTIONS.find(q=>q.id===key)]});
const step = (s,text) => advanceInterview(s,s.pendingQuestions[0].id,text,'message-id',123);
test('desconocimiento exacto normaliza variantes sin inferir frases distintas',()=>{
 for(const text of ['nose','NOSE','No sé','NO   SE','no lo recuerdo','No estoy segura.']) assert.equal(answerStatus(text),'unknown',text);
 for(const text of ['no','no sé si tengo alergia','nariz','nosebleed','sin síntomas']) assert.equal(answerStatus(text),'reported',text);
 const result=step(atQuestion('associated'),'nose');
 assert.equal(result.clinicalState.facts.at(-1).text,'nose');assert.equal(result.clinicalState.facts.at(-1).status,'unknown');
 assert.equal(step(initialInterview(),'nose').clinicalState.safety.status,'unknown');
});
test('No y motivo ambiguo no avanzan; datos desconocidos y motivo corto sí',()=>{
 for(const text of ['No','SI','ninguno','solo persiste']){
  const s=atQuestion('reason'),result=step(s,text);
  assert.equal(result.clinicalState.facts.length,0);assert.equal(result.clinicalState.pendingQuestions[0].id,'reason');
  assert.equal(result.clinicalState.qualityEvents[0].text,text);assert.equal(s.qualityEvents,undefined);
 }
 for(const text of ['tos','dolor','hola tengo fiebre','No sé','Prefiero no responder']) assert.equal(reasonIssue(text),null,text);
 assert.equal(step(atQuestion('reason'),'tos').clinicalState.pendingQuestions[0].id,'age');
 assert.doesNotMatch(step(atQuestion('reason'),'hola que tal').reply,/pregunta 1/);
 const state=step(atQuestion('reason'),'tos').clinicalState;
 assert.throws(()=>correctInterview(state,'reason','NO','correction-id',125),{status:400});
});
test('concentración incompleta mantiene aclaración y borrador; no inventa dosis',()=>{
 const s=step(atQuestion('medications'),'aspirina').clinicalState;
 const incomplete=step(s,'2 pastillas');
 assert.equal(incomplete.clinicalState.pendingQuestions[0].id,'medications_formulation');
 assert.equal(incomplete.clinicalState.clarificationContext.draft.clarifications.length,0);
 assert.equal(incomplete.clinicalState.qualityEvents[0].sourceMessageId,'message-id');
 const valid=step(incomplete.clinicalState,'tabletas de 100 mg');
 assert.equal(valid.clinicalState.pendingQuestions[0].id,'medications_amount');
 assert.equal(valid.clinicalState.clarificationContext.draft.clarifications[0].text,'tabletas de 100 mg');
 assert.equal(step(s,'nose').clinicalState.clarificationContext.draft.clarifications[0].status,'unknown');
 for(const text of ['jarabe 100 mg/5 ml','crema 1%','cápsulas 0,5 g']) assert.equal(detailIssue('medications_formulation',text),null,text);
 assert.ok(detailIssue('medications_amount','una cubeta'));assert.equal(detailIssue('medications_amount','No sé'),null);
});
test('reacción solo con intensidad y tiempo solo recurrente requieren aclaración',()=>{
 let s=step(atQuestion('allergies'),'salpullido').clinicalState;
 s=step(s,'cacahuate').clinicalState;
 assert.equal(step(s,'leve').clinicalState.pendingQuestions[0].id,'allergies_reaction');
 s=step(s,'salpullido leve').clinicalState;
 const recurrent=step(s,'cada vez que como cacahuate');
 assert.equal(recurrent.clinicalState.pendingQuestions[0].id,'allergies_when');
 s=step(recurrent.clinicalState,'hace dos semanas').clinicalState;
 assert.equal(s.phase,'complete');assert.equal(s.facts.at(-1).clarifications.at(-1).text,'hace dos semanas');
 assert.equal(s.assessment,null);assert.equal(s.facts.at(-1).status,'reported');
});
