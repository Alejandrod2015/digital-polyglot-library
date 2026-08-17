#!/bin/bash
# Stop hook: EL AUDIO DE UNA HISTORIA SE OYE EN LA HISTORIA (2026-08-17)
#
# WHY: la regla lleva escrita desde el 2026-08-16 (memoria
# feedback_audition_links_clickable, sección "AUDIO DE UNA HISTORIA COMPLETA →
# EL LECTOR, NO EL MP3") y se rompió igual dos veces: tras una tanda de
# empalmes, la URL que uno tiene delante es la del máster en R2, porque es lo
# que imprimen los scripts, y se pega tal cual. Esa URL es el artefacto de
# TRABAJO. El usuario necesita oír la frase dentro de su historia, con su
# texto, su karaoke y sus píldoras de vocab, que es donde se nota si el audio
# y el texto casan. Una regla que solo vive en la memoria no es una regla.
#
# QUÉ HACE: lee el ÚLTIMO mensaje del asistente y BLOQUEA el cierre (exit 2)
# si entrega audio de producción de una historia (un mp3 bajo
# media/generated/audio/ o media/multivoice-segments/ en R2) sin dar, al
# menos, tantos enlaces de lector /stories/<slug> como historias entrega.
#
# NO BLOQUEA:
#   - un mensaje sin ninguna URL de audio de historia
#   - una MUESTRA de voz suelta: no vive bajo esos prefijos (va a
#     media/review/ o es local), y no tiene historia donde vivir
#   - el máster citado JUNTO a su enlace de lector (ej. rollback documentado)
#
# Sin variable de escape, a propósito.

set -uo pipefail
PAYLOAD="$(cat)"

RESULT="$(printf '%s' "$PAYLOAD" | /usr/bin/python3 -c '
import json, sys, os, re

try:
    payload = json.load(sys.stdin)
except Exception:
    print("skip:no_payload"); sys.exit(0)

# Nunca re-bloquear un stop ya bloqueado: evita el bucle infinito.
if payload.get("stop_hook_active"):
    print("skip:already_active"); sys.exit(0)

tp = payload.get("transcript_path") or ""
if not tp or not os.path.exists(tp):
    print("skip:no_transcript"); sys.exit(0)

texts = []
try:
    with open(tp) as f:
        for line in f:
            try:
                obj = json.loads(line)
            except Exception:
                continue
            if obj.get("type") != "assistant":
                continue
            content = obj.get("message", {}).get("content", "")
            if isinstance(content, str):
                texts.append(content)
            elif isinstance(content, list):
                buf = [p.get("text", "") for p in content
                       if isinstance(p, dict) and p.get("type") == "text"]
                if buf:
                    texts.append("\n".join(buf))
except Exception:
    print("skip:read_error"); sys.exit(0)

if not texts:
    print("skip:no_assistant_msg"); sys.exit(0)

msg = texts[-1] or ""
if not msg.strip():
    print("skip:empty"); sys.exit(0)

# Audio de PRODUCCIÓN de una historia: el máster y sus fragmentos. Una muestra
# de voz de una o dos líneas no vive aquí, y por eso no dispara el gate.
STORY_AUDIO = re.compile(
    r"https?://[^\s)\"\x27<>]*/media/(?:generated/audio|multivoice-segments)/[^\s)\"\x27<>]+\.mp3",
    re.I)
READER = re.compile(r"/stories/([a-z0-9][a-z0-9-]*)", re.I)

audios = set(STORY_AUDIO.findall(msg))
if not audios:
    print("ok:no_story_audio"); sys.exit(0)

lectores = set(m.lower() for m in READER.findall(msg))
if len(lectores) >= len(audios):
    print("ok:linked"); sys.exit(0)

print("BLOCK:%d:%d:%s" % (len(audios), len(lectores), sorted(audios)[0][:160]))
sys.exit(0)
')"

case "$RESULT" in
    BLOCK:*)
        rest="${RESULT#BLOCK:}"
        n_audio="${rest%%:*}"; rest="${rest#*:}"
        n_link="${rest%%:*}"; ejemplo="${rest#*:}"
        cat >&2 <<EOF
BLOQUEADO: el audio de una historia se entrega EN la historia
(.claude/safety/stop-story-audio-link-guard.sh).

Tu mensaje entrega $n_audio audio(s) de producción y solo $n_link enlace(s)
de lector. Ejemplo del mp3 suelto:
  $ejemplo

Esa URL es tu artefacto de trabajo, no el del usuario. Él tiene que oír la
frase DENTRO de su historia: con el texto delante, el karaoke y las píldoras
de vocab, que es donde se ve si el audio y el texto casan.

Reescribe la entrega así:
  - un enlace markdown por historia a
    http://localhost:3000/stories/<slug>
    (localhost es donde el usuario revisa; producción solo si él lo pide);
    el dev server tiene que estar arriba y respondiendo 200 ANTES de darlo;
  - di el minuto exacto que hay que oír, no la URL del mp3;
  - un journey en draft se ve en el lector añadiendo su id a
    PREVIEW_JOURNEY_IDS, que está en src/app/journey/journeyData.ts Y en
    src/lib/journeyStories.ts.
El mp3 crudo solo vale para una MUESTRA de voz de una o dos líneas, que no
tiene historia donde vivir.
EOF
        exit 2
        ;;
    *)
        exit 0
        ;;
esac
