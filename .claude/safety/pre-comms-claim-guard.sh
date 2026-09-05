#!/usr/bin/env bash
# PreToolUse: ningún correo que ANUNCIE algo sale sin comprobar que ese algo
# se ve en TODAS las superficies a las que el correo manda al lector.
#
# WHY (2026-08-30): el 28/08 salieron 12 correos "We heard your feedback"
# anunciando la capa de contexto de las glosas. Se veía en web y en ninguna de
# las dos apps, y el botón del correo, en un móvil, lleva a TestFlight o a
# Play, justo donde no se veía. El portón 6f de `pre-bash-guard.sh` comprueba
# la AUTORIZACIÓN (que el usuario nombre el correo) y nada más: nadie
# comprobaba si lo que el correo promete es verdad. Autorizado no es cierto.
#
# El fichero de comprobación lo escribe Claude, así que no prueba nada por sí
# solo: lo que hace el portón es OBLIGAR a nombrar cada superficie y a pegar
# su prueba, y ademas cruza dos hechos que sí son mecánicos (árbol limpio y
# HEAD subido). Previsualizar y `--dry` pasan siempre.

DPL_HOOK_PAYLOAD="$(cat)"; export DPL_HOOK_PAYLOAD
RESULT="$(/usr/bin/python3 - <<'PY'
import json, os, re, time, subprocess

def out(*a): print(" ".join(a)); raise SystemExit

try:
    p = json.loads(os.environ.get("DPL_HOOK_PAYLOAD", ""))
except Exception:
    out("PASS")
if (p.get("tool_name") or "") != "Bash":
    out("PASS")
cmd = (p.get("tool_input") or {}).get("command", "") or ""

# Los mismos disparadores que el portón de autorización, más el envío suelto.
#
# La lista se mantiene A LA PAR con la del 6f en `pre-bash-guard.sh`. El
# 2026-09-05 esta era mas corta y le faltaba lo que de verdad importa: la RUTA
# del cron. Un `curl` al endpoint no nombra ninguna funcion, asi que manda los
# correos de verdad y este porton ni se entera; solo fallo porque el secreto de
# produccion no coincidia con el local. Un endpoint que envia es un remitente,
# se llame por funcion o por URL.
SENDERS = re.compile(
    r"send" r"BetaEmail|run" r"BetaLifecycle|publish" r"Release"
    r"|_sendImprovementToReaders|_runBetaTriage|processApplication"
    r"|invite" r"Applicant|decline" r"Applicant|waitlist" r"Applicant"
    r"|send" r"PersonalNote|_personalNote|_coldNote"
    r"|send" r"LifecycleEmail|run" r"LifecycleEmails|send" r"WelcomeEmail"
    r"|send" r"BetaConfirmationEmail|send" r"ClaimEmail"
    r"|api\.resend\.com|resend\.emails\.send"
    r"|/api/cron/(?:beta-lifecycle|lifecycle-emails|claim-reminders)", re.I)

# Un comando que solo es git no envia nada, y sin embargo caia aqui: el
# porton lee el CONTENIDO de cualquier .ts que nombres, y el motor del
# calendario contiene el nombre de la funcion que envia. Resultado, el
# 2026-09-05: `git add src/lib/<el motor>.ts` bloqueado como si fuera un envio.
# Se comprueban TODOS los segmentos, para que un `git add x && curl ...` siga
# entrando por la puerta de siempre.
def solo_git(c):
    segs = [s.strip() for s in re.split(r"&&|\|\||;|\||\n", c) if s.strip()]
    if not segs:
        return False
    for s in segs:
        toks = s.split()
        i = 0
        while i < len(toks) and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", toks[i]):
            i += 1
        if i >= len(toks) or toks[i] != "git":
            return False
    return True

if solo_git(cmd):
    out("PASS")

hay = cmd
for m in re.finditer(r"(?:^|\s)((?:scripts|src)/[\w./-]+\.(?:ts|tsx|js|mjs))", cmd):
    try:
        hay += "\n" + open(m.group(1), encoding="utf-8", errors="ignore").read()
    except Exception:
        pass

if not SENDERS.search(hay):
    out("PASS")
if re.search(r"(^|\s)--dry(\s|$)", cmd) or "_renderBetaEmails" in cmd:
    out("PASS")

F = ".claude/safety/comms-claim-check.json"
try:
    chk = json.load(open(F, encoding="utf-8"))
except Exception:
    out("BLOCK", "falta " + F)

if float(chk.get("expires_at_epoch") or 0) < time.time():
    out("BLOCK", "la comprobacion ha caducado, rehazla")

claim = (chk.get("claim") or "").strip()
if len(claim.split()) < 5:
    out("BLOCK", "`claim` tiene que decir, en una frase, que vera el lector")

sup = chk.get("surfaces") or []
nombres = {(s.get("name") or "").lower() for s in sup}
faltan = {"web", "ios", "android"} - nombres
if faltan:
    out("BLOCK", "sin respuesta para: " + ", ".join(sorted(faltan)))

for s in sup:
    n = (s.get("name") or "?").lower()
    if not s.get("live"):
        out("BLOCK", "el anuncio no se ve en " + n)
    if len((s.get("evidence") or "").split()) < 4:
        out("BLOCK", "sin prueba pegada para " + n)

def git(*a):
    try:
        return subprocess.run(("git",) + a, capture_output=True, text=True, timeout=20).stdout.strip()
    except Exception:
        return ""

sucio = [l for l in git("status", "--porcelain").splitlines()
         if re.match(r"^.{2}\s*(src/|apps/mobile/src/|prisma/)", l)]
if sucio:
    out("BLOCK", "hay cambios sin commitear en src/ o apps/mobile/src/")

if git("rev-list", "--count", "origin/main..HEAD") not in ("", "0"):
    out("BLOCK", "hay commits sin subir a main")

out("PASS")
PY
)"

if [ "${RESULT%% *}" = "BLOCK" ]; then
  cat >&2 <<MSG
[comms-claim] BLOQUEADO: ${RESULT#BLOCK }

Un correo que anuncia algo no sale hasta comprobar que ese algo se VE en
todas las superficies a las que el propio correo manda al lector. El boton
\`/go/app\`, en un movil, lleva a TestFlight o a Play; en escritorio, al
lector web. Son tres superficies, y las tres cuentan.

Escribe .claude/safety/comms-claim-check.json asi:

{
  "kind": "improvement",
  "claim": "una frase con lo que el correo dice que el lector vera",
  "expires_at_epoch": <ahora + 3600>,
  "surfaces": [
    {"name": "web",     "live": true, "evidence": "que miraste y donde"},
    {"name": "ios",     "live": true, "evidence": "build publicada, no la local"},
    {"name": "android", "live": true, "evidence": "build publicada, no la local"}
  ]
}

\`live: false\` en cualquiera de las tres BLOQUEA: se arregla la superficie o
se reescribe el correo para no prometerla. La prueba de iOS y de Android es
la version que esta EN LA TIENDA, nunca la que tienes instalada a mano.

Previsualizar sigue libre: _renderBetaEmails.ts y cualquier \`--dry\`.
MSG
  exit 2
fi
exit 0
