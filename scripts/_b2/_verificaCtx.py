import json, sys, subprocess
slug = sys.argv[1]
f = f"scripts/_b2/_ctx_{slug}.json"
t = json.load(open(f))
r = subprocess.run(["npx","tsx","scripts/_b2/_dbText.ts",slug], capture_output=True, text=True, cwd=".")
text = r.stdout.lower()
bad = [(k, v["es"]) for k, v in t.items() if v["es"].lower() not in text]
long = [(k, v["es"]) for k, v in t.items() if len(v["es"].split()) > 8]
print(f"{slug}: {len(t)} entradas · no-literal: {bad or 'ninguno'} · largo>8: {long or 'ninguno'}")
