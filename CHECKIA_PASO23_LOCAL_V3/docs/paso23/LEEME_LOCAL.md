# CHECKIA · Paso 23 local v3

Actualiza la prueba local con el archivo modificado y las instrucciones del 18/10/2026. No publica cambios en la web.

## Instalar

Cierra el demo anterior con Ctrl+C. Extrae CHECKIA_PASO23_LOCAL_V3.zip en Descargas, conservando backend y docs. El ZIP contiene los archivos directamente, sin una carpeta duplicada dentro.

```powershell
$ErrorActionPreference = "Stop"
Set-Location "C:\Users\cancu\Downloads\CHECKIA_PASO23_LOCAL_V3"
powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALAR_PASO_23.ps1
if ($LASTEXITCODE -ne 0) { throw "Falló la instalación" }
Set-Location "C:\Users\cancu\Documents\GitHub\checkIA"
powershell -NoProfile -ExecutionPolicy Bypass -File .\PROBAR_PASO_23.ps1
```

Abrir http://127.0.0.1:3023 y recargar con Ctrl+F5. Se requiere Node.js 22 o posterior. No agrega dependencias npm. El instalador respalda los archivos anteriores del demo en una carpeta junto al proyecto e imprime su ruta. Solo actualiza backend/paso23, docs/paso23 y PROBAR_PASO_23.ps1; no cambia frontend, backend/src, credenciales ni otros repositorios.

## Cambios visibles

- Inicio simplificado, sin estados técnicos, promedios ni preguntas para el profesional.
- Nivel 0–7: continúa; 8–9: selector; 10: alerta 911 inmediata más selector para identificar el caso.
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

Pruebas automáticas de rutas, literalidad, límites y referencias de IMC, presentación, servidor HTTP, exportación, ampliaciones, revisiones concurrentes y llamadas a RAG/LLM con proveedores simulados. Se verificó la sintaxis y las referencias a elementos de la interfaz. No se hizo una llamada real a OpenAI ni validación clínica. La visualización en navegador no pudo comprobarse en este entorno; revisar el aspecto localmente.

Datos solo en memoria: se pierden al cerrar el servidor y expiran tras dos horas de inactividad. Descargar el JSON antes de cerrar. Esta regla sigue vigente aunque el texto se haya quitado de la pantalla. Una nueva prueba es una sesión nueva.

Servidor limitado a 127.0.0.1: otras computadoras o celulares no acceden directamente. No escribe en Firestore ni despliega en Cloud Run/Firebase. Probar con casos ficticios antes de definir el tratamiento de información real de participantes.

IMC pediátrico: requiere edad precisa y sexo; en menores de dos años no clasifica sin confirmar longitud acostado. La referencia OMS 2007 termina a 228 meses, sin extrapolar. Embarazo requiere interpretación específica. El modelo no calcula ni reemplaza estos límites por promedios anuales.
