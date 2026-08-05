#!/usr/bin/env python3
"""Exercise guard 6f against the real hook. Builds the JSON payload directly so
no shell quoting can silently drop a trigger word, which is how an earlier
version of this test produced five false passes."""
import json, os, pathlib, subprocess, tempfile

HERE = pathlib.Path(__file__).resolve().parent
GUARD = str(HERE / "pre-bash-guard.sh")
CWD = str(HERE.parent.parent)

def transcript(last_user_message):
    fd, path = tempfile.mkstemp(suffix=".jsonl")
    with os.fdopen(fd, "w") as f:
        f.write(json.dumps({"type": "user", "message": {"content": last_user_message}}) + "\n")
    return path

def run(command, last_user_message):
    tp = transcript(last_user_message)
    payload = json.dumps({
        "transcript_path": tp,
        "tool_name": "Bash",
        "tool_input": {"command": command},
    })
    p = subprocess.run([GUARD], input=payload, capture_output=True, text=True, cwd=CWD)
    os.unlink(tp)
    # Exit 2 is a deliberate block, exit 0 is allow. Anything else is the guard
    # crashing, and it must NOT be reported as a block: the first version of
    # this harness folded every non-zero status into "BLOCK", which made a
    # guard dying on `set -e` look like a guard doing its job.
    if p.returncode == 2 or "BLOCKED" in (p.stdout + p.stderr):
        return "BLOCK"
    if p.returncode != 0:
        return f"CRASH({p.returncode})"
    return "PASS"

NO_VERB = "Seguro al 100%? Solo quiero saber."
VERB = "manda el correo a jaelyn"

GET = 'curl -s "https://api.resend.com/emails?limit=100" -H "Authorization: Bearer $RESEND_API_KEY"'

CASES = [
    # (label, command, last user message, expected)
    ("lectura GET a Resend",              GET, NO_VERB, "PASS"),
    ("lectura de UN correo por id",       'curl -s https://api.resend.com/emails/8dcd69dc -H "Authorization: Bearer $K"', NO_VERB, "PASS"),
    ("GET + pipe a python",               GET + " | python3 -c \"import json,sys; print(json.load(sys.stdin))\"", NO_VERB, "PASS"),
    ("envio explicito -X POST",           'curl -X POST https://api.resend.com/emails -H "Authorization: Bearer $K"', NO_VERB, "BLOCK"),
    ("envio con cuerpo -d",               'curl https://api.resend.com/emails -d \'{"to":"a@b.com"}\'', NO_VERB, "BLOCK"),
    ("envio con --data",                  'curl https://api.resend.com/emails --data @body.json', NO_VERB, "BLOCK"),
    ("envio con --json",                  'curl https://api.resend.com/emails --json @body.json', NO_VERB, "BLOCK"),
    ("GET con un sender colado detras",   GET + ' && npx tsx scripts/_personalNote.ts a@b.com slug --send', NO_VERB, "BLOCK"),
    ("GET con sendBetaEmail colado",      GET + ' ; npx tsx -e "sendBetaEmail()"', NO_VERB, "BLOCK"),
    ("_personalNote --send sin verbo",    'npx tsx scripts/_personalNote.ts a@b.com slug --send', NO_VERB, "BLOCK"),
    ("_personalNote --send CON verbo",    'npx tsx scripts/_personalNote.ts a@b.com slug --send', VERB, "PASS"),
    ("triaje real sin verbo",             'npx tsx scripts/_runBetaTriage.ts', NO_VERB, "BLOCK"),

    # Added after the first version read the `-d=` of `cut -d= -f2-` as a POST
    # body and blocked the read it existed to permit.
    ("GET con cut -d= en la tuberia",     'K=$(grep -hE "^RESEND_API_KEY=" .env | head -1 | cut -d= -f2-); curl -s "https://api.resend.com/emails" -H "Authorization: Bearer $K"', NO_VERB, "PASS"),
    ("GET de dominios",                   'curl -s https://api.resend.com/domains -H "Authorization: Bearer $K"', NO_VERB, "PASS"),
    ("GET con date -d en otro tramo",     'date -d yesterday; ' + GET, NO_VERB, "PASS"),
    ("cuerpo pegado sin espacio",         'curl https://api.resend.com/emails -d\'{"to":"a@b.com"}\'', NO_VERB, "BLOCK"),
    ("cuerpo -d sin comillas",            'curl https://api.resend.com/emails -d to=a@b.com', NO_VERB, "BLOCK"),
    ("cuerpo -d con arroba",              'curl https://api.resend.com/emails -d@body.json', NO_VERB, "BLOCK"),
    ("script tsx que nombra el proveedor",'npx tsx scripts/_x.ts # habla con api.resend.com', NO_VERB, "BLOCK"),
    ("interprete que postea",             'python3 -c "requests.post(\'https://api.resend.com/emails\')"', NO_VERB, "BLOCK"),
    ("GET seguido de bash script",        GET + ' && bash /tmp/enviar.sh', NO_VERB, "BLOCK"),

    # Every case above is a single line, which is why they all stayed green
    # while `grep -oc` was emitting one count PER LINE and handing the
    # arithmetic test a literal "0\n0".
    ("multilinea sin el proveedor",       'echo uno\necho dos\ngit status', NO_VERB, "PASS"),
    ("multilinea con lectura GET",        'echo comprobando\n' + GET + '\necho listo', NO_VERB, "PASS"),
    ("multilinea con envio real",         'echo preparando\nnpx tsx scripts/_personalNote.ts a@b.com slug --send', NO_VERB, "BLOCK"),
    ("multilinea, GET arriba y envio abajo", GET + '\nnpx tsx scripts/_runBetaTriage.ts', NO_VERB, "BLOCK"),

    # _coldNote writes to people who are not in the database yet, so it gets the
    # same treatment as _personalNote: previewing free, sending gated.
    ("_coldNote preview",                 'npx tsx scripts/_coldNote.ts beta-invite', NO_VERB, "PASS"),
    ("_coldNote --send sin verbo",        'npx tsx scripts/_coldNote.ts beta-invite --send', NO_VERB, "BLOCK"),
    ("_coldNote --send CON verbo",        'npx tsx scripts/_coldNote.ts beta-invite --send', VERB, "PASS"),
    # The exact phrasing that prompted this: an unmistakable instruction that
    # never names the mail. It must NOT open the gate.
    ("verbo suelto sin nombrar el correo",'npx tsx scripts/_coldNote.ts beta-invite --send', "manda tú", "BLOCK"),
]

fails = 0
for label, cmd, msg, expected in CASES:
    got = run(cmd, msg)
    ok = got == expected
    fails += 0 if ok else 1
    print(f"{'ok  ' if ok else 'FALLA'}  {label:34} esperado={expected:5} obtuvo={got}")

print()
print(f"{len(CASES) - fails}/{len(CASES)} correctos" if not fails else f"{fails} FALLOS")
raise SystemExit(1 if fails else 0)
