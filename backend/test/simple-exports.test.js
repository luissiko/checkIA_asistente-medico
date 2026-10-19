import assert from 'node:assert/strict';
import {simpleExport,simpleText} from '../src/simple-exports.js';
import test from 'node:test';
test('exportaciones breves conservan los datos y evitan duplicar el historial',()=>{
const s={status:'closed',summary:{groups:[{id:'basic',fields:[{key:'height',label:'Estatura',text:'56 cm',status:'reported',details:[{label:'Confirmación',text:'No sé',status:'unknown'}]}]}],warnings:[{text:'Dato pendiente de revisar'}],safety:{screenText:'No'}},messages:[{text:'HISTORIAL NO REPETIR'}]};
const original=JSON.stringify(s),j=simpleExport(s),t=simpleText(s);assert.equal(JSON.stringify(s),original);assert.equal(j.secciones[0].datos[0].respuesta,'56 cm');assert.equal(j.secciones[0].datos[0].aclaraciones[0].estado,'Desconocido');assert.match(t,/56 cm/);assert.doesNotMatch(t,/156|HISTORIAL NO REPETIR/);assert.equal(j.orientacion,null);assert.ok(simpleText({}).length);});
