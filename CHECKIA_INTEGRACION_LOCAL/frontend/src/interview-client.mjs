export const WELCOME='0. ¡Hola, qué tal! Seré tu asistente virtual de diagnóstico médico. Por favor, responde las siguientes preguntas que se te realizarán.';
export function createdInterview(data,expectedProtocol) {
 const session=data?.session,state=session?.clinicalState;
 if(!session?.id||state?.protocolId!==expectedProtocol||state?.phase!=='collecting'||state?.pendingQuestions?.[0]?.id!==(expectedProtocol?.startsWith('paso23-local-')?'respondent':'name')) {
  throw new Error('No se pudo iniciar la entrevista. Actualiza la página e inténtalo nuevamente.');
 }
 return session;
}
export function friendlyApiError(status,message,operation='') {
 if(status===401||status===403)return 'Tu acceso no está disponible. Inicia sesión nuevamente.';
 if(status===410)return 'Esta consulta venció. Puedes crear una nueva.';
 if(status>=500){
  // Only explicitly approved public messages can cross this boundary.
  // Never display arbitrary provider errors, stack traces, paths or credentials.
  const publicMessages=new Set([
   'La orientación no está disponible en este momento. Puedes seguir consultando tu resumen.',
   'La orientación tardó demasiado o no se pudo conectar. Intenta nuevamente en unos momentos.',
   'No se pudo generar la orientación. Intenta más tarde.',
   'No se pudo completar la orientación con estos datos. Tu resumen sigue disponible.',
   'No se recibió una orientación válida.',
   'No se recibió una orientación válida. Puedes intentarlo nuevamente.',
   'No se recibieron fuentes válidas.',
   'No se recibieron aclaraciones válidas.',
   'La orientación contiene un enlace que no pudo comprobarse.',
   'No se pudo comprobar la fuente de la orientación. Tu resumen sigue disponible.',
   'La base de información necesita preparación o revisión. Tu entrevista y resumen siguen disponibles.',
   'La búsqueda de información no está disponible en este momento.',
   'La búsqueda de información tardó demasiado. Intenta nuevamente.',
   'No se pudo consultar la información de apoyo. Intenta más tarde.',
   'No se recibió una búsqueda válida.'
  ]);
  if(publicMessages.has(message))return message;
  if(operation==='orientation')return status===504?'La orientación tardó demasiado. Tus respuestas siguen guardadas. Intenta nuevamente en unos momentos.':status===503?'El servicio de orientación no está disponible en este momento. Tu resumen sigue guardado.':status===502?'No se recibió una orientación válida del servicio. Tu resumen sigue guardado.':'No se pudo generar la orientación. Tu resumen sigue guardado. Intenta nuevamente en unos momentos.';
  return 'No se pudo completar la operación. Intenta nuevamente en unos momentos.';
 }
 if(typeof message==='string'&&message.trim()&&!/backend|frontend|firestore|\bAPI\b|\bUID\b|\.jsx?\b|protocolo|\bsrc\b/i.test(message))return message;
 return 'No se pudo completar la operación. Actualiza la consulta e inténtalo nuevamente.';
}
