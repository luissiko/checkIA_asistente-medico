import test from 'node:test';
import assert from 'node:assert/strict';
import {consultationText,consultationPdf} from '../src/consultation-export.mjs';
import {PDFDocument} from '../src/vendor/pdf-lib.mjs';
const session={clinicalState:{revision:3,facts:[{key:'respondent',text:'María Pérez'},{key:'reason',text:'Náuseas y dolor'},{key:'age',text:'34'}],paso23:{extraInformation:[{text:'Empezó ayer'}]}},orientation:{status:'ready',basedOnRevision:3,result:{resumen:'Relato de prueba, sin diagnóstico.',siguiente_paso:'Acude a valoración.',orientacion_general:'Información de prueba.',datos_por_aclarar:['Duración']}}};
test('exportación legible, acentos y ampliaciones sin metadatos técnicos',()=>{const t=consultationText(session);assert.match(t,/María Pérez/);assert.match(t,/Empezó ayer/);assert.match(t,/Acude a valoración/);assert.doesNotMatch(t,/basedOnRevision|protocolId|fuentes_usadas/);});
test('impide descargar una evaluación anterior después de corregir',()=>{assert.throws(()=>consultationText({...session,orientation:{...session.orientation,basedOnRevision:2}}));});
test('PDF válido con varias páginas y palabras largas',async()=>{const bytes=await consultationPdf(consultationText(session)+'\n'+('Texto español de prueba. '.repeat(800))+'\n'+'x'.repeat(600));const d=await PDFDocument.load(bytes);assert.ok(d.getPageCount()>1);assert.equal(d.getTitle(),'Resumen de la consulta');});

test('resumen primero y las 35 preguntas y respuestas después, sin omitir correcciones',()=>{
 const facts=Array.from({length:35},(_,i)=>({key:'q'+i,question:'Texto de pregunta '+(i+1),number:String(i+1),text:'Respuesta '+(i+1)}));
 const journal=[...facts,{...facts[0],text:'Respuesta corregida',operation:'correction'}];
 const s={...session,clinicalState:{...session.clinicalState,facts,paso23:{journal}}};
 const text=consultationText(s),history=text.slice(text.indexOf('Historial de conversación'));
 assert.ok(text.indexOf('Acude a valoración')<text.indexOf('Historial de conversación'));
 for(let i=1;i<=35;i++){assert.ok(history.includes('Texto de pregunta '+i));assert.ok(history.includes('Usuario: Respuesta '+i));}
 assert.match(history,/Corrección de/);assert.match(history,/Usuario: Respuesta corregida/);assert.match(history,/CHECKIA: Resultado final/);
});
test('historial usa mensajes reales y conserva información extra y correcciones',()=>{
 const s={...session,messages:[{role:'user',operation:'answer',questionId:'respondent',text:'María',sequence:0,createdAt:100},{role:'assistant',text:'¿Motivo de consulta?',sequence:1,createdAt:100},{role:'user',operation:'answer',questionId:'reason',text:'Dolor',sequence:2,createdAt:200},{role:'assistant',text:'Respuestas guardadas.',sequence:3,createdAt:200},{role:'user',operation:'correction',factKey:'reason',text:'Mareo',sequence:4,createdAt:300},{role:'user',operation:'extra',text:'Información adicional',sequence:5,createdAt:400}]};
 const text=consultationText(s);assert.match(text,/CHECKIA: Pregunta 1/);assert.match(text,/Usuario: Dolor/);assert.match(text,/Usuario \(corrección/);assert.match(text,/Usuario \(información adicional\): Información adicional/);
});
