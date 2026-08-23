import json, io, sys
def fix(bundle, pares):
    p=f'src/data/tapGlosses/{bundle}.json'
    b=json.load(io.open(p,encoding='utf-8')); g=b['glosses']; n=0
    for k,v in pares.items():
        if k not in g: print("  NO EXISTE:",k); continue
        if g[k]['g']!=v: g[k]['g']=v; n+=1
    io.open(p,'w',encoding='utf-8').write(json.dumps(b,ensure_ascii=False,indent=2)+"\n")
    print(f"{bundle}: {n}/{len(pares)}")
