import json,re,collections,sys
O,C="“","”"
S=[]
for t in range(1,8):
    for d in json.load(open(f"scripts/_deA0Friends/t{t}-data.json")): d["t"]=t; S.append(d)
tok=lambda s:set(re.findall(r"[^\W\d_]+",s.lower()))
bodies=[tok(d["text"]) for d in S]
# cast cross-topic mentions
for n in ["Anna","Jan","Nele","Felix","Johanna","Tim","Luisa","Niklas"]:
    ts=sorted({d["t"] for d in S if re.search(rf"(?<!\w){n}(?!\w)",d["text"])})
    print(n,ts, "ART!" if any(re.search(rf"\b(der|die|das|den|dem|ein|eine)\s+{n}\b",d["text"],re.I) for d in S) else "")
# encounters
items=[]
for i,d in enumerate(S):
    for v in d["vocab"]:
        k=(v.get("surface") or v["word"]).lower()
        k=re.sub(r"^(der|die|das)\s+","",k)
        n=sum(1 for b in bodies if k in b)
        items.append((n,d["t"],d["slotIndex"],v["word"],k,v["type"]))
ns=[x[0] for x in items]
print("media",sum(ns)/len(ns),"una vez",sum(1 for x in ns if x<=1),"de",len(ns))
if "-v" in sys.argv:
    for x in sorted(items): print(x)
if "-free" in sys.argv:
    used={x[4] for x in items}
    cnt=collections.Counter(w for b in bodies for w in b)
    stop=set("der die das den dem des ein eine einen einem einer und ist sind nicht sie er ich du wir es mit in im am an auf zu für von aus ihr ihre ihren seine sein mein meine dein deine noch auch aber denn so wie was wer jetzt hier da dann nur schon sehr ganz alle alles nach vor bei um bis oder ja nein hat habe haben bin bist uns mir dich dir mich ihm ihn ihnen man".split())
    print([ (w,c) for w,c in cnt.most_common() if c>=3 and w not in used and w not in stop][:150])
if "-forms" in sys.argv:
    cnt=collections.Counter(w for b in bodies for w in b)
    gain=0
    for i,d in enumerate(S):
        for v in d["vocab"]:
            k=re.sub(r"^(der|die|das)\s+","",(v.get("surface") or v["word"]).lower())
            n=cnt[k]
            stem=k[:max(4,len(k)-3)]
            alts=[(cnt[w],w) for w in bodies[i] if w!=k and w.startswith(stem[:4]) and abs(len(w)-len(k))<=3]
            if alts:
                best=max(alts)
                if best[0]>n: print(d["t"],d["slotIndex"],k,n,"->",best[1],best[0]); gain+= best[0]-n
    print("gain",gain)
if "-plan" in sys.argv:
    singles=[x for x in items if x[0]<=1]
    nouns=[x for x in singles if x[5]=="noun"]
    print("singles",len(singles),"nouns",len(nouns))
    other=[x for x in singles if x[5]!="noun"]
    print("non-noun singles",len(other))
    print(" ".join(f"{x[1]}-{x[2]}:{x[4]}" for x in other))
