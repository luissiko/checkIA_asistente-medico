export const eligible=s=>Boolean(s.phase==='emergency'&&s.alert?.requiresRag||s.phase==='complete'&&s.answers.find(a=>a.key==='answers_confirmation')?.text.normalize('NFD').replace(/\p{M}/gu,'').trim().toLowerCase()==='si');
export const emergencyChoices=content=>content.emergencyOptions.map(o=>({value:o.value,label:o.label,question:o.question}));
const titles={resumen:'Resumen',datos_por_aclarar:'Datos por aclarar',orientacion_general:'Orientación general',siguiente_paso:'Siguiente paso'};
export const resultSections=result=>Object.entries(result).filter(([key,value])=>Object.hasOwn(titles,key)&&value&&(!Array.isArray(value)||value.length)).map(([key,value])=>({key,title:titles[key],text:Array.isArray(value)?value.join('\n'):value}));
export const resultNotice=model=>'La respuesta fue generada por una biblioteca de corpus medico pequeña y el modelo de '+model+', es una versión de prueba, no es una evaluación profesional, consulte a un medico profesional';
export function bmiText(bmi){
 if(bmi?.bmi===null||bmi?.bmi===undefined)return 'No se puede calcular el IMC con las mediciones proporcionadas. Revisa el peso y la altura en tus respuestas.';
 return 'Tu IMC es '+bmi.display+' kg/m². '+bmi.classification.replaceAll('_',' ')+'.\nIMC = '+Number(bmi.weightKg.toFixed(3))+' kg / (('+bmi.heightCm+' cm / 100)²) = '+bmi.display+' kg/m².'+(bmi.note?'\n'+bmi.note:'');
}
