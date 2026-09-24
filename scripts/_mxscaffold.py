import json,re,sys
g=json.load(open('/tmp/mxgloss.json')); d=json.load(open('/tmp/mxa0.json'))
slug=sys.argv[1]
t=d[slug]
sents=[s.strip() for s in re.split(r'(?<=[.!?”])\s+', t.replace('\n',' ')) if s.strip()]
occ={}
for si,s in enumerate(sents):
    for m in re.finditer(r"[A-Za-zÁÉÍÓÚÑÜáéíóúñü]+", s):
        w=m.group(0).lower()
        if w in g: occ.setdefault(w,[]).append((si,m.start(),s))
for w in sorted(occ, key=lambda x: occ[x][0]):
    print(f"@{w} :: {g[w]['g']} [{g[w]['t']}] x{len(occ[w])}")
    for si,st,s in occ[w]:
        print(f"   {si}> {s}")
