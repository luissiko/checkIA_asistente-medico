const states={unknown:'Desconocido',declined:'Prefirió no responder',not_collected:'Sin responder',not_applicable:'No aplica',none_reported:'Ninguno referido'};
const title=s=>String(s||'Dato').replace(/ aproximad[oa]$/gi,'').replace(/ referidos?\b| referidas?\b/gi,'');
function datum(f){return {dato:title(f.label||f.question||f.key),respuesta:f.text??'Sin responder',...(states[f.status]?{estado:states[f.status]}:{}),...(f.measurement?{medida_registrada:f.measurement.value+' '+f.measurement.unit}:{}),...(f.provisional?{pendiente_de_confirmar:true}:{}),...((f.details||[]).length?{aclaraciones:f.details.map(datum)}:{})};}
export function simpleExport(s){
 const groups=s.summary?.groups||[],o=s.orientation,r=o?.result;
 return {formato:'checkia-resumen-v1',nota:'Resumen de datos referidos, sin confirmación clínica. El registro original permanece guardado.',estado:s.status==='closed'?'Cerrada':'Abierta',
 secciones:groups.map(g=>({titulo:g.id==='basic'?'Datos básicos':'Motivo, síntomas y antecedentes',datos:(g.fields||[]).filter(f=>!f.autoSkipped&&f.key!=='answers_confirmation').map(datum)})),
 por_revisar:(s.summary?.warnings||[]).map(w=>w.text),preguntas_pendientes:(s.summary?.pendingQuestions||[]).map(q=>q.text),
 señales:{respuesta:s.summary?.safety?.screenText??'Sin respuesta',alerta:s.summary?.safety?.alertText??null,nota:'La respuesta registrada no descarta una emergencia.'},
 orientacion:r?{vigencia:o.status==='ready'&&o.basedOnRevision===(s.clinicalState?.revision||0)?'Corresponde a la revisión actual':'Revisión anterior o resultado no vigente',general:r.orientacion_general??'',siguiente_paso:r.siguiente_paso??'',preguntas:r.preguntas_para_profesional||[],datos_por_aclarar:r.datos_por_aclarar||[]}:null,
 fuentes:[...new Map((o?.rag?.sources||[]).map(f=>[JSON.stringify([f.title,f.url]),{titulo:f.title,enlace:f.url}])).values()]};
}
export function simpleText(s){
 const d=simpleExport(s),lines=['CHECKIA — RESUMEN DE CONSULTA',d.nota,'Estado: '+d.estado];
 function add(f,indent=''){lines.push(indent+f.dato+': '+f.respuesta+(f.estado?' ('+f.estado+')':'')+(f.medida_registrada?' · Medida registrada: '+f.medida_registrada:'')+(f.pendiente_de_confirmar?' · Pendiente de confirmar':''));for(const a of f.aclaraciones||[])add(a,indent+'  ');}
 for(const section of d.secciones){if(!section.datos.length)continue;lines.push('',section.titulo.toUpperCase());section.datos.forEach(f=>add(f));}
 if(d.por_revisar.length||d.preguntas_pendientes.length)lines.push('','POR REVISAR',...d.por_revisar,...d.preguntas_pendientes);
 lines.push('','SEÑALES REGISTRADAS',d.señales.respuesta,d.señales.nota);if(d.señales.alerta)lines.push(d.señales.alerta);
 lines.push('','ORIENTACIÓN GUARDADA');if(!d.orientacion)lines.push('Sin orientación guardada.');else{const o=d.orientacion;lines.push(o.vigencia,'Orientación general: '+o.general,'Siguiente paso: '+o.siguiente_paso);if(o.datos_por_aclarar.length)lines.push('Datos por aclarar:',...o.datos_por_aclarar.map(t=>'- '+t));if(o.preguntas.length)lines.push('Preguntas para tu consulta:',...o.preguntas.map(t=>'- '+t));}
 if(d.fuentes.length)lines.push('','FUENTES',...d.fuentes.map(f=>f.titulo+' — '+f.enlace));
 return lines.join('\n');
}
