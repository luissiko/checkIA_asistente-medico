import {readFileSync} from 'node:fs';
import {calculateBmi} from './bmi.mjs';
export const CONTENT = JSON.parse(readFileSync(new URL('./content.json', import.meta.url), 'utf8'));
const questions = new Map(CONTENT.questions.map(q => [q.id, q]));
const norm = x => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const fail = (status, message) => { throw Object.assign(new Error(message), {status}); };
const answer = (s, id) => s.answers.find(a => a.key === id)?.text ?? '';
const yes = (s, id) => norm(answer(s, id)) === 'si';
export const isWoman = s => /^(m|mujer|femenino|femenina)$/.test(norm(answer(s, 'sex')));
export const bmiFor = s => calculateBmi(s.answers);
export function initialState() {
  return {protocolId: CONTENT.version, revision: 0, phase: 'collecting', questionId: 'respondent', answers: [], journal: [], alert: null, bmi: null, orientation: null, extraInformation: [], orientationHistory: []};
}
export function pending(s) { return questions.get(s.questionId) ?? null; }
const detailGroups = {1: 'infant_emergency', 2: 'pregnancy_emergency', 3: 'older_emergency', 4: 'disability_emergency'};
function nextQuestion(s, id) {
  const items=CONTENT.questions.filter(q=>q.kind!=='condition');
  const following=items[items.findIndex(q=>q.id===id)+1]?.id??null;
  const branch=(detail,after)=>yes(s,id)?detail:after;
  const routes={
    respondent:'reason',reason:'emergency_level',emergency_level:'emergency_options',age:'sex',
    sex:isWoman(s)?'has_children':'weight',has_children:branch('children_count','pregnant'),children_count:'pregnant',
    pregnant:branch('pregnancy_months','weight'),pregnancy_months:'weight',height:'bmi_consent',
    history:branch('history_detail','medications'),medications:branch('medications_details','remedies'),
    medications_knows_active:branch('medications_identity','remedies'),remedies:branch('remedies_detail','allergies'),
    allergies:branch('allergy_timing','cancer_diabetes'),pets:branch('pets_detail','cancer_diabetes'),
    cancer_diabetes:branch('cancer_diabetes_detail','hereditary'),
    hereditary:branch('hereditary_choice','degenerative'),hereditary_choice:answer(s,id).trim()==='10'?'degenerative':'hereditary_since',hereditary_relative_age:'degenerative',
    degenerative:branch('degenerative_choice','sti'),degenerative_choice:answer(s,id).trim()==='10'?'sti':'degenerative_since',degenerative_since:'sti',
    sti:branch('sti_choice','physical_activity'),sti_choice:answer(s,id).trim()==='10'?'physical_activity':'sti_since',sti_since:'physical_activity',
    physical_activity:branch('activity_detail','healthy_diet'),healthy_diet:branch('avoids_processed','unhealthy_food'),
    unhealthy_food:/^(?:no(?: consumo(?: comida no saludable)?)?|ningun[oa](?:s)?|nada|nunca|no como(?: comida no saludable)?)[.!]?$/i.test(norm(answer(s,id)))?'city':'unhealthy_food_frequency',unhealthy_food_frequency:'city',
    avoids_processed:'unhealthy_food',travel:branch('travel_where','medical_visits'),
    medical_visits:branch('medical_last','lab_tests'),lab_tests:branch('lab_which','sleep'),
    alcohol:branch('alcohol_current','smoking'),alcohol_current:branch('alcohol_detail','alcohol_past'),alcohol_detail:'smoking',alcohol_past:'smoking',
    smoking:branch('smoking_current','drugs'),smoking_current:branch('smoking_detail','smoking_past'),smoking_detail:'drugs',smoking_past:'drugs',
    drugs:branch('drugs_current','protection'),drugs_current:branch('drugs_detail','drugs_past'),drugs_detail:'protection',drugs_past:'protection',
    protection:branch('partners','donated'),donated:branch('donated_when','answers_confirmation'),answers_confirmation:null
  };
  return Object.hasOwn(routes,id)?routes[id]:following;
}
export function advance(state, questionId, text) {
  if (state.phase !== 'collecting' || state.questionId !== questionId) fail(409, 'La pregunta cambió. Recarga la consulta.');
  if (typeof text !== 'string' || !text.trim() || text.length > 4000) fail(400, 'Escribe una respuesta de 1 a 4000 caracteres.');
  const q = pending(state), n = norm(text);
  if ((q.kind === 'yesno' || q.kind === 'recheck') && !['si', 'no'].includes(n)) fail(400, 'Responde si o no.');
  const s = structuredClone(state);
  const fact = {key: q.id, number: q.number, question: q.text, text, source: 'user_report', recordedAt: new Date().toISOString()};
  s.journal.push(fact);
  s.answers = [...s.answers.filter(a => a.key !== q.id), fact];
  s.revision++;
  s.orientation = null;
  let next;
  if (q.id === 'emergency_level') {
    const level = parseEmergencyLevel(text);
    s.inputNotice = null;
    if (level === null || level < 1) { next = 'emergency_level'; s.inputNotice = 'Indica un número del 1 al 10 para continuar.'; }
    else if (level <= 8) next = 'age';
    else { next = 'emergency_options'; if(level >= 9) s.alert = {kind:'reported_level',source:'user_report',immediate:true}; }
  } else if (q.id === 'emergency_options') {
    const selection = n.replace(/^(?:opcion|opción)\s*/, '').replace(/[.)]$/, '');
    if (selection === 'no' || selection === '5' || selection === 'h') next = 'age';
    else if (selection === 'a' || selection === 'si') next = 'emergency_group';
    else if ('bcdefg'.includes(selection) && selection.length === 1) {
      s.alert = {kind: selection, source: 'user_selection', content: CONTENT.emergencyOptions.find(o => o.value === selection), requiresRag: true};
      s.phase = 'emergency'; next = null;
    } else next = 'emergency_options'; // La respuesta libre se conserva; pedir una ruta interpretable.
  } else if (q.id === 'emergency_group') {
    next = detailGroups[n] ?? (n === '5' ? 'age' : 'emergency_group');
  } else if (Object.values(detailGroups).includes(q.id)) {
    s.alert = {kind: q.id, source: 'user_report', requiresRag: true};
    s.phase = 'emergency'; next = null;
  } else {
    next = nextQuestion(s, q.id);
  }
  s.questionId = next ?? null;
  if (!next && s.phase !== 'emergency') s.phase = 'complete';
  s.bmi = yes(s,'bmi_consent') ? bmiFor(s) : null;
  return s;
}
export function parseEmergencyLevel(text) {
  const n=norm(text), words=['cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez'];
  if(words.includes(n))return words.indexOf(n);
  const match=n.match(/^(10|[0-9])(?:\s*(?:\/\s*10|de\s+10))?$/);
  return match?Number(match[1]):null;
}
export function addExtraInformation(state,text) {
  if(!canGenerate(state))fail(409,'Completa primero el formulario o la ruta de emergencia.');
  if(typeof text!=='string'||!text.trim()||text.length>4000)fail(400,'Escribe información adicional de 1 a 4000 caracteres.');
  if((state.extraInformation??[]).length>=10)fail(429,'Se alcanzó el límite de diez ampliaciones para esta consulta.');
  const s=structuredClone(state), item={text,source:'user_report',recordedAt:new Date().toISOString()};
  if(s.orientation)s.orientationHistory=[...(s.orientationHistory??[]),s.orientation];
  s.extraInformation=[...(s.extraInformation??[]),item];s.journal.push({key:'extra_information',...item});
  s.orientation=null;s.generationPending=false;s.revision++;
  return s;
}
export function confirmed(s) { return yes(s, 'answers_confirmation'); }
export function canGenerate(s) { return s.phase === 'emergency' && s.alert?.requiresRag || s.phase === 'complete' && confirmed(s); }
export function contextFor(s) {
  const fields = s.answers.filter(a => !['respondent','bmi_consent'].includes(a.key)).map(a => ({key: a.key, label: a.question, answer: a.text, ...(questions.get(a.key)?.choices ? {selectedOptions: questions.get(a.key).choices.filter(o=>a.text.split(/[,;\s]+/).includes(o.value)).map(o=>o.label)} : {}), status: 'reported', omitted: false, clarifications: []}));
  if(s.alert?.content?.question)fields.push({key:'associated',label:'Pregunta de alarma seleccionada; no confirma por separado cada síntoma',answer:s.alert.content.question,status:'reported',omitted:false,clarifications:[]});
  const detail = s.answers.find(a => Object.values(detailGroups).includes(a.key));
  if (detail) fields.push({key: 'reason', label: detail.question, answer: detail.text, status: 'reported', omitted: false, clarifications: []});
  for(const [i,item] of (s.extraInformation??[]).entries())fields.push({key:'associated',label:'Información extra '+(i+1),answer:item.text,status:'reported',omitted:false,clarifications:[]});
  return {extraInformation:s.extraInformation??[], emergencyCase:s.alert?.content??null, purpose: 'Prueba local del formulario literal del usuario; no diagnóstico confirmado.', availableClarifications: [], safety: {status: s.alert ? 'possible_alarm' : 'not_determined'}, fields, anthropometry: s.bmi, testOnly: true};
}
