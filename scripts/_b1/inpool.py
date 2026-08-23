# Dice que tokens del texto (stdin) estan en el pool limpio, y cuales no.
import sys, re, unicodedata
pool = set(open("scripts/_b1/pool-limpio.txt", encoding="utf-8").read().split("\n"))
t = sys.stdin.read()
toks = re.findall(r"[a-záéíóúñü]+", t.lower())
seen, si, no = [], [], []
for w in toks:
    if w in seen: continue
    seen.append(w)
    (si if w in pool else no).append(w)
print("EN POOL:", " ".join(si))
print()
print("FUERA:", " ".join(no))
