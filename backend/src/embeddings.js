const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export const EMBEDDING_MODEL='text-embedding-3-small';
export const DIMENSIONS=512;
export function validVector(v,dimensions=DIMENSIONS){return Array.isArray(v)&&v.length===dimensions&&v.every(x=>typeof x==='number'&&Number.isFinite(x))&&v.some(x=>x!==0);}
export function createEmbeddingClient({apiKey=process.env.OPENAI_API_KEY,enabled=true,fetchImpl=globalThis.fetch,timeoutMs=20000}={}){
 const configured=Boolean(enabled&&apiKey?.trim());
 return {configured,model:EMBEDDING_MODEL,dimensions:DIMENSIONS,async embed(input){
  if(!configured)fail(503,'La búsqueda de información no está disponible en este momento.');
  if(!Array.isArray(input)||!input.length||input.length>32||input.some(t=>typeof t!=='string'||!t.trim()||t.length>4000))fail(400,'No se pudo preparar la búsqueda.');
  let response;try{response=await fetchImpl('https://api.openai.com/v1/embeddings',{method:'POST',headers:{Authorization:`Bearer ${apiKey.trim()}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(timeoutMs),body:JSON.stringify({model:EMBEDDING_MODEL,dimensions:DIMENSIONS,encoding_format:'float',input})});}catch{fail(504,'La búsqueda de información tardó demasiado. Intenta nuevamente.');}
  if(!response.ok)fail(response.status===429?429:502,'No se pudo consultar la información de apoyo. Intenta más tarde.');
  let data;try{data=await response.json();}catch{fail(502,'No se recibió una búsqueda válida.');}
  if(data.model!==EMBEDDING_MODEL||!Array.isArray(data.data)||data.data.length!==input.length)fail(502,'No se recibió una búsqueda válida.');
  const rows=[...data.data].sort((a,b)=>a.index-b.index);
  if(rows.some((row,i)=>row.index!==i||!validVector(row.embedding)))fail(502,'No se recibió una búsqueda válida.');
  return {vectors:rows.map(row=>row.embedding),usage:{inputTokens:Number(data.usage?.total_tokens)||0}};
 }};
}
