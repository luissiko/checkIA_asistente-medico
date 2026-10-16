import {validateCorpus,flattenCorpus,validateIndex,retrievalQuery,cosine,isApplicable} from './rag.js';
// Preparación local: nunca se ejecuta a partir de texto enviado por un paciente.
export function mergeLibrary(corpus,addition){
 validateCorpus(corpus);if(corpus.schemaVersion!==2||addition?.schemaVersion!==2)throw new Error('La importación requiere esquema 2.');
 const merge=(a,b,key)=>{const m=new Map(a.map(x=>[x[key],x]));for(const x of b||[])m.set(x[key],x);return [...m.values()];};
 const next={...corpus,version:addition.version,topics:merge(corpus.topics,addition.topics,'id'),sources:merge(corpus.sources,addition.sources,'id'),documents:merge(corpus.documents,addition.documents,'id')};
 if(typeof next.version!=='string'||!next.version.trim()||next.version===corpus.version)throw new Error('Usa una nueva versión para la biblioteca.');
 for(const d of addition.documents||[])if(d.clinicalReview!=='pending'||d.status!=='active_beta')throw new Error('La importación beta solo admite documentos pendientes de revisión; registra una aprobación clínica por separado con evidencia.');
 return validateCorpus(next);
}
export function libraryReport(corpus){validateCorpus(corpus);const chunks=flattenCorpus(corpus);return {version:corpus.version,institutions:corpus.sources?.length||1,topics:corpus.topics?.length||4,documents:corpus.documents.length,activeDocuments:new Set(chunks.map(c=>c.documentId)).size,chunks:chunks.length,excluded:corpus.documents.filter(d=>['needs_update','excluded'].includes(d.status)||d.clinicalReview==='rejected').map(d=>({id:d.id,status:d.status,clinicalReview:d.clinicalReview})),pendingClinicalReview:chunks.filter(c=>c.clinicalReview==='pending').length};}
export function lexicalRank(corpus,context){
 const q=retrievalQuery(context,corpus),words=new Set(q.query.split(/\W+/).filter(w=>w.length>2).map(w=>w.length>4?w.replace(/s$/,''):w));
 return flattenCorpus(corpus).filter(c=>q.topics.includes(c.topic)&&isApplicable(c,context)).map(c=>({...c,score:[...words].filter(w=>(c.title+' '+c.section+' '+c.text).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().includes(w)).length})).filter(c=>c.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,3);
}
export async function evaluateRetrieval(corpus,cases,{index,client}={}){
 validateCorpus(corpus);if(index)validateIndex(corpus,index);const rows=[];
 for(const c of cases){const context={fields:[{key:'reason',answer:c.query,status:'reported',clarifications:[]}]},started=performance.now();let got;
  if(index){const q=retrievalQuery(context,corpus);if(!q.query||!q.topics.length)got=[];else{const v=await client.embed([q.query]);got=flattenCorpus(corpus).map((x,i)=>({...x,score:cosine(v.vectors[0],index.rows[i].vector)})).filter(x=>q.topics.includes(x.topic)&&isApplicable(x,context)&&x.score>=.35).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,3);}}
  else got=lexicalRank(corpus,context);
  const expected=c.expectedDocumentIds||[],hit=expected.length?got.some(r=>expected.includes(r.documentId)):got.length===0;
  rows.push({id:c.id,query:c.query,expectedDocumentIds:expected,retrieved:got.map(r=>({id:r.id,documentId:r.documentId,section:r.section,score:r.score})),hit,elapsedMs:Math.round(performance.now()-started)});
 }
 return {mode:index?'real_embeddings_retrieval':'offline_lexical_smoke_test',corpusVersion:corpus.version,total:rows.length,passed:rows.filter(r=>r.hit).length,note:'Acierto documental en casos sintéticos; no mide diagnóstico, urgencia ni respaldo semántico de cada afirmación. La modalidad léxica no evalúa embeddings. Revisar manualmente la orientación generada con la rúbrica.',rows};
}

export async function embedLibrary(chunks,client,onProgress=()=>{}){
 const vectors=[];let inputTokens=0;
 for(let i=0;i<chunks.length;i+=32){const input=chunks.slice(i,i+32).map(c=>c.title+' — '+c.section+'\n'+c.text),batch=await client.embed(input);if(!Array.isArray(batch.vectors)||batch.vectors.length!==input.length)throw new Error('Lote de vectores incompleto.');vectors.push(...batch.vectors);inputTokens+=batch.usage?.inputTokens||0;onProgress(vectors.length,chunks.length);}
 return {vectors,inputTokens};
}
