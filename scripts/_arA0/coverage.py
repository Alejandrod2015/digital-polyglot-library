# -*- coding: utf-8 -*-
import json, sys, os, re, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from core import CORE
st = json.load(open("/tmp/ar_a0.json", encoding="utf-8"))
tok = lambda t: set(re.findall(r"[\wáéíóúñü]+", t.lower(), re.UNICODE))
sets = [tok(s["text"]) for s in st]
freq = {w: sum(1 for S in sets if w in S) for w in CORE}
print("CORE con pocas apariciones (objetivo 8+):")
bajos = sorted([(w, n) for w, n in freq.items() if n < 8], key=lambda kv: kv[1])
print("  " + " ".join(f"{w}({n})" for w, n in bajos))
print(f"\ncore total encuentros {sum(freq.values())} sobre {len(CORE)} palabras (media {sum(freq.values())/len(CORE):.1f})")
if len(sys.argv) > 1:
    i = int(sys.argv[1])
    falta = [w for w in CORE if w not in sets[i] and freq[w] < 12]
    print(f"\n[{st[i]['topic']}#{st[i]['slotIndex']}] {st[i]['title']}")
    print("  FALTAN: " + " ".join(falta))
