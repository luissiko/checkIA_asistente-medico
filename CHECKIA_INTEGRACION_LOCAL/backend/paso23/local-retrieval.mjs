import {retrievalQuery,isApplicable} from '../src/rag.js';
import {ageFor} from './bmi.mjs';
// Broaden the symptom query without embedding names or the whole medical history.
export function retrievalContextFor(context){
 const fields=(context.fields??[]).map(f=>({...f}));
 const age=fields.find(f=>f.key==='age');
 if(age){const parsed=ageFor(String(age.answer));if(parsed.months!==null&&parsed.months>=0)age.answer=String(Math.floor(parsed.months/12));}
 for(const f of context.fields??[])if(f.key==='location_description')fields.push({...f,key:'associated',label:'Descripción y síntomas acompañantes'});
 return{...context,fields};
}
export async function retrieveForPaso23(retriever,context){
 const queryContext=retrievalContextFor(context),base=await retriever.retrieve(queryContext);
 if(!retriever.corpus||!Array.isArray(retriever.chunks))return base;
 const {topics}=retrievalQuery(queryContext,retriever.corpus);
 if(!topics.length)return base;
 const main=topics[0],candidates=retriever.chunks.filter(c=>topics.includes(c.topic)&&isApplicable(c,queryContext));
 const selected=[];
 const add=c=>{if(c&&!selected.some(s=>s.id===c.id)&&selected.length<3)selected.push(c);};
 // Editorial warning/history paragraphs should not be crowded out by diary/preparation paragraphs.
 add(candidates.find(c=>c.topic===main&&c.kind==='warning'));
 const hasHistory=(context.fields??[]).some(f=>['cancer_diabetes','hereditary','degenerative','drugs'].includes(f.key)&&String(f.answer).normalize('NFD').replace(/\p{M}/gu,'').trim().toLowerCase()==='si');
 if(hasHistory)add(candidates.find(c=>c.topic===main&&c.kind==='history'));
 add(candidates.find(c=>c.topic!==main&&['warning','symptoms','context'].includes(c.kind)));
 for(const c of base.retrieved??[])add(c);
 for(const c of candidates.filter(c=>c.topic===main))add(c);
 return{...base,status:selected.length?'matched':'insufficient_evidence',retrieved:selected,selectionMethod:'semantic_plus_topic_warning_history',selectionNote:'Cobertura editorial por tema, no puntuación clínica de riesgo.'};
}
