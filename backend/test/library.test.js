import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CORPUS_PATH,validateCorpus,flattenCorpus,makeIndex,RagRetriever,retrievalQuery,validateIndex,bindEvidence,isApplicable} from '../src/rag.js';
import {mergeLibrary,libraryReport,evaluateRetrieval,embedLibrary} from '../src/knowledge-tools.js';
import {safeSourceUrl,SOURCE_HOSTS} from '../src/source-policy.js';
const corpus=JSON.parse(readFileSync(CORPUS_PATH,'utf8')),chunks=flattenCorpus(corpus),clock=()=>Date.parse('2026-10-14T18:00:00Z');
const vector=t=>Array.from({length:512},(_,i)=>i===corpus.topics.findIndex(x=>x.id===t)?1:0),index=makeIndex(corpus,chunks.map(c=>vector(c.topic)));
const context=answer=>({fields:[{key:'reason',answer,status:'reported',clarifications:[]}]});
test('biblioteca beta: diez instituciones, siete temas, 13 documentos activos y 26 fragmentos trazables',()=>{
 assert.equal(validateCorpus(corpus),corpus);const report=libraryReport(corpus);assert.equal(report.institutions,10);assert.equal(report.topics,7);assert.equal(report.activeDocuments,13);assert.equal(report.documents,15);assert.equal(report.chunks,26);assert.equal(report.excluded.length,2);
 for(const c of chunks){assert.ok(c.locator);assert.ok(c.version);assert.equal(c.clinicalReview,'pending');assert.ok(safeSourceUrl(c.url));assert.ok(!['cenetec','imss'].includes(c.sourceId));}
});
test('política institucional exacta; no acepta subdominios engañosos, credenciales ni enlaces del modelo',()=>{
 for(const url of ['http://www.who.int/a','https://www.who.int.evil.test/a','https://user@www.who.int/a','https://www.who.int:8443/a','https://www.who.int/a?redirect=evil','javascript:alert(1)'])assert.equal(safeSourceUrl(url),undefined);
 for(const s of corpus.sources)assert.ok(safeSourceUrl(s.url));
 assert.equal(readFileSync(new URL('../../frontend/src/source-policy.js',import.meta.url),'utf8'),readFileSync(new URL('../src/source-policy.js',import.meta.url),'utf8'));
 const bad=structuredClone(corpus);bad.documents[0].sourceId='who';assert.throws(()=>validateCorpus(bad),/institución/);
});
test('nuevo tema y documento se importan sin editar la lógica de búsqueda; el índice previo se invalida',async()=>{
 const d=structuredClone(corpus.documents[0]);d.id='nuevo';d.topic='nuevo_tema';d.chunks=[{...d.chunks[0],id:'nuevo-1',text:'Información de prueba sobre la palabra pruebaejemplo.'}];
 const add={schemaVersion:2,version:'beta-nueva',topics:[{id:'nuevo_tema',title:'Tema de prueba',aliases:['pruebaejemplo']}],documents:[d]};
 const next=mergeLibrary(corpus,add);assert.deepEqual(retrievalQuery(context('pruebaejemplo'),next).topics,['nuevo_tema']);assert.throws(()=>validateIndex(next,index));
 const flat=flattenCorpus(next),idx=makeIndex(next,flat.map(()=>vector('headache'))),r=new RagRetriever({corpus:next,index:idx,client:{configured:true,embed:async()=>({vectors:[vector('headache')],usage:{inputTokens:1}})},now:clock});
 const found=await r.retrieve(context('pruebaejemplo'));assert.deepEqual(found.retrieved.map(c=>c.id),['nuevo-1']);
});
test('no quedan los límites antiguos de 32 documentos u ocho fragmentos por documento',()=>{
 const next=structuredClone(corpus);for(let i=0;i<40;i++){const d=structuredClone(next.documents[0]);d.id='extra-'+i;d.chunks=Array.from({length:10},(_,j)=>({...d.chunks[0],id:d.id+'-'+j}));next.documents.push(d);}assert.equal(validateCorpus(next),next);
});
test('validación exige versiones, institución, localizador, fechas reales y evidencia de aprobación',()=>{
 for(const patch of [{locator:''},{version:''},{checkedAt:'2026-02-30'},{status:'automatic_approval'},{clinicalReview:'approved'},{url:'https://evil.example/a'}]){const bad=structuredClone(corpus);Object.assign(bad.documents[0],patch);assert.throws(()=>validateCorpus(bad));}
 const bad=structuredClone(corpus);bad.documents[1].chunks[0].id=bad.documents[0].chunks[0].id;assert.throws(()=>validateCorpus(bad));
 const add={schemaVersion:2,version:'different',documents:[{...corpus.documents[0],clinicalReview:'approved',reviewedAt:'2026-10-14',reviewedBy:'Nombre de prueba'}]};assert.throws(()=>mergeLibrary(corpus,add),/pendientes/);
});
test('pendiente de actualización y rechazado quedan fuera de recuperación; aprobación conserva metadatos',()=>{
 const next=structuredClone(corpus);next.documents[0].clinicalReview='rejected';assert.ok(!flattenCorpus(next).some(c=>c.documentId===next.documents[0].id));
 const d=next.documents[1];d.clinicalReview='approved';d.reviewedAt='2026-10-14';d.reviewedBy='Revisor de prueba';assert.equal(validateCorpus(next),next);assert.equal(flattenCorpus(next).find(c=>c.documentId===d.id).clinicalReview,'approved');
});
test('búsqueda real con vectores simulados mantiene tópicos y solo consulta OpenAI para motivos cubiertos',async()=>{
 let calls=0;const r=new RagRetriever({corpus,index,now:clock,client:{configured:true,embed:async()=>{calls++;return {vectors:[vector('diabetes')],usage:{inputTokens:1}};}}});
 const hit=await r.retrieve(context('mucha sed y orino mucho'));assert.equal(hit.status,'matched');assert.equal(hit.retrieved.length,3);assert.ok(hit.retrieved.every(c=>c.topic==='diabetes'));
 assert.equal((await r.retrieve(context('dolor de rodilla'))).retrieved.length,0);assert.equal(calls,1);assert.equal(r.status.pendingClinicalReview,true);
});
test('evaluación offline identifica sus límites; evaluación de embeddings usa índice validado y casos sintéticos',async()=>{
 const cases=JSON.parse(readFileSync(new URL('../knowledge/evaluation-cases.json',import.meta.url),'utf8'));const offline=await evaluateRetrieval(corpus,cases);assert.equal(offline.mode,'offline_lexical_smoke_test');assert.equal(offline.passed,cases.length);
 const real=await evaluateRetrieval(corpus,[cases[0]],{index,client:{embed:async()=>({vectors:[vector('headache')]})}});assert.equal(real.mode,'real_embeddings_retrieval');assert.equal(real.passed,1);
});
test('negaciones no añaden temas y las fuentes finales proceden de los fragmentos recuperados',()=>{
 assert.deepEqual(retrievalQuery(context('sin mareo pero dolor de cabeza'),corpus).topics,['headache']);
 const source=chunks.find(c=>c.sourceId==='nice'),bound=bindEvidence({fuentes_usadas:[source.id]},{status:'matched',retrieved:[source]});assert.equal(bound.rag.sources[0].url,source.url);assert.equal(bound.rag.sources[0].locator,source.locator);assert.throws(()=>bindEvidence({fuentes_usadas:['imss-cefalea-1']},{status:'matched',retrieved:[source]}));
});

test('indexación por lotes: 70 fragmentos usan 32/32/6 y un lote fallido no produce resultado parcial',async()=>{
 const input=Array.from({length:70},()=>chunks[0]),sizes=[],progress=[];
 const got=await embedLibrary(input,{embed:async xs=>{sizes.push(xs.length);return {vectors:xs.map(()=>vector('headache')),usage:{inputTokens:xs.length}};}},done=>progress.push(done));
 assert.deepEqual(sizes,[32,32,6]);assert.deepEqual(progress,[32,64,70]);assert.equal(got.vectors.length,70);assert.equal(got.inputTokens,70);
 await assert.rejects(embedLibrary(input,{embed:async()=>({vectors:[],usage:{inputTokens:0}})}),/incompleto/);
});

test('alcance de edad: NICE CG150 no se aplica a menores de 12 ni a edad desconocida',()=>{
 const c=chunks.find(c=>c.sourceId==='nice');assert.equal(isApplicable(c,context('cabeza')),false);
 for(const [age,expected] of [['8',false],['12',true],['33',true],['No sé',false]])assert.equal(isApplicable(c,{fields:[{key:'age',answer:age,status:'reported'}]}),expected);
});
