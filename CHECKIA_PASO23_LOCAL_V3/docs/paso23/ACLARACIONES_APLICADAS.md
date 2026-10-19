# Cambios y reglas vigentes · Paso 23 v3

Documento fuente: ORIGINAL_USUARIO.md, copia exacta del archivo actualizado preguntas nuevas 17_10_202666666666666(1).md. Las instrucciones posteriores del mensaje del usuario prevalecen sobre el documento cuando difieren.

- 2.1 conserva el último texto solicitado: «¿Nivel de emergencia del 0 al 9?(EL NUMERO 10 ES DIRECTAMENTE A EMERGENCIA).»
- 0–7: pregunta 3. 8–9: pregunta 2.1.1. 10: se muestran de inmediato 911 y ubicaciones, y el selector de caso; no se espera al modelo. La selección del caso no es requisito para ver la alerta. Si el número no se interpreta, se conserva el texto y se pide identificar el nivel sin decidir una ruta silenciosamente.
- aa1 se muestra en mayúsculas, sin corregir las palabras del autor. Opción 5: pregunta 3.
- B–G se presentan como «F. 🔵ACCIDENTE CEREBROVASCULAR (ACV)», con su pregunta debajo. No se incluye botón No al final del selector; sigue siendo posible escribir no, como permite el archivo. Las indicaciones se muestran en azul intenso. No se cambiaron las instrucciones clínicas del documento.
- Las tres listas de enfermedades incluyen ahora diez opciones, con NINGUNA/NIGUNA literal del archivo. Al seleccionar 10 se omiten los detalles de esa enfermedad y se continúa al siguiente bloque. La respuesta anterior se conserva aunque sea contradictoria con NINGUNA.
- Pregunta 7: resultado inmediato, con fórmula, datos normalizados y clasificación cuando proceda. Se presenta antes de la siguiente pregunta y tiene un botón Continuar. Si responde no, no se calcula IMC derivado para el modelo.
- Se mantienen los límites de adultos autorizados previamente, sin huecos en decimales: 18.5, 25, 30, 35 y 40. No se usa la fórmula dimensionalmente incorrecta «metros × centímetros» que aparece en una instrucción del documento; sí se usa la fórmula correcta que aparece a continuación en el mismo documento.
- Pregunta 15.1 y 25.2 incorporan literalmente las correcciones del documento nuevo. 25.2 pregunta duración y hace cuánto/fecha en una misma respuesta.
- 21.1 avanza a 22 y no vuelve a 20. Se conservan los textos y la numeración duplicada de los bloques de consumo.
- Se eliminan de la pantalla las métricas, las preguntas para el profesional, títulos técnicos, nombre del modelo junto al resultado, referencias con «Fuente recuperada», textos de memoria temporal y encabezados de prueba solicitados. Las métricas y fuentes reales siguen disponibles internamente/exportadas, sin afirmar que estaban fijas.
- El aviso final usa la frase solicitada con el identificador real del modelo que devolvió el servicio. Si el modelo es otro, no se afirma falsamente que fue gpt-6.1-sol.
- El checkbox de inicio se sustituye por el botón Comenzar y un aviso breve de procesamiento con OpenAI. Al pulsarlo se autoriza el envío para esa prueba; no se envía nada al proveedor solo por abrir la página.
- El botón «Añadir mas información extra» permite aportar hasta diez ampliaciones de 4000 caracteres. Se conserva el relato original y cada ampliación en orden. La nueva evaluación usa todo el contexto; la versión anterior se guarda en orientationHistory. Si se edita una pregunta original, se reinicia su recorrido y las ampliaciones anteriores pasan al historial de correcciones.
- Cada ampliación incrementa la revisión e invalida el resultado anterior. No se publica un resultado generado sobre una revisión antigua. Si el proveedor o RAG falla, la ampliación permanece guardada y se muestra el error, sin fingir una nueva evaluación.
- B–G y las cuatro ramas especiales permiten generar orientación ampliada con el RAG y el cliente local de emergencia. El aviso 911, ubicaciones e indicaciones fijas aparecen antes de esa llamada. El prompt especial pide más contexto y apoyo respaldado por evidencia, sin inventar tratamientos ni convertir los textos de prueba en evidencia médica validada.

## Textos corregidos expresamente por el usuario

Alcohol actual:
¿Cada cuanto tiempo consumes y desde hace cuanto tiempo?

Alcohol pasado:
¿Hace cuanto tiempo consumió y durante cuanto tiempo aproximadamente?

Drogas actuales:
¿Cada cuanto consumes  y desde hace cuanto tiempo?

Drogas pasadas:
¿Hace cuanto tiempo consumió y durante cuanto tiempo aproximadamente?

El texto de mascotas carece de número en el documento; se identifica internamente como 15.4 sin cambiar sus palabras.

## Referencias del IMC

- OMS 2006: parámetros diarios L, M y S de bmianthro.txt, repositorio oficial WorldHealthOrganization/anthro. https://github.com/WorldHealthOrganization/anthro/blob/master/data-raw/growthstandards/bmianthro.txt
- OMS 2007: parámetros mensuales L, M y S de las dos hojas oficiales de IMC para la edad aportadas por el usuario. https://www.who.int/tools/growth-reference-data-for-5to19-years/indicators/bmi-for-age
- Adultos: clasificación general OMS. https://www.who.int/data/nutrition/nlis/info/malnutrition-in-women

Se compara el IMC con los límites obtenidos de los parámetros oficiales: IMC(z) = M × (1 + L × S × z)^(1/L), o M × exp(S × z) cuando L = 0. No se reporta una puntuación z extrema mediante una fórmula simplificada.

Hasta 60 meses se usa OMS 2006; de 61 a 228 meses, OMS 2007. Las edades de 19 años posteriores al mes 228 no se extrapolan ni se clasifican con el perfil adulto de 20 años.

En menores, una edad expresada solo en años no se considera exacta: se muestra el IMC numérico y se pide precisión para interpretarlo. Se aceptan, por ejemplo, «120 meses» o «10 años 0 meses». Para menores de dos años falta confirmar la medición acostado: el cálculo queda provisional y no se clasifica. Desde dos años se presupone talla de pie, indicado en el resultado.

Los patrones de crecimiento son una referencia de cribado, no promedios de peso/altura ni un diagnóstico. En embarazo se evita clasificar con límites generales. Las medidas sin unidad se interpretan como en la versión anterior, dejando una marca de unidad inferida para revisar.
