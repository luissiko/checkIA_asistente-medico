import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {CORPUS_PATH,validateCorpus,flattenCorpus,isApplicable,retrievalQuery,validateIndex} from '../src/rag.js';
import {safeSourceUrl} from '../src/source-policy.js';
import {retrievalContextFor} from './local-retrieval.mjs';
import {prepareIndex} from './rebuild-library.mjs';
const corpus=JSON.parse(readFileSync(CORPUS_PATH,'utf8')),chunks=flattenCorpus(corpus);
const context=age=>retrievalContextFor({fields:[{key:'age',answer:age,status:'reported'},{key:'reason',answer:'fiebre',status:'reported'}]});
test('ampliación incorpora 25 registros únicos y excluye pendientes, conservando documentos locales',()=>{
 validateCorpus(corpus);assert.ok(corpus.documents.length>=25);
 const added=corpus.documents.filter(d=>d.version==='ampliacion-20261019');assert.equal(added.length,25);
 assert.equal(added.filter(d=>d.status==='active_beta').length,22);
 for(const d of added.filter(d=>d.status==='needs_update'))assert.equal(chunks.some(c=>c.documentId===d.id),false);
 assert.equal(new Set(added.map(d=>d.url)).size,added.length);
});
test('fiebre infantil requiere edad exacta y no se recupera para adultos, niños mayores o edad desconocida',()=>{
 const infant=chunks.find(c=>c.documentId==='aap-infant-fever');
 for(const age of ['2 meses','3 meses'])assert.equal(isApplicable(infant,context(age)),true,age);
 for(const age of ['4 meses','10 años','45 años','no se','0'])assert.equal(isApplicable(infant,context(age)),false,age);
 const elderly=chunks.find(c=>c.documentId==='nia-older-adult-balance');
 assert.equal(isApplicable(elderly,context('65 años')),true);assert.equal(isApplicable(elderly,context('20 años')),false);
 assert.ok(retrievalQuery(context('2 meses'),corpus).topics.includes('ext_infant_fever'));
});
test('dominios nuevos son exactos: no permite subdominios falsos ni credenciales',()=>{
 assert.ok(safeSourceUrl('https://www.nhlbi.nih.gov/es/salud/asma/crisis'));
 for(const u of ['https://www.nhlbi.nih.gov.evil.example/test','https://evil@www.nhlbi.nih.gov/test','http://www.nhlbi.nih.gov/test'])assert.equal(safeSourceUrl(u),undefined);
});
test('preparación crea un índice coherente y propaga fallos sin fabricar vectores',async()=>{
 let calls=0;const client={configured:true,embed:async xs=>{calls++;return{vectors:xs.map(()=>Array.from({length:512},(_,i)=>i===0?1:0))};}};
 const index=await prepareIndex(corpus,client);validateIndex(corpus,index);assert.equal(index.rows.length,chunks.length);assert.equal(calls,Math.ceil(chunks.length/32));
 await assert.rejects(prepareIndex(corpus,{configured:false}),/Falta OPENAI_API_KEY/);
 await assert.rejects(prepareIndex(corpus,{configured:true,embed:async()=>{throw Error('fallo simulado')}}),/fallo simulado/);
});
