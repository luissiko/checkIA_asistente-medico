import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialInterview,QUESTIONS,followupsFor} from '../src/interview-v3.js';
import {initialInterview as previousInitial} from '../src/interview-v2.js';
import {parseAge,parsePain,parseDirectSex,directMeasurement} from '../src/direct-input.js';
import {advanceInterview} from '../src/interview.js';
import {FirestoreStore as CurrentStore} from '../src/firestore-store.js';
import {initialInterview as v4Initial} from '../src/direct-interview.js';
class FirestoreStore extends CurrentStore {async create(uid){const s=await super.create(uid);s.clinicalState=v4Initial();this.db.data.set('checkia_sessions/'+s.id,structuredClone(s));return s;}}
import {FakeDB} from '../test-support/fake-db.js';
import {selectedScreenLetters,detectSignals} from '../src/safety.js';
const answers={name:'Luis Alejandro',age:'veintidós',sex:'m',weight:'80',height:'178',alarm_screen:'No',reason:'dolor de cabeza',onset:'ayer',location:'frente derecha',severity:'mucho',associated:'mareos',history:'diabetes',medications:'ninguno',allergies:'papaya',allergy_reaction:'se pone roja la piel; no tomo nada',allergy_timing:'desde niño; la última fue el año pasado'};
async function complete(store,s,overrides={}) {
 const values={...answers,...overrides};let state=s.clinicalState,visited=[];
 while(state.pendingQuestions.length){const q=state.pendingQuestions[0];visited.push(q.id);assert.ok(q.id in values,q.id);await store.append(s.id,'A',values[q.id],randomUUID(),q.id);state=(await store.get(s.id,'A')).clinicalState;assert.ok(visited.length<40);}
 return {session:await store.get(s.id,'A'),visited};
}
test('edades de 1 a 99, dígitos y palabras, sin avance para entradas inválidas',()=>{
 for(let n=1;n<=99;n++)assert.equal(parseAge(String(n)),n);
 for(const [text,n] of [['uno',1],['veintidós',22],['treinta y tres',33],['noventa y nueve',99],['tengo veintitrés años',23]])assert.equal(parseAge(text),n);
 for(const text of ['0','100','120','22.5','ayer','veinte años y tres meses'])assert.throws(()=>parseAge(text),{status:400},text);
 let state=advanceInterview(initialInterview(),'name','Luis Alejandro','name',0).clinicalState;
 assert.match(state.pendingQuestions[0].text,/Luis Alejandro/);
 assert.throws(()=>advanceInterview(state,'age','100','invalid',1),{status:400});assert.equal(state.pendingQuestions[0].id,'age');
 state=advanceInterview(state,'age','22','age',1).clinicalState;assert.equal(state.facts.at(-1).numericValue,22);
});
test('M/F se separan de las identidades anteriores y X recibe una aclaración neutral',()=>{
 assert.equal(parseDirectSex('m'),'male');assert.equal(parseDirectSex('f'),'female');
 assert.throws(()=>parseDirectSex('x'),e=>e.status===400&&!/primaria|no existe|biologia/i.test(e.message));
 let old=previousInitial();old.facts=QUESTIONS.slice(0,2).map(q=>({key:q.id,text:'dato'}));old.pendingQuestions=[{id:'sex',kind:'sex',text:'anterior'}];
 old=advanceInterview(old,'sex','M','old',0).clinicalState;assert.equal(old.facts.at(-1).codedValue,'female');assert.equal(old.protocolId,'intake-demo-v2');
});
test('dolor cualitativo no inventa una puntuación; altura simple admite metros',()=>{
 for(const value of ['poco','medio','mucho'])assert.deepEqual(parsePain(value),{kind:'qualitative',value});
 assert.equal(parsePain('9').value,9);assert.equal(parsePain('Sin dolor').value,0);assert.throws(()=>parsePain('11'),{status:400});
 for(const text of ['178','178 cm','1.78','1,78','1,78 m'])assert.equal(directMeasurement('height',text).value,178,text);
});
test('frecuencia de medicamento no sustituye desde cuándo; inicio ambiguo mantiene aclaración',()=>{
 assert.ok(followupsFor('medications','paracetamol tableta 500 mg, 1 tableta cada 24 horas','reported').some(q=>q.id==='medications_since'));
 assert.equal(followupsFor('medications','paracetamol tableta 500 mg, 1 tableta cada 24 horas desde ayer','reported').some(q=>q.id==='medications_since'),false);
 let state=initialInterview();state.facts=QUESTIONS.slice(0,6).map(q=>({key:q.id,text:'dato',status:'reported'}));state.pendingQuestions=[QUESTIONS.find(q=>q.id==='onset')];
 state=advanceInterview(state,'onset','no recuerdo bien pero persiste','a',0).clinicalState;assert.equal(state.pendingQuestions[0].id,'onset_when');
 state=advanceInterview(state,'onset_when','me siento mal','b',1).clinicalState;assert.equal(state.pendingQuestions[0].id,'onset_when');
 state=advanceInterview(state,'onset_when','ayer','c',2).clinicalState;assert.equal(state.pendingQuestions[0].id,'location');
});
test('letras de alarmas activan alerta solo en esa pregunta y conservan el bloqueo',async()=>{
 for(const text of ['a','G','a, c','letra b','a y g'])assert.equal(selectedScreenLetters(text),true,text);
 for(const text of ['No','no a','ayer','x'])assert.equal(selectedScreenLetters(text),false,text);
 const store=new FirestoreStore(new FakeDB()),s=await store.create('A');
 let state=s.clinicalState;
 for(const id of ['name','age','sex','weight','height']){await store.append(s.id,'A',answers[id],randomUUID(),id);state=(await store.get(s.id,'A')).clinicalState;}
 await store.append(s.id,'A','g',randomUUID(),'alarm_screen');
 const fresh=await store.get(s.id,'A');assert.equal(fresh.clinicalState.phase,'safety_alert');assert.equal(fresh.clinicalState.assessment.reportedText,'g');
 await assert.rejects(store.append(s.id,'A','No',randomUUID(),'alarm_screen'),{status:409});
 const other=await store.create('A');await store.append(other.id,'A','a',randomUUID(),'name');assert.equal((await store.get(other.id,'A')).clinicalState.phase,'collecting');
});
test('señales en lenguaje directo reconocen respiración, desmayo y panza',()=>{
 for(const text of ['me cuesta mucho respirar','presión fuerte en el pecho','me acabo de desmayar','de repente me cuesta hablar','me duele la panza muy fuerte'])assert.ok(detectSignals(text).length,text);
 assert.equal(detectSignals('no tengo dolor fuerte en el pecho').length,0);
});
test('entrevista de 16 preguntas, edad única y alergia dividida sin repetir lo ya informado',async()=>{
 const store=new FirestoreStore(new FakeDB()),s=await store.create('A'),{session,visited}=await complete(store,s);
 assert.deepEqual(visited,['name','age','sex','weight','height','alarm_screen','reason','onset','location','severity','associated','history','medications','allergies','allergy_reaction','allergy_timing']);
 assert.equal(session.clinicalState.facts.length,15);assert.equal(session.clinicalState.phase,'complete');assert.equal(session.summary.progress.expected,15);
 assert.equal(session.summary.groups[0].fields.find(f=>f.key==='sex').label,'Sexo referido');assert.equal(visited.filter(q=>q==='age').length,1);
 assert.equal(session.clinicalState.facts.find(f=>f.key==='severity').pain.kind,'qualitative');
 assert.match(session.clinicalState.facts.find(f=>f.key==='allergy_timing').text,/el año pasado/);
 assert.equal(session.summary.clinicalInterpretation,false);
});
test('sin alergias no pregunta 15/16; corrección reabre y conserva los cambios',async()=>{
 const store=new FirestoreStore(new FakeDB()),s=await store.create('A');const{session,visited}=await complete(store,s,{allergies:'ninguna'});
 assert.equal(visited.includes('allergy_reaction'),false);assert.equal(session.summary.progress.autoSkipped,2);
 for(const f of session.clinicalState.facts.slice(-2)){assert.equal(f.source,'conditional_skip');assert.equal(f.autoSkipped,true);}
 await assert.rejects(store.correct(s.id,'A','granos',randomUUID(),'allergy_reaction',session.clinicalState.revision),{status:400});
 await store.correct(s.id,'A','papaya',randomUUID(),'allergies',session.clinicalState.revision);
 let fresh=await store.get(s.id,'A');assert.equal(fresh.clinicalState.pendingQuestions[0].id,'allergy_reaction');
 await store.append(s.id,'A',answers.allergy_reaction,randomUUID(),'allergy_reaction');await store.append(s.id,'A',answers.allergy_timing,randomUUID(),'allergy_timing');
 fresh=await store.get(s.id,'A');assert.equal(fresh.clinicalState.phase,'complete');assert.equal(fresh.summary.progress.autoSkipped,0);
 assert.ok(fresh.clinicalState.facts.find(f=>f.key==='allergies').revisions.some(r=>r.text==='ninguna'));
 await store.correct(s.id,'A','ninguna',randomUUID(),'allergies',fresh.clinicalState.revision);
 fresh=await store.get(s.id,'A');assert.equal(fresh.summary.progress.autoSkipped,2);assert.ok(fresh.clinicalState.facts.at(-1).revisions.length);
});
