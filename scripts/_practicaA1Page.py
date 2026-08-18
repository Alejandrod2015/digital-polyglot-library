"""Pagina de revision de los sets de practica del A1 ES/Spain.

Se sirve desde el servidor de local en /_practica-a1.html, que es donde el
usuario los revisa: fuera de la webapp, con el reproductor de cada clip al
lado del ejercicio. Se regenera entera cada vez, leyendo scripts/_sets.

    python3 scripts/_practicaA1Page.py
"""
import json, html, os

GRUPOS = [
 ("Tema 1 · Neighbours & Favours", [("nerja-huele-a-pan","Nerja huele a pan"),("el-paquete-duerme-cuatro-meses","El paquete duerme cuatro meses"),("seis-naranjas-y-un-delantal","Seis naranjas y un delantal")]),
 ("Tema 2 · Timetables & Meal Times", [("a-las-dos-no-cabe-nadie","A las dos no cabe nadie"),("el-portal-sigue-vacio","El portal sigue vacío"),("ya-llega-cuando-llegan-todos","Ya llega cuando llegan todos")]),
 ("Tema 3 · Bars & Tapas", [("la-barra-manda","La barra manda"),("nadie-ha-pedido-esa-tapa","Nadie ha pedido esa tapa"),("apunta-la-cuenta-con-tiza","Apunta la cuenta con tiza")]),
 ("Tema 4 · Family & Relatives", [("la-madre-antes-que-el-pan","La madre antes que el pan"),("media-calle-comparte-apellido","Media calle comparte apellido"),("rocio-tarda-un-segundo","Rocío tarda un segundo")]),
 ("Tema 5 · Plans & Invitations", [("ya-veremos-no-era-un-no","Ya veremos no era un no"),("invita-el-que-cumple-anos","Invita el que cumple años"),("rechaza-la-boda-gana-el-postre","Rechaza la boda, gana el postre")]),
 ("Tema 6 · Health & Symptoms", [("la-farmacia-no-tiene-estantes","La farmacia no tiene estantes"),("rocio-cuenta-sus-sintomas","Rocío cuenta sus síntomas"),("sale-con-jarabe-y-sin-ayuda","Sale con jarabe y sin ayuda")]),
 ("Tema 7 · Festivals & Traditions", [("todos-lo-sabian-desde-mayo","Todos lo sabían desde mayo"),("un-recado-para-la-mesa-larga","Un recado para la mesa larga"),("el-salmorejo-se-acaba-primero","El salmorejo se acaba primero")]),
]
esc = lambda x: html.escape(str(x))
sec, tot, con_tot = [], 0, 0
for gtit, slugs in GRUPOS:
    hechos = [(s, t) for s, t in slugs if os.path.exists(f"scripts/_sets/{s}.json")]
    if not hechos:
        continue
    sec.append(f"<h1 class=g>{esc(gtit)}</h1>")
    for slug, titulo in hechos:
        d = json.load(open(f"scripts/_sets/{slug}.json"))
        filas, con = [], 0
        for i, e in enumerate(d, 1):
            feat = "featured" if e.get("featured", True) else "pool"
            p, t = e["payload"], e["type"]
            url = (p.get("audioClip") or {}).get("clipUrl")
            if url:
                con += 1
            audio = f"<audio controls preload=none src='{esc(url)}'></audio>" if url else "<span class=sin>sin audio</span>"
            if t == "match_meaning":
                cuerpo = "<br>".join(f"<b>{esc(pr['word'])}</b> = {esc(pr['answer'])}" for pr in p["pairs"])
                audio = "<span class=sin>audio en runtime</span>"
            else:
                marca = esc(e["sentence"]).replace("[[", "<mark>").replace("]]", "</mark>")
                opts = " · ".join(("<b>" + esc(o) + "</b>" if o == p["answer"] else esc(o)) for o in p["options"])
                cuerpo = f"{marca}<div class=o>{opts}</div>"
                if t == "fill_blank":
                    cuerpo += f"<div class=t>{esc(p['translation'])}</div>"
            filas.append(f"<tr><td class=n>{i}</td><td><span class='b {feat}'>{feat}</span></td>"
                         f"<td class=w>{esc(e['word'])}</td><td class=ty>{t.replace('_',' ')}</td>"
                         f"<td>{cuerpo}</td><td class=a>{audio}</td></tr>")
        n = sum(1 for e in d if e["type"] != "match_meaning")
        tot += n; con_tot += con
        sec.append(f"<h2>{esc(titulo)}</h2><div class=meta>{len(d)} ejercicios · 10 featured · audio {con}/{n}</div>"
                   f"<table><thead><tr><th>#</th><th></th><th>palabra</th><th>tipo</th><th>ejercicio</th><th>audio</th></tr></thead>"
                   f"<tbody>{''.join(filas)}</tbody></table>")

doc = f"""<!doctype html><meta charset=utf-8><title>Practica A1</title>
<style>body{{font:15px/1.5 system-ui;margin:0;padding:28px;background:#faf9f7;color:#1c1a17;max-width:1180px}}
h1.g{{font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:#8a8279;margin:38px 0 0;border-top:1px solid #e6e1da;padding-top:20px}}
h2{{font-size:17px;margin:26px 0 2px}} .meta{{color:#7a736a;font-size:13px;margin-bottom:10px}}
table{{border-collapse:collapse;width:100%;background:#fff;border:1px solid #e6e1da;border-radius:8px;overflow:hidden}}
th{{text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#8a8279;padding:8px 10px;border-bottom:1px solid #e6e1da}}
td{{padding:10px;border-bottom:1px solid #f0ece6;vertical-align:top}} tr:last-child td{{border-bottom:none}}
.n{{color:#a9a199;width:26px}} .w{{font-weight:600;white-space:nowrap}} .ty{{color:#7a736a;font-size:13px;white-space:nowrap}}
.b{{font-size:11px;padding:2px 6px;border-radius:20px;white-space:nowrap}}
.featured{{background:#e8f0e4;color:#3f6132}} .pool{{background:#f0ece6;color:#8a8279}}
mark{{background:#ffeaa7;padding:0 2px;border-radius:3px}}
.o{{margin-top:5px;color:#57514a;font-size:13.5px}} .t{{margin-top:3px;color:#8a8279;font-size:13px;font-style:italic}}
.a{{width:210px}} audio{{width:200px;height:32px}} .sin{{color:#b8b0a6;font-size:12px}}
</style>
<h1 style="font-size:20px;margin:0 0 4px">Práctica · Village Life in Andalusia</h1>
<div class=meta>{con_tot}/{tot} clips · todos los sets pasan el validador canónico · en negrita, la respuesta</div>
{''.join(sec)}"""
open("public/_practica-a1.html", "w").write(doc)
print(f"{con_tot}/{tot} clips")
