# Solo lectura: busca palabras en el inventario PCIC 9 (Nociones especificas A1-A2),
# descargado a mano de cvc.cervantes.es. Imprime nivel, seccion y la linea literal.
import re, sys, html
src = open(sys.argv[1], encoding="utf-8").read()
secs = [(m.start(), m.group(1)) for m in re.finditer(r'<caption>\s*([0-9.]+\s[^<\n]+)', src)]
def sec(pos):
    s = ""
    for p, name in secs:
        if p < pos: s = name.strip()
    return s
items = []
for m in re.finditer(r'<td headers="p[0-9a-z]*?(a1|a2)">(.*?)</td>', src, re.S):
    lvl = m.group(1).upper()
    for li in re.findall(r'<li>(.*?)(?:</li>|<p>|<ul>)', m.group(2), re.S):
        t = html.unescape(re.sub(r'<[^>]+>', '', li)).strip()
        if t: items.append((lvl, sec(m.start()), t))
for w in sys.argv[2:]:
    pat = re.compile(r'(?<![\wáéíóúñü])' + re.escape(w) + r'(?![\wáéíóúñü])', re.I)
    hits = [(l, s, t) for l, s, t in items if pat.search(t)]
    if not hits: print(f"{w}\tNO ESTA"); continue
    for l, s, t in hits[:3]: print(f"{w}\t{l}\t{s}\t{t}")
