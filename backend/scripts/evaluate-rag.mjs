import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CORPUS_PATH,INDEX_PATH} from '../src/rag.js';
import {createEmbeddingClient} from '../src/embeddings.js';
import {evaluateRetrieval} from '../src/knowledge-tools.js';
try{
 const args=process.argv.slice(2);if(args.some(x=>!['--embeddings','--confirm-cost'].includes(x)))throw new Error('Opciones: --embeddings --confirm-cost. Sin opciones: prueba léxica offline.');
 const real=args.includes('--embeddings');if(real&&!args.includes('--confirm-cost'))throw new Error('La evaluación real envía casos sintéticos a OpenAI; confirma el cargo con --confirm-cost.');
 const env=new URL('../.env',import.meta.url);if(real&&existsSync(env))process.loadEnvFile(fileURLToPath(env));
 const corpus=JSON.parse(readFileSync(CORPUS_PATH,'utf8')),cases=JSON.parse(readFileSync(new URL('../knowledge/evaluation-cases.json',import.meta.url),'utf8'));
 const options=real?{index:JSON.parse(readFileSync(INDEX_PATH,'utf8')),client:createEmbeddingClient()}:{};
 const report=await evaluateRetrieval(corpus,cases,options),target=new URL('../knowledge/evaluation-'+(real?'embeddings':'offline')+'.json',import.meta.url);
 writeFileSync(target,JSON.stringify(report,null,2)+'\n');console.log(`${report.mode}: ${report.passed}/${report.total} casos. Reporte: ${fileURLToPath(target)}`);console.log(report.note);if(report.passed<report.total)process.exitCode=1;
}catch(e){console.error(e.status?'No se completó la evaluación: revisa conexión, índice y configuración.':e.message);process.exitCode=1;}
