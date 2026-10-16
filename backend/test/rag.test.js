import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createEmbeddingClient,DIMENSIONS,EMBEDDING_MODEL} from '../src/embeddings.js';
import {CORPUS_PATH,validateCorpus,flattenCorpus,makeIndex,validateIndex,corpusHash,cosine,retrievalQuery,RagRetriever,bindEvidence,NO_EVIDENCE_MESSAGE} from '../src/rag.js';
import {OrientationService} from '../src/orientation.js';
import {LegacyStore as FirestoreStore} from '../test-support/legacy-store.js';
import {validateOrientation} from '../src/openai-client.js';
import {FakeDB} from '../test-support/fake-db.js';
const corpus=JSON.parse(readFileSync(new URL('../test-support/pilot-corpus.json',import.meta.url),'utf8')),chunks=flattenCorpus(corpus),now=()=>Date.parse('2026-10-14T18:00:00Z');
const vector=(n=0)=>Array.from({length:DIMENSIONS},(_,i)=>i===n?1:0);
const vectors=chunks.map(c=>vector(['headache','abdominal','dizziness','food_allergy'].indexOf(c.topic)));
const index=makeIndex(corpus,vectors);
const field=(key,answer,status='reported')=>({key,answer,status,clarifications:[]});
const result={fuentes_usadas:[],aclaraciones_sugeridas:[],resumen:'Resumen referido.',datos_por_aclarar:[],orientacion_general:'Orientación informativa.',siguiente_paso:'Solicita evaluación profesional.',preguntas_para_profesional:[]};
function retriever(embed=async()=>({vectors:[vector(0)],usage:{inputTokens:8}}),options={}){return new RagRetriever({corpus,index,client:{configured:true,embed},now,...options});}
async function fixture(){const store=new FirestoreStore(new FakeDB()),s=await store.create('A');
 const answers={location_detail:'No sé',location_description:'Molestia continua',remedies_use:'No',name:'Alias privado',age:'33',sex:'M',weight:'70',height:'175',alarm_screen:'No',reason:'dolor de cabeza',onset:'desde ayer',location:'frente',severity:'4',associated:'No sé',history:'ninguna',medications:'ninguno',allergies:'ninguna'};
 let fresh=s;while(fresh.clinicalState.pendingQuestions.length){const q=fresh.clinicalState.pendingQuestions[0];await store.append(s.id,'A',answers[q.id],randomUUID(),q.id);fresh=await store.get(s.id,'A');}
 await store.beginAdditional(s.id,'A',{expectedRevision:fresh.clinicalState.revision,requestId:randomUUID()},'review');await store.append(s.id,'A','No',randomUUID(),'alarm_recheck');fresh=await store.get(s.id,'A');return {store,id:s.id,body:{consent:true,expectedRevision:fresh.clinicalState.revision}};
}
test('corpus: cuatro fuentes, ocho resúmenes, metadatos y URLs controladas',()=>{
 assert.equal(validateCorpus(corpus),corpus);assert.equal(corpus.documents.length,4);assert.equal(chunks.length,8);assert.ok(chunks.every(c=>c.checkedAt==='2026-10-14'&&c.clinicalReview==='pending'));
 for(const url of ['javascript:alert(1)','https://medlineplus.gov.evil.example/spanish/headache.html','https://evil@medlineplus.gov/spanish/headache.html']){const bad=structuredClone(corpus);bad.documents[0].url=url;assert.throws(()=>validateCorpus(bad));}
 const bad=structuredClone(corpus);bad.documents[0].chunks[1].id=bad.documents[0].chunks[0].id;assert.throws(()=>validateCorpus(bad));
});
test('índice vinculado al contenido, modelo, dimensiones y fragmentos; rechaza cambios',()=>{
 assert.equal(validateIndex(corpus,index),index);assert.equal(cosine(vector(0),vector(0)),1);assert.equal(cosine(vector(0),vector(1)),0);
 for(const patch of [{corpusHash:'otro'},{model:'otro'},{dimensions:7},{rows:[{id:chunks[0].id,vector:[1]}]}])assert.throws(()=>validateIndex(corpus,{...index,...patch}));
 const changed=structuredClone(corpus);changed.documents[0].chunks[0].text+=' Cambio.';assert.notEqual(corpusHash(changed),corpusHash(corpus));assert.throws(()=>validateIndex(changed,index));
});
test('consulta excluye identificadores, desconocidos, negaciones simples y tratamientos',()=>{
 const context={fields:[field('name','Nombre privado'),field('reason','dolor de cabeza'),field('associated','sin mareo'),field('allergies','cacahuate','unknown'),field('medications','aspirina'),field('history','diabetes'),field('age','33')]};
 const q=retrievalQuery(context);assert.deepEqual(q.topics,['headache']);assert.doesNotMatch(q.query,/Nombre|privado|mareo|cacahuate|aspirina|diabetes|33/);
 assert.deepEqual(retrievalQuery({fields:[field('reason','dolor de rodilla')]}).topics,[]);
 assert.throws(()=>retrievalQuery({fields:[field('reason','cabeza'.repeat(700))]}),{status:400});
});
test('recupera por similitud solo temas presentes, conserva URLs y limita a tres fragmentos',async()=>{
 let sent;const rag=retriever(async input=>{sent=input;return {vectors:[vector(0)],usage:{inputTokens:4}};});
 const hit=await rag.retrieve({fields:[field('reason','dolor d ecabeza')]});
 assert.equal(sent.length,1);assert.equal(hit.status,'matched');assert.equal(hit.retrieved.length,2);assert.ok(hit.retrieved.every(c=>c.topic==='headache'&&c.url===corpus.documents[0].url));
 for(const [topic,i,text]of [['abdominal',1,'dolor de estómago'],['dizziness',2,'mareos'],['food_allergy',3,'alergia al cacahuate']]){const r=retriever(async()=>({vectors:[vector(i)],usage:{inputTokens:1}}));const hit=await r.retrieve({fields:[field('reason',text)]});assert.ok(hit.retrieved.length);assert.ok(hit.retrieved.every(c=>c.topic===topic));}
});
test('motivo fuera de cobertura o similitud insuficiente: no inventa evidencia',async()=>{
 let calls=0;const r=retriever(async()=>{calls++;return {vectors:[vector(1)],usage:{inputTokens:1}};});
 assert.equal((await r.retrieve({fields:[field('reason','dolor de rodilla')]})).status,'insufficient_evidence');assert.equal(calls,0);
 assert.equal((await r.retrieve({fields:[field('reason','dolor de cabeza')]})).retrieved.length,0);assert.equal(calls,1);
 const bound=bindEvidence(result,{status:'insufficient_evidence',retrieved:[]});assert.equal(bound.result.orientacion_general,NO_EVIDENCE_MESSAGE);assert.deepEqual(bound.rag.sources,[]);
});
test('índice ausente, obsoleto, credenciales ausentes o fecha de revisión impiden usar la base',async()=>{
 for(const [opts,state] of [[{index:null},'index_required'],[{index:{...index,model:'otro'}},'index_required'],[{client:{configured:false}},'credentials_required'],[{now:()=>Date.parse('2027-04-16')},'review_required']]){
 const r=retriever(undefined,opts);assert.equal(r.status.ready,false);assert.equal(r.status.state,state);await assert.rejects(r.retrieve({fields:[]}),{status:503});}
});
test('citas solo de fragmentos recuperados; no acepta inventadas, duplicadas ni URLs del modelo',()=>{
 const source=chunks[0],evidence={status:'matched',retrieved:[source]};
 const bound=bindEvidence({...result,fuentes_usadas:[source.id]},evidence);assert.equal(bound.rag.sources[0].url,source.url);assert.equal(bound.rag.sources[0].text,source.text);
 assert.throws(()=>bindEvidence({...result,fuentes_usadas:['inventado']},evidence),{status:502});
 assert.throws(()=>validateOrientation({...result,fuentes_usadas:[source.id,source.id]}),{status:502});
 assert.throws(()=>validateOrientation({...result,orientacion_general:'Visita https://malicioso.example'}),{status:502});
});
test('embeddings: endpoint y dimensiones, valida orden, no envía clave dentro del texto',async()=>{
 let body,url;const client=createEmbeddingClient({apiKey:'clave-simulada',fetchImpl:async(u,o)=>{url=u;body=JSON.parse(o.body);return Response.json({model:EMBEDDING_MODEL,data:[{index:1,embedding:vector(1)},{index:0,embedding:vector(0)}],usage:{total_tokens:12}});}});
 const got=await client.embed(['texto uno','texto dos']);assert.equal(url,'https://api.openai.com/v1/embeddings');assert.equal(body.dimensions,512);assert.equal(body.encoding_format,'float');assert.equal(body.model,EMBEDDING_MODEL);assert.doesNotMatch(JSON.stringify(body),/clave-simulada/);assert.deepEqual(got.vectors,[vector(0),vector(1)]);
});
test('embeddings: controla entrada, rechazo, timeout, filas duplicadas y valores inválidos',async()=>{
 await assert.rejects(createEmbeddingClient({enabled:false}).embed(['texto']),{status:503});
 await assert.rejects(createEmbeddingClient({apiKey:'fake'}).embed([]),{status:400});
 await assert.rejects(createEmbeddingClient({apiKey:'fake',fetchImpl:async()=>{throw new Error();}}).embed(['texto']),{status:504});
 for(const [status,data,expected]of [[429,{},429],[401,{},502],[200,{model:'otro',data:[]},502],[200,{model:EMBEDDING_MODEL,data:[{index:1,embedding:vector()}]},502],[200,{model:EMBEDDING_MODEL,data:[{index:0,embedding:Array(512).fill(0)}]},502]])await assert.rejects(createEmbeddingClient({apiKey:'fake',fetchImpl:async()=>Response.json(data,{status})}).embed(['texto']),{status:expected});
});
test('integración: persiste evidencia y fuentes, reutiliza resultado sin repetir embeddings ni LLM',async()=>{
 const {store,id,body}=await fixture();let embeds=0,calls=0,context;
 const rag=retriever(async()=>{embeds++;return {vectors:[vector(0)],usage:{inputTokens:2}};});
 const client={configured:true,promptVersion:'orientation-rag-v1',generate:async c=>{calls++;context=c;return {result:{...result,fuentes_usadas:[c.evidence.retrieved[0].id]},model:'simulado',promptVersion:'orientation-rag-v1',usage:{inputTokens:3,outputTokens:4}};}};
 const service=new OrientationService(store,client,{retriever:rag});
 const one=await service.generate(id,'A',body);assert.equal(one.orientation.rag.status,'matched');assert.equal(one.orientation.rag.sources.length,1);
 assert.equal((await service.generate(id,'A',body)).cached,true);assert.equal(calls,1);assert.equal(embeds,1);assert.doesNotMatch(JSON.stringify(context),/Alias privado|sourceMessageId|ownerUid/);
 const recovered=await new FirestoreStore(store.db).get(id,'A');assert.equal(recovered.orientation.rag.sources[0].url,corpus.documents[0].url);assert.equal(recovered.orientation.rag.retrieved.length,2);
});
test('consentimiento, propiedad, señales e índice se verifican antes de cualquier costo',async()=>{
 const {store,id,body}=await fixture();let calls=0;const r=retriever(async()=>{calls++;return {vectors:[vector()],usage:{inputTokens:1}};});const client={configured:true,generate:async()=>{calls++;throw new Error('No debe llamarse');}};const service=new OrientationService(store,client,{retriever:r});
 await assert.rejects(service.generate(id,'A',{...body,consent:false}),{status:400});await assert.rejects(service.generate(id,'B',body),{status:404});assert.equal(calls,0);
 const unavailable=new OrientationService(store,client,{retriever:retriever(undefined,{index:null})});await assert.rejects(unavailable.generate(id,'A',body),{status:503});assert.equal((await store.get(id,'A')).orientationAttempts,undefined);
 await store.correct(id,'A','No puedo respirar',randomUUID(),'associated',body.expectedRevision);const fresh=await store.get(id,'A');await assert.rejects(service.generate(id,'A',{...body,expectedRevision:fresh.clinicalState.revision}),{status:409});assert.equal(calls,0);
});
test('alarma o corrección durante embeddings impide la llamada posterior al LLM',async()=>{
 for(const answer of ['72','No puedo respirar']){const {store,id,body}=await fixture();let calls=0;const r=retriever(async()=>{await store.correct(id,'A',answer,randomUUID(),answer==='72'?'weight':'associated',body.expectedRevision);return {vectors:[vector()],usage:{inputTokens:1}};});
 const service=new OrientationService(store,{configured:true,generate:async()=>{calls++;throw new Error();}},{retriever:r});await assert.rejects(service.generate(id,'A',body),{status:409});assert.equal(calls,0);assert.equal((await store.get(id,'A')).orientation,undefined);}
});
test('error de búsqueda no guarda orientación ni hace fallback oculto al LLM',async()=>{
 const {store,id,body}=await fixture();let calls=0;const r=retriever(async()=>{throw Object.assign(new Error('Fallo simulado'),{status:502});});const service=new OrientationService(store,{configured:true,generate:async()=>{calls++;}},{retriever:r});await assert.rejects(service.generate(id,'A',body),{status:502});assert.equal(calls,0);assert.equal((await store.get(id,'A')).orientationRun.status,'failed');
});
test('cambiar el corpus invalida la orientación en caché y vuelve a recuperar las fuentes',async()=>{
 const {store,id,body}=await fixture();let calls=0;
 const client={configured:true,promptVersion:'orientation-rag-v1',generate:async c=>{calls++;return {result:{...result,fuentes_usadas:[c.evidence.retrieved[0].id]},model:'simulado',promptVersion:'orientation-rag-v1',usage:{inputTokens:1,outputTokens:1}};}};
 await new OrientationService(store,client,{retriever:retriever()}).generate(id,'A',body);
 const changed=structuredClone(corpus);changed.version='checkia-pilot-revision';
 const updated=retriever(undefined,{corpus:changed,index:makeIndex(changed,vectors)});
 const next=await new OrientationService(store,client,{retriever:updated}).generate(id,'A',body);
 assert.equal(next.cached,false);assert.equal(calls,2);assert.equal(next.orientation.rag.corpusHash,corpusHash(changed));
});
test('una cita no recuperada impide guardar el resultado aunque el modelo dé JSON válido',async()=>{
 const {store,id,body}=await fixture();const service=new OrientationService(store,{configured:true,generate:async()=>({result:{...result,fuentes_usadas:['mp-abdominal-context']},model:'simulado',promptVersion:'orientation-rag-v1',usage:{inputTokens:1,outputTokens:1}})},{retriever:retriever()});
 await assert.rejects(service.generate(id,'A',body),{status:502});assert.equal((await store.get(id,'A')).orientation,undefined);
});
