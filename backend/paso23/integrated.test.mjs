import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {FakeDB} from './test-support/fake-db.mjs';
import {FirestoreStore} from '../src/firestore-store.js';
import {IntegratedStore} from './integrated-store.mjs';
import {IntegratedOrientationService} from './integrated-orientation.mjs';
import {createIntegratedApp} from './integrated-app.mjs';
import {CONTENT} from './engine.mjs';
const defaults={respondent:'Caso ficticio',reason:'Prueba de dolor',emergency_level:'5',age:'30',sex:'h',weight:'80',height:'170',bmi_consent:'si',onset:'ayer',location:'brazo',location_description:'Prueba',severity:'2',city:'Cancún',origin:'Cancún',answers_confirmation:'si'};
async function full(store,session,{overrides={},until=null}={}){
 let s=session;
 for(let i=0;i<100;i++){
  const q=s.clinicalState.pendingQuestions[0];if(!q||q.id===until)return s;
  await store.append(s.id,'u1',overrides[q.id]??defaults[q.id]??(q.kind==='yesno'?'no':'Respuesta ficticia'),randomUUID(),q.id);s=await store.get(s.id,'u1');
 }
 throw Error('Ciclo no esperado');
}
const output={fuentes_usadas:['doc-test'],aclaraciones_sugeridas:[],resumen:'Caso ficticio',datos_por_aclarar:['Dato pendiente'],orientacion_general:'Orientación de prueba',siguiente_paso:'Evaluación profesional',preguntas_para_profesional:[]};
const chunk={id:'doc-test',documentId:'doc',title:'Fuente sintética',section:'Contexto',text:'Fragmento ficticio',checkedAt:'2026-10-18',url:'https://www.who.int/'};
const retriever={status:{ready:true},version:'test-rag',ensureReady(){},retrieve:async()=>({version:'rag-library-v2',status:'matched',retrieved:[chunk]})};

test('integración: crear, completar, resumir, cerrar y eliminar conserva contrato y propietario',async()=>{
 const store=new IntegratedStore(new FakeDB()),created=await store.create('u1');assert.equal(created.clinicalState.protocolId,CONTENT.version);assert.equal(created.clinicalState.pendingQuestions[0].id,'respondent');
 const s=await full(store,created);assert.equal(s.clinicalState.phase,'complete');assert.equal(s.clinicalState.canGenerate,true);assert.equal(s.summary.supported,true);assert.equal(s.clinicalState.bmi.display,27.68);
 assert.ok(s.summary.groups.flatMap(g=>g.fields).some(f=>f.key==='occupation'));assert.ok(!(s.clinicalState.facts.some(f=>f.key==='emergency_options')));
 assert.ok(s.messages.length<=200);await assert.rejects(store.get(s.id,'u2'),e=>e.status===404);
 await store.close(s.id,'u1');assert.equal((await store.get(s.id,'u1')).status,'closed');await store.delete(s.id,'u1');await assert.rejects(store.get(s.id,'u1'),e=>e.status===404);
});
test('integración: las consultas anteriores mantienen su protocolo y siguen respondiendo',async()=>{
 const db=new FakeDB(),oldStore=new FirestoreStore(db),old=await oldStore.create('u1'),store=new IntegratedStore(db);
 await store.append(old.id,'u1','Alias',randomUUID(),'name');const current=await store.get(old.id,'u1');assert.equal(current.clinicalState.protocolId,'intake-demo-v8');assert.equal(current.summary.supported,true);assert.ok(current.clinicalState.facts.length>0);
});
test('integración: opciones A–H, las cuatro ramas especiales y niveles 8/9/10',async()=>{
 for(const level of ['9','10'])for(const choice of ['a','b','c','d','e','f','g','h']){
  const store=new IntegratedStore(new FakeDB());let s=await full(store,await store.create('u1'),{until:'emergency_level'});
  await store.append(s.id,'u1',level,randomUUID(),'emergency_level');s=await store.get(s.id,'u1');assert.equal(s.clinicalState.pendingQuestions[0].id,'emergency_options');assert.equal(s.clinicalState.emergency.immediate,true);
  assert.equal(s.clinicalState.pendingQuestions[0].choices.length,8);await store.append(s.id,'u1',choice,randomUUID(),'emergency_options');s=await store.get(s.id,'u1');
  if(choice==='a'){assert.equal(s.clinicalState.pendingQuestions[0].id,'emergency_group');await store.append(s.id,'u1','5',randomUUID(),'emergency_group');assert.equal((await store.get(s.id,'u1')).clinicalState.pendingQuestions[0].id,'age');}
  else if(choice==='h')assert.equal(s.clinicalState.pendingQuestions[0].id,'age');
  else{assert.equal(s.clinicalState.phase,'complete');assert.equal(s.clinicalState.canGenerate,true);assert.ok(s.clinicalState.emergency.content.paragraphs.length);}
 }
 for(const group of ['1','2','3','4']){const store=new IntegratedStore(new FakeDB());let s=await full(store,await store.create('u1'),{until:'emergency_level'});for(const text of ['9','a',group,'Urgencia ficticia']){const q=s.clinicalState.pendingQuestions[0];await store.append(s.id,'u1',text,randomUUID(),q.id);s=await store.get(s.id,'u1');}assert.equal(s.clinicalState.canGenerate,true);}
});
test('integración: idempotencia, corrección y rechazo de preguntas/revisiones antiguas',async()=>{
 const store=new IntegratedStore(new FakeDB()),s=await store.create('u1'),id=randomUUID();
 await store.append(s.id,'u1','Alias',id,'respondent');assert.equal((await store.append(s.id,'u1','Alias',id,'respondent')).duplicate,true);
 await assert.rejects(store.append(s.id,'u1','Otro',id,'respondent'),e=>e.status===409);
 await assert.rejects(store.append(s.id,'u1','Alias',randomUUID(),'respondent'),e=>e.status===409);
 const saved=await full(store,await store.get(s.id,'u1'));
 await assert.rejects(store.correct(s.id,'u1','Nuevo',randomUUID(),'reason',0),e=>e.status===409);
 await store.correct(s.id,'u1','Nuevo motivo',randomUUID(),'reason',saved.clinicalState.revision);const current=await store.get(s.id,'u1');assert.equal(current.clinicalState.pendingQuestions.length,0);assert.equal(current.clinicalState.canGenerate,true);assert.equal(current.clinicalState.facts.length,saved.clinicalState.facts.length);assert.equal(current.clinicalState.facts.find(f=>f.key==='reason').text,'Nuevo motivo');assert.ok(current.clinicalState.paso23.correctionHistory.length);
});
test('integración: reevaluación conserva datos originales, fuentes y resultado anterior',async()=>{
 const store=new IntegratedStore(new FakeDB());let s=await full(store,await store.create('u1'));const seen=[];
 const service=new IntegratedOrientationService(store,{configured:true,promptVersion:'paso23-analysis-v4',generate:async c=>{seen.push(c);return{result:output,model:'mock',promptVersion:'paso23-analysis-v4'};}},{retriever});
 await service.generate(s.id,'u1',{consent:true,expectedRevision:s.clinicalState.revision});
 assert.equal((await service.generate(s.id,'u1',{consent:true,expectedRevision:s.clinicalState.revision})).cached,true);assert.equal(seen.length,1);
 await store.addExtra(s.id,'u1',{text:'Información adicional ficticia',requestId:randomUUID(),expectedRevision:s.clinicalState.revision});s=await store.get(s.id,'u1');assert.equal(s.clinicalState.paso23.orientationHistory.length,1);assert.notEqual(s.orientation.basedOnRevision,s.clinicalState.revision);
 await service.generate(s.id,'u1',{consent:true,expectedRevision:s.clinicalState.revision});s=await store.get(s.id,'u1');assert.equal(seen[1].extraInformation[0].text,'Información adicional ficticia');assert.ok(seen[1].fields.some(f=>f.key==='reason'));assert.equal(s.orientation.rag.sources[0].id,'doc-test');assert.ok(s.summary.groups.flatMap(g=>g.fields).some(f=>f.key==='extra_0'));
});
test('integración: generación de emergencia sin esperar confirmación final',async()=>{
 const store=new IntegratedStore(new FakeDB());let s=await full(store,await store.create('u1'),{until:'emergency_level'});
 for(const answer of ['9','b']){await store.append(s.id,'u1',answer,randomUUID(),s.clinicalState.pendingQuestions[0].id);s=await store.get(s.id,'u1');}
 const service=new IntegratedOrientationService(store,{configured:true,promptVersion:'test',generate:async c=>{assert.equal(c.emergencyCase.value,'b');return{result:output,model:'mock',promptVersion:'test'};}},{retriever});
 const result=await service.generate(s.id,'u1',{consent:true,expectedRevision:s.clinicalState.revision});assert.equal(result.orientation.status,'ready');
});
test('integración HTTP: autenticación y propietario se verifican también en ampliaciones',async t=>{
 const store=new IntegratedStore(new FakeDB()),app=createIntegratedApp({store,verifyToken:async token=>({uid:token})});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 const req=(path,body,uid='u1')=>fetch(base+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(uid?{authorization:'Bearer '+uid}:{})},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await req('/api/health')).status,200);assert.equal((await(await req('/api/health')).json()).interview,CONTENT.version);assert.equal((await req('/api/sessions',{},'')).status,401);
 const s=(await(await req('/api/sessions',{})).json()).session;
 assert.equal((await req('/api/sessions/'+s.id+'/extra',{text:'Prueba',requestId:randomUUID(),expectedRevision:0},'u2')).status,404);
 assert.equal((await req('/api/sessions/'+s.id+'/extra',{text:'Prueba',requestId:randomUUID(),expectedRevision:0},'')).status,401);
 assert.equal((await req('/api/sessions/'+s.id+'/messages',{message:'Alias',requestId:randomUUID(),questionId:'respondent'})).status,201);
 const current=await(await req('/api/sessions/'+s.id)).json();assert.equal(current.clinicalState.pendingQuestions[0].id,'reason');
});

test('corregir una respuesta conserva el resto, las ampliaciones y regenera con el dato nuevo',async()=>{
 const store=new IntegratedStore(new FakeDB());let s=await full(store,await store.create('u1'));const seen=[];
 const service=new IntegratedOrientationService(store,{configured:true,promptVersion:'test',generate:async c=>{seen.push(c);return{result:output,model:'mock',promptVersion:'test'};}},{retriever});
 await store.addExtra(s.id,'u1',{text:'Contexto adicional',requestId:randomUUID(),expectedRevision:s.clinicalState.revision});s=await store.get(s.id,'u1');
 await service.generate(s.id,'u1',{consent:true,expectedRevision:s.clinicalState.revision});s=await store.get(s.id,'u1');const before=s;
 await store.correct(s.id,'u1','60',randomUUID(),'weight',s.clinicalState.revision);s=await store.get(s.id,'u1');
 assert.equal(s.clinicalState.revision,before.clinicalState.revision+1);assert.equal(s.clinicalState.canGenerate,true);assert.equal(s.clinicalState.bmi.display,20.76);
 assert.deepEqual(s.clinicalState.facts.filter(a=>a.key!=='weight'),before.clinicalState.facts.filter(a=>a.key!=='weight'));
 assert.deepEqual(s.clinicalState.paso23.extraInformation,before.clinicalState.paso23.extraInformation);
 assert.notEqual(s.orientation.basedOnRevision,s.clinicalState.revision);
 await service.generate(s.id,'u1',{consent:true,expectedRevision:s.clinicalState.revision});s=await store.get(s.id,'u1');
 assert.equal(seen.length,2);assert.equal(seen[1].fields.find(f=>f.key==='weight').answer,'60');assert.equal(s.orientation.basedOnRevision,s.clinicalState.revision);
});

test('corrección de una rama pide solo el detalle nuevo y reutiliza las respuestas posteriores',async()=>{
 const store=new IntegratedStore(new FakeDB());let s=await full(store,await store.create('u1'));const before=s;
 await store.correct(s.id,'u1','si',randomUUID(),'history',s.clinicalState.revision);s=await store.get(s.id,'u1');
 assert.equal(s.clinicalState.pendingQuestions[0].id,'history_detail');
 await store.append(s.id,'u1','Antecedente de prueba',randomUUID(),'history_detail');s=await store.get(s.id,'u1');
 assert.equal(s.clinicalState.canGenerate,true);assert.equal(s.clinicalState.pendingQuestions.length,0);
 assert.deepEqual(s.clinicalState.facts.filter(f=>!['history','history_detail'].includes(f.key)),before.clinicalState.facts.filter(f=>f.key!=='history'));
});

test('controles de un clic: escalas 1–10 y sexo conservan rutas de hombre y mujer',async()=>{
 for(const level of ['1','8','9','10']){
  const store=new IntegratedStore(new FakeDB());let s=await full(store,await store.create('u1'),{until:'emergency_level'});
  assert.equal(s.clinicalState.pendingQuestions[0].selectionOnly,true);assert.equal(s.clinicalState.pendingQuestions[0].choices.length,10);
  await store.append(s.id,'u1',level,randomUUID(),'emergency_level');s=await store.get(s.id,'u1');assert.equal(s.clinicalState.pendingQuestions[0].id,Number(level)>8?'emergency_options':'age');
 }
 for(const sex of ['Hombre','Mujer']){
  const store=new IntegratedStore(new FakeDB());let s=await full(store,await store.create('u1'),{until:'sex'});
  assert.deepEqual(s.clinicalState.pendingQuestions[0].choices.map(x=>x.value),['Hombre','Mujer']);
  await store.append(s.id,'u1',sex,randomUUID(),'sex');s=await store.get(s.id,'u1');assert.equal(s.clinicalState.pendingQuestions[0].id,sex==='Mujer'?'has_children':'weight');
  s=await full(store,s,{until:'severity'});assert.equal(s.clinicalState.pendingQuestions[0].choices.length,10);
 }
});

test('pregunta 22.1: cuatro opciones; no o ninguna omite frecuencia; corregir preserva lo demás',async()=>{
 for(const answer of ['si','Frituras','no','ninguna']){
  const store=new IntegratedStore(new FakeDB());let s=await full(store,await store.create('u1'),{until:'unhealthy_food'});
  await store.append(s.id,'u1',answer,randomUUID(),'unhealthy_food');s=await store.get(s.id,'u1');
  if(['no','ninguna'].includes(answer)){assert.equal(s.clinicalState.pendingQuestions[0].id,'city');continue;}
  assert.equal(s.clinicalState.pendingQuestions[0].id,'unhealthy_food_frequency');assert.deepEqual(s.clinicalState.pendingQuestions[0].choices.map(c=>c.value),['poco','a veces','frecuente','diario']);assert.equal(s.clinicalState.pendingQuestions[0].selectionOnly,true);
  await store.append(s.id,'u1','a veces',randomUUID(),'unhealthy_food_frequency');s=await full(store,await store.get(s.id,'u1'));assert.equal(s.clinicalState.canGenerate,true);
  await store.correct(s.id,'u1','diario',randomUUID(),'unhealthy_food_frequency',s.clinicalState.revision);s=await store.get(s.id,'u1');assert.equal(s.clinicalState.canGenerate,true);assert.equal(s.clinicalState.facts.find(f=>f.key==='unhealthy_food_frequency').text,'diario');
 }
});
test('textos de edad/peso/altura y placeholders de 17–19 actualizados',()=>{
 for(const [id,part] of [['age','solo numero'],['weight','(kg)'],['height','1.56 = 156']])assert.ok(CONTENT.questions.find(q=>q.id===id).text.includes(part));
 for(const id of ['hereditary','hereditary_choice','degenerative','degenerative_choice','sti','sti_choice'])assert.equal(CONTENT.questions.find(q=>q.id===id).placeholder,'si tienes otra enfermedad no mencionada, escríbela aquí');
});
