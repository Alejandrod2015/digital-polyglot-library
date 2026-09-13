import json,sys
def v(word,surface,typ,definition,anchor=False,register="neutral"):
    n=len(definition.split())
    if n<8 or n>14: print("DEF LARGO", n, word, file=sys.stderr)
    d={"type":typ,"word":word,"surface":surface,"register":register,"definition":definition}
    if anchor: d["anchor"]=True
    return d
def dump(path,data):
    json.dump(data,open(path,"w"),ensure_ascii=False,indent=1)
