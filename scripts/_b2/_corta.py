"""Aplica reemplazos exactos (cada uno debe aparecer UNA vez) a un tema y escribe tNcorto.json.
   python3 scripts/_b2/_corta.py N reemplazos.json   (lista de [slot, viejo, nuevo]); base: tNcorto.json si existe, si no tN.json"""
import json,sys,os
n=sys.argv[1]; base=f"scripts/_b2/t{n}corto.json"
d=json.load(open(base if os.path.exists(base) else f"scripts/_b2/t{n}.json"))
for slot,a,b in json.load(open(sys.argv[2])):
    s=[x for x in d if x['slotIndex']==slot][0]
    c=s['text'].count(a)
    if c!=1: sys.exit(f"slot {slot}: '{a}' aparece {c} veces")
    s['text']=s['text'].replace(a,b)
json.dump(d,open(base,'w'),ensure_ascii=False,indent=2)
