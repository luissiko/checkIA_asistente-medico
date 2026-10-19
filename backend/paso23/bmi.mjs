import {readFileSync} from 'node:fs';
const DATA=JSON.parse(readFileSync(new URL('./who-bmi-reference.json',import.meta.url),'utf8'));
export const normal=x=>x.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
export function numeric(text,units='') {
 const m=normal(text).replace(',','.').match(new RegExp('^(\\d+(?:\\.\\d+)?)\\s*(?:'+units+')?$'));
 return m?Number(m[1]):null;
}
export function ageFor(text){
 const t=normal(text);let m;
 if((m=t.match(/^(\d+)\s*anos?\s*(?:y\s*)?(\d+)\s*mes(?:es)?$/)))return{months:Number(m[1])*12+Number(m[2]),precise:true,unit:'months'};
 if((m=t.match(/^(\d+(?:[.,]\d+)?)\s*mes(?:es)?$/)))return{months:Number(m[1].replace(',','.')),precise:true,unit:'months'};
 if((m=t.match(/^(\d+)\s*dias?$/)))return{months:Number(m[1])/30.4375,days:Number(m[1]),precise:true,unit:'days'};
 const years=numeric(t,'anos?');return{months:years===null?null:years*12,precise:false,unit:'years'};
}
const measurement=(text)=>{
 const t=normal(text);let n=numeric(t,'kg|kilos?|kilogramos?|g|gramos?|lb|libras?');
 if(n!==null && /(?:g|gramos?)$/.test(t) && !/(?:kg|kilogramos?)$/.test(t))n/=1000;
 if(n!==null && /(?:lb|libras?)$/.test(t))n*=0.45359237;
 return n;
};
const cutoff=([l,m,s],z)=>l===0?m*Math.exp(s*z):m*(1+l*s*z)**(1/l);
export function calculateBmi(answers){
 const a=id=>answers.find(a=>a.key===id)?.text??'';
 const age=ageFor(a('age')),weight=measurement(a('weight')),rawHeight=a('height');
 let height=numeric(rawHeight,'cm|centimetros?|m|metros?');
 const explicitM=/(?:^|\d)\s*(?:m|metros?)$/.test(normal(rawHeight)),explicitCm=/(?:cm|centimetros?)$/.test(normal(rawHeight));
 if(height!==null && (explicitM||(!explicitCm&&height<=3)))height*=100;
 const out={weightKg:weight,heightCm:height,ageYears:age.months===null?null:age.months/12,ageMonths:age.months,bmi:null,classification:'no_evaluable',reference:null};
 if(!(weight>0)||!(height>0))return out;
 const bmi=weight/((height/100)**2);if(!Number.isFinite(bmi))return out;
 Object.assign(out,{bmi,display:Number(bmi.toFixed(2)),heightInterpretation:explicitM||explicitCm?'unidad_declarada':'unidad_inferida_confirmar'});
 if(normal(a('pregnant'))==='si')return{...out,classification:'requiere_interpretacion_por_embarazo'};
 if(out.ageYears!==null&&out.ageYears>=20&&out.ageYears<=80)return{...out,reference:'OMS_adulto_general',classification:bmi<18.5?'bajo_peso':bmi<25?'rango_normal':bmi<30?'sobrepeso':bmi<35?'obesidad_grado_I':bmi<40?'obesidad_grado_II':'obesidad_grado_III'};
 const sex=/^(h|hombre|masculino)$/.test(normal(a('sex')))?'1':/^(m|mujer|femenino|femenina)$/.test(normal(a('sex')))?'2':null;
 if(age.months===null||age.months<0||age.months>228)return{...out,classification:'requiere_referencia_especifica',note:'La referencia pediátrica llega a 228 meses; perfil de adulto de esta prueba desde 20 años. No se extrapola.'};
 if(!age.precise||!sex)return{...out,classification:'requiere_edad_exacta_y_sexo',note:'Para interpretar el IMC infantil indica edad en meses, días, o años y meses; no se utilizan promedios anuales.'};
 const younger=age.months<=60;
 // For infants the document does not establish how length was measured. Do not guess posture.
 if(age.months<24)return{...out,classification:'requiere_confirmar_longitud_acostado',reference:'OMS_2006',note:'IMC numérico provisional. Confirmar longitud acostado y valoración de crecimiento antes de clasificar.'};
 const index=younger?Math.round(age.days??age.months*30.4375):Math.floor(age.months);
 const lms=(younger?DATA.daily:DATA.monthly)[sex][index];
 if(!lms)return{...out,classification:'referencia_no_disponible'};
 const bounds=Object.fromEntries([-3,-2,1,2,3].map(z=>[String(z),cutoff(lms,z)]));
 const classification=bmi<bounds['-3']?'delgadez_severa':bmi<bounds['-2']?'delgadez':younger?(bmi>bounds['3']?'obesidad':bmi>bounds['2']?'sobrepeso':bmi>bounds['1']?'posible_riesgo_de_sobrepeso':'rango_de_referencia'):(bmi>bounds['2']?'obesidad':bmi>bounds['1']?'sobrepeso':'rango_de_referencia');
 return{...out,classification,reference:younger?'OMS_2006':'OMS_2007',referenceSex:sex==='1'?'hombre':'mujer',referenceAge:index,referenceAgeUnit:younger?'days':'months',cutoffs:bounds,note:'Clasificación de cribado del IMC para la edad; no es un diagnóstico. Talla de pie desde 2 años.'};
}
