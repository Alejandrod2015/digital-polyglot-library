import json, re, sys
D = sys.argv[1] if len(sys.argv) > 1 else "scripts/_frA0/pasada3"
data = {t: json.load(open(f"{D}/{t}.json")) for t in ("t1","t2","t3","t4","t5","t6","t7")}
st = [s for t in data for s in data[t]]
tok = lambda x: set(re.findall(r"[^\W\d_]+", x.lower()))
cu = [tok(s["text"]) for s in st]; tx = [s["text"].lower().replace("’","'") for s in st]
def clave(v): return re.sub(r"^(der|die|das|le|la|el|il|o|a)\s+", "", str(v.get("surface") or v["word"]).lower()).replace("’","'")
def enc(v):
    k = clave(v)
    if " " not in k and not re.fullmatch(r"[^\W\d_]+", k):
        r = re.compile(r"(?<![^\W\d_])" + re.escape(k) + r"(?![^\W\d_])"); return sum(1 for x in tx if r.search(x))
    if " " not in k: return sum(1 for c in cu if k in c)
    l = str(v["word"]).lower(); return sum(1 for x in tx if k in x or l in x)
port = [enc(v) for s in st for v in s["vocab"] if not v.get("anchor")]
suma = sum(port)
print(f"suma {suma} · media {suma/len(port):.4f} · sueltos {sum(1 for n in port if n<=1)} · para 2.6 faltan {max(0, 765-suma)} · tope sueltos 88")
W = lambda x: len(re.findall(r"[A-Za-zÀ-ÿœ'’-]+", x)); Q = lambda x: sum(W(m) for m in re.findall(r"“([^”]*)”", x))
print("fuera de vara:", [(f"{t}#{i}", W(s['text']), round(100*Q(s['text'])/W(s['text']))) for t in data for i, s in enumerate(data[t]) if W(s['text'])>145 or not 25 <= 100*Q(s['text'])/W(s['text']) <= 35] or "ninguna")
