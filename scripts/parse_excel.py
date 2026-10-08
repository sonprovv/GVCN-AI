import sys
import json
import zipfile
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding='utf-8')

excel_path = r'C:\Users\Dell\Downloads\Mau_Nhap_Hoc_Sinh_12A5.xlsx'
z = zipfile.ZipFile(excel_path)
shared_strings = []
if 'xl/sharedStrings.xml' in z.namelist():
    tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
    for si in tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
        t = si.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
        if t is not None:
            shared_strings.append(t.text or '')
        else:
            text = ''.join([node.text or '' for node in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')])
            shared_strings.append(text)

rows = []
tree = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
for r in tree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
    row_data = {}
    for c in r.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
        ref = c.get('r')
        col = ''.join([ch for ch in ref if ch.isalpha()])
        v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
        val = v.text if v is not None else ''
        if c.get('t') == 's' and val.isdigit():
            val = shared_strings[int(val)]
        row_data[col] = val
    rows.append(row_data)

students = []
for r in rows[1:]:
    stt = r.get('A', '')
    name = r.get('B', '')
    birth = r.get('C', '')
    gender = r.get('D', '')
    team = r.get('E', '')
    role = r.get('F', '')
    p_name = r.get('G', '')
    p_rel = r.get('H', '')
    p_phone = r.get('I', '')
    p_email = r.get('J', '')
    notes = r.get('K', '')
    if name:
        students.append({
            'stt': int(stt) if stt.isdigit() else len(students)+1,
            'name': name.strip(),
            'birthDate': birth.strip(),
            'gender': gender.strip(),
            'team': team.strip(),
            'role': role.strip(),
            'parentName': p_name.strip(),
            'parentRelation': p_rel.strip(),
            'parentPhone': p_phone.strip(),
            'parentEmail': p_email.strip(),
            'notes': notes.strip()
        })

print(json.dumps(students, ensure_ascii=False))
