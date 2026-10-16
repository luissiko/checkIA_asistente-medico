import {normalize} from './response-quality.js';
import {parseMeasurement} from './demographics.js';
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
export function parseAge(answer) {
 const n=normalize(answer).replace(/^tengo\s+/,'').replace(/\s+anos?$/,'');
 const words=['cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciseis','diecisiete','dieciocho','diecinueve','veinte','veintiuno','veintidos','veintitres','veinticuatro','veinticinco','veintiseis','veintisiete','veintiocho','veintinueve'];
 let value=/^\d{1,2}$/.test(n)?Number(n):words.indexOf(n);
 if(n==='un'||n==='una') value=1;
 if(value<0){const tens={treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90};const m=n.match(/^(treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)(?: y (uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve))?$/);if(m)value=tens[m[1]]+(m[2]?words.indexOf(m[2]):0);}
 if(!(value>=1&&value<=99)) fail('Escribe tu edad de 1 a 99 años, con número o con palabras. Si no la sabes, escribe No sé; también puedes escribir Prefiero no responder.');
 return value;
}
export function parseDirectSex(answer) {
 const n=normalize(answer),values={m:'male',masculino:'male',hombre:'male',f:'female',femenino:'female',mujer:'female'};
 if(!values[n]) fail('En este campo registra tu sexo: M (masculino), F (femenino), No sé o Prefiero no responder. No se deduce de tu nombre ni de tu identidad de género.');
 return values[n];
}
export function parsePain(answer) {
 const n=normalize(answer).replace(/[.!]+$/,'');
 if(['poco','medio','mucho'].includes(n)) return {kind:'qualitative',value:n};
 if(['no tengo dolor','sin dolor','no me duele','nada'].includes(n)) return {kind:'numeric',value:0,scale:'0-10'};
 if(/^\d{1,2}$/.test(n)&&Number(n)<=10) return {kind:'numeric',value:Number(n),scale:'0-10'};
 fail('Responde poco, medio, mucho o un número del 1 al 10. Si no tienes dolor, escribe Sin dolor; si no sabes, No sé.');
}
export function directMeasurement(kind,answer) {
 const n=normalize(answer).replace(',','.');
 if(kind==='height'&&/^\d\.\d+$/.test(n)&&Number(n)<3) return {...parseMeasurement(kind,n+' m'),inputUnit:'m',unitWasInferred:true};
 return parseMeasurement(kind,answer);
}
