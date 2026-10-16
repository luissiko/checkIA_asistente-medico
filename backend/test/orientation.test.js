import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {LegacyStore as FirestoreStore} from '../test-support/legacy-store.js';
import {OrientationService,orientationContext} from '../src/orientation.js';
import {createOpenAIClient,validateOrientation} from '../src/openai-client.js';
import {createApp} from '../src/app.js';
import {FakeDB} from '../test-support/fake-db.js';
const result={fuentes_usadas:[],aclaraciones_sugeridas:['onset_time'],resumen:'Refieres molestias en el abdomen desde ayer.',datos_por_aclarar:['Falta conocer la evolución.'],orientacion_general:'Lleva el resumen de tus respuestas a la consulta.',siguiente_paso:'Solicita una evaluación profesional. No esperes esta herramienta si aparecen señales de alarma.',preguntas_para_profesional:['¿Qué datos conviene registrar?']};
const generated={result,model:'gpt-5-mini',promptVersion:'orientation-rag-v1',usage:{inputTokens:100,outputTokens:120}};
async function fixture(){
 const db=new FakeDB(),store=new FirestoreStore(db),s=await store.create('A');
 const values={location_detail:'No sé',location_description:'Molestia continua',remedies_use:'No',name:'Nombre privado',age:'33',sex:'M',weight:'70',height:'175',alarm_screen:'No',reason:'molestia en el abdomen',onset:'ayer',location:'parte superior del abdomen',severity:'4',associated:'No sé',history:'ninguna',medications:'ninguno',allergies:'ninguna'};
 let fresh=s;
 while(fresh.clinicalState.pendingQuestions.length){const q=fresh.clinicalState.pendingQuestions[0];assert.ok(q.id in values,q.id);await store.append(s.id,'A',values[q.id],randomUUID(),q.id);fresh=await store.get(s.id,'A');}
 await store.beginAdditional(s.id,'A',{expectedRevision:fresh.clinicalState.revision,requestId:randomUUID()},'review');
 await store.append(s.id,'A','No',randomUUID(),'alarm_recheck');fresh=await store.get(s.id,'A');
 return {db,store,s:fresh,body:{consent:true,expectedRevision:fresh.clinicalState.revision}};
}
const fakeClient=(generate=async()=>generated)=>({configured:true,model:'gpt-5-mini',generate});
test('contexto omite nombre, cuenta e identificadores; conserva desconocidos y omisiones',async()=>{
 const {s}=await fixture(),context=orientationContext(s),encoded=JSON.stringify(context);
 assert.doesNotMatch(encoded,/Nombre privado|ownerUid|sourceMessageId|sessionId/);
 assert.equal(context.fields.find(f=>f.key==='associated').status,'unknown');assert.equal(context.fields.find(f=>f.key==='allergy_reaction').omitted,true);
 assert.equal(context.safety.status,'user_denied_listed_signs');
 const huge=structuredClone(s);huge.clinicalState.facts.find(f=>f.key==='reason').text='a'.repeat(33000);assert.throws(()=>orientationContext(huge),{status:400});
});
test('guarda, recupera y reutiliza resultado de misma revisión sin llamar dos veces',async()=>{
 const {store,s,body}=await fixture();let calls=0;const service=new OrientationService(store,fakeClient(async()=>{calls++;return generated;}));
 const one=await service.generate(s.id,'A',body),two=await service.generate(s.id,'A',body);
 assert.equal(calls,1);assert.equal(one.cached,false);assert.equal(two.cached,true);
 const recovered=await new FirestoreStore(store.db).get(s.id,'A');assert.equal(recovered.orientation.result.resumen,result.resumen);
 assert.equal(recovered.clinicalState.revision,body.expectedRevision);assert.equal(recovered.orientationConsent.provider,'OpenAI');
 await store.close(s.id,'A');assert.equal((await service.generate(s.id,'A',body)).cached,true);
});
test('rechaza consentimiento ausente, otro propietario, revisión obsoleta, entrevista incompleta y alerta',async()=>{
 const {store,s,body}=await fixture();let calls=0;const service=new OrientationService(store,fakeClient(async()=>{calls++;return generated;}));
 await assert.rejects(service.generate(s.id,'A',{...body,consent:false}),{status:400});
 await assert.rejects(service.generate(s.id,'B',body),{status:404});
 await assert.rejects(service.generate(s.id,'A',{...body,expectedRevision:0}),{status:409});
 const partial=await store.create('A');await assert.rejects(service.generate(partial.id,'A',{consent:true,expectedRevision:0}),{status:409});
 await store.correct(s.id,'A','No puedo respirar',randomUUID(),'associated',body.expectedRevision);
 const flagged=await store.get(s.id,'A');await assert.rejects(service.generate(s.id,'A',{...body,expectedRevision:flagged.clinicalState.revision}),{status:409});assert.equal(calls,0);
});
test('corrección obliga a nueva orientación y no reutiliza texto anterior',async()=>{
 const {store,s,body}=await fixture();let calls=0;const service=new OrientationService(store,fakeClient(async()=>{calls++;return generated;}));
 await service.generate(s.id,'A',body);await store.correct(s.id,'A','72',randomUUID(),'weight',body.expectedRevision);
 let fresh=await store.get(s.id,'A');assert.notEqual(fresh.orientation.basedOnRevision,fresh.clinicalState.revision);
 await store.beginAdditional(s.id,'A',{expectedRevision:fresh.clinicalState.revision,requestId:randomUUID()},'review');
 await store.append(s.id,'A','No',randomUUID(),'alarm_recheck');fresh=await store.get(s.id,'A');
 await service.generate(s.id,'A',{...body,expectedRevision:fresh.clinicalState.revision});assert.equal(calls,2);
});
test('bloqueo pendiente evita otra llamada; cambio durante generación impide guardar resultado obsoleto',async()=>{
 const {store,s,body}=await fixture();let release;const paused=new Promise(r=>release=r);let entered;const started=new Promise(r=>entered=r);let calls=0;
 const service=new OrientationService(store,fakeClient(async()=>{calls++;entered();await paused;return generated;}));
 const run=service.generate(s.id,'A',body);await started;
 await assert.rejects(service.generate(s.id,'A',body),{status:409});
 await store.correct(s.id,'A','72',randomUUID(),'weight',body.expectedRevision);release();await assert.rejects(run,{status:409});
 const fresh=await store.get(s.id,'A');assert.equal(fresh.orientation,undefined);assert.equal(fresh.orientationRun.status,'failed');assert.equal(calls,1);
});
test('borrar durante generación no recrea documentos ni guarda datos',async()=>{
 const {store,s,body}=await fixture();let release,entered;const gate=new Promise(r=>release=r),started=new Promise(r=>entered=r);
 const service=new OrientationService(store,fakeClient(async()=>{entered();await gate;return generated;}));
 const run=service.generate(s.id,'A',body);await started;await store.delete(s.id,'A');release();await assert.rejects(run,{status:404});assert.equal(store.db.data.has('checkia_sessions/'+s.id),false);
});
test('fallos no guardan orientación, aplican espera y limitan cinco intentos',async()=>{
 const {store,s,body}=await fixture();let now=1000,calls=0;const service=new OrientationService(store,fakeClient(async()=>{calls++;throw Object.assign(new Error('Servicio no disponible'),{status:502});}),{now:()=>now});
 for(let i=0;i<5;i++){await assert.rejects(service.generate(s.id,'A',body),{status:502});await assert.rejects(service.generate(s.id,'A',body),{status:429});now+=16000;}
 await assert.rejects(service.generate(s.id,'A',body),{status:429});assert.equal(calls,5);assert.equal((await store.get(s.id,'A')).orientation,undefined);
});
test('cliente REST: Responses, store false, esquema estricto, sin enviar clave en el cuerpo',async()=>{
 let captured;const client=createOpenAIClient({apiKey:'clave-simulada',enabled:true,fetchImpl:async(url,options)=>{captured={url,options};return new Response(JSON.stringify({status:'completed',model:'gpt-5-mini',output:[{type:'reasoning'},{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(result)}]}],usage:{input_tokens:100,output_tokens:120}}),{status:200});}});
 assert.deepEqual((await client.generate({fields:[]})).result,result);
 const payload=JSON.parse(captured.options.body);assert.equal(captured.url,'https://api.openai.com/v1/responses');assert.equal(payload.store,false);assert.equal(payload.text.format.strict,true);assert.equal(payload.text.format.schema.additionalProperties,false);assert.doesNotMatch(captured.options.body,/clave-simulada/);
});
test('cliente maneja falta de clave, timeout, 429, rechazo y salida incompleta o inválida',async()=>{
 await assert.rejects(createOpenAIClient({enabled:false}).generate({}),{status:503});
 await assert.rejects(createOpenAIClient({enabled:true,apiKey:'fake',fetchImpl:async()=>{throw new Error('timeout');}}).generate({}),{status:504});
 for(const [status,body,expected] of [[200,{status:'completed',output:{}},502],[429,{},429],[401,{},502],[200,{status:'incomplete',output:[]},502],[200,{status:'completed',output:[{type:'message',role:'assistant',content:[{type:'refusal',refusal:'No'}]}]},502],[200,{status:'completed',output:[]},502],[200,{status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'{}'}]}]},502]]){
 const client=createOpenAIClient({enabled:true,apiKey:'fake',fetchImpl:async()=>new Response(JSON.stringify(body),{status})});await assert.rejects(client.generate({}),{status:expected});}
 assert.throws(()=>validateOrientation({...result,extra:'dato'}),{status:502});
});
test('ruta exige token y propiedad antes de enviar al proveedor',async()=>{
 const {store,s,body}=await fixture();let calls=0;const orientationService=new OrientationService(store,fakeClient(async()=>{calls++;return generated;}));
 const app=createApp({store,orientationService,verifyToken:async token=>{if(token!=='A'&&token!=='B')throw new Error('invalid');return {uid:token};}}),server=app.listen(0,'127.0.0.1');await once(server,'listening');
 try{const base='http://127.0.0.1:'+server.address().port,path='/api/sessions/'+s.id+'/orientation';
 for(const [token,expected]of [['',401],['B',404],['A',200]]){const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});assert.equal(response.status,expected);}
 assert.equal(calls,1);const health=await(await fetch(base+'/api/health')).json();assert.equal(health.stage,22);assert.equal(health.llm.configured,true);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
