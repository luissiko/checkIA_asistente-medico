# Etapa 1: decisiones y validación

Se crea CHECKIA separado de BuscaQroo. Se conserva Node/Express como tecnología, sin copiar credenciales, institución documental ni destino de despliegue.

Separación: `app.js` define rutas y validaciones; `store.js` gestiona sesiones; `server.js` configura escucha local; tests verifican comportamiento observable.

Almacenamiento en memoria facilita probar el contrato antes de configurar Firebase. No es persistencia productiva. El token aleatorio es una capacidad de acceso temporal para pruebas; autenticación y roles se implementarán posteriormente.

Datos clínicos: estado vacío con versión de esquema, hechos, preguntas pendientes y evaluación nula. Ningún modelo interpreta mensajes en esta etapa.

Pruebas ejecutadas: 3 suites de prueba aprobadas; aislamiento entre sesiones, acceso sin token, conservación de mensajes, ausencia de hash en respuesta, cierre, eliminación, validación de entrada, expiración y límite de sesiones.

No probado: PowerShell en Windows, instalación limpia de npm en el equipo del usuario, Firebase, despliegue, LLM, RAG ni validez clínica. Las pruebas Node se ejecutaron en el entorno Linux utilizando las dependencias locales del ZIP proporcionado.

Pendientes antes de acceso público: Firebase Authentication, autorización y reglas, persistencia, límites de solicitudes, retención y borrado, tratamiento de errores, observabilidad sin contenido clínico y revisión del flujo.
