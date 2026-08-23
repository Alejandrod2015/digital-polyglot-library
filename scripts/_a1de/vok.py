import json, re, sys, unicodedata, os
HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.dirname(os.path.dirname(HERE))
src=open(ROOT+"/src/lib/cefr/germanA1A2.ts").read()
body=src.split("new Set([",1)[1].split("]);",1)[0]
LEM=set(re.findall(r'"([^"]+)"', body))
SEP=["an","auf","aus","ein","nach","vor","zu","ab","mit","bei"]
COM=["ge","ver","be","er","ent"]
def strip(w):
    l=w.lower()
    for a in ("der ","die ","das "):
        if l.startswith(a): l=l[len(a):]; break
    for p in SEP+COM:
        if l.startswith(p) and len(l)>len(p)+3: return l[len(p):]
    return l
def lema(w):
    s=strip(w)
    return "".join(c for c in unicodedata.normalize("NFD",s) if unicodedata.category(c)!="Mn").strip()
def isA1(word):
    l=word.lower().strip()
    if l in LEM: return True
    st=re.sub(r'^(der|die|das|ein|eine|den|dem|des)\s+','',l)
    if st in LEM: return True
    for i in range(3,len(l)-2):
        if l[i:] in LEM: return True
    return False
t=open(HERE+"/taught.txt").read().splitlines()
SAME={lema(w) for w in json.loads([x for x in t if x.startswith("SAME_TYPE_LIST")][0].split(" ",1)[1])}
ELSE={lema(w) for w in json.loads([x for x in t if x.startswith("ELSEWHERE_LIST")][0].split(" ",1)[1])}
def status(w):
    return dict(word=w, a1=isA1(w), lema=lema(w), same=lema(w) in SAME, elsewhere=lema(w) in ELSE)
if __name__=="__main__":
    for w in sys.argv[1:]:
        s=status(w); print(f"{w:24} a1={s['a1']} same={s['same']} else={s['elsewhere']}")
