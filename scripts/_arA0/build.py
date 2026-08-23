# -*- coding: utf-8 -*-
import json, importlib, sys, os, re, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
out = []
for m in ["t1","t2","t3","t4","t5","t6","t7"]:
    out += importlib.import_module(m).STORIES
def slugify(t):
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return t
voc = {}
try:
    voc = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "vocab.json"), encoding="utf-8"))
except Exception:
    pass
for s in out:
    s["slug"] = slugify(s["title"])
    s["arcType"] = None
    s["vocab"] = voc.get(f'{s["topic"]}#{s["slotIndex"]}', [])
print(json.dumps(out, ensure_ascii=False, indent=1))
