"""Compone scripts/_frB1cov/portadas.json (Friends FR B1, Lille, Fives, atelier
de velos de Aurelien y Elodie) con el formato de scripts/_frA2cov/portadas.json:
una ficha de reparto por tema y un prompt por historia. Las fichas se escriben
UNA vez y se repiten literales, para que ningun rasgo cambie entre portadas.
Escribe tambien para-el-doc.txt desde la misma fuente. No genera nada.
  python3 scripts/_frB1cov/build.py
"""
import json

C = {
 "AURELIEN": "man, exactly 30 years old, slim runner's build, medium height, fair skin, short neat dark-brown hair, WITHOUT fringe, clean-shaven, no glasses; wears a faded denim-blue mechanic's work shirt with sleeves rolled up over a plain grey t-shirt, dark canvas work trousers and black lace-up work boots",
 "ELODIE": "woman, exactly 29 years old, sturdy athletic build, a head shorter than AURELIEN, light olive skin, short black wavy hair just above the shoulders, WITHOUT fringe, no glasses; wears navy-blue mechanic's overalls with the sleeves tied at the waist over a plain white tank top and black steel-toe work boots",
 "GUILLAUME": "man, exactly 36 years old, stocky heavier build, a little taller than AURELIEN, fair ruddy skin, short wavy light-brown hair receding slightly at the temples, WITHOUT fringe, trimmed light-brown moustache, no glasses; wears a charcoal-grey blazer over a plain white shirt, dark trousers and brown leather dress shoes",
 "YASMINE": "woman, exactly 31 years old, slim build, the same height as ELODIE, warm brown skin, long straight black hair worn in a low ponytail, WITHOUT fringe, thin gold-framed glasses; wears a tailored navy-blue blazer over a plain cream blouse, a dark-grey pencil skirt and black low heels",
 "CHARLOTTE": "woman, exactly 30 years old, tall slender build, a little taller than ELODIE, fair skin with light freckles, long straight ash-blonde hair worn loose, WITHOUT fringe, no glasses; wears a mustard-yellow trench coat over a plain black turtleneck, dark jeans and tan ankle boots, a camera on a strap across her chest",
 "MARION": "woman, exactly 29 years old, petite slim build, a little shorter than ELODIE, fair skin, dark-brown hair cut in a straight bob at the chin, WITH a straight blunt fringe, no glasses; wears pale-blue hospital scrubs under an open cream wool coat and white trainers",
 "FLORIAN": "man, exactly 47 years old but sturdy and energetic, no grey hair, broad heavyset build, taller than AURELIEN, ruddy weathered skin, short dark hair cropped close, clean-shaven, no glasses; wears a plain forest-green apron over a checked flannel shirt, dark trousers and black boots",
 "QUENTIN": "man, exactly 40 years old, average lean build, similar height to AURELIEN, fair skin, short neat sandy-blond hair, WITHOUT fringe, clean-shaven, thin black-framed glasses; wears a plain white doctor's coat over a light-blue shirt and navy trousers, a stethoscope around his neck",
}
POS = {2: ["LEFT", "RIGHT"], 3: ["LEFT", "CENTER", "RIGHT"]}

def sheet(names):
    n = len(names)
    parts = [f"{POS[n][i]} is {nm}: {C[nm]}." for i, nm in enumerate(names)]
    return ("Character model sheet for a story series, clean cel-shaded editorial illustration, crisp clean linework, flat vivid warm colour fills, "
            "plain pure white background, landscape 16:9.\n\n"
            f"Exactly {n} adult characters, drawn as a reference sheet: top row shows all of them full body from head to feet, standing straight, "
            "front view, neutral expression, natural skin with no blush, natural eyes; bottom row shows the same characters as head and shoulders close ups.\n\n"
            + "\n\n".join(parts)
            + "\n\nGenerous white margin around every figure, no props, no animals, no scenery, no shadows on the background, and absolutely no text, labels or numbers anywhere in the image.")

HEAD = ("LOCK: The image provided is the cast sheet for this story. KEEP every character's face, hair, facial hair, body build, height difference, skin tone "
        "and clothing IDENTICAL to the sheet; only pose, framing, light and background change. Draw only the characters the scene names, and no other people: "
        "no children, no teenagers, no elderly people, no crowd, not even in the background. "
        "No text, letters or numbers anywhere in the image. No readable surfaces, no signs, no posters, no visible writing paper, no open books, no open newspapers, "
        "no front-facing screens: any phone shows only its plain back. Any paper, note, list, letter or envelope is folded shut or lies face down, never legible writing. "
        "Any bottle or jar is plain glass with no label. Any book spine, record sleeve or box is a plain solid colour with no titles, marks or numbers. "
        "Any microphone and any electrical panel carry no letters, numbers or logos.\n\n"
        "STYLE: Clean cel-shaded editorial illustration anchored to the published FR A0 Friends Marseille and FR A2 Friends Nantes covers: thick crisp linework, "
        "flat saturated warm colour fills, brick and pale stone, clear grey-blue northern-French daylight or warm interior lamp light, simple graphic shadows, "
        "adult figures at middle distance, natural skin with no blush, natural eyes, 16:9 landscape.\n\n"
        "FRAMING: the characters occupy the middle third of the frame, waist-up or fuller, and the illustration fills the entire canvas edge to edge with no borders or empty margins.\n\n"
        "SCENE: ")

ATELIER = "Aurélien and Élodie's bicycle workshop in the Fives district of Lille, exposed red brick walls, a long wooden workbench covered in tools, bicycle wheels hanging on hooks, a tall factory-style window"
GUILLAUME_HOME = "the dining room of Guillaume's apartment in Roubaix, warm floral wallpaper, a wooden table set for Sunday lunch, a half-eaten tart"
VIEUX_LILLE = "a cobbled street in the Vieux-Lille district, tall ornate Flemish-style brick facades, a shop with a large plain glass shopfront window"
GRAND_PLACE = "the Grand-Place of Lille at night, the ornate stone facade of the Vieille Bourse glowing under warm lights behind them"
ESTAMINET = "the wooden bar counter of a small Fives estaminet, exposed ceiling beams, a row of beer taps, small round tables behind"
BANK = "a small bank branch office in Lille, a plain desk, grey filing cabinets, a window with pale daylight"
CAFETERIA = "a hospital staff cafeteria near Lille, plain round tables, a vending machine, pale fluorescent light"

T = [
 ("advice-and-opinions", "Advice & Opinions", ["AURELIEN", "GUILLAUME"], [
  ("des-conseils-pas-demandes", "Des conseils pas demandés", 1,
   f"In {GUILLAUME_HOME}, Sunday midday. GUILLAUME points a fork across the table, sure of himself, mid-lecture; AURELIEN sits across from him staring down at a slice of sugar tart, jaw clenched, hurt. Medium shot across the table, both waist up.", ""),
  ("une-vitrine-trop-chic", "Une vitrine trop chic", 2,
   f"On {VIEUX_LILLE}, a cold clear afternoon, passers-by in warm coats out of frame. GUILLAUME stands in front of a shopfront window gesturing at it proudly, one hand on the glass; AURELIEN stands beside him, arms crossed, unconvinced. Medium shot, both waist up or fuller.", ""),
  ("le-compteur-ne-ment-pas", "Le compteur ne ment pas", 3,
   f"Inside the bare unfinished space of {ATELIER}, before renovation, dim daylight, exposed wiring on one wall. GUILLAUME crouches by an open electrical fuse box holding a small flashlight, grimacing at what he sees; AURELIEN stands behind him, worried, one hand on the brick wall. Medium shot, both waist up or fuller.", ""),
 ]),
 ("careers-and-ambitions", "Careers & Ambitions", ["AURELIEN", "ELODIE"], [
  ("la-tournee-jamais-offerte", "La tournée jamais offerte", 1,
   f"In {ESTAMINET}, warm evening light, two plates of welsh and two glasses of beer on the table. ELODIE has just dropped her bicycle helmet onto the bench beside her, tense; AURELIEN sits across from her, forcing a reassuring smile, hiding his own good news. Medium shot across the table, both waist up.", ""),
  ("reponse-avant-vendredi", "Réponse avant vendredi", 2,
   f"By a window at night with the lit belfry of Lille's beffroi glowing outside, AURELIEN's small living room, a laptop open on a low table showing only its plain closed lid from this angle. ELODIE sits beside him holding out two bottles of beer, insistent; AURELIEN rubs his face, torn. Medium shot, both waist up.", ""),
  ("un-carton-sous-le-bras", "Un carton sous le bras", 3,
   f"On a rain-slicked street at dusk, heavy drizzle, warm shopfront lights reflected in puddles. ELODIE sits astride her bicycle holding up a rusty set of keys, teasing; AURELIEN stands beside her holding a plain sealed cardboard box against his hip, tired but relieved. Medium shot, both waist up or fuller.", ""),
 ]),
 ("dating-and-romance", "Dating & Romance", ["AURELIEN", "MARION", "ELODIE"], [
  ("rendez-vous-sous-la-bourse", "Rendez-vous sous la Bourse", 1,
   f"On {GRAND_PLACE}. AURELIEN stands waiting with his hands in his pockets, hopeful; MARION arrives a little out of breath, still in her pale-blue scrubs under her open coat, apologetic smile. Medium shot, both waist up or fuller.", "Elodie no sale en esta escena."),
  ("samedi-deux-promesses", "Samedi, deux promesses", 2,
   f"Inside {ATELIER} at night, a single work lamp lit, a wooden shelf half mounted on the brick wall, a stepladder beside it. ELODIE stands alone driving in a screw with a screwdriver, one hand wrapped in a small bandage, focused. Medium shot, waist up or fuller.", "Aurelien y Marion no salen: estan en el restaurante, escena aparte."),
  ("une-verite-trop-tard", "Une vérité trop tard", 3,
   f"In {CAFETERIA}, quiet Sunday morning, two plain paper cups on the table. MARION turns her cup slowly between her fingers, tired and resolved; AURELIEN sits across from her, head down, saying nothing. Medium shot across the table, both waist up.", "Elodie no sale en esta escena: la charla con ella es despues, en el taller."),
 ]),
 ("money-and-debts", "Money & Debts", ["AURELIEN", "ELODIE", "YASMINE"], [
  ("trente-mille-euros", "Trente mille euros", 1,
   f"In {BANK}, a plain closed folder on the desk between them. YASMINE sits behind the desk, serious, one hand on the folder; AURELIEN and ELODIE sit across from her side by side, AURELIEN's hands visibly tense on his knees. Medium shot, all three waist up.", "Yasmine no lleva bata: viste de traje de oficina, distinta de Elodie en ropa y en pelo."),
  ("un-seul-nom-sur-le-contrat", "Un seul nom sur le contrat", 2,
   f"Inside {ATELIER}, evening lamp light, a single sheet of paper lying face down on the workbench. ELODIE stands with her arms crossed, lips pressed tight, hurt; AURELIEN stands across the bench from her, one hand raised placating. Medium shot, both waist up.", "Yasmine no sale: solo llama por telefono."),
  ("deux-cents-euros-par-mois", "Deux cents euros par mois", 3,
   f"Inside {ATELIER}, warm lamp light, a single sheet of paper lying face down on the workbench with a plain pen beside it. ELODIE has just set the pen down, calm and resolute; AURELIEN stands across the bench watching her, subdued. Medium shot, both waist up.", "Yasmine no sale: el banco confirma el lunes, fuera de escena."),
 ]),
 ("pride-and-envy", "Pride & Envy", ["AURELIEN", "ELODIE", "CHARLOTTE"], [
  ("une-photo-pour-le-journal", "Une photo pour le journal", 1,
   f"Inside {ATELIER}, daylight through the tall window. CHARLOTTE stands holding a plain camera up to her eye, framing a shot of AURELIEN, who gestures mid-story, pleased with himself; ELODIE crouches at the workbench in the background, changing a bicycle tyre with both hands, not looking up. Medium shot, all three waist up or fuller.", "Elodie tiene una accion fisica clara (cambia una rueda) para que Flux no la borre del cuadro."),
  ("son-nom-n-y-est-pas", "Son nom n'y est pas", 2,
   f"Inside {ATELIER}, midday, a compressor pipe visible on the wall. AURELIEN stands to one side holding a phone to his ear with a guilty, defensive expression; ELODIE stands at the workbench twisting an inner tube tightly between both hands, not looking at him. Medium shot, both waist up.", "Charlotte no sale: esta al telefono. Sin periodico en pantalla."),
  ("derriere-la-cloison", "Derrière la cloison", 3,
   f"Inside {ATELIER}, early morning, a paper bag of croissants on the workbench. AURELIEN holds out a single sheet of paper face down towards ELODIE, a little nervous; ELODIE stands with her arms crossed, studying him, not yet convinced. Medium shot, both waist up.", ""),
 ]),
 ("rumours-and-reputation", "Rumours & Reputation", ["AURELIEN", "ELODIE", "FLORIAN"], [
  ("ce-qu-on-raconte-a-fives", "Ce qu'on raconte à Fives", 1,
   f"At {ESTAMINET}. FLORIAN leans on the bar counter pouring a hot drink, giving AURELIEN a sly sideways look; AURELIEN sits on a stool at the counter, holding his cup, caught off guard. Medium shot, both waist up.", "Elodie no sale."),
  ("une-blague-mal-repetee", "Une blague mal répétée", 2,
   f"Inside {ATELIER} in the evening, a wall half painted in fresh grey over old white, a dripping paintbrush on the floor. AURELIEN stands with his arms spread, upset; ELODIE stands facing him, biting her lip, apologetic. Medium shot, both waist up.", "Florian no sale."),
  ("des-comptes-bien-tenus", "Des comptes bien tenus", 3,
   f"At {ESTAMINET}, evening, the bar busier than before. FLORIAN stands behind the counter, relieved, drying a glass; AURELIEN stands at the bar facing him, having just finished speaking, a little exposed but steady. Medium shot, both waist up.", "Elodie no sale en primer plano: aplaude al fondo, fuera del cuadro principal."),
 ]),
 ("stress-and-burnout", "Stress & Burnout", ["AURELIEN", "ELODIE", "QUENTIN"], [
  ("des-mains-qui-tremblent", "Des mains qui tremblent", 1,
   f"Inside {ATELIER}, daylight, a bicycle turned upside down on the workbench, gears exposed. QUENTIN stands beside it, watching ELODIE's hands closely, concerned; ELODIE adjusts a derailleur with a small tool, her hands slightly unsteady, forcing a smile; AURELIEN sands a wheel rim in the background with a hand tool, not looking up. Medium shot, all three waist up or fuller.", ""),
  ("endormie-contre-l-etabli", "Endormie contre l'établi", 2,
   f"Inside {ATELIER}, dim evening light. ELODIE sits slumped against the workbench, eyes closed, an inner tube loose in her hand; QUENTIN kneels beside her checking her wrist, grave; AURELIEN stands behind them, a hand pressed to his own forehead, alarmed. Medium shot, all three waist up or fuller.", ""),
  ("cinq-cents-prospectus", "Cinq cents prospectus", 3,
   f"Inside {ATELIER}, daylight, a tall stack of plain flyers with no visible print facing away from the viewer on the workbench. AURELIEN sits on the floor with his back against the workbench leg, hands limp in his lap, exhausted; ELODIE crouches in front of him, one hand on his shoulder, steady and clear-eyed. Medium shot, both waist up or fuller.", "Los prospectus van de canto o boca abajo: nunca se lee la fecha impresa."),
 ]),
]

out = []
for topic, label, names, stories in T:
    out.append({"topic": topic, "label": label, "place": "Lille, France", "names": names, "sheet": sheet(names),
                "stories": [{"slug": s, "title": ti, "slot": sl, "prompt": HEAD + sc, "note": no} for s, ti, sl, sc, no in stories]})
json.dump(out, open("scripts/_frB1cov/portadas.json", "w"), ensure_ascii=False, indent=1)
open("scripts/_frB1cov/portadas.json", "a").write("\n")
print(f"{len(out)} temas, {sum(len(t['stories']) for t in out)} portadas")

# --- para-el-doc.txt: mismo formato que scripts/_frA2cov/para-el-doc.txt ---
doc = []
doc.append("[Journey-planning-2, 2026-09-14] PETICIÓN FR B1 Friends: 21 portadas + 7 cast sheets, carpeta francia-b1-friends bajo la raíz 1sFlqVaqsLy1cGqPNpLh5JJE03Dw1rnZP")
doc.append("")
for topic, label, names, stories in T:
    doc.append(f"TEMA: {label} ({topic})")
    doc.append("Lugar: Lille, France")
    doc.append("Reparto:")
    for nm in names:
        doc.append(f"- {nm}: {C[nm]}.")
    doc.append("")
    doc.append("CAST SHEET:")
    doc.append(sheet(names))
    doc.append("")
    for i, (s, ti, sl, sc, no) in enumerate(stories, start=1):
        doc.append(f"PORTADA {i}: {ti} ({s})")
        doc.append(HEAD + sc)
        doc.append(f"note: {no}")
        doc.append("")
    doc.append("")
open("scripts/_frB1cov/para-el-doc.txt", "w").write("\n".join(doc).rstrip("\n") + "\n")
print("para-el-doc.txt escrito")
