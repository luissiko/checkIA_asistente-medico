import React,{useState} from 'react';
import {consultationText,consultationPdf,saveDownload} from './consultation-export.mjs';
export function ConsultationDownloads({session}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function download(pdf){if(busy)return;setBusy(true);setError('');try{const text=consultationText(session);if(pdf)saveDownload(await consultationPdf(text),'application/pdf','Resumen_de_la_consulta.pdf');else saveDownload(text,'text/plain;charset=utf-8','Resumen_de_la_consulta.txt');}catch(e){setError(e.message||'No se pudo descargar. Inténtalo de nuevo.');}finally{setBusy(false);}}
 return <><div className="consultation-downloads" aria-label="Descargar información de la consulta"><button type="button" className="download-pdf" disabled={busy} onClick={()=>download(true)}>Descargar información de la consulta · PDF</button><button type="button" className="download-txt" disabled={busy} onClick={()=>download(false)}>Descargar información de la consulta · TXT</button></div>{error&&<p role="alert">{error}</p>}</>;
}
