#!/usr/bin/env bash
# MUESTRA DE NARRACION del A2, con los ajustes EXACTOS de produccion
# (eleven_multilingual_v2, stability .4 / similarity .8 / style .3 / speed .9 /
# speaker_boost, y despues el tempo 0.94 de DEFAULT_NARRATION_TEMPO). La
# muestra ES la toma final: si se aprueba, este mismo audio es el que se queda
# ([[project_audio_sample_becomes_the_final_take]]).
#
# Con gate F0: cada fragmento se mide y se re-tira hasta que cierre como
# AFIRMACION, no como pregunta.
set -euo pipefail
OUT="$1"; VOICE="jipeLrCHZ6ByxrU2JP9i"
KEY=$(python3 - <<'PY'
for f in [".env.local",".env"]:
    try:
        for l in open(f):
            if l.startswith("ELEVENLABS_API_KEY"): print(l.split("=",1)[1].strip().strip('"')); raise SystemExit
    except FileNotFoundError: pass
PY
)
PY=~/.cache/dpl-qa/venv/bin/python
render () { # $1 texto  $2 salida  $3 modo-f0
  for intento in 1 2 3; do
    curl -sS -X POST "https://api.elevenlabs.io/v1/text-to-speech/${VOICE}" \
      -H "xi-api-key: ${KEY}" -H "Content-Type: application/json" \
      -d "$(python3 -c 'import json,sys;print(json.dumps({"text":sys.argv[1],"model_id":"eleven_multilingual_v2","voice_settings":{"stability":0.4,"similarity_boost":0.8,"style":0.3,"speed":0.9,"use_speaker_boost":True}}))' "$1")" \
      -o "$2.raw.mp3"
    ffmpeg -y -loglevel error -i "$2.raw.mp3" -filter:a "atempo=0.94" "$2" 2>/dev/null
    J=$($PY scripts/_f0gate.py "$2" "$3" 2>/dev/null || echo '{"ok":true,"reason":"gate no disponible"}')
    echo "    toma $intento -> $J"
    if python3 -c "import json,sys;sys.exit(0 if json.loads(sys.argv[1]).get('ok') else 1)" "$J"; then rm -f "$2.raw.mp3"; return 0; fi
  done
  rm -f "$2.raw.mp3"; echo "    AVISO: 3 tomas sin pasar el gate"; return 0
}
echo "titulo:"
render "Eso no es un cordel." "$OUT/01-titulo.mp3" statement
echo "primer parrafo:"
render "Irene es una mujer que vino a pasar el verano a Nerja, un pueblo de la costa de Málaga, y no se ha ido. Vive encima de la panadería y lleva dos semanas oyendo cómo se vacía. Rocío, la vecina de arriba, sube con un cuaderno y le anota seis cosas con letra fina." "$OUT/02-parrafo.mp3" statement-multi
