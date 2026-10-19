import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CONTENT,initialState,advance,pending,bmiFor,contextFor,canGenerate,addExtraInformation} from './engine.mjs';
import {createLocalServer} from './server.mjs';

const defaults = {respondent:'Para mí, Luis 34',reason:'Caso ficticio: malestar',emergency_level:'9',emergency_options:'no',age:'30',sex:'h',weight:'80 kg',height:'1.70 m',bmi_consent:'si',onset:'ayer',location:'brazo',location_description:'texto libre 123',severity:'no tengo dolor 0',city:'Cancún',origin:'Campeche',answers_confirmation:'si'};
function until(target, overrides={}, state=initialState()) {
  for(let i=0;i<100;i++){
    if(state.questionId===target || !state.questionId)return state;
    const q=pending(state);state=advance(state,q.id,overrides[q.id]??defaults[q.id]??(q.kind==='yesno'?'no':'Información libre'));
  }
  throw Error('Ruta cíclica');
}
test('fuente íntegra y preguntas literales con correcciones autorizadas',()=>{
  const bytes=readFileSync(new URL('../../docs/paso23/ORIGINAL_USUARIO.md',import.meta.url));
  assert.equal(CONTENT.sourceSha256,createHash('sha256').update(bytes).digest('hex'));
  const text=bytes.toString().replaceAll('\r','\n').replaceAll('~~','').replaceAll('**','');
  for(const q of CONTENT.questions)if(!CONTENT.decisions.questionTextOverrides[q.id])assert.ok(text.includes(q.text),q.id+' debe coincidir con la fuente');
  for(const o of CONTENT.emergencyOptions.filter(o=>o.question))assert.ok(text.includes(o.question));
  assert.equal(CONTENT.questions.find(q=>q.id==='respondent').text,'¿Cuál es tu nombre o de la persona para el diagnóstico?');
});
test('recorrido adulto completo, saltos negativos y confirmación',()=>{
  const s=until(null);assert.equal(s.phase,'complete');assert.ok(canGenerate(s));
  const ids=s.answers.map(a=>a.key);assert.ok(!ids.includes('pregnant'));assert.ok(!ids.includes('children_count'));assert.ok(!ids.includes('medications_details'));assert.ok(ids.includes('remedies'));assert.ok(!ids.includes('activity_detail'));assert.ok(ids.includes('unhealthy_food'));assert.equal(s.bmi.display,27.68);
});
test('mujer: hijos, cantidad, embarazo y meses; rama afirmativa completa',()=>{
  const s=until(null,{sex:'m',has_children:'si',children_count:'2',pregnant:'si',pregnancy_months:'3 meses',history:'si',medications:'si',medications_knows_active:'si',remedies:'si',allergies:'si',cancer_diabetes:'si',hereditary:'si',degenerative:'si',sti:'si',physical_activity:'si',healthy_diet:'si',avoids_processed:'si'});
  const ids=s.answers.map(a=>a.key);
  assert.ok(ids.indexOf('has_children')<ids.indexOf('children_count'));assert.ok(ids.indexOf('children_count')<ids.indexOf('pregnant'));
  for(const key of ['pregnancy_months','history_detail','medications_identity','remedies_detail','allergy_timing','allergy_reaction','hereditary_relatives','activity_detail'])assert.ok(ids.includes(key),key);
  assert.ok(ids.includes('unhealthy_food'));assert.equal(s.bmi.classification,'requiere_interpretacion_por_embarazo');
});
test('texto y números sin bloqueo; si/no estricto; texto original intacto',()=>{
  let s=until('age');s=advance(s,'age','No lo sé, quizá 20 o 21');assert.equal(s.answers.at(-1).text,'No lo sé, quizá 20 o 21');
  s=until('medications',{},s);assert.throws(()=>advance(s,'medications','tal vez'),e=>e.status===400);
  s=advance(s,'medications','Sí');assert.equal(s.questionId,'medications_details');
});
test('nivel: 1–8 continúa, 9–10 abre emergencia; texto ambiguo o cero no decide',()=>{
 for(const level of ['1','7','8']){let s=until('emergency_level');s=advance(s,s.questionId,level);assert.equal(s.questionId,'age');assert.equal(s.alert,null);}
 for(const level of ['9','10']){let s=until('emergency_level');s=advance(s,s.questionId,level);assert.equal(s.questionId,'emergency_options');assert.equal(s.alert.immediate,true);}
 let s=until('emergency_level');s=advance(s,s.questionId,'10');assert.equal(s.questionId,'emergency_options');assert.equal(s.alert.immediate,true);
 s=until('emergency_level');s=advance(s,s.questionId,'no sé');assert.equal(s.questionId,'emergency_level');assert.ok(s.inputNotice);
 for(const text of ['0','11']){const invalid=advance(until('emergency_level'),'emergency_level',text);assert.equal(invalid.questionId,'emergency_level');assert.ok(invalid.inputNotice);}
});
test('cada opción b–g muestra su texto propio y termina esa ruta',()=>{
  for(const letter of 'bcdefg'){
    let s=until('emergency_options');s=advance(s,'emergency_options',letter);assert.equal(s.phase,'emergency');assert.equal(s.alert.kind,letter);assert.ok(s.alert.content.paragraphs.length>3);assert.match(s.alert.content.paragraphs.join(' '),/911/);assert.equal(canGenerate(s),true);
  }
});
test('las cuatro ramas especiales conservan la descripción para RAG/LLM',()=>{
  for(const [group,key] of [['1','infant_emergency'],['2','pregnancy_emergency'],['3','older_emergency'],['4','disability_emergency']]){
    let s=until('emergency_options');s=advance(s,s.questionId,'a');s=advance(s,s.questionId,group);assert.equal(s.questionId,key);
    s=advance(s,key,'3 meses; ejemplo ficticio');assert.equal(s.phase,'emergency');assert.ok(canGenerate(s));assert.ok(contextFor(s).fields.some(f=>f.key==='reason'&&f.answer==='3 meses; ejemplo ficticio'));
  }
});
test('grupo 5 continúa a pregunta 3; pregunta 7 es consentimiento de IMC',()=>{
 let s=until('emergency_options');s=advance(s,s.questionId,'a');s=advance(s,s.questionId,'5');assert.equal(s.questionId,'age');
 let h=until('emergency_options');h=advance(h,h.questionId,'H');assert.equal(h.questionId,'age');assert.equal(h.phase,'collecting');
 const normal=until(null,{emergency_level:'8'});assert.equal(normal.phase,'complete');assert.ok(!normal.answers.some(a=>a.key==='emergency_options'));
 s=until('bmi_consent',{},s);assert.equal(s.bmi,null);s=advance(s,s.questionId,'no');assert.equal(s.questionId,'onset');assert.equal(s.bmi,null);
 s=until('bmi_consent');s=advance(s,s.questionId,'si');assert.equal(s.bmi.display,27.68);
});
test('IMC adultos: unidades, decimales y grados autorizados',()=>{
 const state=(age,weight,height)=>({answers:[{key:'age',text:age},{key:'weight',text:weight},{key:'height',text:height}]});
 assert.equal(bmiFor(state('30','80','170')).display,27.68);assert.equal(bmiFor(state('30','80000 g','1.70 m')).display,27.68);
 for(const [bmi,expected] of [[18.49,'bajo_peso'],[18.5,'rango_normal'],[24.99,'rango_normal'],[25,'sobrepeso'],[29.9,'sobrepeso'],[30,'obesidad_grado_I'],[35,'obesidad_grado_II'],[39.9,'obesidad_grado_II'],[40,'obesidad_grado_III']])assert.equal(bmiFor(state('30',String(bmi*4),'200 cm')).classification,expected);
 assert.equal(bmiFor(state('30','texto','170')).bmi,null);assert.equal(bmiFor(state('30','80','0')).bmi,null);
 assert.equal(bmiFor(state('81','80','170')).classification,'requiere_referencia_especifica');
});
test('IMC pediátrico: edad y sexo exactos, separación de referencias y límites',()=>{
 const calc=(age,sex,weight='45',height='120')=>bmiFor({answers:Object.entries({age,sex,weight,height}).map(([key,text])=>({key,text}))});
 assert.equal(calc('10','h').classification,'requiere_edad_exacta_y_sexo');
 for(const sex of ['h','m'])assert.equal(calc('10 años 0 meses',sex).classification,'obesidad');
 assert.equal(calc('48 meses','h','16','100').reference,'OMS_2006');
 assert.equal(calc('60 meses','m','18','110').reference,'OMS_2006');
 assert.equal(calc('61 meses','m','18','110').reference,'OMS_2007');
 assert.equal(calc('228 meses','h','65','175').reference,'OMS_2007');
 assert.equal(calc('229 meses','h').classification,'requiere_referencia_especifica');
 assert.equal(calc('6 meses','h','7.5','67').classification,'requiere_confirmar_longitud_acostado');
 assert.notEqual(calc('120 meses','h').cutoffs['2'],calc('120 meses','m').cutoffs['2']);
});
test('listas de diez opciones, respuesta libre y contexto interpretado',()=>{
 for(const key of ['hereditary_choice','degenerative_choice','sti_choice']){
  const q=CONTENT.questions.find(q=>q.id===key);assert.equal(q.choices.length,10);
  let s=until(key,{hereditary:'si',degenerative:'si',sti:'si'});s=advance(s,key,'3');
  assert.equal(contextFor(s).fields.find(f=>f.key===key).selectedOptions[0],q.choices[2].label);
 }
});
test('todas las ramas nuevas, actuales y pasadas, sin ciclos ni preguntas cruzadas',()=>{
 for(const current of ['si','no']){
  const overrides=Object.fromEntries(CONTENT.questions.filter(q=>q.kind==='yesno').map(q=>[q.id,'si']));
  Object.assign(overrides,{sex:'m',alcohol_current:current,smoking_current:current,drugs_current:current});
  const s=until(null,overrides);assert.equal(s.phase,'complete');const ids=s.answers.map(a=>a.key);
  for(const prefix of ['alcohol','smoking','drugs']){
   assert.ok(ids.includes(prefix+(current==='si'?'_detail':'_past')));
   assert.ok(!ids.includes(prefix+(current==='si'?'_past':'_detail')));
  }
  for(const key of ['pets_detail','cancer_diabetes_detail','hereditary_since','degenerative_since','sti_since','city_since','origin_visits','travel_where','travel_duration','travel_frequent','medical_last','medical_reason','medical_treatment','lab_results','sleep_medications','work_hours','partners','donated_when'])assert.ok(ids.includes(key),key);
  assert.equal(new Set(ids).size,ids.length);
 }
 for(const diet of ['si','no']){const s=until('unhealthy_food',{healthy_diet:'si',avoids_processed:diet});assert.equal(s.questionId,'unhealthy_food');}
});
async function local(t,dependencies={}){
  const server=createLocalServer(dependencies);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;const first=await fetch(base);const cookie=first.headers.get('set-cookie').split(';')[0];
  return {base,cookie,async api(path,body,options={}){return fetch(base+path,{method:body?'POST':'GET',headers:{cookie,...(body?{'content-type':'application/json'}:{}),...options.headers},...(body?{body:JSON.stringify(body)}:{}),...options});}};
}
test('HTTP local: sin credenciales funciona formulario, control revisión y exportación',async t=>{
  const c=await local(t);assert.equal((await fetch(c.base+'/api/config')).status,403);
  let r=await c.api('/api/config');assert.equal((await r.json()).llm.configured,false);
  r=await c.api('/api/sessions',{});let s=await r.json();
  r=await c.api('/api/sessions/'+s.id+'/answer',{questionId:s.questionId,answer:'texto 123',expectedRevision:99});assert.equal(r.status,409);
  r=await c.api('/api/sessions/'+s.id+'/answer',{questionId:s.questionId,answer:'texto 123',expectedRevision:0});s=await r.json();assert.equal(s.pending.id,'reason');
  r=await c.api('/api/sessions/'+s.id+'/export');assert.equal((await r.json()).session.answers[0].text,'texto 123');
  r=await c.api('/api/sessions/'+s.id+'/edit',{questionId:'respondent',expectedRevision:s.revision});s=await r.json();assert.equal(s.pending.id,'respondent');assert.equal(s.correctionHistory[0].previousAnswers.length,1);
});
const output={fuentes_usadas:['doc-test'],aclaraciones_sugeridas:[],resumen:'Caso ficticio',datos_por_aclarar:['Edad'],orientacion_general:'Información del fragmento',siguiente_paso:'Solicitar evaluación profesional',preguntas_para_profesional:[]};
test('HTTP: RAG y LLM llamados con la rama infantil, sin fuentes inventadas',async t=>{
  let received;
  const chunk={id:'doc-test',title:'Fuente sintética de prueba',section:'Contexto',text:'Contenido de prueba',checkedAt:'2026-10-17',url:'https://www.who.int/'};
  const c=await local(t,{client:{configured:true,generate:async context=>{received=context;return{result:output,model:'mock',usage:{inputTokens:0,outputTokens:0}};}},retriever:{status:{ready:true},retrieve:async()=>({status:'matched',retrieved:[chunk]})}});
  let s=await (await c.api('/api/sessions',{consent:true})).json();
  for(const answer of ['Para mi bebé','Caso ficticio','9','a','1','3 meses, caso ficticio'])s=await(await c.api('/api/sessions/'+s.id+'/answer',{questionId:s.questionId,answer,expectedRevision:s.revision})).json();
  const r=await c.api('/api/sessions/'+s.id+'/orientation',{expectedRevision:s.revision});assert.equal(r.status,200);const result=await r.json();assert.equal(result.orientation.model,'mock');assert.equal(received.evidence.retrieved[0].id,'doc-test');assert.ok(received.fields.some(f=>f.key==='reason'&&f.answer.includes('3 meses')));
  assert.equal(result.orientation.rag.sources[0].id,'doc-test');
});
test('HTTP: sin consentimiento no se llama al proveedor y CORS bloquea origen externo',async t=>{
  const c=await local(t,{client:{configured:true,generate:()=>assert.fail('No se debe llamar sin consentimiento')}});
  let s=await(await c.api('/api/sessions',{})).json();
  for(const answer of ['Yo','Caso ficticio','9','a','1','Caso ficticio'])s=await(await c.api('/api/sessions/'+s.id+'/answer',{questionId:s.questionId,answer,expectedRevision:s.revision})).json();
  assert.equal((await c.api('/api/sessions/'+s.id+'/orientation',{expectedRevision:s.revision})).status,400);
  assert.equal((await fetch(c.base+'/api/config',{headers:{cookie:c.cookie,origin:'https://otro-sitio.example'}})).status,403);
});

test('NINGUNA omite detalles sin borrar la respuesta original',()=>{
 for(const [key,next] of [['hereditary_choice','degenerative'],['degenerative_choice','sti'],['sti_choice','physical_activity']]){
  let s=until(key,{hereditary:'si',degenerative:'si',sti:'si'});s=advance(s,key,'10');assert.equal(s.questionId,next);assert.equal(s.answers.at(-1).text,'10');
 }
});
test('ampliaciones conservan relato, resultados y orden temporal; validación',()=>{
 let s=until(null);const original=structuredClone(s.answers);
 s.orientation={revision:s.revision,result:{resumen:'Primera orientación'}};
 s=addExtraInformation(s,'Ahora agrego que empezó ayer');assert.deepEqual(s.answers,original);assert.equal(s.orientation,null);
 assert.equal(s.orientationHistory[0].result.resumen,'Primera orientación');
 s=addExtraInformation(s,'Segunda ampliación');assert.equal(s.extraInformation.length,2);
 assert.deepEqual(contextFor(s).extraInformation.map(x=>x.text),['Ahora agrego que empezó ayer','Segunda ampliación']);
 assert.equal(contextFor(s).fields.filter(f=>f.key==='associated').length,2);
 assert.throws(()=>addExtraInformation(initialState(),'Texto'),e=>e.status===409);
 assert.throws(()=>addExtraInformation(s,' '),e=>e.status===400);
 assert.throws(()=>addExtraInformation(s,'x'.repeat(4001)),e=>e.status===400);
});
test('HTTP: segunda evaluación combina información inicial y extra y conserva primera orientación',async t=>{
 const seen=[];const chunk={id:'doc-test',title:'Fuente de prueba',section:'Contexto',text:'Fragmento de prueba',checkedAt:'2026-10-18',url:'https://www.who.int/'};
 const c=await local(t,{client:{configured:true,generate:async context=>{seen.push(context);return{result:{...output,resumen:'Evaluación '+seen.length},model:'mock'};}},retriever:{status:{ready:true},retrieve:async context=>({status:'matched',retrieved:[chunk]})}});
 let s=await(await c.api('/api/sessions',{consent:true})).json();
 for(const a of ['Alias','Malestar inicial','9','a','1','3 meses, caso ficticio'])s=await(await c.api('/api/sessions/'+s.id+'/answer',{questionId:s.questionId,answer:a,expectedRevision:s.revision})).json();
 s=await(await c.api('/api/sessions/'+s.id+'/orientation',{expectedRevision:s.revision})).json();
 assert.equal(s.orientation.result.resumen,'Evaluación 1');const oldRevision=s.revision;
 s=await(await c.api('/api/sessions/'+s.id+'/extra',{expectedRevision:s.revision,text:'Información extra nueva'})).json();assert.equal(s.orientation,null);
 assert.equal((await c.api('/api/sessions/'+s.id+'/extra',{expectedRevision:oldRevision,text:'No debe duplicarse'})).status,409);
 s=await(await c.api('/api/sessions/'+s.id+'/orientation',{expectedRevision:s.revision})).json();assert.equal(s.orientation.result.resumen,'Evaluación 2');
 assert.equal(seen[1].extraInformation[0].text,'Información extra nueva');assert.ok(seen[1].fields.some(f=>f.key==='reason'&&f.answer==='Malestar inicial'));
 const exported=await(await c.api('/api/sessions/'+s.id+'/export')).json();assert.equal(exported.session.orientationHistory[0].result.resumen,'Evaluación 1');
});
test('HTTP: descarta una evaluación pendiente si llega información nueva',async t=>{
 let release,started;const ready=new Promise(r=>{started=r;});const blocked=new Promise(r=>{release=r;});
 const c=await local(t,{client:{configured:true,generate:async()=>{started();await blocked;return{result:output,model:'mock'};}},retriever:{status:{ready:true},retrieve:async()=>({status:'unmatched',retrieved:[]})}});
 let s=await(await c.api('/api/sessions',{consent:true})).json();
 for(const a of ['Alias','Ficción','9','e'])s=await(await c.api('/api/sessions/'+s.id+'/answer',{questionId:s.questionId,answer:a,expectedRevision:s.revision})).json();
 const generating=c.api('/api/sessions/'+s.id+'/orientation',{expectedRevision:s.revision});await ready;
 const updated=await c.api('/api/sessions/'+s.id+'/extra',{expectedRevision:s.revision,text:'Cambio de contexto'});assert.equal(updated.status,200);
 release();assert.equal((await generating).status,409);
 const current=await(await c.api('/api/sessions/'+s.id)).json();assert.equal(current.orientation,null);assert.equal(current.extraInformation.length,1);
});
test('presentación: sin No adicional, resultados técnicos o preguntas profesionales; aviso dinámico',async()=>{
 const {emergencyChoices,resultSections,resultNotice,bmiText}=await import('./public/view.mjs');
 const choices=emergencyChoices(CONTENT);assert.equal(choices.length,8);assert.ok(!choices.some(x=>x.value==='no'));
 for(const o of choices.slice(1))assert.match(o.label,/^[B-H]\. 🔵/);
 assert.ok(!resultSections({...output,preguntas_para_profesional:['Texto oculto']}).some(s=>s.key==='preguntas_para_profesional'));
 assert.match(resultNotice('modelo-real'),/modelo-real/);assert.match(bmiText({bmi:27.68,display:27.68,classification:'sobrepeso',weightKg:80,heightCm:170}),/80 kg.*170 cm/);
 const html=readFileSync(new URL('./public/index.html',import.meta.url),'utf8');
 for(const text of ['Orientación con biblioteca y OpenAI','Promedios de esta prueba local','Nueva prueba de preguntas','Las respuestas permanecen en memoria','Respuestas registradas'])assert.ok(!html.includes(text),text);
});
test('cliente local amplía solo el modo de emergencia y conserva el modelo configurado',async()=>{
 const {createPaso23Client,EMERGENCY_INSTRUCTIONS}=await import('./local-client.mjs');const bodies=[];
 const client=createPaso23Client({enabled:true,apiKey:'fake-test',model:'modelo-test',fetchImpl:async(url,init)=>{
  bodies.push(JSON.parse(init.body));return{ok:true,json:async()=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(output)}]}],model:'modelo-real',usage:{}})};
 }});
 await client.generate({safety:{status:'not_determined'}});await client.generate({safety:{status:'possible_alarm'},extraInformation:[{text:'Relato'}]});
 assert.notEqual(bodies[0].instructions,EMERGENCY_INSTRUCTIONS);assert.equal(bodies[1].instructions,EMERGENCY_INSTRUCTIONS);assert.equal(bodies[1].model,'modelo-test');assert.equal(JSON.parse(bodies[1].input[0].content).extraInformation[0].text,'Relato');
});

test('recuperación usa síntomas acompañantes y normaliza edad sin enviar el nombre',async()=>{
 const {retrievalContextFor,retrieveForPaso23}=await import('./local-retrieval.mjs');
 const {retrievalQuery}=await import('../src/rag.js');
 const context={fields:[{key:'reason',answer:'Me duele la cabeza',status:'reported',omitted:false},{key:'location_description',answer:'Náuseas y mareo al caminar',status:'reported',omitted:false},{key:'age',answer:'45 años',status:'reported',omitted:false},{key:'cancer_diabetes',answer:'Sí',status:'reported',omitted:false}]};
 const normalized=retrievalContextFor(context);assert.equal(normalized.fields.find(f=>f.key==='age').answer,'45');assert.equal(context.fields.find(f=>f.key==='age').answer,'45 años');
 assert.ok(retrievalQuery(normalized).topics.includes('dizziness'));
 const corpus=JSON.parse(readFileSync(new URL('../knowledge/corpus.json',import.meta.url),'utf8'));
 const {flattenCorpus}=await import('../src/rag.js');const chunks=flattenCorpus(corpus);
 let sent;const retriever={corpus,chunks,retrieve:async c=>{sent=c;return{status:'matched',retrieved:chunks.filter(c=>c.id.startsWith('healthdirect-headache')).slice(0,2)};}};
 const result=await retrieveForPaso23(retriever,context);assert.equal(result.retrieved.length,3);
 assert.ok(result.retrieved.some(c=>c.kind==='warning'&&c.topic==='headache'));
 assert.ok(result.retrieved.some(c=>c.kind==='history'&&c.topic==='headache'));
 assert.ok(result.retrieved.some(c=>c.topic==='dizziness'));
 assert.ok(!sent.fields.some(f=>f.key==='respondent'));
 const child={fields:context.fields.map(f=>f.key==='age'?{...f,answer:'10 años 0 meses'}:f)};
 const childResult=await retrieveForPaso23(retriever,child);assert.ok(!childResult.retrieved.some(c=>c.id.startsWith('nice-headache')));
});
test('análisis ampliado: esfuerzo medio y prompt versionado para la reevaluación completa',async()=>{
 const {createPaso23Client,ANALYSIS_PROMPT_VERSION,NORMAL_INSTRUCTIONS}=await import('./local-client.mjs');let request;
 const client=createPaso23Client({enabled:true,apiKey:'fake-test',model:'modelo-test',fetchImpl:async(url,init)=>{
  request=JSON.parse(init.body);return{ok:true,json:async()=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(output)}]}],model:'modelo-test',usage:{}})};
 }});
 const context={fields:[{key:'history',answer:'no'},{key:'severity',answer:'8'}],extraInformation:[{text:'Dolores intensos durante seis meses'}],safety:{status:'not_determined'}};
 const result=await client.generate(context);assert.equal(request.instructions,NORMAL_INSTRUCTIONS);assert.equal(request.reasoning.effort,'medium');
 assert.deepEqual(JSON.parse(request.input[0].content),context);assert.equal(result.promptVersion,ANALYSIS_PROMPT_VERSION);
 const {resultSections}=await import('./public/view.mjs');assert.equal(resultSections(output)[0].key,'siguiente_paso');
 const html=readFileSync(new URL('./public/index.html',import.meta.url),'utf8');assert.ok(html.indexOf('<nav>')>html.indexOf('id="extra-answers"'));assert.equal((html.match(/id="restart"/g)||[]).length,1);assert.ok(html.indexOf('id="result-institutions"')>html.indexOf('id="generated"'));assert.match(html,/Le invito a que visite un centro de salud publico o privado/);
});
