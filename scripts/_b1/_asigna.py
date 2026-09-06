# Reparte las palabras de una historia entre los trozos escritos a mano.
# Cada palabra cae en el trozo que la CONTIENE y que sale de su propia frase;
# lo que no encaje se lista, que es donde hace falta un trozo nuevo.
import json, re, sys, unicodedata
def norm(s): return unicodedata.normalize("NFC", s.lower())
def run(skel_path, chunks, out_path):
    sk = json.load(open(skel_path, encoding="utf-8"))
    res, huerf = {}, []
    for w, info in sk.items():
        wn = norm(w)
        cands = [c for c in chunks if re.search(r"(?<!\w)" + re.escape(wn) + r"(?!\w)", norm(c["es"]))]
        # el trozo bueno es el que sale de la frase donde la palabra aparece
        mejor = next((c for c in cands if norm(c["es"]) in norm(info["frase"])), None) or (cands[0] if cands else None)
        if not mejor: huerf.append(f'{w} <- {info["frase"][:60]}'); continue
        res[w] = {"es": mejor["es"], "en": mejor["en"]}
    json.dump(res, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{out_path.split('/')[-1]}: asignadas {len(res)} · sin trozo {len(huerf)}")
    for h in huerf: print("   ", h)
