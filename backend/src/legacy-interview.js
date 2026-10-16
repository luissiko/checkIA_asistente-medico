// Protocolo técnico de recopilación: sin clasificación ni interpretación clínica.
import { normalize, answerStatus, reasonIssue, detailIssue } from './response-quality.js';
import { SCREEN_QUESTION, initialSafety, recordScreen } from './safety.js';
export const PROTOCOL_ID = 'intake-demo-v1';
export const QUESTIONS = Object.freeze([
  { id: 'reason', text: 'En este caso ficticio, ¿cuál es el motivo principal de consulta?', kind: 'text' },
  { id: 'age', text: '¿Qué edad tiene la persona del caso ficticio? Escribe años cumplidos (0 a 120).', kind: 'age' },
  { id: 'onset', text: '¿Cuándo comenzó el problema y cómo ha cambiado desde entonces?', kind: 'text' },
  { id: 'location', text: '¿En qué parte del cuerpo se presenta? Si no corresponde, escribe No aplica.', kind: 'text' },
  { id: 'severity', text: 'Si hay dolor, ¿qué intensidad tiene de 0 a 10? 0 significa sin dolor y 10 el máximo. Si no corresponde, escribe No aplica.', kind: 'severity' },
  { id: 'associated', text: '¿Qué otros síntomas presenta la persona del caso ficticio?', kind: 'text' },
  { id: 'history', text: '¿Qué enfermedades o antecedentes relevantes refiere?', kind: 'text' },
  { id: 'medications', text: '¿Qué medicamentos refiere tomar? Si conoce dosis y frecuencia, inclúyelas.', kind: 'text' },
  { id: 'allergies', text: '¿Qué alergias conocidas refiere?', kind: 'text' }
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
  return { schemaVersion: 2, protocolId: PROTOCOL_ID, validationVersion: 5, revision: 0, phase: 'collecting', facts: [], pendingQuestions: [{ ...SCREEN_QUESTION }], clarificationContext: null, safety: initialSafety(), assessment: null };
}
function error(status, message) { throw Object.assign(new Error(message), { status }); }
function validateAnswer(question, answer) {
  const n = normalize(answer), status = answerStatus(answer);
  if (status === 'reported' && question.kind === 'age' && (!/^\d{1,3}$/.test(n) || Number(n) > 120))
    error(400, 'Escribe una edad entera de 0 a 120, No sé o Prefiero no responder.');
  if (status === 'reported' && question.kind === 'severity' && (!/^\d{1,2}$/.test(n) || Number(n) > 10))
    error(400, 'Escribe un número entero de 0 a 10, No aplica, No sé o Prefiero no responder.');
  if (question.kind === 'age' && status === 'not_applicable') error(400, 'Para la edad usa No sé o Prefiero no responder.');
  return status;
}
const knownNone = text => /^(?:ninguno|ninguna|ninguno referido|ninguna referida|ninguna conocida|ninguno conocido|no tomo medicamentos|no tomo nada|no tengo alergias|sin alergias conocidas)$/.test(normalize(text).replace(/[.!]+$/g,''));
export function followupsFor(key, answer, status) {
  if (status !== 'reported') return [];
  if ((key === 'medications' || key === 'allergies') && knownNone(answer)) return [];
  if (key === 'onset') {
    const n=normalize(answer);
    const hasTime = /\b(?:ayer|hoy|anoche|anteayer|siempre|infancia|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(n) || /\b(?:hace|desde)\b.*\b(?:dias?|horas?|semanas?|mes(?:es)?|anos?|minutos?)\b/.test(n) || /\d+\s*(?:dias?|horas?|semanas?|mes(?:es)?|anos?|minutos?)\b/.test(n) || /\d{1,4}[/-]\d{1,2}(?:[/-]\d{1,4})?/.test(n);
    return hasTime ? [] : [{id:'onset_when',parentKey:key,text:'Con esa respuesta no puedo identificar cuándo comenzó. ¿Hace cuánto tiempo o en qué fecha empezó? Si no lo recuerdas, escribe No sé.',kind:'text'}];
  }
  if (key === 'medications') return [
    {id:'medications_formulation',parentKey:key,text:'Para cada medicamento mencionado, ¿qué presentación y concentración indica su envase? Por ejemplo: tableta o jarabe y la concentración escrita. Si no la conoces, escribe No sé.',kind:'text'},
    {id:'medications_amount',parentKey:key,text:'¿Qué cantidad refiere tomar cada vez de cada medicamento? Describe lo que ya toma, sin cambiarlo. Si no lo sabes, escribe No sé.',kind:'text'},
    {id:'medications_frequency',parentKey:key,text:'¿Con qué frecuencia refiere tomar cada medicamento? Si no lo sabes, escribe No sé.',kind:'text'}
  ];
  if (key === 'allergies') return [
    {id:'allergies_substance',parentKey:key,text:'¿A qué medicamento, alimento u otra sustancia te refieres? No se confirma una alergia con esta respuesta. Si lo anterior no describe una alergia, escribe No corresponde; si no sabes la sustancia, escribe No sé.',kind:'text'},
    {id:'allergies_reaction',parentKey:key,text:'¿Qué reacción presentó y qué tan intensa fue? Describe lo ocurrido; si no lo sabes, escribe No sé.',kind:'text'},
    {id:'allergies_when',parentKey:key,text:'¿Cuándo ocurrió esa reacción? Si no lo recuerdas, escribe No sé.',kind:'text'}
  ];
  return [];
}
function factFrom(question, answer, sourceMessageId, at) {
  const status=validateAnswer(question,answer);
  return {key:question.id,question:question.text,text:answer,status:status === 'reported' && ['medications','allergies'].includes(question.id) && knownNone(answer) ? 'none_reported' : status,source:'user_report',sourceMessageId,recordedAt:at,clarifications:[]};
}
function resultFor(state, reply, needsClarification=false) {
  return {clinicalState:{...state,validationVersion:5,safety:state.safety||initialSafety(),assessment:null},reply,needsClarification};
}
function requestDetail(state, question, answer, sourceMessageId, at, reply) {
  const event = {questionId:question.id,text:answer,sourceMessageId,recordedAt:at,reason:reply,source:'user_report'};
  return resultFor({...state,qualityEvents:[...(state.qualityEvents || []),event]},reply,true);
}
function finishMain(state, fact) {
  const facts=[...state.facts,fact], next=QUESTIONS[facts.length];
  return resultFor({...state,facts,clarificationContext:null,pendingQuestions:next ? [{...next}] : [],phase:next ? 'collecting' : 'complete'},next ? next.text : 'Recopilación de prueba terminada. Se registraron las respuestas y los datos desconocidos como información referida. Esto no confirma alergias, diagnóstico ni urgencia.');
}
function finishClarification(state, context) {
  if (!context.correction) return finishMain(state,context.draft);
  const facts=state.facts.map((f,i)=>i===context.targetIndex ? context.draft : f);
  const restored={...state,facts,clarificationContext:null,pendingQuestions:context.resumePendingQuestions,phase:context.resumePhase};
  return resultFor(restored,context.resumePendingQuestions[0] ? 'Corrección y aclaraciones guardadas. '+context.resumePendingQuestions[0].text : 'Corrección y aclaraciones guardadas. La recopilación sigue terminada; no se ha realizado evaluación clínica.');
}
export function advanceInterview(state, questionId, answer, sourceMessageId, at) {
  if (state?.protocolId !== PROTOCOL_ID) error(409, 'Esta sesión pertenece a la prueba anterior. Crea una nueva para iniciar la entrevista.');
  if (state.phase !== 'collecting') error(409, 'La entrevista ya terminó. Puedes consultar el historial o corregir una respuesta.');
  const question=state.pendingQuestions?.[0];
  if (!question || question.id !== questionId) error(409, 'La pregunta pendiente cambió. Recarga la consulta antes de responder.');
  if (question.id === 'alarm_screen') {
    const safety=recordScreen(state,answer,sourceMessageId,at);
    return resultFor({...state,safety,pendingQuestions:[{...QUESTIONS[0]}]},'Comprobación registrada. Esto no descarta otras emergencias ni determina urgencia. '+QUESTIONS[0].text);
  }
  if ((question.id === 'reason' || question.parentKey) && isGreetingOnly(answer)) {
    return resultFor(state,question.id === 'reason' ? 'Hola. Describe el motivo de consulta del caso ficticio. El saludo queda en el historial y seguimos en la pregunta sobre el motivo de consulta.' : 'Necesito una respuesta a esta aclaración. Describe el dato que conozcas o escribe No sé o Prefiero no responder.',true);
  }
  const issue = question.id === 'reason' ? reasonIssue(answer) : question.parentKey ? detailIssue(question.id, answer) : null;
  if (issue) return requestDetail(state,question,answer,sourceMessageId,at,issue);
  if (state.clarificationContext) {
    const context=structuredClone(state.clarificationContext);
    if (!question.parentKey || question.parentKey !== context.draft.key) error(409,'Aclaración incompatible. Recarga la consulta.');
    const status=answerStatus(answer);
    context.draft.clarifications.push({key:question.id,question:question.text,text:answer,status,source:'user_report',sourceMessageId,recordedAt:at});
    // No corresponde expresa que el texto original no era una declaración de alergia.
    const next=context.remainingQuestions.slice(1);
    if (question.id === 'allergies_substance' && status === 'not_applicable') {
      context.draft.status='not_applicable';return finishClarification(state,context);
    }
    if (!next.length) return finishClarification(state,context);
    context.remainingQuestions=next;
    return resultFor({...state,clarificationContext:context,pendingQuestions:[next[0]]},next[0].text,true);
  }
  if (question.id !== QUESTIONS[state.facts.length]?.id) error(409,'Estado incompatible. Crea una nueva entrevista.');
  const fact=factFrom(question,answer,sourceMessageId,at), followups=followupsFor(fact.key,answer,fact.status);
  if (!followups.length) return finishMain(state,fact);
  const context={draft:fact,remainingQuestions:followups,correction:false};
  return resultFor({...state,clarificationContext:context,pendingQuestions:[followups[0]]},followups[0].text,true);
}
export function correctInterview(state, key, answer, sourceMessageId, at) {
  if (state?.protocolId !== PROTOCOL_ID) error(409,'Esta consulta no admite correcciones de esta entrevista.');
  if (state.clarificationContext) error(409,'Termina la aclaración pendiente antes de corregir otra respuesta.');
  const targetIndex=state.facts.findIndex(f=>f.key===key),question=QUESTIONS.find(q=>q.id===key);
  if(targetIndex<0 || !question) error(400,'Selecciona una respuesta ya registrada.');
  if(key==='reason' && isGreetingOnly(answer)) error(400,'Un saludo no puede sustituir el motivo de consulta. Describe el problema o escribe No sé.');
  if(key==='reason' && reasonIssue(answer)) error(400,reasonIssue(answer));
  const old=state.facts[targetIndex], fact=factFrom(question,answer,sourceMessageId,at);
  fact.revisions=[...(old.revisions||[]),{text:old.text,status:old.status,clarifications:old.clarifications||[],sourceMessageId:old.sourceMessageId,recordedAt:old.recordedAt,supersededAt:at}];
  const facts=state.facts.map((f,i)=>i===targetIndex ? fact : f),followups=followupsFor(key,answer,fact.status);
  if (!followups.length) return resultFor({...state,facts},state.pendingQuestions[0] ? 'Corrección guardada. '+state.pendingQuestions[0].text : 'Corrección guardada. La recopilación sigue terminada; no se ha realizado evaluación clínica.');
  const context={draft:fact,remainingQuestions:followups,correction:true,targetIndex,resumePendingQuestions:state.pendingQuestions,resumePhase:state.phase};
  return resultFor({...state,facts,phase:'collecting',clarificationContext:context,pendingQuestions:[followups[0]]},'Corrección guardada. '+followups[0].text,true);
}
