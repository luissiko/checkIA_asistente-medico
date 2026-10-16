// Validación de unidades, sin interpretación clínica ni cálculo de IMC.
function fail(message) { throw Object.assign(new Error(message), {status:400}); }
export function parseMeasurement(kind, answer) {
  const n=answer.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(',', '.');
  if (kind === 'weight') {
    const match=n.match(/^(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilogramos?)?$/);
    if (!match || !(Number(match[1])>0 && Number(match[1])<=1000)) fail('Escribe el peso aproximado en kg, por ejemplo 70 o 70,5 kg, No sé o Prefiero no responder.');
    return {value:Number(match[1]),unit:'kg',approximate:true};
  }
  const match=n.match(/^(\d+(?:\.\d+)?)\s*(cm|centimetros?|m|metros?)?$/);
  if (!match) fail('Escribe la altura aproximada en cm (175) o indica metros (1,75 m), No sé o Prefiero no responder.');
  const value=Number(match[1]),meters=/^(?:m|metros?)$/.test(match[2] || ''),cm=meters ? Math.round(value*10000)/100 : value;
  if (!(cm>0 && cm<=300) || (!match[2] && value<10)) fail('Indica la unidad: 175 cm o 1,75 m. Si no conoces la altura, escribe No sé.');
  return {value:cm,unit:'cm',approximate:true};
}
export function parseSex(answer) {
  const n=answer.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  const options={h:'male',m:'female',x:'other','no binario':'other','no binaria':'other',femenino:'female',mujer:'female',masculino:'male',hombre:'male',intersexual:'intersex',otro:'other'};
  if (!options[n]) fail('Escribe H (hombre), M (mujer), X (otra identidad), No sé o Prefiero no responder. Se registra tu respuesta sin inferir anatomía.');
  return options[n];
}
