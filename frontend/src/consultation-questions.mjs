export default {
  "respondent": {
    "number": "1",
    "text": "¿Cuál es tu nombre o de la persona para el diagnóstico?"
  },
  "reason": {
    "number": "2",
    "text": "¿Motivo de la consulta?(Descríbemelo)"
  },
  "emergency_level": {
    "number": "2.1",
    "text": "¿Nivel de emergencia del 1 al 10 los numero 9-10 son realmente URGENCIA?",
    "choices": [
      {
        "value": "1",
        "label": "1"
      },
      {
        "value": "2",
        "label": "2"
      },
      {
        "value": "3",
        "label": "3"
      },
      {
        "value": "4",
        "label": "4"
      },
      {
        "value": "5",
        "label": "5"
      },
      {
        "value": "6",
        "label": "6"
      },
      {
        "value": "7",
        "label": "7"
      },
      {
        "value": "8",
        "label": "8"
      },
      {
        "value": "9",
        "label": "9"
      },
      {
        "value": "10",
        "label": "10"
      }
    ]
  },
  "emergency_options": {
    "number": "2.1.1",
    "text": "🔵¿TIENES ALGO DE ESTO SINTOMAS O DOLENCIA?",
    "choices": [
      {
        "value": "a",
        "label": "A.- 🔵 ¿Es un bebe, embarazada, adulto 3ra edad ó discapacitado?"
      },
      {
        "value": "b",
        "label": "B. 🔵PARO CARDIACO O REPSIRATORIO",
        "question": "¿La persona está inconsciente y no respira normalmente, o solamente jadea?"
      },
      {
        "value": "c",
        "label": "C. 🔵DIFICULTAD RESPIRATORIA GRAVE",
        "question": "¿Tienes dificultad extrema para respirar, te estás asfixiando o no puedes hablar por falta de aire?"
      },
      {
        "value": "d",
        "label": "D. 🔵HEMORRAGIA GRAVE",
        "question": "¿Tienes un sangrado abundante que no se detiene o has vomitado sangre o coagulación?"
      },
      {
        "value": "e",
        "label": "E. 🔵INFARTO O EMERGENCIA CARDIACA",
        "question": "¿Tienes dolor o presión persistente en el pecho, especialmente con falta de aire, sudor frío o desmayo?"
      },
      {
        "value": "f",
        "label": "F. 🔵ACCIDENTE CEREBROVASCULAR (ACV)",
        "question": "¿Presentaste repentinamente la cara torcida, debilidad de un lado del cuerpo o dificultad para hablar?"
      },
      {
        "value": "g",
        "label": "G. 🔵ALERGIA (Anafilaxia) U OBSTRUCICON DE GARGANTA",
        "question": "¿Tienes hinchazón repentina de lengua o garganta, o dificultad para respirar o tragar después de un alimento, medicamento o picadura?"
      },
      {
        "value": "h",
        "label": "H. 🔵NINGUNA DE ESTA,SEGUIR EL FORMULARIO"
      }
    ]
  },
  "emergency_group": {
    "number": "aa1",
    "text": "¿ES UN BEBE1)MUJER EMBARAZADA(2) ADULTO TERCERA EDAD(3)DISCAPACITADO(4),NO ES UNA EMERGENCIA(5)?"
  },
  "infant_emergency": {
    "number": "1a",
    "text": "¿Cuántos meses/año tiene el bebe y cual es su urgencia?"
  },
  "pregnancy_emergency": {
    "number": "2a",
    "text": "¿Edad de la mujer embarazada y cual es su urgencia?"
  },
  "older_emergency": {
    "number": "3a",
    "text": "¿Cual edad, sexo y urgencia tiene el adulto mayor?"
  },
  "disability_emergency": {
    "number": "4a",
    "text": "¿Cual edad, sexo, discapacidad tiene y cual urgencia tiene la persona?"
  },
  "age": {
    "number": "3",
    "text": "¿Qué edad tienes?(poner solo numero)"
  },
  "sex": {
    "number": "4",
    "text": "¿Es usted Hombre o Mujer?",
    "choices": [
      {
        "value": "Hombre",
        "label": "Hombre"
      },
      {
        "value": "Mujer",
        "label": "Mujer"
      }
    ]
  },
  "has_children": {
    "number": "4.1",
    "text": "¿Tienes hijos?‬"
  },
  "children_count": {
    "number": "4.1.1",
    "text": "¿Cuantos hijos tienes?"
  },
  "pregnant": {
    "number": "4.1.2",
    "text": "¿Esta embarazada?"
  },
  "pregnancy_months": {
    "number": "4.1.3",
    "text": "¿Cuanto meses tiene tu embarazo?"
  },
  "weight": {
    "number": "5",
    "text": "¿Cuál es tu peso (kg) ?(solo escribir numero)"
  },
  "height": {
    "number": "6",
    "text": "¿Cuál es tu altura(en cm)?(ejemplo 1.56 = 156)"
  },
  "bmi_consent": {
    "number": "7",
    "text": "¿Quieres saber tu índice de masa corporal con tu información(si/no))"
  },
  "onset": {
    "number": "8",
    "text": "¿Cuándo comenzó su dolor ó síntomas?"
  },
  "location": {
    "number": "9",
    "text": "¿En qué parte ó zona le afecta?"
  },
  "location_description": {
    "number": "9.2",
    "text": "¿ Podría describir detalladamente el dolor o afectación y tiempo que sucedio?"
  },
  "severity": {
    "number": "10",
    "text": "¿Cómo clasifica su dolor o afectación del 1 al 10?",
    "choices": [
      {
        "value": "1",
        "label": "1"
      },
      {
        "value": "2",
        "label": "2"
      },
      {
        "value": "3",
        "label": "3"
      },
      {
        "value": "4",
        "label": "4"
      },
      {
        "value": "5",
        "label": "5"
      },
      {
        "value": "6",
        "label": "6"
      },
      {
        "value": "7",
        "label": "7"
      },
      {
        "value": "8",
        "label": "8"
      },
      {
        "value": "9",
        "label": "9"
      },
      {
        "value": "10",
        "label": "10"
      }
    ]
  },
  "history": {
    "number": "11",
    "text": "¿has tenido algo similar en el pasado?"
  },
  "history_detail": {
    "number": "12",
    "text": "¿Cuál dolor o afectación le ocurrió y hace cuanto tiempo (Descríbelo detallamente)?"
  },
  "medications": {
    "number": "13",
    "text": "¿Tomas algún medicamento/suplemento alimenticio/vitamina?"
  },
  "medications_details": {
    "number": "13.1",
    "text": "¿Cual, desde cuando y porque lo consumes?"
  },
  "medications_knows_active": {
    "number": "13.2",
    "text": "¿Sabe el Nombre de la sustancia que tiene el producto(principio activo ó EFG) SI/NO?"
  },
  "medications_identity": {
    "number": "13.4",
    "text": "¿Menciona cual es?"
  },
  "remedies": {
    "number": "14",
    "text": "¿Tomas algún remedio casero, naturista o botánico?"
  },
  "remedies_detail": {
    "number": "14.1",
    "text": "¿Cual es, porque lo consumes y desde hace cuanto tiempo?"
  },
  "allergies": {
    "number": "15",
    "text": "¿tienes algún tipo de alergia?"
  },
  "allergy_timing": {
    "number": "15.1",
    "text": "¿Cual es ,desde cuándo la tienes y cuando tiempo te tarda la alergia?"
  },
  "allergy_reaction": {
    "number": "15.2",
    "text": "¿Qué medicamento/remedio consumes para la alergia?"
  },
  "pets": {
    "number": "15.3",
    "text": "¿tiene mascota en casa(SI/NO)?"
  },
  "pets_detail": {
    "number": "15.4",
    "text": "¿Cuál o cuales tipo de mascota y cuanto tienes)"
  },
  "cancer_diabetes": {
    "number": "16",
    "text": "¿Tiene cáncer o diabetes?"
  },
  "cancer_diabetes_detail": {
    "number": "16.1",
    "text": "¿Cuál y que tipo?"
  },
  "hereditary": {
    "number": "17",
    "text": "¿Tienes alguna enfermedad hereditaria?"
  },
  "hereditary_since": {
    "number": "17.1",
    "text": "¿Desde hace cuanto tiempo?"
  },
  "hereditary_relatives": {
    "number": "17.2",
    "text": "¿Qué familiares la tienen o la tuvieron?"
  },
  "hereditary_relative_age": {
    "number": "17.3",
    "text": "¿Si te acuerdas, desde que edad la tuvieron y cuanto tiempo tuvieron o tienen con ella aproximadamente?"
  },
  "degenerative": {
    "number": "18",
    "text": "¿Tienes una enfermedad degenerativa SI/NO?"
  },
  "degenerative_since": {
    "number": "18.1",
    "text": "¿Desde cuando la tienes y si la tiene o tuvo un familiar cercano?"
  },
  "sti": {
    "number": "19",
    "text": "¿Tienes una enfermedad de trasmisión sexual SI/NO?"
  },
  "sti_since": {
    "number": "19.1",
    "text": "¿Desde cuando la tienes y si la tiene o tuvo un familiar cercano?"
  },
  "physical_activity": {
    "number": "20",
    "text": "¿Realiza actividades físicas (SI/NO)?"
  },
  "activity_detail": {
    "number": "20.1",
    "text": "¿Cuales son y que tiempo la realizas (dias por semana y cuantas hora aprox)"
  },
  "healthy_diet": {
    "number": "21",
    "text": "¿Su alimentación es saludable?"
  },
  "avoids_processed": {
    "number": "21.1",
    "text": "¿Evita usted consumir comida procesada (embutidos ,harinas refinada, comida rápida, ETC?"
  },
  "unhealthy_food": {
    "number": "22",
    "text": "¿Que tipo de comida no saludable consume?"
  },
  "unhealthy_food_frequency": {
    "number": "22.1",
    "text": "¿Cada cuanto consume comida no saludable?",
    "choices": [
      {
        "value": "poco",
        "label": "poco"
      },
      {
        "value": "a veces",
        "label": "a veces"
      },
      {
        "value": "frecuente",
        "label": "frecuente"
      },
      {
        "value": "diario",
        "label": "diario"
      }
    ]
  },
  "city": {
    "number": "23",
    "text": "¿Que ciudad vives actualmente?"
  },
  "city_since": {
    "number": "23.1",
    "text": "¿Desde hace cuanto tiempo vives allí?"
  },
  "origin": {
    "number": "24",
    "text": "¿Donde nació?"
  },
  "origin_visits": {
    "number": "24.1",
    "text": "¿Visita seguido ese lugar?"
  },
  "travel": {
    "number": "25",
    "text": "¿Viajo algún lugar recientemente?"
  },
  "travel_where": {
    "number": "25.1",
    "text": "¿Donde?"
  },
  "travel_duration": {
    "number": "25.2",
    "text": "¿Cuánto tiempo estuvo y hace cuanto (fecha)?"
  },
  "travel_frequent": {
    "number": "25.3",
    "text": "¿Llega frecuente a ese lugar?"
  },
  "medical_visits": {
    "number": "26",
    "text": "¿Realiza visita medica?"
  },
  "medical_last": {
    "number": "26.1",
    "text": "¿Cuándo fue la ultima vez?"
  },
  "medical_reason": {
    "number": "26.2",
    "text": "¿Por qué fue y cual fue el diagnostico medico?"
  },
  "medical_treatment": {
    "number": "26.3",
    "text": "¿Siguió algún tratamiento después de la visita medica?"
  },
  "lab_tests": {
    "number": "27",
    "text": "¿Se ha realizado análisis últimamente?"
  },
  "lab_which": {
    "number": "27.1",
    "text": "¿Cuáles?"
  },
  "lab_results": {
    "number": "27.2",
    "text": "¿Qué resultado salieron?"
  },
  "lab_review": {
    "number": "27.3",
    "text": "¿Visito a un medico por los resultados?"
  },
  "sleep": {
    "number": "28",
    "text": "¿Cuánta horas duermes?"
  },
  "sleep_medications": {
    "number": "28.1",
    "text": "¿tomas medicamento para dormir?"
  },
  "occupation": {
    "number": "29",
    "text": "¿A que se dedica?"
  },
  "work_hours": {
    "number": "29.1",
    "text": "¿Cuánta horas trabaja aproximadamente?"
  },
  "alcohol": {
    "number": "30",
    "text": "¿Toma alcohol?"
  },
  "alcohol_current": {
    "number": "30.1",
    "text": "¿consume actualmente (SI/NO)?"
  },
  "alcohol_detail": {
    "number": "30.2",
    "text": "¿Cada cuanto tiempo consumes y desde hace cuanto tiempo?"
  },
  "alcohol_past": {
    "number": "30.2",
    "text": "¿Hace cuanto tiempo consumió y durante cuanto tiempo aproximadamente?"
  },
  "smoking": {
    "number": "31",
    "text": "¿fumas cigarro?"
  },
  "smoking_current": {
    "number": "31.1",
    "text": "¿consume actualmente (SI/NO)?"
  },
  "smoking_detail": {
    "number": "31.2",
    "text": "¿Cuanto cigarros por día y desde hace cuanto tiempo?"
  },
  "smoking_past": {
    "number": "31.2",
    "text": "¿Hace cuanto tiempo consumió y durante cuanto tiempo aproximadamente?"
  },
  "drugs": {
    "number": "32",
    "text": "¿Consume o consumió algún tipo de droga (SI/NO)?"
  },
  "drugs_current": {
    "number": "32.1",
    "text": "¿consume actualmente (SI/NO)?"
  },
  "drugs_detail": {
    "number": "31.2",
    "text": "¿Cada cuanto consumes  y desde hace cuanto tiempo?"
  },
  "drugs_past": {
    "number": "31.2",
    "text": "¿Hace cuanto tiempo consumió y durante cuanto tiempo aproximadamente?"
  },
  "protection": {
    "number": "33",
    "text": "¿utiliza protección en las relaciones intima(SI/NO)?"
  },
  "partners": {
    "number": "33.1",
    "text": "¿Es pareja única con la persona que tiene intimidad o frecuenta con otra persona?"
  },
  "donated": {
    "number": "34",
    "text": "¿Usted a donado sangre (SI/NO)?"
  },
  "donated_when": {
    "number": "34.1",
    "text": "¿Cuando?"
  },
  "answers_confirmation": {
    "number": "35",
    "text": "¿todas sus respuesta son verdaderas (SI/NO)"
  },
  "hereditary_choice": {
    "number": "17",
    "text": "",
    "choices": [
      {
        "value": "1",
        "label": "1. Hipercolesterolemia familiar"
      },
      {
        "value": "2",
        "label": "2. Fibrosis quística"
      },
      {
        "value": "3",
        "label": "3. Anemia falciforme"
      },
      {
        "value": "4",
        "label": "4. Enfermedad de Huntington"
      },
      {
        "value": "5",
        "label": "5. Hemofilia"
      },
      {
        "value": "6",
        "label": "6. Síndrome de Marfan"
      },
      {
        "value": "7",
        "label": "7. Distrofia muscular"
      },
      {
        "value": "8",
        "label": "8. Hemocromatosis"
      },
      {
        "value": "9",
        "label": "9. Neurofibromatosis"
      },
      {
        "value": "10",
        "label": "10. NINGUNA"
      }
    ]
  },
  "degenerative_choice": {
    "number": "18",
    "text": "",
    "choices": [
      {
        "value": "1",
        "label": "1. Enfermedad de Alzheimer (y otras demencias seniles)"
      },
      {
        "value": "2",
        "label": "2. Artrosis / Osteoartritis (desgaste del cartílago articular)"
      },
      {
        "value": "3",
        "label": "3. Enfermedad de Parkinson (degeneración del sistema nervioso motor)"
      },
      {
        "value": "4",
        "label": "4. Osteoporosis (pérdida progresiva de la densidad ósea)"
      },
      {
        "value": "5",
        "label": "5. Maculopatía / Degeneración Macular Asociada a la Edad (DMAE)"
      },
      {
        "value": "6",
        "label": "6. Esclerosis Lateral Amiotrófica (ELA)"
      },
      {
        "value": "7",
        "label": "7. Enfermedad Cardiovascular Degenerativa (Arterioesclerosis por envejecimiento arterial)"
      },
      {
        "value": "8",
        "label": "8. Sarcopenia (pérdida gradual y natural de la masa y fuerza muscular)"
      },
      {
        "value": "9",
        "label": "9. Presbiacusia (pérdida progresiva de la audición por la edad)"
      },
      {
        "value": "10",
        "label": "10. NINGUNA"
      }
    ]
  },
  "sti_choice": {
    "number": "19",
    "text": "",
    "choices": [
      {
        "value": "1",
        "label": "1. VIH / SIDA (Virus de la Inmunodeficiencia Humana)"
      },
      {
        "value": "2",
        "label": "2. Virus del Papiloma Humano (VPH)"
      },
      {
        "value": "3",
        "label": "3. Sífilis (Treponema pallidum)"
      },
      {
        "value": "4",
        "label": "4. Hepatitis B (VHB)"
      },
      {
        "value": "5",
        "label": "5. Hepatitis C (VHC)"
      },
      {
        "value": "6",
        "label": "6. Clamidia (Chlamydia trachomatis)"
      },
      {
        "value": "7",
        "label": "7. Gonorrea (Neisseria gonorrhoeae)"
      },
      {
        "value": "8",
        "label": "8. Herpes Genital (Virus del Herpes Simple tipo 2 y tipo 1)"
      },
      {
        "value": "9",
        "label": "9. Tricomoniasis (Trichomonas vaginalis)"
      },
      {
        "value": "10",
        "label": "10. NIGUNA"
      }
    ]
  }
};
