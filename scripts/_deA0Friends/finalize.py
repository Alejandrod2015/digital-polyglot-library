import json,re,collections
SURF={"große":"groß","grünes":"grün","singst":"singt","tiefen":"tief","suppen":"Suppe","würfelst":"würfelt","alt":"alte","neu":"neue","kleine":"klein","Beide":"beiden"}
SCENE=set("würfeln laufen küssen springen fliegen gewinnen seufzen sammeln besorgen klopfen drehen regnen schlagen brechen schämen brennen klatschen pfeifen schwimmen rechnen spitz tränen probieren rühren rutschen klingeln husten kratzen schmatzen würzen klappern decken lehnen räuspern quietschen knüllen murmeln gähnen summen telefonieren kauen unterschreiben schütteln tippen schlucken klirren".split())
S=[]
for t in range(1,8):
    S+= [(t,d) for d in json.load(open(f"t{t}-data.json"))]
tok=lambda s:set(re.findall(r"[^\W\d_]+",s.lower()))
bodies=[tok(d["text"]) for _,d in S]
for t,d in S:
    b=tok(d["text"])
    for v in d["vocab"]:
        s=v.get("surface") or v["word"]
        if s in SURF and SURF[s].lower() in b: v["surface"]=SURF[s]
        v.pop("anchor",None)
cands=[]
for t,d in S:
    for v in d["vocab"]:
        k=re.sub(r"^(der|die|das)\s+","",(v.get("surface") or v["word"]).lower())
        n=sum(1 for b in bodies if k in b)
        pri = 0 if (v["type"]=="noun" and n<=1) else 1 if (v["word"] in SCENE and n<=1) else 2 if n<=1 else 9
        cands.append((pri,n,v))
cands.sort(key=lambda x:(x[0],x[1]))
total=len(cands); cap=int(total*0.30)
k=0
for pri,n,v in cands:
    if pri<=1 and k<cap: v["anchor"]=True; k+=1
by={}
for t,d in S: by.setdefault(t,[]).append(d)
for t,ds in by.items(): json.dump(ds,open(f"t{t}-data.json","w"),ensure_ascii=False,indent=1)
port=[(n,v) for pri,n,v in cands if not v.get("anchor")]
print("anchors",k,"de",total,"portables",len(port),"media %.2f"%(sum(n for n,_ in port)/len(port)),"cola",sum(1 for n,_ in port if n<=1),"tope",int(len(port)*0.30))
print("solas:", " ".join(re.sub(r'^(der|die|das)\s+','',(v.get('surface') or v['word'])) for n,v in port if n<=1))
