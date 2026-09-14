"""Mide un fichero de historias del Friends IT A0: palabras, % citado, frases,
parrafos, y vocab contra lo ya enseñado en los tres journeys italianos
(incluido el de julio archivado, que el gate de saveStory no mira).

  python3 scripts/_itA0Friends/measure.py scripts/_itA0Friends/t1-data.json
"""
import json, re, statistics, sys, os

USED = set(json.load(open(os.environ.get("IT_USED", "/private/tmp/it_used_vocab.json"))))
ART = re.compile(r"^(il|lo|la|i|gli|le|l'|un|uno|una|un')\s*", re.I)


def base(w):
    return ART.sub("", w.lower().strip())


USED_BASE = {base(u) for u in USED}

data = json.load(open(sys.argv[1]))
for s in data:
    t = s["text"]
    words = re.findall(r"[A-Za-zÀ-ÿ']+", t)
    quoted = sum(len(re.findall(r"[A-Za-zÀ-ÿ']+", q)) for q in re.findall(r"“([^”]*)”", t))
    sents = [x for x in re.split(r"(?<=[.!?…])\s+|\n+", re.sub(r"[“”]", "", t)) if x.strip()]
    lens = [len(re.findall(r"[A-Za-zÀ-ÿ']+", x)) for x in sents]
    paras = [p for p in t.split("\n\n") if p.strip()]
    print(f"== {s['slotIndex']} {s['title']} ({len(s['title'])}c) · {len(words)} pal · citado {100*quoted/len(words):.1f}% · "
          f"{len(paras)} parr · mediana frase {statistics.median(lens)} max {max(lens)} · vocab {len(s.get('vocab', []))}")
    long = [x for x, n in zip(sents, lens) if n > 9]
    if long:
        print("   frases >9:", " | ".join(long))
    rep = [v["word"] for v in s.get("vocab", []) if base(v["word"]) in USED_BASE]
    if rep:
        print("   YA ENSEÑADAS en IT:", rep)
    miss = [v["surface"] for v in s.get("vocab", []) if v["surface"] not in t]
    if miss:
        print("   surface NO en cuerpo:", miss)
