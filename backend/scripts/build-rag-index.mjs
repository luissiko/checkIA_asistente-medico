import {existsSync,readFileSync,mkdirSync,writeFileSync,renameSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {embedLibrary} from '../src/knowledge-tools.js';
import {createEmbeddingClient} from '../src/embeddings.js';
import {CORPUS_PATH,INDEX_PATH,validateCorpus,flattenCorpus,embeddingText,validateIndex,makeIndex} from '../src/rag.js';
const envPath=fileURLToPath(new URL('../.env',import.meta.url));
if(existsSync(envPath))process.loadEnvFile(envPath);
let temp;
try{
 const corpus=validateCorpus(JSON.parse(readFileSync(CORPUS_PATH,'utf8')));
 if(flattenCorpus(corpus).some(d=>d.reviewBy<new Date().toISOString().slice(0,10)))throw new Error('Las fuentes necesitan revisión antes de crear el índice.');
 let existing;try{existing=JSON.parse(readFileSync(INDEX_PATH,'utf8'));validateIndex(corpus,existing);}catch{existing=null;}
 if(existing&&!process.argv.includes('--rebuild')){console.log('Índice actual: no se realizaron llamadas a OpenAI. Reinicia el backend.');}
 else{
  if(!process.argv.includes('--confirm-cost'))throw new Error('Para crear el índice ejecuta: node scripts/build-rag-index.mjs --confirm-cost. Envía únicamente los resúmenes públicos a OpenAI y genera un cargo por embeddings.');
  const client=createEmbeddingClient();
  if(!client.configured)throw new Error('Configura OPENAI_API_KEY en backend/.env, sin compartirla.');
  const chunks=flattenCorpus(corpus);if(!chunks.length)throw new Error('No hay fragmentos activos para indexar.');
  const {vectors,inputTokens:tokens}=await embedLibrary(chunks,client,(done,total)=>console.log(`Preparados ${done}/${total} fragmentos.`));
  const index=makeIndex(corpus,vectors),target=fileURLToPath(INDEX_PATH);
  mkdirSync(fileURLToPath(new URL('../knowledge/',import.meta.url)),{recursive:true});
  temp=target+'.'+randomUUID()+'.tmp';writeFileSync(temp,JSON.stringify(index),'utf8');renameSync(temp,target);temp=null;
  console.log(`Índice listo: ${corpus.documents.length} fuentes, ${chunks.length} fragmentos. Tokens de embeddings: ${tokens}. Reinicia el backend.`);
 }
}catch(error){if(temp)try{rmSync(temp);}catch{}console.error(error.status?'No se pudo crear el índice. Revisa la conexión, permisos y saldo de la API.':error.message);process.exitCode=1;}
