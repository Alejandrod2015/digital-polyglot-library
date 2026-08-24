# -*- coding: utf-8 -*-
"""Mide el borrador `_a1latamV3.json` en las tres cosas que la acotacion puede
romper: la banda de habla citada (25-35 EXCLUSIVE), las citas que quedan SIN
ANCLAR y las superficies de vocab que hayan desaparecido del cuerpo.

Una cita esta anclada si el narrador dice quien habla pegado a ella, antes o
despues: `“...”, pregunta Elena` vale igual que `Julio contesta: “...”`. Lo que
no vale es la volea muda, cerrar una cita y abrir otra sin nada en medio, que es
donde el lector se pone a contar turnos. Ojo: `_acotacion.ts` mide otra cosa
(si hay narracion al lado, la nombre o no) y por eso daba 97% con 36 voleas."""
import json, re, sys

VERBO = (r"dice|pregunta|contesta|responde|avisa|explica|pide|insiste|aclara|"
         r"ofrece|repite|comenta|añade|agrega|sigue|corta|suelta|se queja|"
         r"se defiende|sopla|se da cuenta|se acomoda|conforma|promete|escribe|empieza|se ríe|grita|suelta|avisa|añade")
D = json.load(open("scripts/_a1latamV3.json", encoding="utf-8"))
def pal(t): return len([x for x in t.split() if x])

def sin_anclar(texto):
    """Citas cuyo hablante no queda dicho ni antes ni despues."""
    sueltas = []
    for par in [p.strip() for p in texto.split("\n\n") if p.strip()]:
        for m in re.finditer(r"“[^”]*”", par):
            antes, despues = par[:m.start()], par[m.end():]
            # El clitico se cuela entre la coma y el verbo: ", le explica Ana".
            ancla_post = re.match(r"\s*,?\s*(?:le |les |me |nos )?(?:%s)\b" % VERBO,
                                  despues, re.I)
            # El ancla previa no siempre pega el verbo a los dos puntos:
            # "Julio insiste antes de cortar:" y "Ana le sopla al oido:" anclan
            # igual de bien. Basta con que la oracion que abre los dos puntos
            # traiga un verbo de habla.
            ancla_prev = bool(re.search(r"(?:%s)[^.:]{0,30}:\s*$" % VERBO, antes, re.I))
            if not (ancla_post or ancla_prev):
                sueltas.append(m.group(0)[:44])
    return sueltas

malos = 0
print("| # | historia | pal | citado | sin anclar | vocab fuera |")
for i, s in enumerate(D, 1):
    t = s["text"]
    dentro = sum(pal(m.group(1)) for m in re.finditer(r"“([^”]*)”", t))
    pct = 100 * dentro / pal(t)
    sueltas = sin_anclar(t)
    bajo = t.lower()
    fuera = [(v.get("surface") or v["word"]) for v in s["vocab"]
             if (v.get("surface") or v["word"]).lower() not in bajo]
    mal = pct <= 25 or pct >= 35 or sueltas or fuera
    malos += bool(mal)
    print(f"| {i} | {s['title'][:34]} | {pal(t)} | {pct:.1f}% | {len(sueltas)} | {', '.join(fuera) or '-'} |{'  <<<' if mal else ''}")
    if sueltas and "-v" in sys.argv:
        for q in sueltas: print(f"       {q}")
print(f"\n{malos} historias con algo que arreglar")
sys.exit(1 if malos else 0)
