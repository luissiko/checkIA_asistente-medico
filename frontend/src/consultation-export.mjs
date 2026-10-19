import {conversationHistory} from './consultation-history.mjs';
// Resumen editorial local: conserva lo referido; no agrega inferencias clínicas.
export const cleanText=value=>String(value??'').replace(/\r/g,'').replace(/\*\*|__|`/g,'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[ \t]+/g,' ').trim();
const fieldNames={respondent:'Nombre o alias',age:'Edad',sex:'Sexo referido',weight:'Peso',height:'Estatura',reason:'Motivo de consulta',emergency_level:'Urgencia referida (1 a 10)',emergency_options:'Opción de emergencia seleccionada',onset:'Inicio y evolución',location:'Ubicación',location_description:'Descripción',severity:'Intensidad (1 a 10)',history_detail:'Antecedentes',medications_details:'Medicamentos',medications_identity:'Principios activos',allergy_timing:'Alergias',allergy_reaction:'Reacción referida',pregnancy_months:'Embarazo',infant_emergency:'Situación del bebé',pregnancy_emergency:'Situación durante el embarazo',older_emergency:'Situación de la persona mayor',disability_emergency:'Situación de la persona con discapacidad'};
export function consultationText(session){
 const state=session.clinicalState,saved=session.orientation;
 if(saved?.status!=='ready'||saved.basedOnRevision!==state.revision)throw Error('Espera a que termine de generarse la respuesta actualizada.');
 const lines=['Resumen de la consulta','CHECKIA','', 'Información proporcionada'];
 for(const f of state.facts??[]){if(!fieldNames[f.key])continue;let text=f.text;if(f.key==='emergency_options')text=state.emergency?.content?.label??text;lines.push(fieldNames[f.key]+': '+cleanText(text));}
 if(state.bmi?.display!=null)lines.push('IMC: '+state.bmi.display+' kg/m². '+cleanText(state.bmi.classification).replaceAll('_',' '));
 for(const e of state.paso23?.extraInformation??[])lines.push('Información adicional: '+cleanText(e.text));
 for(const [key,label] of [['siguiente_paso','Siguiente paso'],['resumen','Resumen del caso'],['orientacion_general','Orientación general'],['datos_por_aclarar','Datos por aclarar']]){
  const value=saved.result?.[key];if(value&&(!Array.isArray(value)||value.length))lines.push('',label,...(Array.isArray(value)?value.map(cleanText):[cleanText(value)]));
 }
 lines.push('','Orientación generada con IA. No confirma un diagnóstico ni sustituye una valoración profesional.');
 lines.push('',...conversationHistory(session));
 return lines.join('\n');
}
export async function consultationPdf(text){
 const [{PDFDocument,rgb},{default:fontkit}]=await Promise.all([import('./vendor/pdf-lib.mjs'),import('./vendor/fontkit.mjs')]);
 const fontBytes=async name=>{const url=name==='DejaVuSans.ttf'?new URL('./vendor/DejaVuSans.ttf',import.meta.url):new URL('./vendor/DejaVuSans-Bold.ttf',import.meta.url);if(url.protocol==='file:'){const {readFile}=await import(/* @vite-ignore */ 'node:fs/promises');return readFile(url);}const response=await fetch(url);if(!response.ok)throw Error('No se pudo cargar la tipografía del PDF.');return response.arrayBuffer();};
 const [regularBytes,boldBytes]=await Promise.all([fontBytes('DejaVuSans.ttf'),fontBytes('DejaVuSans-Bold.ttf')]);
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(regularBytes,{subset:true}),bold=await pdf.embedFont(boldBytes,{subset:true});
 pdf.setTitle('Resumen de la consulta');pdf.setAuthor('CHECKIA');
 const supported=new Set(font.getCharacterSet());
 const safe=s=>Array.from(s).filter(c=>supported.has(c.codePointAt(0))).join('').replace(/ +/g,' ');
 const headings=new Set(['Resumen de la consulta','Información proporcionada','Siguiente paso','Resumen del caso','Orientación general','Datos por aclarar','Historial de conversación','CHECKIA: Resultado final','CHECKIA: Resultado anterior']);
 let page,y,pages=[];const addPage=()=>{page=pdf.addPage([595.28,841.89]);pages.push(page);y=792;};addPage();
 for(const paragraph of text.split('\n')){
  if(!paragraph){y-=8;continue;}
  if(paragraph==='Historial de conversación'&&y<790)addPage();
  const heading=headings.has(paragraph),f=heading?bold:font,size=paragraph==='Resumen de la consulta'?18:heading?12:10.5,leading=heading?21:15;
  const words=safe(paragraph).split(/\s+/),lines=[];let line='';
  for(const word of words){
   if(f.widthOfTextAtSize(word,size)>495){if(line){lines.push(line);line='';}let part='';for(const c of word){if(f.widthOfTextAtSize(part+c,size)>495){lines.push(part);part='';}part+=c;}line=part;continue;}
   const next=line?line+' '+word:word;if(f.widthOfTextAtSize(next,size)>495&&line){lines.push(line);line=word;}else line=next;
  }if(line)lines.push(line);
  if((heading&&y<100)||(paragraph.startsWith('CHECKIA:')&&y<58+leading*(lines.length+2)))addPage();
  for(const l of lines){if(y<58)addPage();page.drawText(l,{x:50,y,size,font:f,color:rgb(.08,.16,.21)});y-=leading;}
 }
 pages.forEach((p,i)=>p.drawText(`${i+1} / ${pages.length}`,{x:50,y:30,size:9,font,color:rgb(.35,.4,.45)}));
 return pdf.save();
}
export function saveDownload(bytes,type,name){
 const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
