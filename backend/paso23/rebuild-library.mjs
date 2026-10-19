import {readFile,writeFile,rename,copyFile,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createEmbeddingClient} from '../src/embeddings.js';
import {CORPUS_PATH,INDEX_PATH,validateCorpus,flattenCorpus,embeddingText,makeIndex,validateIndex} from '../src/rag.js';

export async function prepareIndex(corpus,client,progress=()=>{}){
 validateCorpus(corpus);
 if(!client.configured)throw new Error('Falta OPENAI_API_KEY en backend/.env o en el entorno. No se generó ningún índice.');
 const chunks=flattenCorpus(corpus),vectors=[];
 for(let i=0;i<chunks.length;i+=32){
  const result=await client.embed(chunks.slice(i,i+32).map(embeddingText));vectors.push(...result.vectors);
  progress(Math.min(i+32,chunks.length),chunks.length);
 }
 return validateIndex(corpus,makeIndex(corpus,vectors));
}
export async function rebuild(){
 const env=new URL('../.env',import.meta.url);if(existsSync(env))process.loadEnvFile(env);
 const corpus=JSON.parse(await readFile(CORPUS_PATH,'utf8'));
 const index=await prepareIndex(corpus,createEmbeddingClient(),(done,total)=>console.log(`Biblioteca: ${done}/${total} fragmentos preparados.`));
 const target=new URL(INDEX_PATH),temporary=new URL(target.href+'.'+randomUUID()+'.tmp');
 try{
  await writeFile(temporary,JSON.stringify(index)+'\n',{flag:'wx'});
  if(existsSync(target))await copyFile(target,new URL(target.href+'.respaldo-'+Date.now()));
  await rename(temporary,target);
 }finally{await rm(temporary,{force:true});}
 console.log(`Índice real generado: ${index.rows.length} fragmentos. Reinicia el backend para cargarlo.`);
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 rebuild().catch(e=>{console.error(e.message);process.exitCode=1;});
}
