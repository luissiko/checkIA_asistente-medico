import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CONTENT,initialState,advance,pending,bmiFor,contextFor,canGenerate} from './engine.mjs';
import {createLocalServer} from './server.mjs';

const defaults = {respondent:'Para mí, Luis 34',reason:'Caso ficticio: malestar',emergency_level:'2',emergency_options:'no',age:'30',sex:'h',weight:'80 kg',height:'1.70 m',alarm_recheck:'no',onset:'ayer',location:'brazo',location_description:'texto libre 123',severity:'no tengo dolor 0',city:'Cancún',origin:'Campeche',answers_confirmation:'si'};
function until(target, overrides={}, state=initialState()) {
  for(let i=0;i<100;i++){
    if(state.questionId===target || !state.questionId)return state;
    const q=pending(state);state=advance(state,q.id,overrides[q.id]??defaults[q.id]??(q.kind==='yesno'?'no':'Información libre'));
  }
  throw Error('Ruta cíclica');
}
test('fuente íntegra y preguntas literales, también las tachadas',()=>{
  const bytes=readFileSync(new URL('../../docs/paso23/ORIGINAL_USUARIO.md',import.meta.url));
  assert.equal(CONTENT.sourceSha256,createHash('sha256').update(bytes).digest('hex'));
  const text=bytes.toString().replaceAll('\r','\n').replaceAll('~~','').replaceAll('**','');
  for(const q of CONTENT.questions)assert.ok(text.includes(q.text),q.id+' debe coincidir con la fuente');
  for(const o of CONTENT.emergencyOptions.filter(o=>o.question))assert.ok(text.includes(o.question));
  assert.equal(CONTENT.questions.find(q=>q.id==='respondent').text,'¿La consulta es para ti o para otra persona?');
});
test('recorrido adulto completo, saltos negativos y confirmación',()=>{
  const s=until(null);assert.equal(s.phase,'complete');assert.ok(canGenerate(s));
  const ids=s.answers.map(a=>a.key);assert.ok(!ids.includes('pregnant'));assert.ok(!ids.includes('children_count'));assert.ok(!ids.includes('medications_details'));assert.ok(ids.includes('remedies'));assert.ok(!ids.includes('activity_detail'));assert.ok(ids.includes('unhealthy_food'));assert.equal(s.bmi.display,27.68);
});
test('mujer: hijos, cantidad, embarazo y meses; rama afirmativa completa',()=>{
  const s=until(null,{sex:'m',has_children:'si',children_count:'2',pregnant:'si',pregnancy_months:'3 meses',history:'si',medications:'si',medications_knows_active:'si',remedies:'si',allergies:'si',family_history:'si',physical_activity:'si',healthy_diet:'si',avoids_processed:'si'});
  const ids=s.answers.map(a=>a.key);
  assert.ok(ids.indexOf('has_children')<ids.indexOf('children_count'));assert.ok(ids.indexOf('children_count')<ids.indexOf('pregnant'));
  for(const key of ['pregnancy_months','history_detail','medications_identity','remedies_detail','allergy_timing','allergy_reaction','family_relative','activity_detail'])assert.ok(ids.includes(key),key);
  assert.ok(!ids.includes('unhealthy_food'));assert.equal(s.bmi.classification,'requiere_interpretacion_por_embarazo');
});
test('texto y números sin bloqueo; si/no estricto; texto original intacto',()=>{
  let s=until('age');s=advance(s,'age','No lo sé, quizá 20 o 21');assert.equal(s.answers.at(-1).text,'No lo sé, quizá 20 o 21');
  s=until('medications',{},s);assert.throws(()=>advance(s,'medications','tal vez'),e=>e.status===400);
  s=advance(s,'medications','Sí');assert.equal(s.questionId,'medications_details');
});
test('nivel 8 continúa, 9 y 10 muestran alerta sin esperar API',()=>{
  for(const [level,alarm] of [['0',false],['8',false],['9',true],['10',true],['nueve aprox',false]]){
    let s=until('emergency_level');s=advance(s,'emergency_level',level);assert.equal(s.questionId,'emergency_options');assert.equal(Boolean(s.alert),alarm);
  }
});
test('cada opción b–g muestra su texto propio y termina esa ruta',()=>{
  for(const letter of 'bcdefg'){
    let s=until('emergency_options');s=advance(s,'emergency_options',letter);assert.equal(s.phase,'emergency');assert.equal(s.alert.kind,letter);assert.ok(s.alert.content.paragraphs.length>3);assert.match(s.alert.content.paragraphs.join(' '),/911/);assert.equal(canGenerate(s),false);
  }
});
test('las cuatro ramas especiales conservan la descripción para RAG/LLM',()=>{
  for(const [group,key] of [['1','infant_emergency'],['2','pregnancy_emergency'],['3','older_emergency'],['4','disability_emergency']]){
    let s=until('emergency_options');s=advance(s,s.questionId,'a');s=advance(s,s.questionId,group);assert.equal(s.questionId,key);
    s=advance(s,key,'3 meses; ejemplo ficticio');assert.equal(s.phase,'emergency');assert.ok(canGenerate(s));assert.ok(contextFor(s).fields.some(f=>f.key==='reason'&&f.answer==='3 meses; ejemplo ficticio'));
  }
});
test('grupo 5 continúa a edad y pregunta 7 conserva sus ocho señales',()=>{
  let s=until('emergency_options');s=advance(s,s.questionId,'a');s=advance(s,s.questionId,'5');assert.equal(s.questionId,'age');
  s=until('alarm_recheck',{},s);assert.equal(CONTENT.recheckOptions.length,8);s=advance(s,s.questionId,'si');assert.equal(s.questionId,'emergency_options');assert.ok(s.alert);
});
test('IMC, unidades y límites sin clasificar con medias anuales',()=>{
  const state=(age,weight,height)=>({answers:[{key:'age',text:age},{key:'weight',text:weight},{key:'height',text:height}]});
  assert.equal(bmiFor(state('30','80','170')).display,27.68);assert.equal(bmiFor(state('30','80','1.70')).display,27.68);
  assert.equal(bmiFor(state('30','80','170 cm')).heightCm,170);assert.equal(bmiFor(state('30','80','1.70 cm')).heightCm,1.7);
  assert.equal(bmiFor(state('10','45','120')).classification,'requiere_referencia_pediatrica_o_especifica');
  assert.equal(bmiFor(state('30','texto','170')).bmi,null);assert.equal(bmiFor(state('30','80','0')).bmi,null);
  assert.equal(bmiFor(state('19','100','200')).classification,'sobrepeso_sin_obesidad');
  assert.equal(bmiFor(state('81','80','170')).classification,'requiere_referencia_pediatrica_o_especifica');
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
  for(const answer of ['Para mi bebé','Caso ficticio','3','a','1','3 meses, caso ficticio'])s=await(await c.api('/api/sessions/'+s.id+'/answer',{questionId:s.questionId,answer,expectedRevision:s.revision})).json();
  const r=await c.api('/api/sessions/'+s.id+'/orientation',{expectedRevision:s.revision});assert.equal(r.status,200);const result=await r.json();assert.equal(result.orientation.model,'mock');assert.equal(received.evidence.retrieved[0].id,'doc-test');assert.ok(received.fields.some(f=>f.key==='reason'&&f.answer.includes('3 meses')));
  assert.equal(result.orientation.rag.sources[0].id,'doc-test');
});
test('HTTP: sin consentimiento no se llama al proveedor y CORS bloquea origen externo',async t=>{
  const c=await local(t,{client:{configured:true,generate:()=>assert.fail('No se debe llamar sin consentimiento')}});
  let s=await(await c.api('/api/sessions',{})).json();
  for(const answer of ['Yo','Caso ficticio','2','a','1','Caso ficticio'])s=await(await c.api('/api/sessions/'+s.id+'/answer',{questionId:s.questionId,answer,expectedRevision:s.revision})).json();
  assert.equal((await c.api('/api/sessions/'+s.id+'/orientation',{expectedRevision:s.revision})).status,400);
  assert.equal((await fetch(c.base+'/api/config',{headers:{cookie:c.cookie,origin:'https://otro-sitio.example'}})).status,403);
});
