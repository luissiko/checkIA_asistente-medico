import test from 'node:test';
import assert from 'node:assert/strict';
import {detectSignals, assessIncoming, recordScreen} from '../src/safety.js';
import {initialInterview} from '../src/legacy-interview.js';
test('frases explícitas de siete señales; negaciones e historia simples',()=>{
  const cases=[['No puedo respirar','breathing'],['Me duele el pecho ahora','chest'],['Estoy vomitando sangre','bleeding'],['Mi madre no responde','consciousness'],['De repente no puedo hablar','neurological'],['Me estoy muriendo de dolor de estómago','abdominal'],['Dolor de cabeza muy fuerte que empezó de repente','headache']];
  for(const [text,id] of cases) assert.ok(detectSignals(text).some(s=>s.id===id),text);
  for(const text of ['No tengo dolor de pecho','No me duele el pecho','Tuve dolor de pecho el año pasado','dolor de cabeza','9','mi sistema no responde','ninguna']) assert.equal(detectSignals(text).length,0,text);
  assert.ok(detectSignals('No tengo dolor de pecho pero no puedo respirar').some(s=>s.id==='breathing'));
  assert.ok(detectSignals('Tuve dolor de pecho el año pasado, pero ahora no puedo respirar').some(s=>s.id==='breathing'));
});
test('pantalla positiva genera alerta; negativa y desconocimiento no descartan urgencia',()=>{
  const state=initialInterview();assert.equal(state.pendingQuestions[0].id,'alarm_screen');
  const alert=assessIncoming(state,'Sí','alarm_screen','m',1);
  assert.equal(alert.clinicalState.phase,'safety_alert');assert.equal(alert.clinicalState.pendingQuestions.length,0);
  assert.equal(alert.clinicalState.assessment.clinicallyValidated,false);
  assert.equal(alert.clinicalState.assessment.sourceMessageId,'m');
  assert.equal(alert.clinicalState.assessment.emergencyNumberMexico,'911');
  assert.equal(recordScreen(state,'No','m',1).status,'user_denied_listed_signs');
  assert.equal(recordScreen(state,'No sé','m',1).status,'unknown');
  assert.equal(assessIncoming(state,'No','alarm_screen','m',1),null);
  assert.throws(()=>recordScreen(state,'tal vez','m',1),{status:400});
  assert.equal(state.assessment,null);assert.equal(state.phase,'collecting');
});
