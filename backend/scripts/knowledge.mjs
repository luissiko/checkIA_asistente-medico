import {readFileSync,writeFileSync,copyFileSync,renameSync,rmSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {CORPUS_PATH} from '../src/rag.js';
import {mergeLibrary,libraryReport} from '../src/knowledge-tools.js';
const args=process.argv.slice(2);let temp;
try{
 const corpus=JSON.parse(readFileSync(CORPUS_PATH,'utf8'));
 if(args[0]==='check'&&args.length===1)console.log(JSON.stringify(libraryReport(corpus),null,2));
 else if(args[0]==='import'&&args[1]&&args.length<4){
  if(args[2]&&args[2]!=='--apply')throw new Error('Opción desconocida.');
  const next=mergeLibrary(corpus,JSON.parse(readFileSync(args[1],'utf8')));console.log(JSON.stringify(libraryReport(next),null,2));
  if(args[2]==='--apply'){
   const backup=new URL('./corpus.'+Date.now()+'.backup.json',CORPUS_PATH);copyFileSync(CORPUS_PATH,backup);
   temp=new URL('./corpus.'+randomUUID()+'.tmp',CORPUS_PATH);writeFileSync(temp,JSON.stringify(next,null,2)+'\n');renameSync(temp,CORPUS_PATH);temp=null;console.log('Biblioteca importada. El índice anterior queda inválido; reconstruye el índice y reinicia el backend.');
  }else console.log('Solo validación. Agrega --apply para importar con respaldo.');
 }else throw new Error('Uso: node scripts/knowledge.mjs check | import RUTA.json [--apply]');
}catch(e){if(temp)rmSync(temp,{force:true});console.error(e.message);process.exitCode=1;}
