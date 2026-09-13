import json,re,sys
O,C="“","”"
S=[d for t in range(1,8) for d in json.load(open(f"scripts/_deA0Friends/t{t}-texts.json"))]
HABLA=r"(lächelt|singt|rufen|sagt|fragt|antwortet|ruft|nickt|lacht|flüstert|murmelt|meint|bittet|liest|schreibt|zählt|seufzt|erklärt)"
EMO=re.compile(r"(?m)(?:^|(?<=[.!?] ))(?:Ihr|Ihre|Annas|Anna|Jans|Sein|Seine)\b[^.!?]{0,25}\b(?:ist|sind|wird|werden)\s+[a-zäöüß]+,\s+denn\b")
emo=[d["title"] for d in S if EMO.search(d["text"])]
acht=sum(len(re.findall(r"\bacht Jahre", d["text"], re.I)) for d in S)
late=[]; unattr=0; unattr_st={}
for d in S:
    t=d["text"]; paras=t.split("\n\n")
    if O in t:
        pos=len(re.findall(r"\w+",t[:t.index(O)]))/len(re.findall(r"\w+",t))
        if pos>=0.4: late.append(f'{d["title"]} ({pos:.0%})')
    n=0
    for i,p in enumerate(paras):
        if O not in p: continue
        outside=re.sub(O+"[^"+C+"]*"+C," ",p)
        if re.search(HABLA,outside): continue
        prev=paras[i-1] if i>0 else ""
        if prev and O not in prev:
            last=re.split(r"(?<=[.!?])\s+",prev.strip())[-1]
            if re.match(r"(Anna|Jan|Nele|Felix|Johanna|Tim|Luisa|Niklas|Er|Sie)\b",last): continue
        n+=1
    unattr+=n; unattr_st[d["title"]]=n
print(f"1 formula emocional: {len(emo)}/21 ->", "; ".join(emo))
print(f"2 'acht Jahre': {acht}")
print(f"3 todas las citas en la 2a mitad: {len(late)} ->", "; ".join(late))
print(f"4 replicas sin acotacion en su parrafo: {unattr} ->", ", ".join(f"{k}:{v}" for k,v in unattr_st.items() if v))
if "-w" in sys.argv:
    for d in S:
        t=d["text"]; w=len(re.findall(r"\w+",t)); qw=sum(len(re.findall(r"\w+",m)) for m in re.findall(O+"([^"+C+"]*)"+C,t))
        print(f"  {d['title']}: {w} pal, {100*qw/w:.0f}%")
