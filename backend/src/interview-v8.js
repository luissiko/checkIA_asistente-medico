import {parseMeasurement} from './demographics.js';
import {parseAge,parseDirectSex,parsePain,directMeasurement} from './direct-input-v4.js';
// Protocolo técnico de recopilación: sin clasificación ni interpretación clínica.
import { normalize, answerStatus, reasonIssue, detailIssue, hasReportedTime } from './response-quality.js';
import { CLEAN_SCREEN_QUESTION as SCREEN_QUESTION, initialSafety, recordScreen } from './safety.js';
export const PROTOCOL_ID = 'intake-demo-v8';
export const QUESTIONS = Object.freeze([
 {id:'name',kind:'name',text:"¿Cómo te llamas?"},
 {id:'age',kind:'age',text:"¿Qué edad tienes?"},
 {id:'sex',kind:'sex',text:"¿Masculino (M) o femenino (F)?"},
 {id:'weight',kind:'weight',text:"¿Cuál es tu peso en kg?"},
 {id:'height',kind:'height',text:"¿Cuál es tu altura en cm?"},
 {id:'reason',kind:'text',text:"¿Motivo de tu consulta?"},
 {id:'onset',kind:'text',text:"¿Cuándo comenzaron tu dolencia o tus síntomas?"},
 {id:'location',kind:'text',text:"¿En qué parte le afecta?"},
 {id:'severity',kind:'severity',text:"Si tienes dolor, ¿qué intensidad tiene del 1 al 10? Si no tienes dolor, escribe 0."},
 {id:'associated',kind:'text',text:"¿Qué otros síntomas presentas?"},
 {id:'history',kind:'text',text:"¿Has tenido alguna enfermedad en el pasado?"},
 {id:'medications',kind:'text',text:"¿Tomas algún medicamento?"},
 {id:'allergies',kind:'text',text:"¿Tienes algún tipo de alergia?"},
 {id:'allergy_reaction',kind:'text',text:"¿Qué medicamento o remedio consumes para la alergia?"},
 {id:'allergy_timing',kind:'text',text:"¿Desde cuándo la tienes y cuándo fue la última vez?"},
 {id:'family_history',kind:'text',text:'¿Tienes alguna enfermedad hereditaria y cuál es?'},
 {id:'answers_confirmation',kind:'confirmation',text:'¿Sus respuestas son verdaderas? (Sí/No)'}
]);
// Regla acotada: identifica solo saludos y fórmulas de cortesía conocidas.
// No busca palabras dentro de una descripción ni interpreta síntomas.
export function isGreetingOnly(answer) {
  let remaining = normalize(answer).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!remaining) return true;
  const greeting = /^(?:hola que tal|que tal|como estas|como esta|buenos dias|buenas tardes|buenas noches|buen dia|muy buenas|que onda|de acuerdo|por favor|hola|holi|buenas|saludos|hey|hello|hi|gracias|okay|ok|vale|checkia|asistente)(?:\s+|$)/;
  while (remaining) {
    const match = remaining.match(greeting);
    if (!match) return false;
    remaining = remaining.slice(match[0].length).trim();
  }
  return true;
}
export function initialInterview() {
  return { schemaVersion: 2, protocolId: PROTOCOL_ID, validationVersion: 16, revision: 0, phase: 'collecting', facts: [], pendingQuestions: [{ ...QUESTIONS[0] }], clarificationContext: null, safety: initialSafety(), assessment: null };
}
function error(status, message) { throw Object.assign(new Error(message), { status }); }
function validateAnswer(question,answer) {
 const status=answerStatus(answer);
 if(question.kind==='confirmation'&&!/^(?:si|no)[.!]?$/.test(normalize(answer)))error(400,'Responde Sí o No para confirmar tus respuestas.');
 if(status==='reported') {
  if(question.kind==='name'&&(answer.length>80||!/^[-\p{L}\p{M} '\u2019]+$/u.test(answer))) error(400,'Escribe solo tus nombres o un alias de hasta 80 caracteres. También puedes escribir Prefiero no responder.');

  if(question.kind==='sex') {
   if(/^(?:t|therian)$/.test(normalize(answer))) error(400,'Esta opción no corresponde al dato solicitado. Escribe M, F, No sé o Prefiero no responder para continuar.');
   parseDirectSex(answer);
  }
  if(question.kind==='severity'&&!/^(?:[0-9]|10)$/.test(normalize(answer))) error(400,'Escribe un número de 0 a 10; 0 significa sin dolor.');

 }
 if(['sex'].includes(question.kind)&&status==='not_applicable') error(400,'Puedes escribir No sé o Prefiero no responder para este dato.');
 return status;
}
const knownNone = text => /^(?:no|no tengo|no tengo ninguna|ninguno|ninguna|ninguno referido|ninguna referida|ninguna conocida|ninguno conocido|no tomo medicamentos|no tomo nada|no tomo remedios|no uso remedios|no consumo remedios|ningun remedio|sin remedios|no tengo alergias|no tengo ninguna alergia|no soy alergico|no soy alergica|no soy alergico a nada|no soy alergica a nada|sin alergias conocidas)$/.test(normalize(text).replace(/[.!]+$/g,''));
const bareYes=text=>/^(?:si|si tomo|si tengo|si consumo)[.!]?$/.test(normalize(text));
const yesNo=text=>/^(?:si|no)[.!]?$/.test(normalize(text));
const remedyQuestions = [
 {id:'remedies_detail',parentKey:'medications',kind:'text',text:'¿Cuál es el remedio y qué contiene? Si no sabes, escribe No sé.'},
 {id:'remedies_since',parentKey:'medications',kind:'text',text:'¿Desde cuándo lo consumes y por qué lo consumes? Si no sabes, escribe No sé.'}
];
export function followupsFor(key,answer,status) {
 // Una negación de medicamentos no equivale a negar el uso de remedios.
 if(key==='medications'&&status==='none_reported')return [{id:'remedies_use',parentKey:key,kind:'text',text:'¿Tomas algún remedio casero, naturista o botánico? Responde Sí, No o No sé.'}];
 if(status!=='reported')return [];
 const n=normalize(answer);
 if(key==='onset'&&!hasReportedTime(n))return [{id:'onset_when',parentKey:key,kind:'text',text:'¿Recuerdas cuándo comenzó? Puedes dar una fecha o un aproximado. Si no recuerdas, escribe No sé.'}];
 if(key==='location')return [
  {id:'location_description',parentKey:key,kind:'text',text:'Descríbeme su dolor o afectación.'}
 ];
 if(key==='history'&&/^(?:si|si he tenido(?: alguna)?|si tengo|he tenido)$/.test(n.replace(/[.!]+$/g,'')))return [{id:'history_detail',parentKey:key,kind:'text',text:'¿Cuál enfermedad o dolencia has tenido?'}];
 if(key==='medications')return [
  {id:'medications_details',parentKey:key,kind:'text',text:'¿Qué medicamento tomas, por qué, cuánto consumes (dosis) y desde cuándo?'},
  {id:'medications_knows_active',parentKey:key,kind:'text',text:'¿Sabes cuál es su principio activo? Responde Sí, No o No sé.'}
 ];
 if(key==='allergies'&&bareYes(answer))return [{id:'allergies_substance',parentKey:key,kind:'text',text:'¿Cuál alergia tienes?'}];
 if(key==='family_history'&&!knownNone(answer))return [...(bareYes(answer)?[{id:'family_history_condition',parentKey:key,kind:'text',text:'¿Cuál es la enfermedad hereditaria?'}]:[]),{id:'family_history_relative',parentKey:key,kind:'text',text:'¿Quién de tus familiares la tuvo o la tiene?'}];
 return [];
}
// Preserve every free-text response; normalize only an unambiguous supported value.
function freeNumericData(kind,answer){
 try{
  if(kind==='age')return {numericValue:parseAge(answer)};
  const normalizedAnswer=normalize(answer).replace(',','.');
  if(!/^\d+(?:\.\d+)?\s*(?:kg|kilos?|kilogramos?|cm|centimetros?|m|metros?)?$/.test(normalizedAnswer))return {};
  return {measurement:parseMeasurement(kind,answer)};
 }catch{return {};}
}
function factFrom(question, answer, sourceMessageId, at) {
  const status=validateAnswer(question,answer);
  const valueData=status!=='reported'?{}:['age','weight','height'].includes(question.kind)?freeNumericData(question.kind,answer):question.kind==='sex'?{codedValue:parseDirectSex(answer),dataType:'self_reported_sex'}:question.kind==='severity'?{pain:parsePain(answer)}:{};
  return {...valueData,key:question.id,question:question.text,text:answer,status:status === 'reported' && ['medications','allergies','family_history'].includes(question.id) && knownNone(answer) ? 'none_reported' : status,source:'user_report',sourceMessageId,recordedAt:at,clarifications:[]};
}
function resultFor(state, reply, needsClarification=false) {
  return {clinicalState:{...state,validationVersion:16,safety:state.safety||initialSafety(),assessment:null},reply,needsClarification};
}
function requestDetail(state, question, answer, sourceMessageId, at, reply) {
  const event = {questionId:question.id,text:answer,sourceMessageId,recordedAt:at,reason:reply,source:'user_report'};
  return resultFor({...state,qualityEvents:[...(state.qualityEvents || []),event]},reply,true);
}
function personalized(question,facts) {
 if(!question) return null;
 const name=facts.find(f=>f.key==='name');
 if(name?.status!=='reported'||!['age','weight','height'].includes(question.id)) return {...question};
 const display=name.text.trim().replace(/\s+/g,' ').slice(0,60);
 return {...question,text:question.text.replace('?',`, ${display}?`)};
}
function skipAllergyDetails(state,fact) {
 const facts=[...state.facts.filter(f=>!['allergies','allergy_reaction','allergy_timing','answers_confirmation'].includes(f.key)),fact];
 for(const key of ['allergy_reaction','allergy_timing']) {
  const q=QUESTIONS.find(q=>q.id===key),old=state.facts.find(f=>f.key===key);
  const revisions=old?[...(old.revisions||[]),{text:old.text,status:old.status,clarifications:old.clarifications||[],sourceMessageId:old.sourceMessageId,recordedAt:old.recordedAt}]:[];
  facts.push({key,question:q.text,text:'No se preguntó: no refieres una alergia identificada en la respuesta anterior.',status:'not_applicable',source:'conditional_skip',sourceMessageId:fact.sourceMessageId,recordedAt:fact.recordedAt,clarifications:[],autoSkipped:true,revisions});
 }
 const next=personalized(QUESTIONS.find(q=>!facts.some(f=>f.key===q.id)),facts);
 return resultFor({...state,facts,phase:next?'collecting':'complete',pendingQuestions:next?[next]:[],clarificationContext:null},next?next.text:'Respuestas guardadas.');
}
function finishMain(state, fact) {
  if(fact.key==='allergies'&&fact.status!=='reported') return skipAllergyDetails(state,fact);
  const facts=[...state.facts,fact], next=fact.key === 'height' ? SCREEN_QUESTION : personalized(QUESTIONS.find(q=>!facts.some(f=>f.key===q.id)),facts);
  return resultFor({...state,facts,clarificationContext:null,pendingQuestions:next ? [{...next}] : [],phase:next ? 'collecting' : 'complete'},next ? next.text : 'Respuestas guardadas. Puedes revisar y corregir el resumen.');
}
function finishClarification(state, context) {
  if (!context.correction) return finishMain(state,context.draft);
  const facts=state.facts.map((f,i)=>i===context.targetIndex ? context.draft : f);
  const restored={...state,facts,clarificationContext:null,pendingQuestions:context.resumePendingQuestions,phase:context.resumePhase};
  return resultFor(restored,context.resumePendingQuestions[0] ? 'Corrección y aclaraciones guardadas. '+context.resumePendingQuestions[0].text : 'Corrección y aclaraciones guardadas. La recopilación sigue terminada; no se ha realizado evaluación clínica.');
}
export function advanceDirect(state, questionId, answer, sourceMessageId, at) {
  if (state?.protocolId !== PROTOCOL_ID) error(409, 'Esta sesión pertenece a la prueba anterior. Crea una nueva para iniciar la entrevista.');
  if (state.phase !== 'collecting') error(409, 'La entrevista ya terminó. Puedes consultar el historial o corregir una respuesta.');
  const question=state.pendingQuestions?.[0];
  if (!question || question.id !== questionId) error(409, 'La pregunta pendiente cambió. Recarga la consulta antes de responder.');
  if (question.id === 'alarm_screen') {
    const safety=recordScreen(state,answer,sourceMessageId,at);
    return resultFor({...state,safety,pendingQuestions:[personalized(QUESTIONS[5],state.facts)]},QUESTIONS[5].text);
  }
  if ((question.id === 'reason' || question.parentKey) && isGreetingOnly(answer)) {
    return resultFor(state,question.id === 'reason' ? 'Hola. Cuéntame qué molestia tienes para registrar el motivo de tu consulta.' : 'Necesito una respuesta a esta aclaración. Describe el dato que conozcas o escribe No sé o Prefiero no responder.',true);
  }
  const issue = question.id === 'reason' ? reasonIssue(answer) : question.parentKey ? detailIssue(question.id, answer) : null;
  if (issue) return requestDetail(state,question,answer,sourceMessageId,at,issue);
  if(question.id==='onset_when'&&answerStatus(answer)==='reported'&&!hasReportedTime(answer)&&! /\b(?:infancia|desde nino|desde nina)\b/.test(normalize(answer)))
    return requestDetail(state,question,answer,sourceMessageId,at,'Dime cuándo empezó: por ejemplo ayer, hace 2 días o una fecha. Si no recuerdas, escribe No sé.');
  if(question.id==='history_detail'&&/^(?:si|si he tenido|si tengo)$/.test(normalize(answer).replace(/[.!]+$/g,''))) return requestDetail(state,question,answer,sourceMessageId,at,'Escribe cuál enfermedad o dolor has tenido. Si no lo recuerdas, escribe No sé.');
  if (['medications_identity','location_description','remedies_detail'].includes(question.id)&&/^(?:si|no|ok)$/.test(normalize(answer))) return requestDetail(state,question,answer,sourceMessageId,at,'Describe el dato que te pide la pregunta. Si no lo sabes, escribe No sé; también puedes escribir Prefiero no responder.');
  if(['remedies_use','medications_knows_active'].includes(question.id)&&answerStatus(answer)==='reported'&&!yesNo(answer)&&!knownNone(answer))return requestDetail(state,question,answer,sourceMessageId,at,'Responde Sí, No o No sé.');
  if (['medications_details','medications_identity','allergies_substance','family_history_condition','family_history_relative'].includes(question.id)&&/^(?:si|no|ok)$/.test(normalize(answer)))return requestDetail(state,question,answer,sourceMessageId,at,'Describe el dato que conoces o escribe No sé.');
  if (state.clarificationContext) {
    const context=structuredClone(state.clarificationContext);
    if (!question.parentKey || question.parentKey !== context.draft.key) error(409,'Aclaración incompatible. Recarga la consulta.');
    const status=['remedies_use','medications_knows_active'].includes(question.id)&&knownNone(answer)?'none_reported':answerStatus(answer);
    context.draft.clarifications.push({key:question.id,question:question.text,text:answer,status,source:'user_report',sourceMessageId,recordedAt:at});
    // No corresponde expresa que el texto original no era una declaración de alergia.
    const next=context.remainingQuestions.slice(1);
    if(question.id==='remedies_use'&&status==='reported'&&bareYes(answer))next.push(...remedyQuestions.map(q=>({...q})));
    if(question.id==='medications_knows_active'&&status==='reported'&&bareYes(answer))next.push({id:'medications_identity',parentKey:'medications',kind:'text',text:'Menciona cuál es el principio activo que indica la caja. Si no sabes, escribe No sé.'});
    if (question.id === 'allergies_substance' && status === 'not_applicable') {
      context.draft.status='not_applicable';return finishClarification(state,context);
    }
    if (!next.length) return finishClarification(state,context);
    context.remainingQuestions=next;
    return resultFor({...state,clarificationContext:context,pendingQuestions:[next[0]]},next[0].text,true);
  }
  if (question.id !== QUESTIONS.find(q=>!state.facts.some(f=>f.key===q.id))?.id) error(409,'Estado incompatible. Crea una nueva entrevista.');
  const fact=factFrom(question,answer,sourceMessageId,at), followups=followupsFor(fact.key,answer,fact.status);
  if (!followups.length) return finishMain(state,fact);
  const context={draft:fact,remainingQuestions:followups,correction:false};
  return resultFor({...state,clarificationContext:context,pendingQuestions:[followups[0]]},followups[0].text,true);
}
function correctCore(state, key, answer, sourceMessageId, at) {
  if (state?.protocolId !== PROTOCOL_ID) error(409,'Esta consulta no admite correcciones de esta entrevista.');
  if (state.clarificationContext) error(409,'Termina la aclaración pendiente antes de corregir otra respuesta.');
  const targetIndex=state.facts.findIndex(f=>f.key===key),question=QUESTIONS.find(q=>q.id===key);
  if(targetIndex<0 || !question) error(400,'Selecciona una respuesta ya registrada.');
  if(state.facts[targetIndex].autoSkipped) error(400,'Primero corrige la pregunta 15 sobre tus alergias para responder las preguntas que se omitieron.');
  if(key==='reason' && isGreetingOnly(answer)) error(400,'Un saludo no puede sustituir el motivo de consulta. Describe el problema o escribe No sé.');
  if(key==='reason' && reasonIssue(answer)) error(400,reasonIssue(answer));
  const old=state.facts[targetIndex], fact=factFrom(question,answer,sourceMessageId,at);
  fact.revisions=[...(old.revisions||[]),{text:old.text,status:old.status,clarifications:old.clarifications||[],sourceMessageId:old.sourceMessageId,recordedAt:old.recordedAt,supersededAt:at}];
  const facts=state.facts.map((f,i)=>i===targetIndex ? fact : f),followups=followupsFor(key,answer,fact.status);
  if(key==='allergies'&&fact.status!=='reported') return skipAllergyDetails(state,fact);
  if(key==='allergies'&&fact.status==='reported') {
   const reset=state.facts.filter(f=>!['allergies','allergy_reaction','allergy_timing','answers_confirmation'].includes(f.key));
   fact.revisions=[...(fact.revisions||[]),...state.facts.filter(f=>['allergy_reaction','allergy_timing'].includes(f.key)).map(f=>({text:f.text,status:f.status,clarifications:f.clarifications||[],sourceMessageId:f.sourceMessageId,recordedAt:f.recordedAt,dependentKey:f.key}))];
   const transition=advanceDirect({...state,facts:reset,pendingQuestions:[{...question}],phase:'collecting'},'allergies',answer,sourceMessageId,at);
   const revised=transition.clinicalState.clarificationContext?.draft || transition.clinicalState.facts.find(f=>f.key==='allergies');
   revised.revisions=fact.revisions;return transition;
  }
  if (!followups.length) return resultFor({...state,facts},state.pendingQuestions[0] ? 'Corrección guardada. '+state.pendingQuestions[0].text : 'Corrección guardada. La recopilación sigue terminada; no se ha realizado evaluación clínica.');
  const context={draft:fact,remainingQuestions:followups,correction:true,targetIndex,resumePendingQuestions:state.pendingQuestions,resumePhase:state.phase};
  return resultFor({...state,facts,phase:'collecting',clarificationContext:context,pendingQuestions:[followups[0]]},'Corrección guardada. '+followups[0].text,true);
}


// Una corrección cambia la base de la confirmación: debe confirmarse de nuevo.
export function correctDirect(state,key,...args){
 if(key==='answers_confirmation')return correctCore(state,key,...args);
 const hadConfirmation=state.facts?.some(f=>f.key==='answers_confirmation');
 const base=hadConfirmation?{...state,facts:state.facts.filter(f=>f.key!=='answers_confirmation'),phase:'collecting',pendingQuestions:[{...QUESTIONS.find(q=>q.id==='answers_confirmation')}]}:state;
 return correctCore(base,key,...args);
}
export function answersConfirmed(state){
 if(!['intake-demo-v6','intake-demo-v7','intake-demo-v8'].includes(state?.protocolId))return true;
 const answer=state.facts?.find(f=>f.key==='answers_confirmation');
 return !!answer&&normalize(answer.text).replace(/[.!]$/,'')==='si';
}
