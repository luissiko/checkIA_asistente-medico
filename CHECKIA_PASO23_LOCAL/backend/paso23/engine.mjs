import {readFileSync} from 'node:fs';
export const CONTENT = JSON.parse(readFileSync(new URL('./content.json', import.meta.url), 'utf8'));
const questions = new Map(CONTENT.questions.map(q => [q.id, q]));
const norm = x => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const fail = (status, message) => { throw Object.assign(new Error(message), {status}); };
const answer = (s, id) => s.answers.find(a => a.key === id)?.text ?? '';
const yes = (s, id) => norm(answer(s, id)) === 'si';
export const isWoman = s => /^(m|mujer|femenino|femenina)$/.test(norm(answer(s, 'sex')));
function number(text, units) {
  const n = norm(text).replace(',', '.');
  const m = n.match(new RegExp('^(\\d+(?:\\.\\d+)?)\\s*(?:' + units + ')?$'));
  return m ? Number(m[1]) : null;
}
export function bmiFor(s) {
  const weight = number(answer(s, 'weight'), 'kg|kilos?|kilogramos?');
  const rawHeight = answer(s, 'height');
  let height = number(rawHeight, 'cm|centimetros?|m|metros?');
  const explicitM = /(?:^|\d)\s*(?:m|metros?)$/.test(norm(rawHeight));
  const explicitCm = /(?:cm|centimetros?)$/.test(norm(rawHeight));
  if (height !== null && (explicitM || (!explicitCm && height <= 3))) height *= 100;
  const age = number(answer(s, 'age'), 'anos?');
  const base = {weightKg: weight, heightCm: height, ageYears: age, bmi: null, classification: 'no_evaluable', reference: null};
  if (!(weight > 0) || !(height > 0)) return base;
  const bmi = weight / ((height / 100) ** 2);
  if (!Number.isFinite(bmi)) return base;
  const out = {...base, bmi, display: Number(bmi.toFixed(2)), heightInterpretation: explicitM || explicitCm ? 'unidad_declarada' : height >= 100 ? 'unidad_inferida_confirmar' : 'unidad_sin_confirmar'};
  if (yes(s, 'pregnant')) return {...out, classification: 'requiere_interpretacion_por_embarazo'};
  if (age !== null && age >= 19 && age <= 80) return {...out, reference: 'OMS_adulto_general_segun_documento', classification: bmi < 18.5 ? 'bajo_peso' : bmi < 25 ? 'peso_normal' : bmi < 30 ? 'sobrepeso_sin_obesidad' : 'obesidad'};
  return {...out, classification: 'requiere_referencia_pediatrica_o_especifica', reference: 'No se clasifica con promedios anuales'};
}
export function initialState() {
  return {protocolId: CONTENT.version, revision: 0, phase: 'collecting', questionId: 'respondent', answers: [], journal: [], alert: null, bmi: null, orientation: null};
}
export function pending(s) { return questions.get(s.questionId) ?? null; }
const detailGroups = {1: 'infant_emergency', 2: 'pregnancy_emergency', 3: 'older_emergency', 4: 'disability_emergency'};
function nextQuestion(s, id) {
  const woman = isWoman(s);
  const afterChildren = woman ? 'pregnant' : 'weight';
  const age = number(answer(s, 'age'), 'anos?');
  const routes = {
    respondent: 'reason', reason: 'emergency_level', emergency_level: 'emergency_options',
    age: 'sex', sex: age !== null && age >= 18 ? 'has_children' : afterChildren,
    has_children: yes(s, id) ? 'children_count' : afterChildren,
    children_count: afterChildren, pregnant: yes(s, id) ? 'pregnancy_months' : 'weight', pregnancy_months: 'weight',
    weight: 'height', height: 'alarm_recheck', alarm_recheck: 'onset', onset: 'location', location: 'location_description',
    location_description: 'severity', severity: 'history', history: yes(s, id) ? 'history_detail' : 'medications', history_detail: 'medications',
    medications: yes(s, id) ? 'medications_details' : 'remedies', medications_details: 'medications_knows_active',
    medications_knows_active: yes(s, id) ? 'medications_identity' : 'remedies', medications_identity: 'remedies',
    remedies: yes(s, id) ? 'remedies_detail' : 'allergies', remedies_detail: 'allergies',
    allergies: yes(s, id) ? 'allergy_timing' : 'pets', allergy_timing: 'allergy_reaction', allergy_reaction: 'pets',
    pets: 'family_history', family_history: yes(s, id) ? 'family_condition' : 'physical_activity',
    family_condition: 'family_relative', family_relative: 'physical_activity',
    physical_activity: yes(s, id) ? 'activity_detail' : 'healthy_diet', activity_detail: 'healthy_diet',
    healthy_diet: yes(s, id) ? 'avoids_processed' : 'unhealthy_food',
    avoids_processed: yes(s, id) ? 'city' : 'unhealthy_food', unhealthy_food: 'city',
    city: 'origin', origin: 'travel', travel: 'answers_confirmation', answers_confirmation: null
  };
  return routes[id];
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
  if (q.id === 'emergency_options') {
    const selection = n.replace(/^(?:opcion|opción)\s*/, '').replace(/[.)]$/, '');
    if (selection === 'no' || selection === '5') next = 'age';
    else if (selection === 'a' || selection === 'si') next = 'emergency_group';
    else if ('bcdefg'.includes(selection) && selection.length === 1) {
      s.alert = {kind: selection, source: 'user_selection', content: CONTENT.emergencyOptions.find(o => o.value === selection)};
      s.phase = 'emergency'; next = null;
    } else next = 'emergency_options'; // La respuesta libre se conserva; pedir una ruta interpretable.
  } else if (q.id === 'emergency_group') {
    next = detailGroups[n] ?? (n === '5' ? 'age' : 'emergency_group');
  } else if (Object.values(detailGroups).includes(q.id)) {
    s.alert = {kind: q.id, source: 'user_report', requiresRag: true};
    s.phase = 'emergency'; next = null;
  } else if (q.id === 'alarm_recheck' && n === 'si') {
    s.alert = {kind: 'recheck', source: 'user_report'};
    next = 'emergency_options';
  } else {
    next = nextQuestion(s, q.id);
    if (q.id === 'emergency_level') {
      const level = number(text, '');
      if (level !== null && level >= 9 && level <= 10) s.alert = {kind: 'reported_level', source: 'user_report'};
    }
  }
  s.questionId = next ?? null;
  if (!next && s.phase !== 'emergency') s.phase = 'complete';
  s.bmi = bmiFor(s);
  return s;
}
export function confirmed(s) { return yes(s, 'answers_confirmation'); }
export function canGenerate(s) { return s.phase === 'emergency' && s.alert?.requiresRag || s.phase === 'complete' && confirmed(s); }
export function contextFor(s) {
  const fields = s.answers.filter(a => a.key !== 'respondent').map(a => ({key: a.key, label: a.question, answer: a.text, status: 'reported', omitted: false, clarifications: []}));
  const detail = s.answers.find(a => Object.values(detailGroups).includes(a.key));
  if (detail) fields.push({key: 'reason', label: detail.question, answer: detail.text, status: 'reported', omitted: false, clarifications: []});
  return {purpose: 'Prueba local del formulario literal del usuario; no diagnóstico confirmado.', availableClarifications: [], safety: {status: s.alert ? 'possible_alarm' : 'not_determined'}, fields, anthropometry: s.bmi, testOnly: true};
}
