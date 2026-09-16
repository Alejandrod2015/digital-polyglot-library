#!/usr/bin/env python3
"""Barrido de cobertura v2: transcribe cada master con whisper.cpp local
(gratis) CON timestamps por palabra, y alinea contra el texto guardado con
difflib.SequenceMatcher (tolera ortografia distinta: "goutte" vs "goute",
"voula" vs "vous la"), no comparacion exacta palabra por palabra. Solo los
tramos DELETE de 3+ palabras (texto sin nada parecido en lo oido) cuentan
como hueco candidato. Cada candidato se ancla a un tiempo real (la palabra
oida justo antes y justo despues) y se comprueba con silencedetect antes de
reportarlo.

Uso: python3 scripts/_coverageSweep.py <manifest.json>
manifest.json: [{"slug": ..., "text": ..., "url": ...}, ...]
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from difflib import SequenceMatcher

WHISPER_CLI = "/opt/homebrew/bin/whisper-cli"
MODEL = "/Users/alejandrodelcarpio/digital-polyglot-library/scripts/tts/whisper-models/ggml-small.bin"


def norm(w: str) -> str:
    return re.sub(r"[^0-9a-zà-öø-ÿœ]", "", w.lower())


def whisper_words(mp3_path: str):
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "a.wav")
        subprocess.run(
            ["ffmpeg", "-v", "error", "-i", mp3_path, "-ar", "16000", "-ac", "1",
             "-c:a", "pcm_s16le", wav, "-y"], check=True)
        out = os.path.join(td, "a")
        subprocess.run(
            [WHISPER_CLI, "-m", MODEL, "-l", "fr", "-np", "-ml", "1", "-ojf", "-of", out, wav],
            check=True, capture_output=True)
        with open(out + ".json", "rb") as fh:
            data = json.loads(fh.read().decode("utf-8", errors="replace"))
    words = []
    for seg in data["transcription"]:
        raw = seg["text"]
        if not raw.strip():
            continue
        start = seg["offsets"]["from"] / 1000.0
        end = seg["offsets"]["to"] / 1000.0
        if raw.startswith(" ") or not words:
            words.append([raw.strip(), start, end])
        else:
            words[-1][0] += raw.strip()
            words[-1][2] = end
    return [(w, s, e) for w, s, e in words if norm(w)]


def silences(mp3_path: str, noise="-35dB", d=0.15):
    r = subprocess.run(
        ["ffmpeg", "-i", mp3_path, "-af", f"silencedetect=noise={noise}:d={d}", "-f", "null", "-"],
        capture_output=True, text=True)
    out = []
    ini = None
    for m in re.finditer(r"silence_(start|end): ([\d.]+)", r.stderr):
        if m.group(1) == "start":
            ini = float(m.group(2))
        elif ini is not None:
            out.append((ini, float(m.group(2))))
            ini = None
    return out


def gap_covered_by_silence(t0, t1, sils, min_ratio=0.5):
    """El hueco [t0,t1] esta cubierto por silencio si la union de silencios
    dentro de ese rango cubre al menos min_ratio de su duracion. Un hueco de
    contenido real (frase omitida) es CASI TODO silencio; uno falso (solo un
    problema de ortografia) tendra voz de sobra ahi."""
    span = max(0.01, t1 - t0)
    covered = 0.0
    for a, b in sils:
        lo, hi = max(a, t0), min(b, t1)
        if hi > lo:
            covered += hi - lo
    return covered / span


def find_duplicates(heard, window=6):
    """Busca un tramo de `window`+ palabras OIDAS que se repite dos veces
    (contenido duplicado en el audio). Compara ventanas deslizantes exactas
    sobre lo oido (no hace falta tolerancia: una repeticion real sale de la
    MISMA sintesis, con la misma ortografia)."""
    norms = [norm(w) for w, _, _ in heard]
    seen = {}
    dups = []
    i = 0
    n = len(norms)
    while i + window <= n:
        key = tuple(norms[i:i + window])
        if key in seen:
            j = seen[key]
            dups.append({
                "text": " ".join(w for w, _, _ in heard[i:i + window]),
                "t0_primera": heard[j][1], "t1_primera": heard[j + window - 1][2],
                "t0_segunda": heard[i][1], "t1_segunda": heard[i + window - 1][2],
            })
            i += window  # salta el tramo duplicado, no lo vuelvas a contar
        else:
            seen[key] = i
            i += 1
    return dups


def main():
    manifest_path = sys.argv[1]
    stories = json.load(open(manifest_path))
    confirmados = []
    descartados = []
    duplicados_todos = []
    for s in stories:
        slug = s["slug"]
        text = s["text"]
        url = s["url"]
        print(f"=== {slug} ===", file=sys.stderr)
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tf:
            mp3_path = tf.name
        subprocess.run(["curl", "-s", "-o", mp3_path, url], check=True)
        try:
            heard = whisper_words(mp3_path)
            text_words = [w for w in re.split(r"\s+", text) if norm(w)]
            text_norm = [norm(w) for w in text_words]
            heard_norm = [norm(w) for w, _, _ in heard]

            dups = find_duplicates(heard)
            for d in dups:
                d["slug"] = slug
                duplicados_todos.append(d)
                print(f"  DUPLICADO {d['t0_primera']:.2f}-{d['t1_primera']:.2f} y {d['t0_segunda']:.2f}-{d['t1_segunda']:.2f} :: {d['text']}", file=sys.stderr)

            sm = SequenceMatcher(None, text_norm, heard_norm, autojunk=False)
            gaps = []
            for tag, i1, i2, j1, j2 in sm.get_opcodes():
                if tag == "equal":
                    continue
                run_len = i2 - i1
                if tag == "delete" and run_len >= 3:
                    # ancla: ultima palabra oida ANTES del hueco (j1-1) y
                    # primera palabra oida DESPUES (j1, mismo indice porque
                    # nada se consumio del lado oido).
                    before = heard[j1 - 1] if j1 > 0 else None
                    after = heard[j1] if j1 < len(heard) else None
                    t0 = before[2] if before else 0.0
                    t1 = after[1] if after else t0 + 3.0
                    gaps.append({
                        "text": " ".join(text_words[i1:i2]),
                        "t0": t0, "t1": t1,
                        "before": before[0] if before else None,
                        "after": after[0] if after else None,
                    })
                elif tag == "replace" and run_len >= 3 and (j2 - j1) < run_len * 0.4:
                    # el texto tiene MUCHAS mas palabras que lo oido en ese
                    # tramo: mismo patron que delete pero con algo de ruido
                    # de por medio, no una sustitucion 1:1.
                    before = heard[j1 - 1] if j1 > 0 else None
                    after = heard[j2] if j2 < len(heard) else None
                    t0 = before[2] if before else (heard[j1][1] if j1 < len(heard) else 0.0)
                    t1 = after[1] if after else t0 + 3.0
                    gaps.append({
                        "text": " ".join(text_words[i1:i2]),
                        "t0": t0, "t1": t1,
                        "before": before[0] if before else None,
                        "after": after[0] if after else None,
                    })

            if not gaps:
                print("  sin huecos", file=sys.stderr)
                continue

            sils = silences(mp3_path)
            for g in gaps:
                ratio = gap_covered_by_silence(g["t0"], g["t1"], sils)
                row = {
                    "slug": slug, "texto": g["text"],
                    "t0": round(g["t0"], 2), "t1": round(g["t1"], 2),
                    "silencio_ratio": round(ratio, 2),
                    "entre": f'{g["before"]!r} -> {g["after"]!r}',
                }
                if ratio >= 0.5:
                    confirmados.append(row)
                    print(f"  CONFIRMADO {g['t0']:.2f}-{g['t1']:.2f} ({ratio:.2f} silencio) :: {g['text']}", file=sys.stderr)
                else:
                    descartados.append(row)
                    print(f"  descartado (ruido, {ratio:.2f} silencio) :: {g['text']}", file=sys.stderr)
        finally:
            os.unlink(mp3_path)

    print(json.dumps({"confirmados": confirmados, "descartados": descartados, "duplicados": duplicados_todos}, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
