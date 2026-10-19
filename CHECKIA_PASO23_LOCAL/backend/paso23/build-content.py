"""Reextrae textos del respaldo del usuario sin corregir su redacción."""
from pathlib import Path
import re
import json
import hashlib

root = Path(__file__).resolve().parents[2]
original = root / 'docs/paso23/ORIGINAL_USUARIO.md'
s = original.read_text().split('##### \\-------------------------------------------------------------------------')[0]
def clean(x):
    return re.sub(r'</?(?:i|b)>', '', x).replace('~~', '').replace('**', '').replace('&#x20;', ' ').strip()
q = {}
for line in s.splitlines():
    t = clean(line).strip('*')
    m = re.match(r'^(\d+(?:\.\d+)*|[1-4]a)(?:[.\-]+|\s)*\s*((?:¿|Si tienes dolor|Descríbeme).*)', t)
    if m:
        q.setdefault(m[1], []).append(m[2])
items = []
def add(id, num, text, kind='text'):
    items.append(dict(id=id, number=num, text=text, kind=kind))
add('respondent', '1', q['1'][0])
add('reason', '2', q['2'][0])
add('emergency_level', '2.1', q['2.1'][0])
add('emergency_options', '2.1', q['2.1'][1], 'options')
add('emergency_group', 'aa1', '¿Es un bebe(1)embarazada(2)adulto tercera edad(3)discapacitado(4),no es emergencia(5)>', 'group')
for id, num in [('infant_emergency','1a'), ('pregnancy_emergency','2a'), ('older_emergency','3a'), ('disability_emergency','4a')]:
    add(id, num, q[num][0])
mapping = [('age','3'), ('sex','4'), ('has_children','4.1'), ('children_count','4.1.1'), ('pregnant','4.1.2'), ('pregnancy_months','4.1.3'), ('weight','5'), ('height','6'), ('alarm_recheck','7'), ('onset','8'), ('location','9'), ('location_description','9.2'), ('severity','10'), ('history','11'), ('history_detail','12'), ('medications','13'), ('medications_details','13.1'), ('medications_knows_active','13.2'), ('medications_identity','13.4'), ('remedies','14'), ('remedies_detail','14.1'), ('allergies','15'), ('allergy_timing','15.1'), ('allergy_reaction','15.2'), ('pets','15.3'), ('family_history','16'), ('family_condition','16.1'), ('family_relative','17'), ('physical_activity','18'), ('activity_detail','18.1'), ('healthy_diet','19'), ('avoids_processed','19.1'), ('unhealthy_food','20'), ('city','21'), ('origin','22'), ('travel','23')]
yesno = {'has_children','pregnant','history','medications','medications_knows_active','remedies','allergies','pets','family_history','physical_activity','healthy_diet','avoids_processed','travel'}
for id, num in mapping:
    add(id, num, q[num][0], 'recheck' if id == 'alarm_recheck' else 'yesno' if id in yesno else 'text')
add('answers_confirmation', '16', q['16'][1], 'yesno')
options = []
for letter in 'abcdefg':
    if letter == 'a':
        text = next(clean(l).strip('*') for l in s.splitlines() if l.strip().startswith('*a.-'))
        options.append(dict(value=letter, label=text))
        continue
    m = re.search(r'###### \*\*' + letter + r'\.(.*?)\*\*\s+(¿[^\n]+)', s)
    block = s[m.end():]
    stop = re.search(r'\n(?:######|\*\*3\.)', block)
    if stop:
        block = block[:stop.start()]
    start = re.search(letter * 2 + r'1\.', block)
    block = block[start.start():]
    paras = [clean(p) for p in re.split(r'\n\s*\n', block) if clean(p)]
    paras = [p for p in paras if not any(x in p for x in ['maps.app.goo.gl', 'docs.google.com'])]
    paras = [re.sub(r'<poner[^>]*>', '', p) for p in paras]
    options.append(dict(value=letter, label=letter + '.' + m[1], question=m[2], paragraphs=paras))
rechecks = [clean(l) for l in s[s.index('**7.'):].splitlines() if re.match(r'^[a-h]\.\-', clean(l))]
hospitals = [dict(label=label,url=url) for label,url in [
    ('HOSPITAL GENERAL PUBLICO CANCÚN','https://maps.app.goo.gl/qxRa93CMcFx8SPaU9'),
    ('HOSPITAL IMSS URGENCIAS CANCÚN','https://maps.app.goo.gl/1zB3MtMiEW2PsRTt7'),
    ('HOSPITALES PRIVADOS CANÇÚN','https://maps.app.goo.gl/QMwN4sfFLyYpNrpRA'),
    ('hospitales públicos de quintana roo','https://docs.google.com/document/d/18OXmmfO2w8QtXOLRd38TrUhuiEJpRiuEiLxNpM32OjA/edit?usp=sharing')]]
content = dict(version='paso23-local-v1', sourceSha256=hashlib.sha256(original.read_bytes()).hexdigest(), questions=items, emergencyOptions=options, recheckOptions=rechecks, hospitals=hospitals, decisions=dict(struckTextActive=True, oldFormBackupOnly=True, alertLevelMin=9, askChildrenBeforeCount=True))
assert len(options) == 7 and len(items) > 40 and len(rechecks) == 8
(root / 'backend/paso23/content.json').write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n')
print(f'{len(items)} preguntas, {len(options)} opciones, {len(rechecks)} señales de pregunta 7.')
