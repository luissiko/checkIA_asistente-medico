# CHECKIA · Preguntas Paso 23 en la aplicación React existente

Basado en CHECKIA_CODIGO_ACTUAL_20261018-145744.zip. No contiene credenciales ni configuración Firebase.

## Instalar y probar

Cierra con Ctrl+C el backend anterior del puerto 3001 y el frontend anterior del 5173. Extrae CHECKIA_INTEGRACION_LOCAL.zip en Descargas, conservando las carpetas del paquete. No lo extraigas encima de todo el proyecto.

```powershell
$ErrorActionPreference = "Stop"
Set-Location "C:\Users\cancu\Downloads\CHECKIA_INTEGRACION_LOCAL"
powershell -NoProfile -ExecutionPolicy Bypass -File .\INSTALAR_CHECKIA_INTEGRADO.ps1
if ($LASTEXITCODE -ne 0) { throw "Falló la instalación" }
Set-Location "C:\Users\cancu\Documents\GitHub\checkIA"
powershell -NoProfile -ExecutionPolicy Bypass -File .\PROBAR_CHECKIA_INTEGRADO.ps1
```

Abrir http://127.0.0.1:5173 y recargar con Ctrl+F5. Iniciar sesión de la forma habitual y pulsar Nueva consulta. Las consultas anteriores mantienen el formulario con el que se crearon. Debe iniciarse una consulta nueva para usar las preguntas Paso 23.

El instalador verifica los hashes de los archivos existentes contra el ZIP enviado y las versiones anteriores conocidas del demo. Si encuentra modificaciones posteriores desconocidas, se detiene antes de copiar. Respalda cada archivo que reemplaza en una carpeta junto al proyecto y muestra su ruta.

## Interfaz conservada

Los siete CSS del frontend son idénticos al ZIP aportado: estilos base, ajustes, responsividad, móvil, administración, experiencia e interacciones. No se incluyen esos CSS en el paquete. Se conservan la bienvenida, el acceso, el layout, la barra de progreso, las animaciones, la ubicación del panel de resultados y los componentes de administración/resumen existentes.

Se modifican cuatro archivos existentes para enlazar el nuevo protocolo: frontend/src/main.jsx, frontend/src/OrientationPanel.jsx, frontend/src/interview-client.mjs y backend/src/summary.js. Se agrega frontend/src/Paso23.jsx para presentar los nuevos controles usando las clases actuales. El desplazamiento de las opciones largas se limita a ese nuevo bloque, para poder utilizarlas con el teclado móvil abierto sin cambiar los estilos generales.

No se reemplaza frontend/src/firebase.js, frontend/vite.config.js, package.json, archivos .env, índices, corpus, claves ni configuración de hosting. No se agregan dependencias npm. No se modifica el arranque de producción backend/src/server.js. El servidor integrado solo arranca localmente mediante backend/paso23/integrated-server.mjs; rechaza K_SERVICE.

## Funcionamiento integrado

- Mismas preguntas, respuestas libres, condiciones, opción H y textos revisados del demo V6. A y aa1 dicen ADULTO. G conserva alergia; H dice NINGUNA DE ESTA,SEGUIR EL FORMULARIO y pasa a pregunta 3.
- 1–8 pasa a edad; 9–10 muestra la ayuda urgente y 2.1.1. Las ayudas fijas aparecen sin esperar a OpenAI.
- IMC inmediato con Continuar, antes de la pregunta 8. Interpretación por código, con los límites de referencia y datos faltantes ya documentados.
- Generación al completar y confirmar, o al seleccionar la ruta correspondiente de emergencia. Misma biblioteca y cliente de análisis ampliado del demo. El nombre o alias del campo inicial se excluye del contexto del modelo.
- Añadir mas información extra conserva respuestas iniciales, ampliaciones y orientación previa. Incrementa la revisión y vuelve a consultar la biblioteca y el LLM. Las respuestas pendientes sobre revisiones anteriores se descartan.
- Las correcciones reabren el recorrido desde la pregunta corregida. Los datos anteriores permanecen en el historial. Consultas cerradas y consultas de otra cuenta no se modifican.
- Se reutilizan Firebase Authentication, Firestore y las credenciales locales actuales de la aplicación: frontend y servidor corren localmente, pero Auth/Firestore y OpenAI usan internet. No se despliega en Hosting ni Cloud Run.

Las nuevas consultas integradas se guardan en la misma colección checkia_sessions, con protocolo paso23-local-v6. No se migra ni se elimina información anterior. Sigue vigente la caducidad habitual de 24 horas y el límite de mensajes de la aplicación principal; no la memoria temporal de dos horas del demo separado.

## Verificación

30 pruebas específicas del formulario e integración aprobadas: rutas, cuatro ramas especiales y A–H, IMC, resumen completo, idempotencia, propietario, cierre/eliminación, correcciones, versiones y ampliaciones, llamadas RAG/LLM simuladas, endpoints autenticados y consultas anteriores.

Frontend compilado correctamente. Como firebase.js se excluyó intencionalmente del ZIP del usuario, se usó para esa compilación una configuración temporal de prueba que NO está en este paquete ni se instala. El script de inicio compila en el equipo del usuario con su configuración real, conservada. No se verificó inicio de sesión ni una llamada real a Firestore/OpenAI desde este entorno.

Render de componentes React verificado en servidor para opciones, emergencia y resultado. No es una prueba visual en navegador ni una medición clínica. La apariencia debe comprobarse localmente en las pantallas deseadas.

Pruebas generales del backend: 172 ejecutadas, 170 aprobadas. Dos pruebas antiguas de exportación esperan un formato anterior; las mismas dos fallan con el código original del ZIP, antes de esta integración. No se cambió esa funcionalidad del usuario para forzar esas verificaciones. El inicio local utiliza las 30 pruebas específicas de esta entrega.

## Restaurar archivos

El instalador imprime la carpeta de respaldo. Para volver a los archivos anteriores:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\RESTAURAR_CHECKIA_INTEGRACION.ps1 -Respaldo "RUTA_DEL_RESPALDO_IMPRESA"
```

El restaurador se detiene si detecta cambios posteriores a la instalación. No elimina consultas de Firestore. Después de restaurar, el arranque habitual del proyecto vuelve a utilizar su formulario anterior.
