import json,sys,re,os
HERE=os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0,HERE)
import vok
COG=set("""mathe kaffee tomate tomaten banane schokolade tee telefon apfel optimist chance computer familie
restaurant park auto bus hotel adresse information foto musik konzert pizza spaghetti hamburger
markt fisch hand person glas gläser papier ball name arm finger lampe kamera mann buch bücher winter hunger sommer
mutter vater bruder perfekt""".split())
B1=["container","contain","containing","contained","transparent","transparency","barrier","barriers",
"accessible","accessibility","emphasize","emphasizing","emphasis","ability","abilities","gratitude",
"grasp","grasping","passage","passages","designate","designated","sensation","sensations","customary",
"customs","ancestral","genuine","genuinely","expressing","expression","cold-blooded","warm-blooded",
"movable","moveable","device","devices","facility","facilities","appliance","appliances","establishment","establishments"]
d=json.load(open(sys.argv[1] if len(sys.argv)>1 else HERE+"/work.json"))
bad=0
for s in d:
    msgs=[]
    txt=s["text"]; bw=len(txt.split())
    if bw<115 or bw>170: msgs.append(f"WORDS {bw} (need 115-170)")
    sw=len(s["synopsis"].split())
    if sw<45 or sw>90: msgs.append(f"SYNOPSIS {sw} (need 45-90)")
    nw=dw=0
    for raw in re.split(r"\n+",txt):
        line=raw.strip()
        if not line: continue
        m2=re.match(r"^[A-ZÄÖÜ][\wÄÖÜäöüß\s'\-]*:\s+(.+)$",line)
        if m2: dw+=len(m2.group(1).split())
        else: nw+=len(line.split())
    tot=nw+dw; pct=round(dw*100/tot) if tot else 0
    if pct<60 or pct>80: msgs.append(f"DIALOG {pct}% (n={nw} d={dw})")
    v=s["vocab"]; n=len(v)
    ceil=max(25,round(bw/9))
    if n<20 or n>ceil: msgs.append(f"VOCABCOUNT {n} (20-{ceil})")
    same=[x["word"] for x in v if vok.status(x["word"])["same"]]
    els=[x["word"] for x in v if vok.status(x["word"])["elsewhere"]]
    nota1=[x["word"] for x in v if not vok.status(x["word"])["a1"]]
    cog=[x["word"] for x in v if x["word"].lower() in COG]
    miss=[(x.get("surface") or x["word"]) for x in v if (x.get("surface") or x["word"]).lower() not in txt.lower()]
    if same: msgs.append("SAME: "+", ".join(same))
    if len(els)>2: msgs.append("ELSE: "+", ".join(els))
    elif els: msgs.append("else(warn): "+", ".join(els))
    if nota1: msgs.append(("NOTA1: " if len(nota1)>2 else "nota1(warn): ")+", ".join(nota1))
    if cog: msgs.append("COGNATE: "+", ".join(cog))
    if miss: msgs.append("NOT-IN-BODY: "+", ".join(miss))
    dl=[x["word"] for x in v if not (8<=len(re.findall(r"[A-Za-z']+",x["definition"]))<=14)]
    if dl: msgs.append("DEFLEN: "+", ".join(dl))
    b1=[x["word"] for x in v for w in B1 if re.search(r"\b"+w+r"\b",x["definition"],re.I)]
    if b1: msgs.append("DEFB1: "+", ".join(sorted(set(b1))))
    roots={}
    for x in v:
        head=x["word"].strip().split()[-1]
        r=vok.strip(head)[:5]
        if len(r)>=3: roots.setdefault(r,[]).append(x["word"])
    dup=[f"{k}: {'+'.join(w)}" for k,w in roots.items() if len(w)>1]
    if dup: msgs.append("SAMEROOT: "+"; ".join(dup))
    sp=[x["word"] for x in v if " " in (x.get("surface") or x["word"])]
    if sp: msgs.append("SPACE-SURFACE: "+", ".join(sp))
    paras=[p for p in re.split(r"\n\s*\n",txt) if p.strip()]
    per=[]
    for p in paras:
        c=0
        for x in v:
            nd=(x.get("surface") or x["word"]).lower()
            if re.search(r"\b"+re.escape(nd)+r"\b",p,re.I|re.U): c+=1
        per.append(c)
    zero=sum(1 for c in per if c==0); six=sum(1 for c in per if c>=6)
    if (zero and six) or (per and max(per)/n>0.35): msgs.append(f"DISTRIB {per} (0s={zero}, 6+={six})")
    elif zero>2: msgs.append(f"distrib(warn) {per}")
    if msgs:
        bad+=1
        print(f"--- {s['topic']}#{s['slotIndex']} {s['title']}")
        for m in msgs: print("    "+m)
print(f"{bad}/{len(d)} con avisos")
