# Solo lectura: recuento de las plantillas del pase de edicion sobre las 21 del Friends DE A1.
import json,re
S=[d for t in range(1,8) for d in json.load(open(f"scripts/_deA1Friends/t{t}-data.json"))]
P={"presentacion Julia (aposicion)":r"Julia, (die|eine) Physiotherapeutin",
"presentacion Moritz (ist Straßenbahnfahrer)":r"Moritz ist Straßenbahnfahrer",
"tut mir/es (so/auch) leid":r"[Tt]ut (mir|es) (so |auch )?leid",
"escribe a Rostock/chat como coste":r"schreibt (sie )?(ihrer besten Freundin|nach Rostock|in den Chat)|in den Chat",
"gesto con el movil al cierre":None,
"zum ersten Mal":r"zum ersten Mal",
"sagt (lange/zuerst) nichts":r"sagt (lange |zuerst )?nichts",
"sagt sie leise":r"sagt sie leise"}
for k,p in P.items():
    if p is None:
        hits=[i+1 for i,d in enumerate(S) if re.search(r"Handy|Smartphone",d["text"].split("\n\n")[-1])]
    else:
        hits=[i+1 for i,d in enumerate(S) if re.search(p,d["text"])]
    print(f"{len(hits):2d}  {k}  {hits}")
