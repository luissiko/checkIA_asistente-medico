import {readFileSync} from 'node:fs';
import {validateCorpus,validateIndex,CORPUS_PATH,INDEX_PATH,flattenCorpus} from '../src/rag.js';
try{
 const corpus=validateCorpus(JSON.parse(readFileSync(CORPUS_PATH,'utf8')));validateIndex(corpus,JSON.parse(readFileSync(INDEX_PATH,'utf8')));
 const today=new Date().toISOString().slice(0,10);if(flattenCorpus(corpus).some(c=>c.reviewBy<today||c.checkedAt>today))throw new Error('Revisa la vigencia de las fuentes antes de publicar.');
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));for(const name of ['express','firebase-admin'])if(!pkg.dependencies?.[name])throw new Error('Falta la dependencia de producción '+name+' en backend/package.json.');
 readFileSync(new URL('../package-lock.json',import.meta.url));
 console.log('Preparación local verificada: corpus, índice compatible, vigencia, dependencias declaradas y lockfile. No se realizaron llamadas remotas.');
}catch(e){console.error('Preparación incompleta: '+(e.code==='ENOENT'?'Falta el índice o un archivo requerido. Crea el índice desde backend antes de desplegar.':e.message));process.exitCode=1;}
