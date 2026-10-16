import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {safeSourceUrl} from './source-policy.js';
import {EMBEDDING_MODEL,DIMENSIONS,validVector} from './embeddings.js';
export const RAG_VERSION='rag-library-v2';
export const CORPUS_PATH=new URL('../knowledge/corpus.json',import.meta.url);
export const INDEX_PATH=new URL('../knowledge/index.json',import.meta.url);
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const normalize=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/\bd\s+ecabeza\b/g,'de cabeza');
const topics={headache:/\b(cabeza|cefalea|migrana)\b/,abdominal:/\b(abdomen|abdominal|estomago|vientre|panza|barriga)\b/,dizziness:/\b(mareo|mareos|mareado|mareada|vertigo|inestabilidad)\b/,food_allergy:/\b(cacahuate|cacahuates|mani|mariscos|camaron|camarones|alergia alimentaria|alergia a los alimentos)\b/};
export function corpusHash(corpus){return createHash('sha256').update(JSON.stringify(corpus)).digest('hex');}
const validId=s=>typeof s==='string'&&/^[a-z0-9_-]{1,100}$/.test(s);
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export function topicDefinitions(corpus){return corpus.schemaVersion===2?corpus.topics:Object.keys(topics).map(id=>({id,legacy:topics[id]}));}
export function validateCorpus(corpus){
 if(![1,2].includes(corpus?.schemaVersion)||!Array.isArray(corpus.documents)||!corpus.documents.length||corpus.documents.length>5000)throw new Error('Corpus inválido (máximo técnico: 5000 documentos).');
 const modern=corpus.schemaVersion===2,ids=new Set(),chunks=new Set(),topicIds=new Set();
 if(modern){
  if(!Array.isArray(corpus.topics)||!corpus.topics.length||corpus.topics.length>1000||!Array.isArray(corpus.sources))throw new Error('Catálogo inválido.');
  for(const t of corpus.topics){if(!validId(t.id)||topicIds.has(t.id)||typeof t.title!=='string'||!Array.isArray(t.aliases)||!t.aliases.length||t.aliases.length>100||t.aliases.some(a=>typeof a!=='string'||!a.trim()||a.length>100))throw new Error('Tema inválido.');topicIds.add(t.id);}
  const sourceIds=new Set();for(const source of corpus.sources){if(!validId(source.id)||sourceIds.has(source.id)||!safeSourceUrl(source.url)||typeof source.name!=='string')throw new Error('Institución inválida.');sourceIds.add(source.id);}
 }
 for(const d of corpus.documents){
  if(!validId(d.id)||ids.has(d.id)||!(modern?topicIds.has(d.topic):Object.hasOwn(topics,d.topic))||typeof d.title!=='string'||!d.title.trim()||typeof d.publisher!=='string'||d.type!=='editorial_summary'||!['pending','approved','rejected'].includes(d.clinicalReview)||!validDate(d.checkedAt)||!validDate(d.reviewBy)||d.reviewBy<=d.checkedAt)throw new Error('Metadatos de fuente inválidos.');
  if(!safeSourceUrl(d.url))throw new Error('URL no autorizada.');
  if(modern&&corpus.sources.some(s=>s.id===d.sourceId)&&new URL(d.url).hostname.replace(/^www\./,'')!==new URL(corpus.sources.find(s=>s.id===d.sourceId).url).hostname.replace(/^www\./,''))throw new Error('La institución no corresponde al dominio del documento.');
  if(modern&&(!corpus.sources.some(s=>s.id===d.sourceId)||!['active_beta','needs_update','excluded'].includes(d.status)||!validId(d.version)||!['es','en'].includes(d.language)||typeof d.locator!=='string'||!d.locator.trim()||typeof d.reuseNote!=='string'||!d.reuseNote.trim()))throw new Error('Trazabilidad incompleta.');
  if(d.clinicalReview==='approved'&&(!d.reviewedBy||!validDate(d.reviewedAt)))throw new Error('Falta evidencia de revisión clínica.');
  if(d.minAge!==undefined&&(!Number.isInteger(d.minAge)||d.minAge<0||d.minAge>120))throw new Error('Población inválida.');
  ids.add(d.id);
  if(!Array.isArray(d.chunks)||!d.chunks.length||d.chunks.length>100)throw new Error('Fragmentos inválidos.');
  for(const c of d.chunks){if(!validId(c.id)||!c.id.startsWith(d.id+'-')||chunks.has(c.id)||typeof c.section!=='string'||!c.section.trim()||typeof c.text!=='string'||!c.text.trim()||c.text.length>2400)throw new Error('Fragmento inválido.');if(modern&&(!['context','symptoms','history','questions','warning','limits'].includes(c.kind)||typeof c.locator!=='string'||!c.locator.trim()))throw new Error('Falta sección o clasificación del fragmento.');chunks.add(c.id);}
 }
 if(chunks.size>30000)throw new Error('Máximo técnico: 30000 fragmentos.');
 return corpus;
}
export function flattenCorpus(corpus){return corpus.documents.filter(d=>!['needs_update','excluded'].includes(d.status)&&d.clinicalReview!=='rejected').flatMap(d=>d.chunks.map(c=>({id:c.id,documentId:d.id,topic:d.topic,title:d.title,section:c.section,url:d.url,publisher:d.publisher,checkedAt:d.checkedAt,sourceUpdatedAt:d.sourceUpdatedAt??null,reviewBy:d.reviewBy,type:d.type,text:c.text,clinicalReview:d.clinicalReview,reviewedBy:d.reviewedBy??null,reviewedAt:d.reviewedAt??null,kind:c.kind||'context',minAge:d.minAge??null,version:d.version||corpus.version||'legacy',locator:c.locator||d.locator||c.section,sourceId:d.sourceId||'medline',language:d.language||'es'})));}
export function isApplicable(chunk,context){
 if(chunk.minAge===null||chunk.minAge===undefined)return true;
 const age=(context.fields||[]).find(f=>f.key==='age'&&f.status==='reported'&&!f.omitted);
 // Una edad desconocida o no interpretable no autoriza aplicar una guía con límite de edad.
 const text=String(age?.answer??'').trim(),value=/^\d{1,3}$/.test(text)?Number(text):NaN;
 return Number.isFinite(value)&&value>=chunk.minAge;
}
export function embeddingText(c){return c.title+' — '+c.section+'\n'+c.text;}
export function makeIndex(corpus,vectors,createdAt=new Date().toISOString()){
 validateCorpus(corpus);const chunks=flattenCorpus(corpus);
 if(vectors.length!==chunks.length||vectors.some(v=>!validVector(v)))throw new Error('Vectores inválidos.');
 return {schemaVersion:1,corpusHash:corpusHash(corpus),model:EMBEDDING_MODEL,dimensions:DIMENSIONS,createdAt,rows:chunks.map((c,i)=>({id:c.id,vector:vectors[i]}))};
}
export function validateIndex(corpus,index){
 const chunks=flattenCorpus(corpus);
 if(index?.schemaVersion!==1||index.corpusHash!==corpusHash(corpus)||index.model!==EMBEDDING_MODEL||index.dimensions!==DIMENSIONS||index.rows?.length!==chunks.length||index.rows.some((r,i)=>r.id!==chunks[i].id||!validVector(r.vector)))throw new Error('Índice no compatible con la base actual.');
 return index;
}
export function cosine(a,b){if(a.length!==b.length)throw new Error('Dimensiones distintas.');let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?dot/Math.sqrt(aa*bb):0;}
export function retrievalQuery(context,corpus){
 // Búsqueda acotada: no nombre, edad, UID, peso, medicamentos ni historial completo.
 const selected=(context.fields||[]).filter(f=>['reason','location','associated','allergies'].includes(f.key)&&f.status==='reported'&&!f.omitted);
 const clauses=selected.flatMap(f=>[f.answer,...(f.clarifications||[]).filter(d=>d.status==='reported').map(d=>d.answer)]).filter(t=>typeof t==='string').flatMap(t=>normalize(t).split(/[.,;\n]|\bpero\b/)).filter(t=>! /\b(no|sin|niego|nunca)\b/.test(t));
 const query=clauses.join('. ').trim();
 // No truncar silenciosamente: no enviar una consulta fuera del límite.
 if(query.length>4000)fail(400,'Resume el motivo y los síntomas antes de generar la orientación.');
 const definitions=corpus?topicDefinitions(corpus):Object.entries(topics).map(([id,legacy])=>({id,legacy}));
 return {query,topics:definitions.filter(t=>clauses.some(c=>t.legacy?t.legacy.test(c):t.aliases.some(a=>(' '+c.replace(/[^a-z0-9 ]/g,' ')+' ').includes(' '+normalize(a)+' ')))).map(t=>t.id)};
}
export class RagRetriever{
 constructor({corpus,index=null,client,now=()=>Date.now()}={}){
  this.corpus=validateCorpus(corpus);this.client=client;this.now=now;this.chunks=flattenCorpus(corpus);this.hash=corpusHash(corpus);
  this.index=null;try{this.index=validateIndex(corpus,index);}catch{}
  this.version=RAG_VERSION+':'+this.hash+':'+EMBEDDING_MODEL+':'+DIMENSIONS;
 }
 get status(){const today=new Date(this.now()).toISOString().slice(0,10),expired=this.chunks.some(d=>d.reviewBy<today||d.checkedAt>today);return {enabled:true,ready:Boolean(this.index&&this.client?.configured&&!expired),state:expired?'review_required':!this.index?'index_required':!this.client?.configured?'credentials_required':'ready',version:RAG_VERSION,documents:this.corpus.documents.length,activeDocuments:new Set(this.chunks.map(c=>c.documentId)).size,sources:this.corpus.sources?.length||1,topics:topicDefinitions(this.corpus).length,pendingClinicalReview:this.chunks.some(c=>c.clinicalReview==='pending'),chunks:this.chunks.length};}
 ensureReady(){if(!this.status.ready)fail(503,'La base de información necesita preparación o revisión. Tu entrevista y resumen siguen disponibles.');}
 async retrieve(context){
  this.ensureReady();const {query,topics:found}=retrievalQuery(context,this.corpus);
  const base={version:RAG_VERSION,corpusHash:this.hash,embeddingModel:EMBEDDING_MODEL,createdAt:this.now(),clinicalReview:'pending',status:'insufficient_evidence',retrieved:[],sources:[],usage:{inputTokens:0}};
  if(!query||!found.length)return base;
  const embedding=await this.client.embed([query]);
  // Umbral técnico inicial; NO es una probabilidad ni un criterio clínico.
  const ranked=this.chunks.map((c,i)=>({...c,score:cosine(embedding.vectors[0],this.index.rows[i].vector)})).filter(c=>found.includes(c.topic)&&isApplicable(c,context)&&c.score>=0.35).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,3);
  return {...base,status:ranked.length?'matched':'insufficient_evidence',retrieved:ranked,usage:embedding.usage};
 }
}
export function loadRag(client){let corpus;try{corpus=JSON.parse(readFileSync(CORPUS_PATH,'utf8'));}catch{throw new Error('No se pudo cargar el corpus de CHECKIA.');}let index=null;try{index=JSON.parse(readFileSync(INDEX_PATH,'utf8'));}catch{}return new RagRetriever({corpus,index,client});}
export const NO_EVIDENCE_MESSAGE='La base consultada no contiene información suficiente para este motivo. Lleva el resumen de tus respuestas a un profesional de salud para su evaluación.';
export function bindEvidence(result,rag){
 const used=result.fuentes_usadas||[],byId=new Map((rag.retrieved||[]).map(c=>[c.id,c]));
 if(used.some(id=>!byId.has(id)))fail(502,'No se pudo comprobar la fuente de la orientación. Tu resumen sigue disponible.');
 const insufficient=rag.status!=='matched'||used.length===0;
 return {result:{...result,...(insufficient?{orientacion_general:NO_EVIDENCE_MESSAGE}:{})},rag:{...rag,status:insufficient?'insufficient_evidence':'matched',sources:used.map(id=>byId.get(id))}};
}
