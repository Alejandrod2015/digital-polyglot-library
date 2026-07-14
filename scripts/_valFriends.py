#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pre-validador journey ES C1 LATAM "Friends" (project_journey_es_c1_friends).
Molde = _valHamburg.py, adaptado al español C1 conversacional con slang.
Checks: defs EN 8-14 palabras, ratio dialogo >=70%, turns <=30, surfaces
literales en texto, nouns <=45%, >=2 expressions, CERO digitos en body,
sin em-dash (body+defs), sin risas/filler/stage-directions, apertura no-reloj,
speaker labels de UNA palabra. Escribe JSON validos a scratchpad si TODO pasa.
Uso: python3 scripts/_valFriends.py <OUT_DIR> [data.json]"""
import json, re, sys, os

OUT_DIR = sys.argv[1] if len(sys.argv) > 1 else "/tmp/friends"
DATA = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "_friendsT1_data.json")
os.makedirs(OUT_DIR, exist_ok=True)

# Speaker label: UNA palabra, empieza con mayuscula (acentos incluidos).
SPEAKER_RE = re.compile(r"^([A-ZÁÉÍÓÚÑ][a-záéíóúñü]+):\s(.+)$")
# Risas y muletillas-sonido (feedback_no_filler_sounds): NO interjecciones lexicas
# (orale, hijole, uy, ah quedan permitidas; se banean solo risas y hmm/mmm/ehh).
FILLER_RE = re.compile(r"(?<![\wáéíóúñ])(jaj[aei]*|jej[ei]*|jij[ei]*|ja+j+a+|hm+|mmm+|ehh+|muaja+)(?![\wáéíóúñ])", re.I)

def wc(s): return len([w for w in re.split(r"\s+", s.strip()) if w])

def check_story(d):
    errs, warns = [], []
    body = d["text"]
    # 1. digitos en body
    if re.search(r"\d", body): errs.append(f"DIGIT in body: {re.findall(r'.{0,12}\d.{0,12}', body)}")
    # 2. em-dash en body o defs
    if "—" in body or "–" in body: errs.append("em-dash in body")
    for v in d["vocab"]:
        if "—" in v["definition"] or "–" in v["definition"]:
            errs.append(f"em-dash in def {v['word']}")
    # 3. risas / muletillas / stage directions
    for f in set(m.lower() for m in FILLER_RE.findall(body)):
        errs.append(f"filler/laughter token in body: '{f}'")
    if re.search(r"\((?:r[ií]e|riendo|risas|carcajada|susurr|gui[ñn]|suspir|grita|llor|gru[ñn])", body.lower()):
        errs.append("stage direction in ()")
    # 4. parrafos -> ratio dialogo + turns + speaker labels de UNA palabra
    paras = [p for p in body.split("\n") if p.strip()]
    dialog_words = narr_words = turns = 0
    speakers = set()
    for p in paras:
        m = SPEAKER_RE.match(p.strip())
        if m:
            turns += 1
            speakers.add(m.group(1))
            dialog_words += wc(m.group(2))
        else:
            # una linea con "Palabra Palabra:" (label multi-palabra) es error comun
            mm = re.match(r"^([A-ZÁÉÍÓÚÑ][\wáéíóúñü]+ [\wáéíóúñü]+):\s", p.strip())
            if mm: errs.append(f"speaker label is multi-word: '{mm.group(1)}'")
            narr_words += wc(p)
    spoken = dialog_words + narr_words
    dial_pct = round(dialog_words * 100 / spoken) if spoken else 0
    if dial_pct < 70: errs.append(f"dialogue ratio {dial_pct}% < 70 (dial {dialog_words}w / narr {narr_words}w)")
    if turns > 30: errs.append(f"{turns} turns > 30")
    total_words = wc(body)
    if not (240 <= total_words <= 330): warns.append(f"body {total_words}w (target ~260-315)")
    # 5. vocab defs 8-14 EN, surfaces literales, tipos, nouns<=45%, >=2 expr
    nouns = exprs = 0
    for v in d["vocab"]:
        w = wc(v["definition"])
        if not (8 <= w <= 14): errs.append(f"def '{v['word']}' = {w}w (need 8-14): {v['definition']}")
        surf = v.get("surface") or v["word"]
        if surf not in body: errs.append(f"surface '{surf}' ({v['word']}) NOT literal in body")
        t = v["type"]
        if t == "noun": nouns += 1
        if t == "expression": exprs += 1
        if t not in {"verb","noun","adjective","adverb","expression","slang","preposition"}:
            errs.append(f"bad type {v['word']}={t}")
    nvoc = len(d["vocab"])
    if not (20 <= nvoc <= 25): warns.append(f"{nvoc} vocab items")
    npct = round(nouns * 100 / nvoc) if nvoc else 0
    if npct > 45: errs.append(f"nouns {nouns}/{nvoc} = {npct}% > 45%")
    if exprs < 2: errs.append(f"only {exprs} expressions (need >=2)")
    # 6. apertura no-reloj
    first = paras[0]
    body_first = SPEAKER_RE.match(first)
    ftxt = body_first.group(2) if body_first else first
    if re.match(r"^(Eran las |Son las |A las (una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)|Es la una|Era la una|Faltaban? |Pasadas las |Dieron las |Al filo de las |A eso de las )", ftxt):
        errs.append(f"opening looks like a clock template: {ftxt[:50]}")
    return errs, warns, dict(words=total_words, dial=dial_pct, turns=turns, speakers=sorted(speakers),
                             vocab=nvoc, nouns=f"{nouns}({npct}%)", exprs=exprs)

def last_dialogue_speaker(body):
    last = "(narr)"
    for p in [p for p in body.split("\n") if p.strip()]:
        m = SPEAKER_RE.match(p.strip())
        if m: last = m.group(1)
    return last

STORIES = json.load(open(DATA, encoding="utf-8"))
allok = True
closers, opens = [], []
for d in STORIES:
    errs, warns, stats = check_story(d)
    closers.append((d["slotIndex"], last_dialogue_speaker(d["text"])))
    m0 = SPEAKER_RE.match(d["text"].split("\n")[0])
    opens.append((d["slotIndex"], (m0.group(2) if m0 else d["text"].split("\n")[0])[:45]))
    tag = "OK " if not errs else "FAIL"
    print(f"\n=== {tag} {d['topic']}#{d['slotIndex']} \"{d['title']}\" [{d['arcType']}] {stats}")
    for e in errs: print("   FAIL", e)
    for w in warns: print("   warn", w)
    if errs: allok = False
    else:
        json.dump(d, open(os.path.join(OUT_DIR, f"{d['topic']}_{d['slotIndex']}.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)

print("\n--- GESTALT ---")
print("closers:", closers)
print("openings:", opens)
print("\nALL PASS" if allok else "\nHAS FAILS -> not all written")
sys.exit(0 if allok else 1)
