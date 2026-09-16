"""Regresion del gate F0 sobre fixtures reales (scripts/_f0fixtures/).

Cada fila dice que espera el GENERADOR DE PALABRAS, que usa el gate invertido:
una palabra se publica cuando el gate dice ok=false (no sube).

  medible   la toma se puede medir (antes caian por el piso del medidor)
  sube      el gate la ve subir -> el generador la RE-TIRA

Correr: ~/.cache/dpl-qa/venv/bin/python scripts/testF0Gate.py
"""
import json, subprocess, sys, glob, os

PY = os.path.expanduser("~/.cache/dpl-qa/venv/bin/python")
FIX = "scripts/_f0fixtures"

# (fixture, medible, sube). None = no se exige.
CASOS = [
    # --- los dos que bloqueaban el publish del FR B1. Re-tiros REALES de
    # ElevenLabs guardados el 2026-09-16: 5 de 6 no se podian medir.
    ("retiro_chic_t1",    True,  False),
    ("retiro_chic_t2",    True,  False),
    ("retiro_chic_t3",    True,  False),
    ("retiro_propre_t1",  True,  False),
    ("retiro_propre_t3",  True,  False),
    # 3 frames sonoros (30 ms): esto SI es demasiado poco. Debe seguir sin medirse.
    ("retiro_propre_t2",  False, None),
    # --- uptalk que debe SEGUIR detectandose (si no, el gate no sirve) ---
    ("sube_cestvrai",     True,  True),
    ("sube_tuviens",      True,  True),
    # monosilabas interrogativas: la regla del endpoint era CIEGA aqui
    # (+2.2 y +1.3 st, por debajo del umbral de 4.0) y las daba por afirmacion.
    ("sube_chic",         True,  True),
    ("sube_propre",       True,  True),
]

def veredicto(name):
    p = subprocess.run([PY, "scripts/_f0gate.py", f"{FIX}/{name}.mp3", "question"],
                       capture_output=True, text=True)
    if p.returncode != 0:
        raise SystemExit(f"gate fallo en {name}: {p.stderr[:200]}")
    return json.loads(p.stdout)

fallos = []
for name, medible_esp, sube_esp in CASOS:
    v = veredicto(name)
    medible = v["end"] is not None
    if medible != medible_esp:
        fallos.append(f"{name}: medible={medible}, esperado {medible_esp} ({v['reason']})")
        continue
    if sube_esp is not None and medible and v["ok"] != sube_esp:
        fallos.append(f"{name}: sube={v['ok']}, esperado {sube_esp} (slope {v['slope']} end {v['end']})")
    print(f"  ok  {name:20} medible={medible} sube={v['ok']} {v.get('window','')}")

# Los 14 clips YA PUBLICADOS del journey no pueden cambiar de veredicto: si
# alguno pasara a "sube", el arreglo habria roto material que ya esta bien.
for f in sorted(glob.glob(f"{FIX}/aprobado_*.mp3")):
    n = os.path.basename(f)[:-4]
    v = veredicto(n)
    if v["end"] is None or v["ok"]:
        fallos.append(f"{n}: clip ya publicado cambia de veredicto (ok={v['ok']}, {v['reason']})")
    else:
        print(f"  ok  {n:28} sigue aceptado")

if fallos:
    print("\nFALLOS:"); [print("  -", x) for x in fallos]; sys.exit(1)
print(f"\n{len(CASOS)} casos + 14 clips publicados: todo en verde")
