# -*- coding: utf-8 -*-
"""La ESCALERA, no el gate. El gate cuenta la aparicion en la propia historia;
la escalera dice que el valor lo da el intervalo, asi que el reencuentro se
cuenta en OTRA historia y el intra-historia se reporta aparte."""
import json, re, collections
d = json.load(open("/tmp/ar_a0.json", encoding="utf-8"))
orden = [f'{s["topic"]}#{s["slotIndex"]}' for s in d]
tok = lambda t: re.findall(r"\w+", t.lower(), re.UNICODE)
cuerpos = [collections.Counter(tok(s["text"])) for s in d]
filas = []
for i, s in enumerate(d):
    for v in s["vocab"]:
        w = (v.get("surface") or v["word"]).lower()
        otras = [j for j in range(21) if j != i and cuerpos[j][w] > 0]
        filas.append({"w": w, "hist": i, "otras": len(otras), "intra": cuerpos[i][w],
                      "dist": [abs(j - i) for j in otras]})
n = len(filas)
sin = [f for f in filas if f["otras"] == 0]
print(f"plazas: {n}")
print(f"1. Reencuentro en OTRA historia (la cifra de la escalera)")
print(f"   media {sum(f['otras'] for f in filas)/n:.2f} encuentros en otra historia")
print(f"   SIN reencuentro: {len(sin)} ({100*len(sin)//n}%)  · referencia del catalogo: A0 41-44%, peor 82%")
c = collections.Counter(min(f["otras"], 9) for f in filas)
print("   reparto:", {k: c[k] for k in sorted(c)}, "(9 = nueve o mas)")
print(f"\n2. Encuentro 2, dentro de la propia historia (no vale lo mismo)")
print(f"   plazas que salen 2+ veces en su propio cuerpo: {sum(1 for f in filas if f['intra']>=2)} ({100*sum(1 for f in filas if f['intra']>=2)//n}%)")
print(f"\n3. La escalera pide CUATRO encuentros, ni menos ni mas")
lleg = sum(1 for f in filas if f["otras"] >= 3)
print(f"   llegan a 4 historias distintas (1 + 3 mas): {lleg} ({100*lleg//n}%)  · objetivo: el 70% portable")
exc = sum(1 for f in filas if f["otras"] >= 8)
print(f"   se pasan de largo (9+ historias): {exc} ({100*exc//n}%)  · la escalera dice 4, no 8")
print(f"\n4. Distancia del reencuentro (orden libre: solo cuenta que sean historias distintas)")
todas = [x for f in filas for x in f["dist"]]
print(f"   distancia media {sum(todas)/max(1,len(todas)):.1f} historias · vecinas (1-3): {100*sum(1 for x in todas if x<=3)//max(1,len(todas))}% · lejanas (6+): {100*sum(1 for x in todas if x>=6)//max(1,len(todas))}%")
print(f"\n5. Las tres ultimas historias reciclan?")
for i in (18, 19, 20):
    f = [x for x in filas if x["hist"] == i]
    recogidas = sum(1 for w in cuerpos[i] if any(w == (v.get("surface") or v["word"]).lower() for j in range(i) for v in d[j]["vocab"]))
    print(f"   {orden[i]:34} ensena {len(f)} · recoge {recogidas} palabras ya ensenadas antes")
