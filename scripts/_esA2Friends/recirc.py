# Solo lectura: escalera acumulada con la misma regla que journey-vocab-recirculation
# (token para palabra suelta; subcadena de surface o de word para multipalabra).
import json, re, sys
hist = [s for f in sys.argv[1:] for s in json.load(open(f))]
textos = [s["text"].lower().replace("’", "'") for s in hist]
cuerpos = [set(re.findall(r"[^\W\d_]+", t)) for t in textos]
def n(v):
    k = re.sub(r"^(der|die|das|le|la|el|il|o|a)\s+", "", str(v.get("surface") or v["word"]).lower())
    if " " not in k: return sum(k in c for c in cuerpos)
    lema = v["word"].lower()
    return sum((k in t) or (lema in t) for t in textos)
port = [(i, v) for i, s in enumerate(hist) for v in s["vocab"] if not v.get("anchor")]
anc = sum(1 for s in hist for v in s["vocab"] if v.get("anchor"))
cnt = [(i, v, n(v)) for i, v in port]
solos = [v["surface"] for i, v, k in cnt if k <= 1]
media = sum(k for *_, k in cnt) / len(cnt)
tot = len(cnt) + anc
print(f"historias {len(hist)} · portables {len(cnt)} · media {media:.2f} · cola {len(solos)}/{len(cnt)} = {100*len(solos)/len(cnt):.0f}% · ancladas {anc}/{tot} = {100*anc/tot:.0f}%")
if len(sys.argv) > 2:
    t1 = json.load(open(sys.argv[1])); t2txt = [s["text"].lower() for s in json.load(open(sys.argv[2]))]
    t2c = [set(re.findall(r"[^\W\d_]+", t)) for t in t2txt]
    vuelven = []
    for s in t1:
        for v in s["vocab"]:
            if v.get("anchor"): continue
            k = str(v.get("surface") or v["word"]).lower()
            ok = any(k in c for c in t2c) if " " not in k else any((k in t) or (v["word"].lower() in t) for t in t2txt)
            if ok: vuelven.append(v["surface"])
    print(f"portables del primer fichero que vuelven en el segundo: {len(vuelven)}: {', '.join(vuelven)}")
print("solo una vez:", ", ".join(solos))
