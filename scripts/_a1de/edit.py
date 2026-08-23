import sys, os, re
HERE=os.path.dirname(os.path.abspath(__file__))
def ed(f, reps):
    p=os.path.join(HERE,f); s=open(p).read()
    for a,b in reps:
        if a not in s: print("MISS", f, repr(a[:60])); continue
        s=s.replace(a,b,1)
    open(p,"w").write(s)
