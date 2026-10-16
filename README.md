\# CHECKIA — Asistente de orientación médica con IA



CHECKIA es un proyecto de asistencia conversacional que utiliza inteligencia artificial y recuperación de información documental (RAG) para ofrecer orientación general sobre síntomas y facilitar la búsqueda de atención médica.



Su propósito es ayudar a las personas a organizar la información de su consulta, reconocer señales de alarma y comprender los siguientes pasos para recibir una valoración profesional.



> CHECKIA no sustituye una consulta médica, no confirma diagnósticos y no debe utilizarse para descartar una emergencia. Ante una situación grave, busca atención inmediata sin esperar una respuesta del asistente.



\## Objetivo



Desarrollar una herramienta accesible de preorientación clínica que permita describir molestias en lenguaje cotidiano y recibir información comprensible para preparar una consulta y buscar atención oportuna.



El enfoque inicial del proyecto contempla información relacionada con diabetes y su ampliación progresiva a otros motivos de consulta, sujeta a revisión clínica.



\## Enfoque de funcionamiento



El flujo general propuesto es:



1\. Recopilar el motivo de consulta y los síntomas comunicados.

2\. Identificar información faltante mediante preguntas de seguimiento.

3\. Revisar posibles señales de alarma.

4\. Recuperar información relevante de la biblioteca documental.

5\. Generar orientación general y sugerir el siguiente paso.

6\. Proponer preguntas que la persona pueda llevar a su consulta médica.



Las funciones disponibles dependen de la versión del código y de la configuración del entorno.



\## Inteligencia artificial y RAG



El enfoque RAG permite recuperar fragmentos de una biblioteca documental para aportar contexto al modelo de lenguaje antes de generar una respuesta.



La calidad de la orientación depende de la calidad y actualización de las fuentes, la recuperación de información, los datos proporcionados y las limitaciones del modelo.



Usar RAG no garantiza que una respuesta sea correcta ni equivale a una validación clínica.



\## Estructura de la orientación



La presentación de resultados contempla tres componentes:



\- \*\*Orientación general:\*\* información relacionada con las molestias comunicadas.

\- \*\*Siguiente paso:\*\* indicación sobre la búsqueda de valoración y atención.

\- \*\*Preguntas para la consulta:\*\* dudas que pueden ayudar a conversar con un profesional de salud.



El asistente debe comunicar la incertidumbre y evitar presentar posibilidades como diagnósticos confirmados.



\## Triaje y preguntas adaptativas



Se plantea revisar referencias de evaluación remota y priorización de urgencias, entre ellas:



\- NHS Pathways / NHS 111.

\- Interagency Integrated Triage Tool (IITT), de la OMS, el CICR y Médicos Sin Fronteras.

\- Referencias de triaje de instituciones mexicanas.



Estas referencias tienen contextos de uso, requisitos y condiciones particulares. Su mención no implica integración oficial, autorización, certificación ni equivalencia clínica.



Las preguntas redactadas para CHECKIA son propuestas que requieren revisión profesional. No reproducen los algoritmos oficiales de NHS Pathways.



La IITT fue diseñada para unidades de urgencias y requiere valoración clínica; un cuestionario conversacional no sustituye su aplicación presencial.



\## Principios de seguridad



\- Priorizar señales de alarma antes de continuar la entrevista.

\- Evitar que completar un cuestionario retrase la búsqueda de atención.

\- No interpretar una respuesta desconocida como ausencia de riesgo.

\- Considerar diferencias entre adultos, niños y embarazo o posparto.

\- No indicar que una emergencia está descartada únicamente por el chat.

\- No recomendar cambios de tratamiento sin valoración profesional.

\- Comunicar las limitaciones de la orientación generada.



\## Privacidad y configuración



Antes de utilizar o desplegar el proyecto:



\- Revisa qué información se recopila, almacena y envía a proveedores externos.

\- Informa al usuario sobre el tratamiento de sus datos.

\- Mantén las claves privadas en el servidor.

\- No incluyas claves de API en el código del navegador.

\- No publiques archivos `.env`, credenciales ni datos reales de pacientes.

\- Utiliza información ficticia o debidamente desidentificada en las pruebas.



Un archivo `.env.example`, si se incluye, debe contener únicamente nombres de variables y valores de ejemplo.



\## Ejecución y despliegue



La instalación depende de los componentes y dependencias presentes en esta versión del repositorio.



Antes de ejecutar el proyecto, revisa los manifiestos de dependencias, los scripts disponibles y la configuración de los servicios externos.



Las instrucciones específicas de instalación y despliegue deberán mantenerse alineadas con el código publicado.



\## Evaluación propuesta



El plan de evaluación contempla:



\- Revisar clínicamente la biblioteca documental.

\- Comprobar si el RAG recupera información relevante.

\- Comparar modelos utilizando los mismos casos de prueba.

\- Evaluar la identificación de señales de alarma.

\- Medir omisiones, respuestas sin respaldo y recomendaciones inadecuadas.

\- Revisar la claridad de las indicaciones para el usuario.

\- Probar diferentes edades, motivos de consulta y situaciones de incertidumbre.



Los resultados deben documentarse antes de afirmar precisión diagnóstica o seguridad clínica.



\## Estado del proyecto



Proyecto en desarrollo y evaluación.



Este repositorio no acredita validación clínica, aprobación sanitaria ni autorización para uso autónomo en decisiones médicas.



\## Autor



\*\*Pedro Luis Pérez Barahona — Luis Barahona\*\*



Ingeniería en Datos e Inteligencia Organizacional  

Universidad del Caribe · Cancún, Quintana Roo, México



GitHub: https://github.com/luissiko



\## Licencia



Consulta el archivo `LICENSE` si está disponible.



Las licencias de dependencias, modelos, documentos y herramientas de terceros deben revisarse por separado.

