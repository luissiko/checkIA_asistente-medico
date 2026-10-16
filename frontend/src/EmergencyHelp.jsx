import React,{useState} from 'react';
import {hospitalLinks} from './emergency-config.js';
export function EmergencyHelp() {
  const [city,setCity]=useState(''),[insurance,setInsurance]=useState('');
  return <section className="emergency-help" aria-label="Ayuda de emergencia">
    <h3>Necesitas atención médica inmediata si esta situación es real</h3>
    <a className="emergency-call" href="tel:911">Llamar al 911 en México</a>
    <label htmlFor="emergency-city">Hospitales de emergencia</label>
    <select id="emergency-city" value={city} onChange={e=>{setCity(e.target.value);setInsurance('');}}>
      <option value="">Selecciona una opción</option><option value="yes">Cancún</option><option value="no">Otra localidad</option>
    </select>
    {city==='no' && <p>Estas ubicaciones corresponden al directorio de prueba de Cancún. Solicita ayuda al servicio de emergencias de tu localidad.</p>}
    {city==='yes' && <>
      <label htmlFor="emergency-insurance">¿Tiene seguridad social?</label>
      <select id="emergency-insurance" value={insurance} onChange={e=>setInsurance(e.target.value)}>
        <option value="">Selecciona una opción</option><option value="imss">Sí, IMSS</option><option value="public">No</option><option value="other">Otro seguro o No sé</option>
      </select>
      {insurance==='imss' && <a className="hospital-link" href={hospitalLinks.imss} target="_blank" rel="noopener noreferrer">Abrir ubicación IMSS · Urgencias en Google Maps</a>}
      {['public','other'].includes(insurance) && <a className="hospital-link" href={hospitalLinks.public} target="_blank" rel="noopener noreferrer">Abrir ubicación del hospital general público en Google Maps</a>}
      {insurance && <p>Enlace aportado para el prototipo; comprueba el destino en Maps. No se ha confirmado disponibilidad, cobertura ni tiempo de atención. Si el traslado no es seguro, pide ayuda al 911; no conduzcas tú.</p>}
    </>}
  </section>;
}
