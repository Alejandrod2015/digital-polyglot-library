import json,html,subprocess,sys
S='/private/tmp/claude-501/-Users-alejandrodelcarpio-digital-polyglot-library/7e4f9667-7057-4deb-9d2c-91c1c4b88c2c/scratchpad'
tema=sys.argv[1]; etiqueta=sys.argv[2]
def dur(f): return float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f],capture_output=True,text=True).stdout)
tits=[s['title'] for s in json.load(open(f"{S}/piloto/tema{tema}.json"))]
filas=""
for n in (1,2,3):
    O=f"t{tema}-historia{n}"
    segs=json.load(open(f"{S}/piloto/segments-t{tema}-{n}.json"))
    marcas=json.load(open(f"{O}/marcas.json"))
    d=dur(f"{O}/t{tema}-historia{n}-final.mp3")
    rows=""
    for i,(sp,txt) in enumerate(segs):
        quien="Superior (narrador)" if sp=="narrator" else ("Gaby (Mariana)" if sp=="Mariana" else "Javier (Nicolás)")
        m=marcas.get(str(i))
        rows+=(f'<li class="{"m" if m else ""}"><b>{i}. {html.escape(quien)}</b>{" <span class=tag>revisar</span>" if m else ""}'
               f'<div class=t>{html.escape(txt)}</div>'+(f'<div class=w>{html.escape(m)}</div>' if m else "")
               +f'<audio controls preload=none src="p-s{i:02d}.mp3"></audio></li>')
    open(f"{O}/index.html","w").write(f'''<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>{html.escape(tits[n-1])}</title>
<style>body{{font:15px system-ui;max-width:720px;margin:32px auto;padding:0 16px;background:#faf8f4;color:#222}}
ul{{padding:0}}li{{list-style:none;padding:12px 0;border-bottom:1px solid #e5e0d8}}audio{{width:100%;margin-top:8px}}
.t{{color:#444;margin-top:2px}}.m{{background:#fdf3e3;border-left:3px solid #d98324;padding-left:10px}}
.tag{{font-size:11px;background:#d98324;color:#fff;border-radius:3px;padding:1px 6px;vertical-align:2px}}
.w{{font-size:13px;color:#8a5a12;margin-top:4px}}small{{color:#666}}h2{{font-size:15px;margin:26px 0 6px}}</style>
<h1>{html.escape(tits[n-1])}</h1>
<p><small>Tema {tema}, historia {n} de 3 · Superior narra · Gaby es Mariana · Javier es Nicolás</small></p>
<h2>Historia completa · {d:.1f} s</h2>
<audio controls preload=metadata src="t{tema}-historia{n}-final.mp3"></audio>
<h2>Fragmento por fragmento</h2><ul>{rows}</ul>''')
    filas+=f'<li><b>{n}. {html.escape(tits[n-1])}</b> · {d:.1f} s · <a href="{O}/">abrir</a></li>'
idx=open("index.html").read()
bloque=f'<h2>Tema {tema}: {html.escape(etiqueta)}</h2><ul>{filas}</ul>\n<p><small>Superior narra'
idx=idx.replace('<p><small>Superior narra', bloque, 1)
open("index.html","w").write(idx)
print("paginas del tema", tema, "listas")
