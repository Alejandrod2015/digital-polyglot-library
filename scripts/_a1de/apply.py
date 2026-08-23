import json,sys,os,importlib
HERE=os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0,HERE)
base=json.load(open("/tmp/de-a1-all.json"))
P={}
for mod in sys.argv[1:]:
    P.update(importlib.import_module(mod).P)
slugs={x["slug"] for x in base}
unk=[k for k in P if k not in slugs]
assert not unk, ("UNKNOWN SLUGS",unk)
for s in base:
    p=P.get(s["slug"])
    if not p: continue
    s["arcType"]=p["arcType"]; s["synopsis"]=p["synopsis"]; s["text"]=p["text"]
    s["vocab"]=[{"type":t,"word":w,"surface":sf,"definition":d} for (t,w,sf,d) in p["vocab"]]
json.dump(base,open(HERE+"/work.json","w"),ensure_ascii=False,indent=1)
print("applied",len(P))
