# Aclaraciones del usuario del 18/10/2026

Documento fuente: ORIGINAL_USUARIO.md, conservado byte por byte. Versión: paso23-local-v2.

- Ignorar las instrucciones tachadas. La respuesta del nivel de emergencia queda registrada sin aplicar los umbrales de la versión anterior. Las opciones a–g sí activan sus rutas.
- aa1, opción 5: pregunta 3 (edad).
- Pregunta 7: consentimiento para mostrar el IMC. No: continuar sin calcular ni incluir IMC derivado en el contexto del modelo. Sí: calcular mediante código, no mediante el LLM.
- Autorizada la interpretación pediátrica por edad y sexo, y la corrección de las etiquetas de adultos. Se emplean límites continuos: 18.5, 25, 30, 35 y 40; los decimales no quedan sin categoría. El perfil adulto de esta prueba empieza a los 20 años y llega hasta los 80.
- 21.1: avanzar a 22; se evita volver a 20. Tanto sí como no llegan a 22, conservando ambas respuestas.
- Preguntas 30–32: la respuesta afirmativa de consumo actual lleva al detalle actual; la negativa lleva al detalle pasado. Se conservan las numeraciones repetidas visibles; el código usa identificadores distintos para no sobrescribir respuestas.
- Pregunta 19: nueve opciones. Al no recibirse una nueva lista, se conservan las primeras nueve del archivo adjunto; la décima (Linfogranuloma Venéreo) no se incluye. Decisión pendiente de revisión del autor si pretendía eliminar otra opción.
- Otras condiciones: no omite las subpreguntas de detalle y avanza a la siguiente principal. En el bloque de alergia, la pregunta de mascotas pertenece a ese bloque y se omite cuando no refiere alergia.
- La ruta mujer pasa por hijos y embarazo como en el documento; la ruta hombre va a peso. No se introduce un nuevo filtro por edad para estas preguntas.

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
