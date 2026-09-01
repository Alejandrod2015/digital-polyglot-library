#!/usr/bin/env bash
# PreToolUse guard: no long dashes, em (U+2014) or en (U+2013), written into
# the repo's own code or content.
#
# WHY: the user's typographic rule is hard, but until 2026-08-16 the only gate
# was inside validateGeneratedStory, which covers JourneyStory bodies and
# nothing else. Every surface without a gate drifted: the journey page title
# rendered "Traveler — Portuguese A0" in the browser tab, the blog carried 69
# and the source comments 103. The lint (npm run lint:no-emdash) catches it
# after the fact; this hook catches it at the keystroke.
#
# Scope: Edit/Write/MultiEdit whose file_path is under src/, content/,
# apps/mobile/, scripts/, docs/ o public/, y cuyo contenido nuevo lo contiene.
# Fuera de alcance: node_modules, src/generated, vendor, los proyectos nativos
# de iOS y Android, los entornos virtuales de Python y los modelos de whisper.
#
# Los archivos exentos viven en scripts/no-emdash-allowlist.json, el MISMO
# archivo que lee el lint, para que hook y lint no se desincronicen.
#
# There is no env-var bypass. To write one deliberately, the USER says so in
# their latest message ("permite el em dash", "deja el guion largo").

DPL_HOOK_PAYLOAD="$(cat)"
export DPL_HOOK_PAYLOAD

RESULT="$(/usr/bin/python3 - <<'PY'
import json, os, re

DASHES = (("—", "em", "em dash"), ("–", "en", "en dash"))

raw = os.environ.get("DPL_HOOK_PAYLOAD", "")
try:
    p = json.loads(raw)
except Exception:
    print("PASS"); raise SystemExit

tool = p.get("tool_name") or ""
if tool not in ("Edit", "Write", "MultiEdit", "Bash"):
    print("PASS"); raise SystemExit

# Brazo Bash (2026-09-01). El gate escuchaba solo a Edit/Write/MultiEdit, asi
# que escribir el mismo fichero con un heredoc de python, un `sed -i` o un
# `tee` lo esquivaba entero sin querer. Aqui no hay `file_path`: se mira el
# texto del COMANDO, y solo cuando toca uno de los seis arboles vigilados.
if tool == "Bash":
    cmd = (p.get("tool_input") or {}).get("command", "") or ""
    LECTURA = ("grep", "rg", "cat", "less", "head", "tail", "sed -n",
               "awk", "wc", "diff", "git log", "git show", "git diff")
    if cmd.lstrip().startswith(LECTURA):
        print("PASS"); raise SystemExit
    if not any(("/" + r + "/") in cmd or cmd.count(r + "/") for r in
               ("src", "content", "apps/mobile", "scripts", "docs", "public")):
        print("PASS"); raise SystemExit
    malos = [n for ch, _k, n in DASHES if ch in cmd]
    if not malos:
        print("PASS"); raise SystemExit
    print("BLOCK\t" + ", ".join(malos) + "\tcomando Bash que escribe en el repo")
    raise SystemExit

ti = p.get("tool_input") or {}
fp = (ti.get("file_path") or "").replace("\\", "/")

ROOTS = ("src", "content", "apps/mobile", "scripts", "docs", "public")

# Ruta relativa a la raíz del repo, venga absoluta o relativa.
rel = fp
for r in ROOTS:
    i = fp.find("/" + r + "/")
    if i != -1:
        rel = fp[i + 1:]
        break
if not rel.startswith(tuple(r + "/" for r in ROOTS)):
    print("PASS"); raise SystemExit

# Nunca en alcance: dependencias vendidas, clientes generados, proyectos
# nativos, entornos virtuales y modelos.
if any(s in fp for s in ("/node_modules/", "/src/generated/", "/vendor/",
                         "/apps/mobile/ios/", "/apps/mobile/android/",
                         "/.next/", "/.expo/", "/.venv", "/__pycache__/",
                         "/whisper-models/", "/journey-shots/")):
    print("PASS"); raise SystemExit

# La MISMA allowlist que usa el lint, para que no se desincronicen. Va POR
# CARACTER: necesitar el en dash no exime del em dash.
allow = {}
roots_guess = [os.path.join(os.getcwd(), "scripts/no-emdash-allowlist.json")]
for r in ROOTS:
    marker = "/" + r + "/"
    if marker in fp:
        roots_guess.append(fp.split(marker)[0] + "/scripts/no-emdash-allowlist.json")
for cand in roots_guess:
    if cand and os.path.exists(cand):
        try:
            allow = json.load(open(cand, encoding="utf-8"))
            break
        except Exception:
            pass

def exempt(key):
    a = allow.get(key) or {}
    return rel in set(a.get("files", [])) or any(rel.startswith(x) for x in a.get("prefixes", []))

# What is being written?
incoming = []
if tool == "Write":
    incoming.append(ti.get("content", "") or "")
elif tool == "Edit":
    incoming.append(ti.get("new_string", "") or "")
elif tool == "MultiEdit":
    for e in ti.get("edits", []) or []:
        if isinstance(e, dict):
            incoming.append(e.get("new_string", "") or "")

offending = [name for ch, key, name in DASHES
             if any(ch in s for s in incoming) and not exempt(key)]
if not offending:
    print("PASS"); raise SystemExit

# The user can authorize it explicitly in their latest message.
tp = p.get("transcript_path") or ""
last = ""
if tp and os.path.exists(tp):
    msgs = []
    try:
        with open(tp) as f:
            for line in f:
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                if obj.get("type") != "user":
                    continue
                c = obj.get("message", {}).get("content", "")
                if isinstance(c, str):
                    msgs.append(c)
                elif isinstance(c, list):
                    for part in c:
                        if isinstance(part, dict) and part.get("type") == "text":
                            msgs.append(part.get("text", ""))
    except Exception:
        msgs = []
    if msgs:
        last = msgs[-1] or ""
        last = re.sub(r"<system-reminder>.*?</system-reminder>", "", last, flags=re.DOTALL | re.IGNORECASE)
        last = re.sub(r"<task-notification>.*?</task-notification>", "", last, flags=re.DOTALL | re.IGNORECASE)

authorized = re.search(
    r"\b(permit(e|o|ir)|dej(a|á|ar)|acept(a|o|ar))\b[^.\n]{0,40}\b(em[\s-]?dash|en[\s-]?dash|guion(es)?\s+larg[oa]s?|guión(es)?\s+larg[oa]s?|raya)\b",
    last, re.IGNORECASE)
print("PASS" if authorized else "BLOCK:" + "+".join(offending))
PY
)"

if [ "${RESULT#BLOCK}" != "$RESULT" ]; then
  cat >&2 <<'EOF'
[dash-guard] BLOQUEADO: estás escribiendo un guion largo (em o en) en código o
contenido del repo.

La regla es dura y aplica a TODO: copy de la app, blog, prompts, definiciones
de vocab, comentarios y mensajes de commit. Sustituye por:

  ;   dos cláusulas independientes      "no es un extra; es esencial"
  :   lo que sigue explica lo anterior  "Expat: German C1"
  ()  un inciso                          "alguien (o algo) aparecía"
  .   córtala en dos oraciones
  -   un rango o una celda vacía        "10-20", "sep-oct"

Comprueba el archivo entero con:  npm run lint:no-emdash

Exentos: los que están en scripts/no-emdash-allowlist.json bajo su carácter, o
sea el código que
BUSCA el carácter (validador de historias, pre-validadores, auditorías de
glosas) y src/data/books/**, prosa publicada cuyos tiempos de karaoke guardan
offsets de carácter sobre el texto. Añadir uno exige un motivo escrito.
EOF
  exit 2
fi
exit 0
