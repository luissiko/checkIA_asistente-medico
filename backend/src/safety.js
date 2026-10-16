// Prototipo de alarmas de alcance limitado. No clasifica pacientes ni descarta emergencias.
export const SAFETY_VERSION = 'alarm-demo-v2';
export const SOURCES = Object.freeze({
  general: {title:'MedlinePlus: reconocimiento de emergencias médicas',url:'https://medlineplus.gov/spanish/ency/article/001927.htm'},
  abdominal: {title:'NHS: stomach ache',url:'https://www.nhs.uk/symptoms/stomach-ache/'},
  headache: {title:'NHS: headaches',url:'https://www.nhs.uk/symptoms/headaches/'},
  chest: {title:'East of England Ambulance Service: when to call 999',url:'https://www.eastamb.nhs.uk/your-service/using-999'},
  mexico: {title:'Gobierno de México: 911',url:'https://www.gob.mx/911'}
});
export const SCREEN_QUESTION = Object.freeze({id:'alarm_screen',kind:'safety',text:'Antes de continuar: ¿la persona presenta AHORA alguna de estas señales?\n• Dificultad importante para respirar o atragantamiento.\n• Dolor o presión en el pecho fuerte o que no cede.\n• Sangrado que no se detiene o vómito con sangre.\n• Pérdida de conocimiento o no responde.\n• Dificultad repentina para hablar o debilidad de un lado.\n• Dolor abdominal muy intenso o de aparición muy repentina.\n• Dolor de cabeza que empezó de repente y es extremadamente intenso.\nResponde Sí, No o No sé. Esta lista no cubre todas las emergencias.'});
export const V3_SCREEN_QUESTION=Object.freeze({id:'alarm_screen',kind:'safety',text:"Antes de continuar, responde sinceramente: ¿tienes alguna de estas señales ahora?\na) ¿Tienes dificultad importante para respirar o atragantamiento (te estás asfixiando)?\nb) ¿Tienes dolor o presión fuerte o intensa en el pecho?\nc) ¿Tienes sangrado que no se detiene o vómito con sangre?\nd) ¿Usted tiene pérdida de conocimiento o no responde bien estas preguntas?\ne) ¿Tienes dificultad para hablar o debilidad de un lado de la boca ahora?\nf) ¿Tienes dolor abdominal muy intenso (estómago, vientre, intestinos o riñón)?\ng) ¿Tienes dolor de cabeza intenso (migraña) o te has desmayado antes de responder esto?\nResponde Sí, una letra de la a a la g, No o No sé. Esta lista no cubre todas las emergencias. Si alguien no responde, busca ayuda sin esperar el formulario."});
export const DIRECT_SCREEN_QUESTION=Object.freeze({id:"alarm_screen",kind:"safety",text:"ANTES DE CONTINUAR: ¿TIENES ALGUNA DE ESTAS SEÑALES?\na) ¿Tienes dificultad importante para respirar o atragantamiento?\nb) ¿Tienes dolor o presión fuerte o intensa en el pecho?\nc) ¿Tienes sangrado que no se detiene o vómito con sangre?\nd) ¿Usted tiene pérdida de conocimiento o te sientes realmente mareado?\ne) ¿Tienes dificultad para hablar o debilidad de un lado de la boca ahora?\nf) ¿Tienes dolor abdominal muy intenso (estómago, vientre)?\ng) ¿Tienes dolor de cabeza intenso (migraña) o has sufrido un desmayo hoy?\nResponde Sí, una letra de la a a la g, No o No sé."});
export const MOBILE_SCREEN_QUESTION=Object.freeze({id:'alarm_screen',kind:'safety',screenVersion:'mobile-screen-v1',text:'ANTES DE CONTINUAR: ¿TIENES ALGO DE ESTO AHORA?\na) ¿Tienes dificultad para respirar?\nb) ¿Tienes dolor intenso o presión en el pecho?\nc) ¿Tienes sangrado o vómito con sangre?\nd) ¿Tuviste pérdida de conocimiento o estás mareado ahora?\ne) ¿Tienes mareo, náuseas o desmayo?\nf) ¿Tienes dolor abdominal intenso (estómago, vientre)?\ng) ¿Tienes dolor de cabeza intenso?\nh) ¿Tienes sudoración fría, repentina o pegajosa?\nResponde Sí, una letra de la a a la h, No o No sé.'});
export const COMPACT_SCREEN_QUESTION=Object.freeze({...MOBILE_SCREEN_QUESTION,screenVersion:'mobile-screen-v2',text:MOBILE_SCREEN_QUESTION.text.replace('ANTES DE CONTINUAR: ¿TIENES ALGO DE ESTO AHORA?','ANTES DE CONTINUAR: ¿TIENES ALGO DE ESTO AHORA? SÍ/NO').replace('\nResponde Sí, una letra de la a a la h, No o No sé.','')});
export function selectedScreenLetters(answer,maxLetter='g') {
 const n=normalized(answer).replace(/^(?:la\s+)?(?:opcion|letra)\s+/,'').replace(/[.!?¿¡]+$/g,'').trim();
 return new RegExp('^[a-'+maxLetter+'][).:]?(?:(?:\\s*[,;/]\\s*|\\s+y\\s+|\\s+)[a-'+maxLetter+'][).:]?)*$').test(n);
}
export function initialSafety() {return {version:SAFETY_VERSION,status:'not_screened',screenAnswer:null};}
const normalized = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const RULES = [
  {id:'breathing',label:'Dificultad respiratoria referida',source:'general',match:t=>/\b(?:me cuesta mucho respirar|se me dificulta mucho respirar|no puedo respirar|no puede respirar|no logro respirar|me estoy ahogando|se esta ahogando|me falta el aire|me falta aire|dificultad (?:grave|intensa|severa) para respirar)\b/.test(t)},
  {id:'chest',label:'Dolor o presión torácica referidos',source:'chest',match:t=>/\b(?:dolor (?:en el |de )pecho|presion (?:en el |de )pecho|presion fuerte en el pecho|dolor fuerte en el pecho|me duele el pecho|me aprieta el pecho)\b/.test(t)},
  {id:'bleeding',label:'Sangrado preocupante referido',source:'general',match:t=>/\b(?:vomito sangre|vomitando sangre|vomita sangre|sangrado que no (?:para|se detiene)|sangro y no para|sangro sin parar)\b/.test(t)},
  {id:'consciousness',label:'Falta de respuesta o pérdida de conocimiento referidas',source:'general',match:t=>/\b(?:me acabo de desmayar|me estoy desmayando|esta inconsciente|(?:la persona|mi madre|mi mama|mi padre|mi papa|el paciente|mi hijo|mi hija) no responde|no despierta|no se despierta|perdio el conocimiento|ha perdido el conocimiento)\b/.test(t)},
  {id:'neurological',label:'Cambio neurológico repentino referido',source:'general',match:t=>/\b(?:de repente|repentinamente)\b.{0,90}\b(?:me cuesta hablar|se me dificulta hablar|no puedo hablar|no puede hablar|no puedo mover un lado|no puede mover un lado|debilidad de un lado)\b|\b(?:me cuesta hablar|se me dificulta hablar|no puedo hablar|no puede hablar|debilidad de un lado)\b.{0,90}\b(?:de repente|repentinamente)\b/.test(t)},
  {id:'abdominal',label:'Dolor abdominal intenso o repentino referido',source:'abdominal',match:t=>/\b(?:abdomen|abdominal|estomago|vientre|panza)\b/.test(t) && /\b(?:dolor|duele)\b/.test(t) && /\b(?:insoportable|muy fuerte|muy intenso|intenso|severo|repentino|de repente|no soporto|me estoy muriendo)\b/.test(t)},
  {id:'headache',label:'Dolor de cabeza repentino y muy intenso referido',source:'headache',match:t=>/\b(?:dolor de cabeza|duele la cabeza)\b/.test(t) && /\b(?:de repente|repentinamente|repentino|subito)\b/.test(t) && /\b(?:extremadamente|insoportable|muy fuerte|muy intenso|peor dolor)\b/.test(t)}
];
export function detectSignals(text) {
  // Negaciones e historia solo se manejan en formas sencillas, por cláusula.
  // Esta regla no ofrece comprensión semántica ni cobertura exhaustiva.
  const clauses=normalized(text).split(/[.;!?\n]+|\b(?:pero|aunque|y)\b/).map(t=>t.trim()).filter(Boolean);
  const found=new Map();
  for(const clause of clauses) {
    if (/\b(?:no tengo|no presento|no siento|no me duele|no le duele|no vomito|sin dolor|niego|no hay|nunca he tenido)\b/.test(clause)) continue;
    if (/\b(?:hace anos|hace meses|el ano pasado|tuve|tenia|ya se me quito|ya no tengo)\b/.test(clause)) continue;
    for(const rule of RULES) if(rule.match(clause)) found.set(rule.id,{id:rule.id,label:rule.label,source:SOURCES[rule.source]});
  }
  return [...found.values()];
}
export const ALERT_REPLY = 'Posible señal de alarma reportada. Si corresponde a una situación real actual, busca atención de emergencia ahora. En México llama al 911; fuera de México utiliza el número local de emergencias. No esperes a terminar esta entrevista y no conduzcas tú: pide ayuda. Esta consulta queda interrumpida. Para un caso ficticio, no realices una llamada de emergencia.';
export function assessIncoming(state, text, questionId, sourceMessageId, at) {
  if(state.phase === 'safety_alert') throw Object.assign(new Error('Esta consulta tiene una alerta persistente. Puedes revisar el historial, cerrar la consulta o crear otra prueba.'),{status:409});
  let signals=detectSignals(text);
  const n=normalized(text).replace(/[.!?¿¡]+$/g,'').trim();
  if(['alarm_screen','alarm_recheck'].includes(questionId) && state.pendingQuestions?.[0]?.id === questionId && (/^(?:si|si alguna|si una)$/.test(n)||selectedScreenLetters(text,['intake-demo-v6','intake-demo-v7','intake-demo-v8'].includes(state.protocolId)?'h':'g'))) {
    signals=[{id:'screen_positive',label:'Alguna señal de la lista fue referida por el usuario',source:SOURCES.general}];
  }
  if(!signals.length) return null;
  const safety={...(state.safety||initialSafety()),status:'possible_alarm',version:SAFETY_VERSION};
  const assessment={type:'safety_alert',engineVersion:SAFETY_VERSION,classification:'possible_emergency',clinicallyValidated:false,signals,sourceMessageId,reportedText:text,createdAt:at,reply:ALERT_REPLY,emergencyNumberMexico:'911',emergencyNumberSource:SOURCES.mexico};
  return {clinicalState:{...state,safety,phase:'safety_alert',pendingQuestions:[],assessment},reply:ALERT_REPLY,needsClarification:false};
}
export function recordScreen(state,answer,sourceMessageId,at) {
  const n=normalized(answer).replace(/[.!?¿¡]+$/g,'').trim();
  const denied=/^(?:no|ninguna|ninguno|no ninguna)$/.test(n);
  const unknown=/^(?:no\s+se|nose|no\s+lo\s+se|prefiero\s+no\s+responder|no\s+recuerdo|no\s+lo\s+recuerdo|no\s+estoy\s+segur[oa])$/.test(n);
  if(!denied && !unknown) throw Object.assign(new Error('Para esta comprobación responde Sí, No o No sé. También puedes describir directamente una señal actual.'),{status:400});
  return {version:SAFETY_VERSION,status:denied ? 'user_denied_listed_signs' : 'unknown',screenAnswer:{text:answer,status:denied ? 'reported_negative' : 'unknown',source:'user_report',sourceMessageId,recordedAt:at}};
}

export const CLEAN_SCREEN_QUESTION=Object.freeze({...COMPACT_SCREEN_QUESTION,screenVersion:'mobile-screen-v3',text:COMPACT_SCREEN_QUESTION.text.replace('ANTES DE CONTINUAR: ¿TIENES ALGO DE ESTO AHORA? SÍ/NO','¿Tienes algo de esto ahora? (Sí/No)')});
