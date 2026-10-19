# Paso 23 — preguntas del 17/10/2026, prueba local

Implementación basada en el repositorio público `luissiko/checkIA_asistente-medico`, commit `ab451f9`. No se ha accedido al disco C: del usuario ni se ha publicado ningún cambio.

## Arranque

Requiere Node.js 22 o posterior y el repositorio CHECKIA existente. El prototipo usa módulos nativos de Node y reutiliza el cliente OpenAI y el recuperador RAG del backend. No requiere instalar paquetes nuevos ni levantar Firebase para probar el formulario.

Desde la raíz del proyecto:

```powershell
Set-Location "C:\Users\cancu\Documents\GitHub\checkIA"
powershell -NoProfile -ExecutionPolicy Bypass -File .\PROBAR_PASO_23.ps1
```

Abrir **http://127.0.0.1:3023**. El script ejecuta primero las pruebas y después inicia el servidor. Ctrl+C lo detiene. Si el puerto está ocupado, cerrar la otra ejecución o definir `CHECKIA_PASO23_PORT`; abrir la URL que imprima el servidor.

No se modifica el frontend publicado, el servidor de puerto 3001, las versiones v1–v8, Firestore, las reglas de Firebase ni los scripts de despliegue. Este es un formulario web local separado para revisar el Paso 23. No sustituye automáticamente la entrevista principal.

## Fidelidad al documento

- `ORIGINAL_USUARIO.md` conserva los bytes del documento adjunto, incluidas las tachaduras y el formulario anterior.
- `backend/paso23/content.json` contiene preguntas, textos bb1–gg1 y enlaces extraídos de ese documento. No corrige ortografía ni puntuación.
- `backend/paso23/build-content.py` permite regenerar el contenido con Python. No hace falta ejecutarlo para probar la aplicación.
- Las instrucciones de presentación entre `<...>` no aparecen como consejos: se traducen a comportamiento o color rojo. Las marcas Markdown se retiran para mostrar el texto.
- Se conservaron las numeraciones repetidas, incluida la confirmación final 16.

Decisiones confirmadas expresamente por el usuario:

1. El texto tachado del formulario nuevo también está vigente.
2. El formulario después de la línea de separación es solo respaldo.
3. Nivel 0–8: continuar. Nivel 9–10: mostrar alerta y las opciones.
4. Preguntar hijos antes de cantidad; después preguntar embarazo a mujeres.

Las preguntas libres admiten letras y números sin validadores clínicos. El límite técnico es 4000 caracteres por respuesta. Las preguntas de sí/no admiten `si`, `sí` y `no`, con mayúsculas o minúsculas, sin admitir otras respuestas. Las selecciones de rutas requieren una opción interpretable; cualquier texto enviado se conserva en el historial aunque se repita el selector.

## Recorridos

1 → 2 → nivel 2.1 → opciones 2.1.

- Opción a o `si`: aa1 → 1a, 2a, 3a o 4a → orientación con RAG/LLM cuando está habilitada.
- Opción 5 en aa1 o `no` en el selector general: pregunta 3.
- Opciones b–g: mostrar el texto correspondiente bb1–gg1 y terminar esa ruta con ayuda visible. No requiere esperar a OpenAI.
- Nivel 9–10: mostrar la alerta antes de elegir la opción específica. No infiere automáticamente un diagnóstico.
- Pregunta 7: conserva las ocho señales anteriores porque el usuario confirmó que las tachaduras también están vigentes. `si` vuelve a las opciones de emergencia; `no` continúa a 8.
- La confirmación final `si` habilita la orientación del formulario completo; `no` deja las respuestas disponibles para corregir.

Saltos condicionales de hijos, medicamentos, remedios, alergias, herencia, actividad física y alimentación se definen en `engine.mjs`, función `nextQuestion`, para revisión directa del usuario. Ante una respuesta negativa se omiten solo sus detalles dependientes; las preguntas independientes posteriores se mantienen. Después de 19.1 `si` se continúa a ciudad; `no` conduce a comida no saludable. No se añadieron preguntas clínicas nuevas.

La pregunta inicial no pide un nombre separado: se conserva exactamente. Por eso no se inventa el nombre del paciente ni se añade una pregunta para obtenerlo. Se guarda íntegra la respuesta sobre quién consulta.

## Dos límites explícitos

- El original menciona 085. Se conserva en el respaldo, pero no se crea un botón ni una recomendación generada hacia ese número no verificado. El botón operativo utiliza 911.
- La tabla pediátrica adjunta en el documento prohíbe utilizar los promedios anuales para clasificación individual. Se calcula el IMC cuando los datos son interpretables, pero no se asigna categoría pediátrica con esas medias. Se indica que falta la referencia pediátrica específica. El perfil adulto general se aplica de 19 a 80 según el documento; embarazo requiere interpretación específica. Fuera del dominio no se extrapola.

El peso se interpreta en kg. Una altura con `cm` o `m` respeta la unidad declarada; sin unidad, se presupone metros si es ≤3 y cm en otro caso, dejando constancia en el JSON de que debe confirmarse. El texto original nunca se reemplaza por el valor numérico. El cálculo conserva precisión completa y solo redondea para mostrar.

## Biblioteca y OpenAI

El servidor lee el archivo privado **existente** `backend/.env`, si lo hay. No se incluye ni se solicita una clave en el navegador. Utiliza las variables existentes `OPENAI_API_KEY`, `OPENAI_MODEL` y `CHECKIA_LLM_ENABLED=true` del cliente del proyecto. No se cambia el modelo configurado.

Para el RAG reutiliza `backend/knowledge/corpus.json` e `index.json` y la comprobación de vigencia actual. No construye un corpus pediátrico nuevo ni presupone que el corpus contiene evidencia suficiente para las cuatro poblaciones.

En la pantalla de inicio, el participante puede autorizar el envío del caso ficticio a OpenAI. Cuando esa opción está marcada, el cliente está configurado y el RAG está listo, se genera automáticamente al finalizar una rama especial o confirmar el formulario completo. También se puede reintentar con el botón correspondiente. Las llamadas reales pueden generar cargos en la cuenta de API.

Si faltan credenciales, índice o vigencia documental, el formulario funciona, las ayudas permanecen visibles y se informa que no se generó orientación. No se simula una respuesta clínica como si procediera de OpenAI. La generación reutiliza el formato y las restricciones del cliente existente: organizar declaraciones y explicar evidencia recuperada, sin confirmar diagnósticos. Las instrucciones de primeros auxilios del documento se muestran como texto fijo, separadas del contenido generado.

El resultado identifica modelo, versión del prompt, consumo comunicado por el proveedor y fuentes efectivamente utilizadas. Las descripciones de las ramas 1a–4a se envían como relato libre pertinente; el sistema no inventa semanas de embarazo, edad exacta ni discapacidad a partir de respuestas ambiguas.

Las pruebas automáticas usan un proveedor y fragmentos sintéticos; no prueban precisión clínica ni una llamada real a OpenAI.

## Respuestas, correcciones y métricas

- Sesiones exclusivamente en memoria del proceso; expiran tras dos horas de inactividad y se pierden al cerrar el servidor.
- Recargar la página recupera la sesión del mismo navegador mientras exista en el servidor.
- «Descargar respuestas JSON» incluye preguntas literales, respuestas originales, tiempos, IMC, revisión, decisiones, orientación y trazabilidad.
- «Corregir desde aquí» regresa a la pregunta seleccionada y vuelve a solicitar las posteriores. Sus versiones anteriores quedan en `correctionHistory` y el historial bruto permanece en `journal`.
- Métricas: número de pruebas, terminadas, ramas de emergencia, media de preguntas contestadas y duración media de formularios completos. No calcula sensibilidad, especificidad ni precisión diagnóstica sin evaluaciones externas.
- Los enlaces de hospitales son los proporcionados por el usuario. No hay consulta de disponibilidad en tiempo real ni verificación del destino de los enlaces cortos.

## Archivos principales

| Archivo | Función |
|---|---|
| `backend/paso23/content.json` | Textos literales, enlaces y decisiones confirmadas. |
| `backend/paso23/engine.mjs` | Orden, saltos y cálculo de IMC. |
| `backend/paso23/server.mjs` | Servidor solo local, sesiones y RAG/OpenAI. |
| `backend/paso23/public/app.js` | Pantallas, ayudas, exportación y correcciones. |
| `backend/paso23/paso23.test.mjs` | Pruebas automáticas independientes. |
| `PROBAR_PASO_23.ps1` | Prueba y arranque para Windows. |

## Verificación realizada

12 pruebas automatizadas: texto literal y hash del respaldo, ramas normales y especiales, condiciones afirmativas/negativas, umbral 8/9/10, entrada libre, sí/no estricto, IMC/unidades, revisión de solicitudes, exportación, correcciones, consentimiento y conexión simulada de RAG/LLM.

```powershell
node --test .\backend\paso23\paso23.test.mjs
```

La revisión clínica, la prueba con la configuración privada del usuario y la integración posterior con la interfaz principal siguen pendientes.

No se pudo ejecutar la revisión visual con Chromium en este entorno porque no hay un navegador instalado. La interfaz se comprobó sintácticamente, y el servidor y los recorridos se probaron automáticamente. Revisar visualmente al abrir la URL local.
