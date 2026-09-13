# uso: python3 scripts/_deA0FriendsProbe.py t4 "0:der Stapel:Stapel,das Buch:Büchern" ...
# Genera un data de sondeo con TODAS las candidatas (definicion de relleno) para ver que marca el gate.
import json,sys
t=sys.argv[1]; d=json.load(open(f"scripts/_deA0Friends/{t}-texts.json"))
for arg in sys.argv[2:]:
    i,items=arg.split(":",1); i=int(i)
    d[i]["synopsis"]="Anna and her friends in Bremen, in one old house, on an ordinary day of the week."
    d[i]["vocab"]=[{"type":"noun" if w.split()[0] in("der","die","das") else "verb","word":w,"surface":s,"definition":"A probe definition with enough words here."} for w,s in (x.split("=") for x in items.split(","))]
json.dump(d,open(f"scripts/_deA0Friends/{t}-probe.json","w"),ensure_ascii=False,indent=1)
