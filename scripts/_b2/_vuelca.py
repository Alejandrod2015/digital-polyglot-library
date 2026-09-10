"""Vuelca un tema: texto, superficies de vocab y frases de practica. python3 scripts/_b2/_vuelca.py 2"""
import json,sys
for s in json.load(open(f"scripts/_b2/t{sys.argv[1]}.json")):
    print(f"\n######## {s['slotIndex']} {s['slug']} | {s['title']}")
    print(s['text'])
    print("VOCAB:", " · ".join(v.get('surface') or v['word'] for v in s['vocab']))
    for e in json.load(open(f"scripts/_sets/{s['slug']}.json")):
        if e['type']=='meaning_in_context': print("  SET", e['word'], "|", e['sentence'])
