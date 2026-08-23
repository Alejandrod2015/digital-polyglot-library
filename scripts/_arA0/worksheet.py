# -*- coding: utf-8 -*-
import json, sys, re
words = json.load(open("/tmp/ar_words.json", encoding="utf-8"))
st = json.load(open("/tmp/ar_a0.json", encoding="utf-8"))
keys = list(words.keys())
freq = {}
for k in keys:
    for x in words[k]:
        if x["e"] == "libre": freq[x["w"]] = x["n"]
i = int(sys.argv[1])
k = keys[i]
mios = {x["w"] for x in words[k]}
nofree = [f'{x["w"]}({x["e"][0]})' for x in words[k] if x["e"] != "libre"]
sing = [x["w"] for x in words[k] if x["e"] == "libre" and x["n"] == 1]
ricos = sorted([(w, n) for w, n in freq.items() if w not in mios and n >= 3], key=lambda kv: -kv[1])
print(f"[{i}] {st[i]['topic']}#{st[i]['slotIndex']}  {st[i]['title']}")
print(f"NO LIBRES ({len(nofree)}): " + " ".join(nofree))
print(f"SINGLETONS ({len(sing)}): " + " ".join(sing))
print("LIBRES RICOS QUE LE FALTAN: " + " ".join(f"{w}·{n}" for w, n in ricos[:45]))
