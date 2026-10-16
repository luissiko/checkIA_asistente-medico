// Enlaces aportados por el responsable del prototipo. Verificar destino y servicio.
export const hospitalLinks = Object.freeze({
  imss:'https://maps.app.goo.gl/Q59UgA3fMYwqHRzZ6',
  public:'https://maps.app.goo.gl/171E8NQWoMSDuAtF6'
});
// Pendientes: no se publican como líneas médicas hasta confirmar institución,
// vigencia y disponibilidad en una fuente oficial. 911 permanece visible.
export const pendingContacts = Object.freeze(Array.from({length:10},(_,i)=>({
  number:`+52998891${4033+i}`,display:`(998) 891 ${4033+i}`,verified:false
})));
