"""Propone agrupar los parrafos de cada historia en k bloques contiguos (4-6),
minimizando el maximo de plazas por bloque y sin cortar entre una pregunta
citada y su respuesta. Solo propone: no escribe nada salvo con --aplica."""
import json, sys, re, subprocess
OBJ = {  # tema -> parrafos por historia (4, 5 y 6 una vez cada uno, rotando)
 't1':[5,6,4],'t2':[6,4,5],'t3':[4,5,6],'t4':[5,4,6],'t5':[6,5,4],'t6':[4,6,5],'t7':[5,6,4]}
def plazas(par, vocab):
    b=par.lower(); return sum(1 for v in vocab if (v.get('surface') or v['word']).lower() in b)
def corte_malo(prev, nxt):
    # no separar pregunta citada de su respuesta, ni una frase de narrador de la cita que la sigue pegada
    return bool(re.search(r'\?”[^“]*$', prev.strip())) and nxt.lstrip().startswith('“')
def mejor(pars, vocab, k):
    n=len(pars); c=[plazas(p,vocab) for p in pars]
    if n<k: return None
    import itertools
    best=None
    for cortes in itertools.combinations(range(1,n),k-1):
        # body-narrator-opening: el primer parrafo tiene que acabar en fin de frase, no en comillas
        if not re.search(r'[.!?…]\s*$', pars[cortes[0]-1].strip()): continue
        if any(corte_malo(pars[i-1],pars[i]) for i in cortes): continue
        grupos=[]; a=0
        for b in list(cortes)+[n]: grupos.append(list(range(a,b))); a=b
        cuenta=[sum(c[i] for i in g) for g in grupos]
        largo=[sum(len(pars[i].split()) for i in g) for g in grupos]
        coste=(max(cuenta), sum(1 for x in cuenta if x==0), max(largo)-min(largo))
        if best is None or coste<best[0]: best=(coste,grupos,cuenta,largo)
    return best
aplica='--aplica' in sys.argv
import itertools
for t,_ in OBJ.items():
    d=json.load(open(f'scripts/_b2/{t}.json'))
    orig={x['slug']:x['text'] for x in json.loads(subprocess.run(['git','show',f'HEAD:scripts/_b2/{t}.json'],capture_output=True,text=True,check=True).stdout)}
    for x in d:
        assert ' '.join(orig[x['slug']].split())==' '.join(x['text'].split()), f'el texto de {x["slug"]} cambio, no solo los saltos'
        x['text']=orig[x['slug']]
    # la permutacion de (4,5,6) cuyo peor bloque del tema tiene menos plazas
    def peor(ks):
        rs=[mejor(x['text'].split('\n\n'),x['vocab'],k) for x,k in zip(d,ks)]
        return (99,) if None in rs else (max(max(r[2]) for r in rs), sum(sum(1 for x in r[2] if x==0) for r in rs), sum(max(r[3])-min(r[3]) for r in rs))
    ks=min(itertools.permutations([4,5,6]), key=peor)
    for s,k in zip(d,ks):
        pars=s['text'].split('\n\n'); r=mejor(pars,s['vocab'],k)
        if r is None: print(f'{t} {s["slug"]}: sin particion valida en {k}'); continue
        _,grupos,cuenta,largo=r
        print(f'{t} {s["slug"]}: {len(pars)} -> {k} parrafos · plazas {cuenta} · palabras {largo}')
        if aplica: s['text']='\n\n'.join(' '.join(pars[i] for i in g) for g in grupos)
    if aplica: json.dump(d, open(f'scripts/_b2/{t}.json','w'), ensure_ascii=False, indent=2)
