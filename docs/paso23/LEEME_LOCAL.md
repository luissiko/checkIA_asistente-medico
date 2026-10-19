# CHECKIA · Paso 23 local v6

Versión 6: se corrigió EADULTO a ADULTO en A y aa1; H muestra NINGUNA DE ESTA,SEGUIR EL FORMULARIO y continúa a pregunta 3. G conserva alergia. Este paquete sigue siendo el demo separado; no integra ni reemplaza la interfaz React actual del usuario.

Cambios v5 solicitados el 18/10/2026: pregunta 2.1 del 1 al 10, con 1–8 → pregunta 3 y 9–10 → 2.1.1. El nivel 0 se conserva como respuesta libre pero no decide una ruta, solicitando un número válido. El título 2.1.1 aparece en mayúsculas con 🔵. Se añade H. 🔵NINGUNA DE ESTA,SEGUIR EL FORMULARIO y se conserva G como alergia. En el resultado, después de las cuatro secciones, se muestra en rojo la invitación y los cuatro enlaces solicitados, usando «HOSPITALES PUBLICOS DE QUINTAN ROO» para el enlace final. No se consulta disponibilidad hospitalaria en tiempo real.

Actualiza la prueba local con el archivo modificado y las instrucciones del 18/10/2026. No publica cambios en la web.

## Instalar

Cierra el demo anterior con Ctrl+C. Extrae CHECKIA_PASO23_LOCAL_V6.zip en Descargas, conservando backend y docs. El ZIP contiene los archivos directamente, sin una carpeta duplicada dentro.

```powershell
$ErrorActionPreference = "Stop"
Set-Location "C:\Users\cancu\Downloads\CHECKIA_PASO23_LOCAL_V6"
powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALAR_PASO_23.ps1
if ($LASTEXITCODE -ne 0) { throw "Falló la instalación" }
Set-Location "C:\Users\cancu\Documents\GitHub\checkIA"
powershell -NoProfile -ExecutionPolicy Bypass -File .\PROBAR_PASO_23.ps1
```

Abrir http://127.0.0.1:3023 y recargar con Ctrl+F5. Se requiere Node.js 22 o posterior. No agrega dependencias npm. El instalador respalda los archivos anteriores del demo en una carpeta junto al proyecto e imprime su ruta. Solo actualiza backend/paso23, docs/paso23 y PROBAR_PASO_23.ps1; no cambia frontend, backend/src, credenciales ni otros repositorios.

## Análisis ampliado de la versión 4

El modo normal ya no utiliza el prompt breve del módulo general. El adaptador local solicita integración del episodio actual, recurrencia, síntomas acompañantes, antecedentes y consumos referidos, contradicciones, evidencia y un siguiente paso concreto. Orientación objetivo de 350–550 palabras en casos complejos cuando los datos y las fuentes lo permiten, sin completar espacio con especulaciones.

Se cambia reasoning.effort de low a medium y se conserva el límite de salida existente de 6000 tokens, que también puede incluir razonamiento del proveedor. El esfuerzo medio puede aumentar latencia y consumo; no es una garantía de precisión clínica. Los errores del proveedor se muestran sin fingir un resultado nuevo. La evaluación clínica del cambio queda pendiente.

La búsqueda incorpora el campo location_description como síntomas acompañantes. Normaliza la edad solo para aplicar los límites de las fuentes, conservando el texto original para la orientación. La selección de hasta tres fragmentos incluye señales de alarma y antecedentes de los temas detectados, evitando que todos sean sobre preparar un diario de síntomas. El método queda registrado como semantic_plus_topic_warning_history; no es una puntuación clínica.

Se conservan el corpus y su índice: no hace falta reconstruir embeddings para este cambio. No se han añadido nuevas enfermedades ni fuentes; si la biblioteca no cubre cocaína, un antecedente u otro tema, el modelo debe señalar esa falta concreta sin inventar información médica. El módulo general backend/src no se modifica.

Siguiente paso aparece antes de Resumen. Los botones Nueva prueba, Descargar respuestas JSON y Recargar consulta pasan al final de la vista. Las preguntas y rutas existentes se conservan.

## Cambios visibles

- Inicio simplificado, sin estados técnicos, promedios ni preguntas para el profesional.
- Nivel 1–8: continúa a pregunta 3; 9–10: selector de emergencia con alerta 911.
- Selector B–G en mayúsculas, título y pregunta separados, indicaciones en azul intenso y sin botón No debajo de G.
- IMC inmediato después de responder sí a la pregunta 7, con Continuar antes de la pregunta 8.
- Nuevas redacciones, listas de diez opciones incluyendo NINGUNA, y nombre de instituciones públicas solicitado.
- Indicador «Se esta generando la respuesta espere por favor» mientras se solicita la evaluación.
- Botón «Añadir mas información extra»: guarda lo nuevo sin borrar las respuestas iniciales, consulta de nuevo la biblioteca y genera una nueva respuesta con el contexto combinado.
- Aviso final de versión de prueba con el identificador real del modelo, sin «Fuente recuperada» en la pantalla. Las fuentes utilizadas siguen registradas en el JSON.

Consultar ACLARACIONES_APLICADAS.md para reglas y límites exactos. El documento adjunto se conserva íntegro en ORIGINAL_USUARIO.md.

## RAG y OpenAI

Reutiliza backend/.env y los módulos existentes. No se necesitan claves en el navegador. Comenzar autoriza el envío de esa prueba; abrir la página por sí solo no genera llamadas al proveedor. Si el proveedor no está configurado o el corpus no está listo, el formulario y las indicaciones locales funcionan y el botón de generar muestra el error correspondiente.

El módulo local-client.mjs adapta el prompt solo para casos con alerta. El RAG conserva su filtro de fuentes y utiliza el motivo, ubicación, alergias, alarma seleccionada y ampliaciones para recuperar fragmentos. Toda la entrevista se entrega después al modelo. Una biblioteca sin evidencia pertinente no se convierte en una fuente médica completa; se indica la limitación.

La reevaluación incrementa una revisión y conserva el resultado anterior en el historial. Nunca muestra como nuevo un resultado en curso si el usuario ya añadió datos. Límite de doce intentos de generación y diez ampliaciones por consulta. El contexto no se trunca en silencio; las solicitudes que superan límites muestran un error.

## Verificación y límites

```powershell
node --test .\backend\paso23\paso23.test.mjs
```

23 pruebas automáticas de rutas, literalidad, límites y referencias de IMC, presentación, servidor HTTP, exportación, ampliaciones, revisiones concurrentes y llamadas a RAG/LLM con proveedores simulados. Se verificó la sintaxis y las referencias a elementos de la interfaz. No se hizo una llamada real a OpenAI ni validación clínica. La visualización en navegador no pudo comprobarse en este entorno; revisar el aspecto localmente.

Datos solo en memoria: se pierden al cerrar el servidor y expiran tras dos horas de inactividad. Descargar el JSON antes de cerrar. Esta regla sigue vigente aunque el texto se haya quitado de la pantalla. Una nueva prueba es una sesión nueva.

Servidor limitado a 127.0.0.1: otras computadoras o celulares no acceden directamente. No escribe en Firestore ni despliega en Cloud Run/Firebase. Probar con casos ficticios antes de definir el tratamiento de información real de participantes.

IMC pediátrico: requiere edad precisa y sexo; en menores de dos años no clasifica sin confirmar longitud acostado. La referencia OMS 2007 termina a 228 meses, sin extrapolar. Embarazo requiere interpretación específica. El modelo no calcula ni reemplaza estos límites por promedios anuales.
