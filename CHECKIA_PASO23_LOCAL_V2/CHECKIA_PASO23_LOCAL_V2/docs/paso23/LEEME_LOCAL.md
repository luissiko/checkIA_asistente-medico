# CHECKIA · Paso 23 local v2

Actualización del formulario con el documento corregido y las aclaraciones del 18/10/2026. No sustituye la entrevista publicada.

## Instalar en Windows

1. Cierra el servidor del demo anterior con Ctrl+C.
2. Extrae CHECKIA_PASO23_LOCAL_V2.zip en Descargas, conservando sus carpetas.
3. En PowerShell ejecuta:

```powershell
$ErrorActionPreference = "Stop"
Set-Location "C:\Users\cancu\Downloads\CHECKIA_PASO23_LOCAL_V2"
powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALAR_PASO_23.ps1 -Proyecto "C:\Users\cancu\Documents\GitHub\checkIA"
if ($LASTEXITCODE -ne 0) { throw "No se pudo instalar el demo" }
Set-Location "C:\Users\cancu\Documents\GitHub\checkIA"
powershell -NoProfile -ExecutionPolicy Bypass -File .\PROBAR_PASO_23.ps1
```

Abrir http://127.0.0.1:3023. Requiere Node.js 22 o posterior. No agrega dependencias npm. El instalador respalda los archivos del demo que vaya a reemplazar en una carpeta junto al proyecto e imprime su ruta. No copia ni modifica backend/src, frontend, Firebase, configuración de credenciales ni otros repositorios.

## Qué cambió

- Texto de preguntas extraído literalmente del documento, con las correcciones expresas del usuario. Los emojis y marcas de formato del documento no forman parte de las preguntas. Las instrucciones técnicas no se muestran como preguntas.
- Se ignoran las instrucciones tachadas, incluidos los umbrales de emergencia de la versión anterior.
- 35 preguntas principales con subpreguntas condicionales y selecciones de nueve enfermedades. 90 nodos internos posibles, no 90 preguntas para todas las personas.
- IMC opcional en pregunta 7; resultado inmediato, clasificación por código y referencias específicas de edad/sexo cuando hay datos suficientes. Véanse los límites en ACLARACIONES_APLICADAS.md.
- Historial de consumo separado entre actual y pasado, sin cambiar la numeración repetida visible del autor.
- Cierre, resumen, exportación JSON y corrección de respuestas, con invalidación de orientaciones anteriores.

## RAG y OpenAI

El servidor reutiliza los módulos existentes de CHECKIA y carga backend/.env si está disponible. El formulario no necesita una clave para funcionar. No copies claves en el navegador ni en el documento.

Con consentimiento de envío, proveedor configurado y corpus preparado, genera orientación al terminar y confirmar, o al completar una de las cuatro ramas especiales de emergencia. Las opciones b–g muestran inmediatamente los textos del documento, sin depender de OpenAI. El nombre no se envía al modelo. Los números seleccionados de enfermedades se acompañan de sus etiquetas en el contexto.

La recuperación conserva el alcance del módulo RAG existente: busca por motivo, ubicación y alergias; la entrevista completa se aporta después al LLM. No se ha añadido una búsqueda clínica universal ni entrenamiento de un modelo nuevo.

## Pruebas y límites

```powershell
node --test .\backend\paso23\paso23.test.mjs
```

Pruebas de rutas, texto fuente, condiciones, límites del IMC, referencias pediátricas, servidor HTTP, exportación/corrección y conexión RAG/LLM con proveedores simulados. No se realizó una llamada real de OpenAI ni validación clínica o pruebas con personas. La comprobación del frontend fue de sintaxis; no se verificó visualmente en un navegador.

Las respuestas están en memoria: se pierden al cerrar el servidor y expiran tras dos horas. Cada participante debe iniciar una nueva prueba. Descargar su JSON antes de cerrar. Los promedios son de uso (cantidad de preguntas y duración), no exactitud diagnóstica. No se publica en internet ni se escribe en Firestore. Usar casos ficticios hasta definir el tratamiento de datos personales y sensibles de participantes.

El acceso queda limitado a la misma computadora (127.0.0.1); no se abre al celular ni a otras personas en la red. El directorio original se conserva íntegro y las decisiones están documentadas por separado. Las ubicaciones de hospitales se mantienen como fueron proporcionadas; no verifican capacidad o disponibilidad en tiempo real. El único enlace telefónico es 911; no se habilita 085.
