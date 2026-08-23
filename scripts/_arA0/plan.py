# -*- coding: utf-8 -*-
"""Plan de reescritura del lexico: por historia, que palabra de un solo uso
conviene cambiar y por cual de las que estan a 2-3 historias."""
import json, collections, re, sys
w = json.load(open("/tmp/ar_words.json", encoding="utf-8"))
d = json.load(open("/tmp/ar_a0.json", encoding="utf-8"))
keys = list(w.keys())
NOM = {"julieta","damián","emanuel","facundo","brenda","leandro","agustina","yamila",
       "córdoba","aráoz","warnes","corrientes","lea","facu","villa","crespo"}
ANCLA = {"mate","termo","yerba","medialuna","fiado","birome","canilla","vereda","kiosco","remis",
         "milanesas","rotisería","escribano","pocillo","heladera","campera","tiras","ambo","peluquería"}
cnt = {}
for k in keys:
    for x in w[k]:
        if x["e"] in ("libre", "blando") and x["w"] not in NOM and len(x["w"]) > 2:
            cnt[x["w"]] = x["n"]
c = collections.Counter(cnt.values())
print("corpus:", len(cnt), "candidatos ·", {k: c[k] for k in sorted(c)}, "\n")
# los que estan a 2 o 3: una o dos apariciones mas y llegan a cuatro historias
casi = sorted([(x, n) for x, n in cnt.items() if n in (2, 3)], key=lambda t: -t[1])
print(f"a 3 historias ({sum(1 for _, n in casi if n == 3)}): " +
      " ".join(x for x, n in casi if n == 3))
print(f"\na 2 historias ({sum(1 for _, n in casi if n == 2)}): " +
      " ".join(x for x, n in casi if n == 2))
print("\n== por historia: unicas que se pueden soltar ==")
for i, k in enumerate(keys):
    mios = {x["w"] for x in w[k]}
    unicas = [x["w"] for x in w[k] if x["e"] == "libre" and x["n"] == 1
              and x["w"] not in ANCLA and x["w"] not in NOM and len(x["w"]) > 3]
    falta3 = [x for x, n in casi if n == 3 and x not in mios]
    print(f"\n[{i+1}] {k}")
    print("   sueltas: " + " ".join(unicas[:18]))
    print("   a 3 y le faltan: " + " ".join(falta3[:22]))
