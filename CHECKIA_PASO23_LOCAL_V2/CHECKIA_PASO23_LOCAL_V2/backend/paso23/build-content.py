from pathlib import Path
import re,json,hashlib,shutil
r=Path(__file__).resolve().parents[2];original=r/'docs/paso23/ORIGINAL_USUARIO.md'
# The uploaded bytes stay intact; extraction omits markup and struck instructions.
s=original.read_text();s=re.sub(r'~~.*?~~','',s,flags=re.S)
def clean(t):
 t=re.sub(r'^#+\s*','',t.strip());t=t.replace('**','').strip('*').strip();return re.sub(r'^[🔴🟡🔵]\s*','',t)
lines=[clean(l) for l in s.splitlines() if clean(l)]
parsed={}
for t in lines:
 m=re.match(r'^(\d+(?:\.\d+)*|aa1|[1-4]a)[.\-\s]*(¿.*)',t)
 if m:parsed.setdefault(m[1],[]).append(m[2])
mapping=[('respondent','1'),('reason','2'),('emergency_level','2.1'),('emergency_options','2.1'),('emergency_group','aa1'),('infant_emergency','1a'),('pregnancy_emergency','2a'),('older_emergency','3a'),('disability_emergency','4a'),('age','3'),('sex','4'),('has_children','4.1'),('children_count','4.1.1'),('pregnant','4.1.2'),('pregnancy_months','4.1.3'),('weight','5'),('height','6'),('bmi_consent','7'),('onset','8'),('location','9'),('location_description','9.2'),('severity','10'),('history','11'),('history_detail','12'),('medications','13'),('medications_details','13.1'),('medications_knows_active','13.2'),('medications_identity','13.4'),('remedies','14'),('remedies_detail','14.1'),('allergies','15'),('allergy_timing','15.1'),('allergy_reaction','15.2'),('pets','15.3'),('pets_detail','15.4'),('cancer_diabetes','16'),('cancer_diabetes_detail','16.1'),('hereditary','17'),('hereditary_since','17.1'),('hereditary_relatives','17.2'),('hereditary_relative_age','17.3'),('degenerative','18'),('degenerative_since','18.1'),('sti','19'),('sti_since','19.1'),('physical_activity','20'),('activity_detail','20.1'),('healthy_diet','21'),('avoids_processed','21.1'),('unhealthy_food','22'),('city','23'),('city_since','23.1'),('origin','24'),('origin_visits','24.1'),('travel','25'),('travel_where','25.1'),('travel_duration','25.2'),('travel_frequent','25.3'),('medical_visits','26'),('medical_last','26.1'),('medical_reason','26.2'),('medical_treatment','26.3'),('lab_tests','27'),('lab_which','27.1'),('lab_results','27.2'),('lab_review','27.3'),('sleep','28'),('sleep_medications','28.1'),('occupation','29'),('work_hours','29.1'),('alcohol','30'),('alcohol_current','30.1'),('alcohol_detail','30.2'),('alcohol_past','30.2'),('smoking','31'),('smoking_current','31.1'),('smoking_detail','31.2'),('smoking_past','31.2'),('drugs','32'),('drugs_current','32.1'),('drugs_detail','31.2'),('drugs_past','31.2'),('protection','33'),('partners','33.1'),('donated','34'),('donated_when','34.1'),('answers_confirmation','35')]
yesno=set('has_children pregnant bmi_consent history medications medications_knows_active remedies allergies pets cancer_diabetes hereditary degenerative sti physical_activity healthy_diet avoids_processed origin_visits travel travel_frequent medical_visits medical_treatment lab_tests lab_review sleep_medications alcohol alcohol_current smoking smoking_current drugs drugs_current protection donated answers_confirmation'.split())
items=[]
overrides={'pets_detail':'¿Cuál o cuales tipo de mascota y cuanto tienes)', 'alcohol_detail':'¿Cada cuanto tiempo consumes y desde hace cuanto tiempo?', 'alcohol_past':'¿Hace cuanto tiempo consumió y durante cuanto tiempo aproximadamente?', 'drugs_detail':'¿Cada cuanto consumes  y desde hace cuanto tiempo?', 'drugs_past':'¿Hace cuanto tiempo consumió y durante cuanto tiempo aproximadamente?'}
for id,num in mapping:
 index=1 if id in ['emergency_options','smoking_past'] else 0
 text=overrides.get(id) or parsed[num][index]
 items.append(dict(id=id,number=num,text=text,kind='yesno' if id in yesno else 'options' if id=='emergency_options' else 'group' if id=='emergency_group' else 'text'))
options=[]
for letter in 'abcdefg':
 if letter=='a':options.append(dict(value=letter,label=next(t for t in lines if t.startswith('a.-'))));continue
 title=next(t for t in lines if t.startswith(letter+'. '))
 idx=lines.index(title);question=lines[idx+1]
 start=next(i for i in range(idx+1,len(lines)) if lines[i]==letter*2+'1.')+1
 stop=next(i for i in range(start,len(lines)) if ('maps.app.goo.gl' in lines[i] or lines[i].startswith('HOSPITAL GENERAL')))
 paras=[]
 for t in lines[start:stop]:
  t=re.sub(r'(?:\\~\\~)?<(?:\\~\\~)?poner[^>]*>','',t,flags=re.I)
  t=t.replace('\\~','').strip().removeprefix('* ').removeprefix('\\- ')
  if t:
   if paras and re.search(r'No hacer:',paras[-1],re.I):paras[-1]+='\n'+t
   else:paras.append(t)
 options.append(dict(value=letter,label=title,question=question,paragraphs=paras))
# Explicit selection stages keep the source's list wording; no generated medical options.
for key,num,until in [('hereditary_choice','17', '17.1'),('degenerative_choice','18','18.1'),('sti_choice','19','19.1')]:
 start=next(i for i,t in enumerate(lines) if re.match(r'^'+num+r'[.\-\s]*¿',t))
 stop=next(i for i in range(start+1,len(lines)) if lines[i].startswith(until))
 choices=[]
 for t in lines[start:stop]:
  m=re.match(r'^(\d+)\\\.\s*(.*)',t)
  if m and int(m[1])<=9:choices.append(dict(value=m[1],label=m[1]+'. '+m[2]))
 assert len(choices)==9,(key,choices)
 items.append(dict(id=key,number=num,text='',kind='condition',choices=choices))
old=json.loads((r/'backend/paso23/content.json').read_text())
content=dict(version='paso23-local-v2',sourceSha256=hashlib.sha256(original.read_bytes()).hexdigest(),questions=items,emergencyOptions=options,recheckOptions=[],hospitals=old['hospitals'],decisions=dict(struckTextActive=False,alertByLevel=False,group5Target='age',bmiConsentRequired=True,adultMinAge=20,stiOptions='first_nine_of_upload',diet21_1Target='unhealthy_food',questionTextOverrides=overrides))
(r/'backend/paso23/content.json').write_text(json.dumps(content,ensure_ascii=False,indent=2)+'\n')
print(len(items),'questions extracted')
