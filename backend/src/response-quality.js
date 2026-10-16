// Reglas de formato acotadas. No confirman síntomas, alergias ni dosis.
export const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
export function answerStatus(answer) {
  const n = normalize(answer).replace(/[.!?¿¡]+$/g, '').trim();
  if (['no se', 'nose', 'no lo se', 'no recuerdo', 'no lo recuerdo', 'no estoy seguro', 'no estoy segura'].includes(n)) return 'unknown';
  if (n === 'prefiero no responder') return 'declined';
  if (['no aplica', 'no corresponde'].includes(n)) return 'not_applicable';
  return 'reported';
}
export function reasonIssue(answer) {
  if (answerStatus(answer) !== 'reported') return null;
  const n = normalize(answer).replace(/[.!?¿¡]+$/g, '').trim();
  if (['no', 'si', 'ninguno', 'ninguna', 'solo persiste', 'persiste', 'solicita detalles adicionales', 'solicito aclaraciones'].includes(n)) {
    return 'Esta respuesta no describe el motivo. Indica qué problema presenta el caso ficticio, por ejemplo: dolor de cabeza. Si no lo sabes, escribe No sé.';
  }
  return null;
}
const reportedTime = n => /\b(?:el ano pasado|el mes pasado|la semana pasada|el ultimo mes|el ultimo ano|en enero|en febrero|en marzo|en abril|en mayo|en junio|en julio|en agosto|en septiembre|en octubre|en noviembre|en diciembre)\b/.test(n) || /\b(?:19|20)\d{2}\b/.test(n) || /\b(?:ayer|hoy|anoche|anteayer|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(n) || /\b(?:hace|desde)\b.*\b(?:dias?|horas?|semanas?|mes(?:es)?|anos?|minutos?)\b/.test(n) || /\d+\s*(?:dias?|horas?|semanas?|mes(?:es)?|anos?|minutos?)\b/.test(n) || /\d{1,4}[/-]\d{1,2}(?:[/-]\d{1,4})?/.test(n);
export const hasReportedTime = text => reportedTime(normalize(text));
export function detailIssue(questionId, answer) {
  if (answerStatus(answer) !== 'reported') return null;
  const n = normalize(answer).replace(/[.!?¿¡]+$/g, '').trim();
  if (['solicita detalles adicionales', 'solicito aclaraciones', 'termina la recopilacion'].includes(n)) return 'Describe el dato solicitado o escribe No sé; esa frase no aporta el dato.';
  if (questionId === 'medications_formulation') {
    const form = /\b(?:tabletas?|comprimidos?|pastillas?|capsulas?|jarabe|solucion|suspension|gotas|crema|pomada|gel|inyectable|ampollas?|parche|aerosol|inhalador|supositorios?)\b/.test(n);
    const concentration = /\d+(?:[.,]\d+)?\s*(?:mcg|ug|mg|g|ui|iu|microgramos?|miligramos?|gramos?|unidades?)\b|\d+(?:[.,]\d+)?\s*%/.test(n);
    if (!form || !concentration) return 'Falta la presentación o la concentración escrita en el envase. Una cantidad como 2 pastillas no indica la concentración. Transcribe ambos datos si los conoces; si no, escribe No sé. No cambies lo que toma.';
  }
  if (questionId === 'medications_amount' && /\b(?:cubeta|balde|cubetada)\b/.test(n)) return 'Esa cantidad requiere aclaración. Describe la cantidad que refiere tomar con la unidad del envase, como número de tabletas o mililitros, o escribe No sé. No se está recomendando una dosis.';
  if (questionId === 'allergies_reaction' && /^(?:muy )?(?:leve|moderada|moderado|grave|severa|severo|fuerte|intensa|intenso)$/.test(n)) return 'Indicaste la intensidad, pero falta describir qué ocurrió. Escribe la reacción y su intensidad, por ejemplo: salpullido leve. Si no lo sabes, escribe No sé.';
  if(questionId==='onset_evolution' && !/\b(?:mejoro|mejorado|mejorando|empeoro|empeorado|empeorando|sigue igual|igual|sin cambios|persiste|intermitente|va y viene)\b/.test(n)) return 'Indica si mejoró, empeoró o sigue igual. Si no conoces la evolución, escribe No sé.';
  if (questionId === 'allergies_when' && !reportedTime(n)) return 'No se identifica cuándo ocurrió la última reacción. Indica una fecha o hace cuánto tiempo ocurrió, por ejemplo: ayer o hace 2 semanas. Decir cada vez expresa repetición; si no recuerdas cuándo, escribe No sé.';
  return null;
}
