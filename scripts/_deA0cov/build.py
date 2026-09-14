"""Compone scripts/_deA0cov/portadas.json (Friends DE A0, Bremen, Viertel)
con el formato de los portadas.json de otros journeys (FR A0 Le Panier): una
ficha de reparto por tema y un prompt por historia. Las fichas se escriben UNA
vez y se repiten literales, para que ningun rasgo cambie entre portadas. No
genera nada.
  python3 scripts/_deA0cov/build.py
"""
import json

C = {
 "ANNA": "woman, exactly 33 years old, slim build, medium height, fair skin, dark-blonde hair falling to the shoulders, WITHOUT fringe, no glasses; wears an olive-green cotton jacket over a plain white t-shirt, dark blue jeans and brown leather ankle boots",
 "JAN": "man, exactly 34 years old, stocky build, a head taller than ANNA, fair skin, short brown hair, short neat brown beard, no glasses; wears a navy-blue knit sweater over a white collared shirt, dark blue jeans and brown leather boots",
 "NELE": "woman, exactly 32 years old, athletic build, a little shorter than ANNA, light skin, short black hair in a chin-length bob, WITHOUT fringe, round tortoiseshell glasses; wears a mustard-yellow blouse, dark grey trousers and white canvas sneakers",
 "FELIX": "man, exactly 35 years old, slim build, as tall as JAN, fair skin, short curly blond hair, WITHOUT fringe, clean-shaven, no glasses; wears a plain grey t-shirt, black trousers and black sneakers",
 "JOHANNA": "woman, exactly 30 years old, sturdy build, a little taller than ANNA, fair skin with light freckles, long red hair in a single thick braid over one shoulder, WITHOUT fringe, no glasses; wears blue denim dungarees over a plain white long-sleeved top and brown leather boots",
 "TIM": "man, exactly 34 years old, muscular build, a little shorter than JAN, light-tanned skin, shaved bald head, short stubble, no glasses; wears a red-and-black checked flannel shirt, dark blue jeans and black boots",
 "LUISA": "woman, exactly 31 years old, curvy build, the same height as ANNA, olive skin, long brown hair pulled back in a low bun, WITHOUT fringe, no glasses; wears a black apron over a plain red t-shirt, dark trousers and black clogs",
 "NIKLAS": "man, exactly 36 years old, heavy build with a round belly, a little shorter than JAN, ruddy fair skin, short dark-grey hair with early streaks of grey, clean-shaven, thin rectangular black-framed glasses; wears a brown wool sweater over a checked shirt collar, grey trousers and brown leather loafers",
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
        "and clothing IDENTICAL to the sheet; only pose, framing, light and background change. Draw only the characters the scene names. "
        "No text, letters or numbers anywhere in the image. No readable surfaces, no signs, no posters, no visible writing paper, no open books, no open newspapers, "
        "no front-facing screens. Any postcard shows only its photograph side, never the written side. Any note, letter or list shows only a plain blank side or its "
        "folded outside, never legible writing. Any book spine or stack of books shows plain solid-colour spines with no titles, marks or numbers. Any die shows "
        "plain dot pips, never numerals.\n\n"
        "STYLE: Clean cel-shaded editorial illustration, smooth flat shading, crisp clean linework, vivid warm colour, natural skin with no blush, natural eyes, "
        "bright daylight unless the scene says otherwise, 16:9 landscape.\n\n"
        "FRAMING: the characters occupy the middle third of the frame, waist-up or fuller, and the illustration fills the entire canvas edge to edge with no borders or empty margins.\n\n"
        "SCENE: ")

KITCHEN = "Jan's warm kitchen inside an old Altbau building in Bremen's Viertel district, worn wooden floorboards, a few potted herbs on the windowsill, patterned tiles behind the stove"
STAIRS = "the dim wooden staircase of the old Altbau building in Bremen's Viertel, a cold black iron handrail, a small window letting in soft daylight"
HOF = "the quiet cobbled courtyard behind the Altbau building in Bremen's Viertel, a few bicycles leaning against the brick wall, ivy climbing the corner"
CELLAR = "the building's shared cellar in Bremen, one bare bulb overhead, several bicycles parked in rows against the wall"

T = [
 ("letters-and-invitations", "Letters & Invitations", ["ANNA", "JAN"], [
  ("karten-ohne-briefmarke", "Karten ohne Briefmarke", 1,
   f"In {KITCHEN}, morning light through the window, two cups of tea steaming on the table. ANNA sits with a small wooden box overflowing with postcards, every postcard lying photo side up showing colourful travel landscapes, no writing visible; JAN stands beside the table holding one postcard with its colourful photo side facing the viewer, the written side turned towards himself as he reads it aloud, eyebrows raised. Medium shot across the table, both waist up.", ""),
  ("zwolf-alte-adressen", "Zwölf alte Adressen", 2,
   f"In {KITCHEN}, afternoon light. JAN holds his phone up with the screen facing fully away from the viewer, pointing at it with one finger; ANNA sits at the table holding a folded sheet of paper close to her chest, its written side turned away from the viewer, a pen in her other hand. Two postcards lie photo side up on the table, colourful travel landscapes, their written versos hidden beneath. Medium shot across the table, both waist up.", ""),
  ("funf-marken-am-sonntag", "Fünf Marken am Sonntag", 3,
   f"Outside on a quiet cobbled street corner in Bremen's Viertel, late afternoon, a tall bright yellow German mailbox against an ochre building facade. ANNA holds a small stack of postcards flat against her body, colourful photo sides facing the viewer, about to slide them into the mailbox slot; JAN stands close behind her with one arm resting on her shoulder, watching. A small booklet of plain solid-colour stamp squares, no pictures or markings, peeks from his other hand. Medium shot from the side, both full body.", ""),
 ]),
 ("looks-and-memories", "Looks & Memories", ["ANNA", "JAN", "NELE"], [
  ("fotos-am-kuhlschrank", "Fotos am Kühlschrank", 1,
   f"In {KITCHEN}, midday, a large white refrigerator covered edge to edge with photographs held by small magnets. NELE stands beside the fridge with a camera hanging from her neck, one hand raised in a wave; ANNA stands in front of the fridge scanning the photos closely, one finger touching an empty patch of white door where no photo hangs. JAN stirs a pot at the stove behind them. Medium shot, all three waist up or fuller.", ""),
  ("die-brille-von-fruher", "Die Brille von früher", 2,
   f"In {KITCHEN}, afternoon. NELE kneels slightly, holding up her camera to her eye, aiming it at ANNA; ANNA sits at the table with one old square photograph face down in front of her, hands covering her own face halfway, peeking through her fingers, embarrassed. JAN stands in the doorway behind them wearing a pair of round vintage glasses, grinning. Medium shot, all three visible, waist up.", ""),
  ("ein-rahmen-fur-drei", "Ein Rahmen für drei", 3,
   f"On {STAIRS}, cold blue morning light. ANNA sits on a middle step holding a small wooden picture frame in her lap with two photographs face down beside her on the step; JAN stands one step below her, looking up, one hand resting on the railing. NELE does not appear in this scene. Medium shot from the side, both full body.", "NELE no sale: la escena es solo Anna y Jan en la escalera."),
 ]),
 ("games-and-rules", "Games & Rules", ["ANNA", "JAN", "FELIX"], [
  ("felix-erklart-zu-schnell", "Felix erklärt zu schnell", 1,
   f"In {KITCHEN}, evening, warm lamp light, a board game spread across the table with small blank wooden pieces and a single red die marked only with plain dot pips. FELIX sits across the table gesturing quickly with both hands over the board; ANNA sits beside JAN holding the red die loosely, looking a little lost; JAN sits close beside her, watching the board. Medium shot across the table, all three waist up.", ""),
  ("annas-roter-wurfel", "Annas roter Würfel", 2,
   f"In {KITCHEN} late at night, only one warm lamp lit, an old cracked wooden game board on the table with a small open box beside it. ANNA holds a single red die marked only with plain dot pips tightly in her closed hand, resting it against her chest; JAN sits across from her arranging a few blank game pieces on the board, glancing up at her. FELIX does not appear in this scene. Close medium shot, both waist up.", "Felix no sale: la escena es solo Anna y Jan en la cocina."),
  ("eine-vier-im-hof", "Eine Vier im Hof", 3,
   f"In {HOF}, bright afternoon, a small folding table with a board game on it near the cobblestones, an iron floor grate nearby. ANNA stands with both arms raised high in victory, mouth open in a joyful shout; FELIX sits at the table looking down at the grate with one hand reaching towards it, a rueful smile on his face. JAN does not appear in this scene. Medium shot, both full body.", "Jan no sale: la escena es solo Anna y Felix en el patio."),
 ]),
 ("books-and-reading", "Books & Reading", ["ANNA", "JAN", "JOHANNA"], [
  ("bucher-auf-der-treppe", "Bücher auf der Treppe", 1,
   f"On {STAIRS}, in front of a tall wooden bookcase built into the wall, packed with books of every size, every spine a plain solid colour with no titles, marks or numbers. JOHANNA stands beside the bookcase holding a stack of books against one hip, their spines also plain solid colours, a pencil tucked behind her ear; ANNA sits on a step below her, looking up, hands resting on her knees. JAN does not appear in this scene. Medium shot, both full body.", "Jan no sale: solo se le nombra."),
  ("zettel-in-johannas-dose", "Zettel in Johannas Dose", 2,
   f"On {STAIRS}, seated together on a wide step, a small round metal tin open between them overflowing with tiny folded notes, none of them unfolded or legible. JOHANNA holds one folded note up, laughing; ANNA holds a single small yellow folded note pressed flat against her chest with both hands, eyes closed. JAN does not appear in this scene. Close medium shot, both waist up.", "Jan no sale: solo se le nombra."),
  ("seite-vierzig", "Seite vierzig", 3,
   f"In {KITCHEN}, evening, a pot simmering on the stove. JAN stands at the stove holding a green hardcover book closed against his chest, its spine a plain solid green with no title or lettering of any kind; ANNA stands close beside him holding a small yellow folded note flat in her palm, looking at the book rather than the viewer. A wooden bookshelf with a framed photo and books with plain solid-colour spines stands in the background. Medium shot, both waist up.", "Johanna no sale: solo trajo el libro antes de esta escena."),
 ]),
 ("music-and-singing", "Music & Singing", ["ANNA", "JAN", "TIM"], [
  ("tims-trommelstocke", "Tims Trommelstöcke", 1,
   f"In {KITCHEN}, afternoon, a teapot and two cups on the table. TIM stands holding two wooden drumsticks crossed in one hand, leaning in and speaking quietly; ANNA sits at the table holding a teacup with both hands, turning it slowly, looking uncertain. JAN does not appear in this scene. Medium shot, both waist up.", "Jan no sale: está en el patio."),
  ("zu-hoch-fur-anna", "Zu hoch für Anna", 2,
   f"In {CELLAR}, dim overhead light, a small drum kit set up between the parked bicycles. TIM sits behind the drum kit holding his sticks mid-strike; ANNA stands in front of him holding a single sheet of paper folded in half, its written side turned away from the viewer, one hand pressed to her own throat. JAN does not appear in this scene. Medium shot, both full body.", "Jan no sale: no participa del ensayo."),
  ("ein-lied-fur-jan", "Ein Lied für Jan", 3,
   f"In {KITCHEN}, evening, a birthday cake covered in many small lit candles on the table, the room dim except for warm candlelight and one lamp. ANNA stands holding a microphone with both hands, singing, eyes closed; TIM sits at the drum kit behind her, sticks raised mid-beat; JAN stands across the table wiping one eye with his sleeve, smiling. Medium shot, all three waist up.", ""),
 ]),
 ("cooking-and-hosting", "Cooking & Hosting", ["ANNA", "JAN", "LUISA"], [
  ("ein-rezept-fur-zehn", "Ein Rezept für zehn", 1,
   f"In {KITCHEN}, midday, three large steel pots on the stove. LUISA stands at the stove in a black apron with several small stains, tasting from a large pot with a wooden spoon; ANNA stands at the counter cutting onions on a wooden board, eyes watering, a small folded paper recipe card lying blank side up beside her hand. JAN does not appear in this scene. Medium shot, both waist up or fuller.", "Jan no sale: la escena es solo Anna y Luisa cocinando."),
  ("jans-lieblingstopf", "Jans Lieblingstopf", 2,
   f"In {KITCHEN}, afternoon, thin grey smoke rising from a large dented pot on the stove. JAN stands in the doorway coughing, one hand waving at the air; ANNA stands at the stove holding the pot's hot lid carefully with a folded cloth in one hand, her other hand near her mouth, distressed. LUISA does not appear in this scene. Medium shot, both waist up.", "Luisa no sale: la escena es solo Anna y Jan en la cocina."),
  ("sechs-kleine-suppen", "Sechs kleine Suppen", 3,
   f"In {KITCHEN}, evening, six small mismatched pots lined up on the stove and table, a mix of odd plates and spoons laid out. LUISA stands seasoning one pot with a pinch of herbs; ANNA stands beside her cutting carrots on a board; JAN sits at the far end of the table with a bowl in front of him, spoon raised, mid bite. Wide shot, all three visible, waist up or fuller.", ""),
 ]),
 ("plans-and-decisions", "Plans & Decisions", ["ANNA", "JAN", "NIKLAS"], [
  ("eine-notiz-an-annas-tur", "Eine Notiz an Annas Tür", 1,
   f"On {STAIRS}, in front of a plain wooden door with a small folded note taped to it, its written side turned fully towards the door and away from the viewer. ANNA leans on the iron railing reading the note, her expression pale; NIKLAS stands a step below her in his brown sweater, one hand raised as if clearing his throat. JAN does not appear in this scene. Medium shot, both full body.", "Jan no sale: solo se le nombra."),
  ("die-liste-am-kuhlschrank", "Die Liste am Kühlschrank", 2,
   f"In {KITCHEN}, night, only the light from inside the open refrigerator and one small lamp. ANNA stands in front of the fridge holding a sheet of paper flat against its door with one hand, a pen in the other, the written side of the paper facing fully away from the viewer; JAN stands beside her, yawning, one hand rubbing his eye. NIKLAS does not appear in this scene. Medium shot, both waist up.", "Niklas no sale: la escena es solo Anna y Jan de noche."),
  ("die-karte-vom-mai", "Die Karte vom Mai", 3,
   f"In {KITCHEN}, evening, warm lamp light, two glasses of sparkling wine catching the light on the table. JAN stands at the open refrigerator holding a single postcard with its colourful photo side facing the viewer, the written side turned towards himself as he reads it, a small round plain magnet in his other hand; ANNA stands close beside him, watching him read it, her hand resting lightly on his arm. NIKLAS does not appear in this scene. Close medium shot, both waist up.", "Niklas no sale: ya se fue tras firmar el contrato."),
 ]),
]

out = []
for topic, label, names, stories in T:
    out.append({"topic": topic, "label": label, "place": "Bremen, Germany", "names": names, "sheet": sheet(names),
                "stories": [{"slug": s, "title": ti, "slot": sl, "prompt": HEAD + sc, "note": no} for s, ti, sl, sc, no in stories]})
json.dump(out, open("scripts/_deA0cov/portadas.json", "w"), ensure_ascii=False, indent=1)
open("scripts/_deA0cov/portadas.json", "a").write("\n")
print(f"{len(out)} temas, {sum(len(t['stories']) for t in out)} portadas")

# --- para-el-doc.txt: mismo formato que scripts/_frA1cov/para-el-doc.txt ---
doc = []
doc.append("[Journey-planning, 2026-09-13] PETICIÓN DE A0 Friends: 21 portadas + 7 cast sheets, carpeta alemania-a0-friends bajo la raíz 1sFlqVaqsLy1cGqPNpLh5JJE03Dw1rnZP")
doc.append("")
for topic, label, names, stories in T:
    doc.append(f"TEMA: {label} ({topic})")
    doc.append("Lugar: Bremen, Germany")
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
open("scripts/_deA0cov/para-el-doc.txt", "w").write("\n".join(doc).rstrip("\n") + "\n")
print("para-el-doc.txt escrito")
