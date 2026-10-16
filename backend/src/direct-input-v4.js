import {normalize} from './response-quality.js';
import {parseMeasurement} from './demographics.js';
export {parseAge,parseDirectSex,parsePain} from './direct-input.js';
export function directMeasurement(kind,answer) {
 const n=normalize(answer).replace(',','.');
 if(!/^\d+(?:\.\d+)?$/.test(n)) throw Object.assign(new Error(kind==='height'?'Escribe solo un número en centímetros, por ejemplo 175.':'Escribe solo un número en kilogramos, por ejemplo 70.'),{status:400});
 if(kind==='height'&&Number(n)<10) throw Object.assign(new Error('Escribe tu altura en centímetros, por ejemplo 175; no en metros.'),{status:400});
 return parseMeasurement(kind,n);
}
