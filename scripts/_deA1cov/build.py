"""Compone scripts/_deA1cov/portadas.json (Friends DE A1, Frankfurt, Bornheim)
con el formato de scripts/_frA2cov/portadas.json: una ficha de reparto por
tema y un prompt por historia. Las fichas se escriben UNA vez y se repiten
literales. Escribe tambien para-el-doc.txt desde la misma fuente. No genera
nada.
  python3 scripts/_deA1cov/build.py
"""
import json

C = {
 "JULIA": "woman, exactly 31 years old, medium athletic build, average height, fair skin, long light-brown hair in a low ponytail, WITHOUT fringe, no glasses; wears a bright yellow rain jacket over a plain white t-shirt, dark blue jeans and white canvas sneakers",
 "MORITZ": "man, exactly 34 years old, stocky build, a little taller than JULIA, olive skin, short black curly hair, neat three-day black stubble, no glasses; wears a bottle-green hooded sweatshirt, dark grey trousers and black sneakers",
 "SVENJA": "woman, exactly 29 years old, lean athletic build, as tall as MORITZ, tanned outdoor skin, very short platinum-blonde hair, WITHOUT fringe, no glasses; wears a bright orange running jacket, black running leggings and orange running shoes",
 "FLORIAN": "man, exactly 36 years old, tall broad build, taller than MORITZ, fair freckled skin, short red hair, full neat red beard, no glasses; wears a plain navy-blue baseball cap with no logo, a grey work jacket, dark work trousers and brown boots",
 "THERESA": "woman, exactly 33 years old, curvy build, a little shorter than JULIA, fair skin, dark-brown hair gathered in a low bun, WITH a straight blunt fringe, no glasses; wears a mustard-yellow knit cardigan over a plain cream blouse, brown corduroy trousers and brown flat shoes",
 "PHILIPP": "man, exactly 35 years old, medium build, the same height as MORITZ, fair skin, short blond hair shaved close at the sides, clean-shaven, no glasses; wears a plain blue-and-white check shirt, dark jeans and grey sneakers",
 "MIRIAM": "woman, exactly 38 years old, tall slim build, taller than JULIA, olive skin, long straight black hair with a centre parting, WITHOUT fringe, no glasses; wears a plain light-blue polo shirt, white trousers and white clinic shoes",
 "CAROLIN": "woman, exactly 32 years old, petite build, a little shorter than JULIA, fair skin with light freckles, copper-auburn hair cut to the chin, WITHOUT fringe, no glasses; wears a plain grey wool coat over a plain cream sweater, dark trousers and black ankle boots",
}
POS2 = ["LEFT", "RIGHT"]
POS3 = ["LEFT", "CENTER", "RIGHT"]
POS = {2: POS2, 3: POS3}

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
        "no children, no teenagers, no elderly people, no crowd, not even in the background. Any dog is unnamed and wears no collar tag. "
        "No text, letters or numbers anywhere in the image. No readable surfaces, no signs, no posters, no visible writing paper, no open books, no open newspapers, "
        "no front-facing screens: any phone shows only its plain back. Any paper, note, list, letter or card is folded shut or lies face down, never legible writing. "
        "Any bottle or jar is plain glass with no label. Any balloon is a plain solid colour with no print. Any tram, running bib or race number carries no digits "
        "or letters. Any clothing is free of logos or lettering.\n\n"
        "STYLE: Clean cel-shaded editorial illustration anchored to the published German Friends C1 cover: thick crisp linework, flat saturated colour fills, "
        "pale plastered walls, strong clear daylight, simple graphic shadows, adult figures at middle distance, natural skin with no blush, natural eyes, "
        "bright daylight unless the scene says otherwise, 16:9 landscape.\n\n"
        "FRAMING: the characters occupy the middle third of the frame, waist-up or fuller, and the illustration fills the entire canvas edge to edge with no borders or empty margins.\n\n"
        "SCENE: ")

LANDING = "the shared landing of an old apartment building in Bornheim, Frankfurt, two facing wooden doors under a single hanging bulb, pale plastered walls"
STAIRS = "the stairwell of the same Bornheim building, a straight run of pale stone steps with a black iron railing"
J_LIVING = "the small living room of Julia's apartment in Bornheim, white walls, a green sofa, a tall window"
J_KITCHEN = "the small kitchen of Julia's apartment in Bornheim, white walls, a narrow window, a wooden table"
MAIN = "the paved riverside path along the Main in Frankfurt, the water beside the path and the plain office towers of the skyline across the river"
MUSEUMSUFER = "an outdoor second-hand clothes stall on the Museumsufer flea market in Frankfurt, clothes racks and folding tables, the Main visible behind"
PARK = "a riverside park in Frankfurt, tall plane trees and a wide lawn"
PRAXIS_HALL = "the hallway of a small physiotherapy practice in Frankfurt, pale walls, a row of closed doors"
PAUSENRAUM = "the small break room of the physiotherapy practice, a round table by a window with rain outside"
BOAT = "the open deck of a river excursion boat on the Main, strings of plain warm lights overhead, the Frankfurt skyline sliding past"

T = [
 ("chats-and-phone-calls", "Chats & Phone Calls", ["JULIA", "MORITZ"], [
  ("alles-super-in-frankfurt", "Alles super in Frankfurt", 1,
   f"On {STAIRS}, evening, a single warm bulb lit above. JULIA sits on a step holding her phone up near her mouth, its plain back to the viewer, a bright forced smile; MORITZ stands in his open doorway above her, a black bin bag in one hand, listening with a knowing half smile. Medium shot, both waist up or fuller.", ""),
  ("ein-abend-auf-stumm", "Ein Abend auf stumm", 2,
   f"On {LANDING}, Saturday morning, soft daylight through a small window. MORITZ stands in his doorway holding out a small folded paper note; JULIA stands in her own doorway opposite, reaching for it with a delighted smile. Medium shot across the landing, both waist up.", ""),
  ("lieber-einmal-anrufen", "Lieber einmal anrufen", 3,
   f"In {J_KITCHEN}, Sunday morning, warm sunlight through the window, a coffee cup on the table. JULIA sits at the table in pyjamas, her phone held to her ear with its plain back to the viewer, eyes closed, taking a deep breath before speaking. Medium shot, waist up.", "Solo Julia: llama a Moritz por telefono, el no esta en cuadro."),
 ]),
 ("running-and-fitness", "Running & Fitness", ["JULIA", "MORITZ", "SVENJA"], [
  ("zu-schnell-am-main", "Zu schnell am Main", 1,
   f"On {MAIN}, a cool morning, a plain stone bridge in the distance. SVENJA runs at the front holding a small stopwatch, glancing back; JULIA runs right beside her, straining to keep pace; MORITZ jogs a little behind them, relaxed and easy. Medium shot, all three full body, mid-stride.", ""),
  ("muskelkater-im-treppenhaus", "Muskelkater im Treppenhaus", 2,
   f"On {STAIRS}, evening, one warm bulb lit. JULIA climbs slowly with one hand on the railing, her face tight with sore muscles; MORITZ stands a step above her holding a paper grocery bag, grinning with sympathy. Medium shot, both waist up or fuller.", "Svenja no sale."),
  ("zehn-kilometer-zu-zweit", "Zehn Kilometer zu zweit", 3,
   f"On {MAIN}, bright midday sun, a long flat river barge passing on the water behind them. MORITZ stands still holding his own knee, wincing; JULIA stands facing him, a hand on his shoulder, calm and decided. SVENJA waits further back holding a plain glass water bottle with no label. Medium shot, all three full body.", ""),
 ]),
 ("pets-and-animal-care", "Pets & Animal Care", ["JULIA", "MORITZ", "FLORIAN"], [
  ("ein-hund-furs-wochenende", "Ein Hund fürs Wochenende", 1,
   f"On {MAIN}, warm midday sun. FLORIAN stands holding the leash of a large brown dog that rests its heavy head on JULIA's shoe; JULIA crouches a little, smiling but tense; MORITZ stands beside her, arms crossed, watching. Medium shot, all three waist up or fuller, dog at their feet.", "El perro no lleva placa ni nombre visible."),
  ("nachts-vor-der-tur", "Nachts vor der Tür", 2,
   f"In {J_LIVING}, evening lamp light. MORITZ sits cross-legged on the floor with the large brown dog lying calmly against his side; JULIA sits on the edge of the green sofa just behind them, watching with a nervous but softening expression. Medium shot, both waist up, dog beside Moritz.", "Florian no sale."),
  ("eine-katze-im-park", "Eine Katze im Park", 3,
   f"In {PARK}, under a tall plane tree, late morning. JULIA crouches close to the large brown dog, one hand reaching slowly toward its head, her face calm and relieved; a plain grey cat sits on a low branch above them looking down. Medium shot, Julia and the dog full body, cat visible in the tree.", "Solo Julia: se queda sola con el perro y el gato."),
 ]),
 ("clothes-and-style", "Clothes & Style", ["JULIA", "THERESA"], [
  ("nichts-zum-anziehen", "Nichts zum Anziehen", 1,
   f"At {MUSEUMSUFER}, a sunny afternoon, dresses and blouses hanging from a clothes rack. JULIA holds a dark-blue dress against herself, looking into her open wallet with a worried face; THERESA stands behind her folding table, glancing at Julia's worn denim jacket covered in colourful buttons with a considering look. Medium shot, both waist up or fuller.", ""),
  ("die-jacke-aus-rostock", "Die Jacke aus Rostock", 2,
   f"Behind a thin hanging curtain at {MUSEUMSUFER}, soft daylight. THERESA kneels pinning fabric at the hem of the dark-blue dress JULIA is wearing, a small tin of pins beside her; JULIA stands very still in front of a plain freestanding mirror, looking at her own reflection with damp eyes. The mirror frame is bare plain wood with no maker's stamp, medallion, engraving or emblem anywhere on it. Medium shot, both waist up or fuller.", "Tirada 1: el marco del espejo salio con un sello/emblema translucido arriba a la derecha (texto inventado). Prompt cerrado con la clausula del marco antes de re-tirar."),
  ("ein-fleck-auf-dem-schiff", "Ein Fleck auf dem Schiff", 3,
   f"On {BOAT}, a sunny breezy afternoon. MORITZ stands frozen, an empty wine glass tipped in his hand, staring at a red stain spreading on JULIA's dark-blue dress; JULIA looks down at the stain, stricken; THERESA hurries in from the side holding a folded white cloth and a small sewing kit. Medium shot, all three waist up.", "Svenja no sale en cuadro: la boda es suya, pero queda fuera de foco."),
 ]),
 ("birthdays-and-surprises", "Birthdays & Surprises", ["JULIA", "MORITZ", "PHILIPP"], [
  ("philipps-geheimnis", "Philipps Geheimnis", 1,
   f"On {LANDING}, a cold evening, the hanging bulb lit. PHILIPP stands at Julia's open doorway, visibly nervous, holding a small folded paper list; JULIA stands in the doorway listening, one hand on the frame, surprised and pleased. Medium shot, both waist up.", ""),
  ("luftballons-im-dunkeln", "Luftballons im Dunkeln", 2,
   f"In {J_LIVING}, dim evening, plain solid-colour balloons with no print scattered around. MORITZ stands in the doorway in a bathrobe and joggers, barefoot, looking puzzled; JULIA stands just inside facing him, an awkward guilty smile. The rest of the room behind her is empty and out of focus, no other guests visible. Medium shot, both waist up.", "Los invitados no se dibujan: quedan fuera de foco detras de Julia."),
  ("uberraschung-um-acht", "Überraschung um acht", 3,
   f"In {J_LIVING}, bright warm light, plain solid-colour balloons with no print filling the room. MORITZ stands in the centre, both hands half-raised in surprise, eyes bright; JULIA stands beside him smiling, one arm still on the light switch; PHILIPP stands on his other side, grinning widely. Medium shot, all three waist up or fuller.", "Svenja, Florian y Theresa quedan fuera de foco entre los globos, sin dibujarse."),
 ]),
 ("moods-and-feelings", "Moods & Feelings", ["JULIA", "MIRIAM"], [
  ("zu-feste-hande", "Zu feste Hände", 1,
   f"In {PRAXIS_HALL}, bright daylight through a frosted window. MIRIAM stands facing JULIA, calm and steady, one hand gesturing gently toward a doorway; JULIA stands with her arms wrapped around herself, looking down at her own hands, upset. Medium shot, both waist up.", "Sin paciente en cuadro: la escena es en el pasillo, despues."),
  ("tee-im-pausenraum", "Tee im Pausenraum", 2,
   f"In {PAUSENRAUM}, grey daylight, rain streaking the window, two steaming mugs on the table. MIRIAM sits close to JULIA, holding out a folded tissue; JULIA sits with her face lowered, eyes wet, one hand around her mug. Medium shot, both waist up.", ""),
  ("genug-gelogen", "Genug gelogen", 3,
   f"In {J_LIVING}, a quiet evening, the window open to a soft grey sky. JULIA sits alone on the green sofa, her phone held up near her mouth with its plain back to the viewer, eyes closed, a calm resolved expression. Medium shot, waist up.", "Solo Julia: manda notas de voz, nadie mas sale."),
 ]),
 ("quarrels-and-making-up", "Quarrels & Making Up", ["JULIA", "MORITZ", "CAROLIN"], [
  ("alle-wissen-es", "Alle wissen es", 1,
   f"On {MAIN}, a grey windy morning, low cloud over the water. JULIA stands facing MORITZ, furious, one hand pointing at him; MORITZ stands with his palms open, apologetic; CAROLIN stands a little apart, watching them both, uneasy. Medium shot, all three waist up or fuller.", "Svenja, Florian y Theresa quedan fuera de cuadro."),
  ("kuchen-von-carolin", "Kuchen von Carolin", 2,
   f"In {J_KITCHEN}, a rainy afternoon, a round apple cake with two slices cut on a wooden board on the table. CAROLIN sits across from JULIA, speaking gently, one hand resting near the cake; JULIA sits listening, quiet, her arms loosely folded. Medium shot, both waist up.", "Moritz no sale."),
  ("zwei-becher-auf-der-treppe", "Zwei Becher auf der Treppe", 3,
   f"On {STAIRS}, early morning light. JULIA and MORITZ sit side by side on a middle step, each holding a plain ceramic mug, both looking ahead with small relieved smiles; both apartment doors behind them stand wide open. Medium shot from the side, both waist up.", ""),
 ]),
]

out = []
for topic, label, names, stories in T:
    out.append({"topic": topic, "label": label, "place": "Frankfurt am Main, Germany", "names": names, "sheet": sheet(names),
                "stories": [{"slug": s, "title": ti, "slot": sl, "prompt": HEAD + sc, "note": no} for s, ti, sl, sc, no in stories]})
json.dump(out, open("scripts/_deA1cov/portadas.json", "w"), ensure_ascii=False, indent=1)
open("scripts/_deA1cov/portadas.json", "a").write("\n")
print(f"{len(out)} temas, {sum(len(t['stories']) for t in out)} portadas")

# --- para-el-doc.txt: mismo formato que scripts/_frA2cov/para-el-doc.txt ---
doc = []
doc.append("[Journey-planning, 2026-09-14] PETICIÓN DE A1 Friends: 21 portadas + 7 cast sheets, carpeta alemania-a1-friends bajo la raíz 1sFlqVaqsLy1cGqPNpLh5JJE03Dw1rnZP")
doc.append("")
for topic, label, names, stories in T:
    doc.append(f"TEMA: {label} ({topic})")
    doc.append("Lugar: Frankfurt am Main, Germany")
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
open("scripts/_deA1cov/para-el-doc.txt", "w").write("\n".join(doc).rstrip("\n") + "\n")
print("para-el-doc.txt escrito")
