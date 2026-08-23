import json, io, re, unicodedata
S=json.load(io.open("scripts/_b1/data/all.json",encoding="utf-8"))
pool=set(io.open("scripts/_b1/pool-limpio.txt",encoding="utf-8").read().split("\n"))
NO=set(re.search(r'NO_PLAZA = new Set\(\("([^"]+)"',io.open("scripts/_b1/asignar.ts",encoding="utf-8").read()).group(1).split(" "))
deb=lambda w: unicodedata.normalize("NFD",w).encode("ascii","ignore").decode()
tok=lambda t: set(re.findall(r"[a-záéíóúñü]{3,}",t.lower()))
pares=0; dist=set()
for s in S:
    ok=[w for w in tok(s["text"]) if w in pool and deb(w) not in NO]
    pares+=len(ok); dist.update(ok)
plazas=sum(len(s["vocab"]) for s in S)
print(f"pares (palabra,cuerpo) con plaza legitima: {pares}")
print(f"palabras distintas: {len(dist)}   plazas que hay que llenar: {plazas}")
print(f"TECHO DURO = pares / plazas = {pares/plazas:.2f}")
print(f"para 2,0 harian falta {2.0*plazas/len(S):.0f} palabras con plaza legitima por cuerpo; hay {pares/len(S):.0f}")
