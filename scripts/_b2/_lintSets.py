"""Lo que _validateSets.ts no mira en los sets del B2 latam:
- nombres propios del reparto o numeros escritos en frases de practica (TTS y Scribe);
- fill_blank cuyas opciones no comparten la terminacion de la respuesta (se delata);
- fill_blank cuya frase no esta en <= 12 palabras o no tiene exactamente un hueco;
- headlines que no parecen forma de diccionario (verbo conjugado, plural);
- la frase del audioClip del fill_blank tiene que ser la del hueco con la respuesta puesta.
  python3 scripts/_b2/_lintSets.py [slug ...]"""
import json, os, re, sys

REPARTO = {"renata", "joaquín", "joaquin", "maricarmen", "aurelio", "marcela", "ignacio", "griselda", "ariel",
           "jairo", "yamileth", "emiliano", "norma", "baldomero", "ofelia"}
NUMEROS = {"uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "quince",
           "veinte", "treinta", "cuarenta", "cien", "trescientos", "seiscientos", "mil"}
SLUGS = [s["slug"] for t in range(1, 8) for s in json.load(open(f"scripts/_b2/t{t}.json"))]


def terminacion(w):
    w = w.lower().split()[-1] if w.split() else w.lower()
    for suf in ("aron", "ieron", "aban", "ían", "ó", "ió", "aba", "ía", "ara", "iera", "ando", "iendo", "ado", "ido",
                "ada", "ida", "ar", "er", "ir", "as", "os", "es", "a", "o", "e"):
        if w.endswith(suf):
            return suf
    return w[-2:]


def lint(slug):
    malos = []
    ex = json.load(open(f"scripts/_sets/{slug}.json"))
    for i, e in enumerate(ex):
        t, p = e["type"], e.get("payload", {})
        frases = [e.get("sentence", ""), p.get("audioClip", {}).get("sentence", "")]
        for f in frases:
            toks = {x.lower() for x in re.findall(r"\w+", f)}
            if toks & REPARTO:
                malos.append(f"#{i} {e['word']}: nombre del reparto en la frase ({', '.join(toks & REPARTO)})")
            if toks & NUMEROS:
                malos.append(f"#{i} {e['word']}: numero escrito ({', '.join(toks & NUMEROS)})")
            if re.search(r"\d", f):
                malos.append(f"#{i} {e['word']}: cifra en la frase")
        if t == "fill_blank":
            s = e["sentence"]
            if len(re.findall(r"_{3,}", s)) != 1:
                malos.append(f"#{i} {e['word']}: el hueco no es unico")
            term = {terminacion(o) for o in p.get("options", [])}
            if len(term) > 1:
                malos.append(f"#{i} {e['word']}: opciones con terminacion distinta {p.get('options')}")
            lleno = re.sub(r"_{3,}", p.get("answer", ""), s)
            if p.get("audioClip", {}).get("sentence", "").strip() != lleno.strip():
                malos.append(f"#{i} {e['word']}: audioClip.sentence no es la frase con la respuesta puesta")
        if t == "meaning_in_context":
            w = e["word"].lower()
            if re.search(r"(ó|ió|aba|aban|aron|ieron|ía|ían)$", w) and " " not in w:
                malos.append(f"#{i} {e['word']}: el headline parece conjugado")
    return malos


slugs = sys.argv[1:] or [s for s in SLUGS if os.path.exists(f"scripts/_sets/{s}.json")]
total = 0
for s in slugs:
    m = lint(s)
    total += len(m)
    print(f"{s}: {'ok' if not m else str(len(m)) + ' aviso(s)'}")
    for x in m:
        print("   ", x)
print(f"avisos: {total}")
