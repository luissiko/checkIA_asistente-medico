import test from 'node:test';
import assert from 'node:assert/strict';
import { isGreetingOnly, initialInterview, advanceInterview, QUESTIONS } from '../src/legacy-interview.js';
test('saludos completos frente a descripciones cortas y saludos con motivo',()=>{
  for (const text of ['hola que tal','HOLA','Buenos días, CHECKIA','Hola. ¿Cómo estás?','Buenas tardes','👋','ok, gracias']) assert.equal(isGreetingOnly(text),true,text);
  for (const text of ['tos','fiebre','dolor','hola, tengo tos','hola me duele el abdomen','No sé','Prefiero no responder','me duele desde ayer']) assert.equal(isGreetingOnly(text),false,text);
  const state=initialInterview();state.pendingQuestions=[{...QUESTIONS[0]}];
  assert.equal(advanceInterview(state,'reason','hola','m',0).clinicalState.facts.length,0);
  assert.equal(state.facts.length,0);
  const unknown=advanceInterview(state,'reason','No sé','m',0);
  assert.equal(unknown.clinicalState.facts[0].status,'unknown');
  assert.equal(unknown.clinicalState.pendingQuestions[0].id,'age');
});
