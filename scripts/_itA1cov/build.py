"""Compone scripts/_itA1cov/portadas.json (Friends IT A1, Milano, casa di ringhiera
en via Padova; Elisa, Davide y el perro Biscotto) con el formato de
scripts/_frB1cov/portadas.json: una ficha de reparto por tema y un prompt por
historia. Las fichas se escriben UNA vez y se repiten literales, para que ningun
rasgo cambie entre portadas. Escribe tambien para-el-doc.txt desde la misma
fuente. No genera nada.
  python3 scripts/_itA1cov/build.py
"""
import json

C = {
 "ELISA": "woman, exactly 33 years old, slim build, medium height, fair skin, light-brown straight hair falling loose to the shoulders, WITHOUT fringe, no glasses; wears a bottle-green knit cardigan over a plain black top, dark-grey jeans and white canvas trainers",
 "DAVIDE": "man, exactly 34 years old, lean athletic build, a head taller than ELISA, light olive skin, short straight black hair, WITHOUT fringe, a short neat black beard, no glasses; wears a plain bright-red hooded sweatshirt with no print, dark-blue jeans and grey trainers",
 "NICOLA": "man, exactly 38 years old, stocky broad-shouldered build, a little shorter than DAVIDE, ruddy fair skin, completely shaved head, a thick chestnut-brown moustache and no beard, no glasses; wears a plain high-visibility yellow vest with no lettering and no logo over a light-blue shirt, navy trousers and black shoes",
 "SERENA": "woman, exactly 36 years old, shorter and fuller-figured than ELISA, medium olive skin, black curly hair gathered in a high bun, WITHOUT fringe, round tortoiseshell glasses; wears a pearl-grey wool jumper, black trousers and black flat shoes",
 "NOEMI": "woman, exactly 41 years old, tall sturdy broad-shouldered build, taller than ELISA, sun-tanned skin, short blonde hair cut above the ears, WITHOUT fringe, no glasses, no grey hair; wears a light-blue veterinary coat with no badge over navy scrub trousers and white clogs",
 "TOMMASO": "man, exactly 45 years old but energetic, no grey hair anywhere, heavy solid build, as tall as DAVIDE, warm tanned skin, short brown hair receding at the temples, a short full dark-brown beard, no glasses; wears a brown leather work apron over a navy-and-white checked shirt with rolled sleeves, beige work trousers and brown boots",
 "GABRIELE": "man, exactly 29 years old, slim wiry build, a little shorter than DAVIDE, fair skin, short curly blond hair, clean-shaven, no glasses; wears a plain white t-shirt, a plain royal-blue baseball cap with no logo, khaki shorts and blue canvas shoes",
 "ARIANNA": "woman, exactly 31 years old, petite slim build, a little shorter than ELISA, warm olive-tan skin, long dark-brown hair in a single thick braid over one shoulder, WITHOUT fringe, no glasses; wears a light-wash denim jacket over a plain white t-shirt, black leggings and tan leather sandals",
}
DOG = "BISCOTTO: a medium-sized lean mixed-breed dog, short smooth pure-white coat with no spots, exactly ONE black ear (its left ear) while its right ear is white, soft floppy ears folding forward, a black nose, brown eyes and a long thin white tail"
COLLAR = "; it wears a plain red collar with no tag"
POS = {2: ["LEFT", "RIGHT"], 3: ["LEFT", "CENTER", "RIGHT"]}

def sheet(names, dog):
    n = len(names)
    parts = [f"{POS[n][i]} is {nm}: {C[nm]}." for i, nm in enumerate(names)]
    return ("Character model sheet for a story series, clean cel-shaded editorial illustration, crisp clean linework, flat vivid warm colour fills, "
            "plain pure white background, landscape 16:9.\n\n"
            f"Exactly {n} adult characters and one dog, drawn as a reference sheet: top row shows all of them full body from head to feet, standing straight, "
            "front view, neutral expression, natural skin with no blush, natural eyes, with the dog sitting in front of them in side view; "
            "bottom row shows the same characters as head and shoulders close ups and the dog's head in three-quarter view.\n\n"
            + "\n\n".join(parts)
            + f"\n\nIn front of them sits {dog}."
            + "\n\nNo two characters wear the same garment or the same colour. Generous white margin around every figure, no props, no other animals, no scenery, "
            "no shadows on the background, and absolutely no text, labels or numbers anywhere in the image.")

HEAD = ("LOCK: The image provided is the cast sheet for this story. KEEP every character's face, hair, facial hair, body build, height difference, skin tone "
        "and clothing IDENTICAL to the sheet, and KEEP the dog BISCOTTO identical to the sheet (white coat, one black left ear); only pose, framing, light and background change. "
        "No two characters wear the same garment or the same colour: each wears only what the sheet gives them. "
        "Draw only the characters the scene names, and no other people: no children, no teenagers, no elderly people, no crowd, no passers-by, not even in the background or at a window. "
        "The only animal is BISCOTTO the dog, and only when the scene names it. "
        "No text, letters or numbers anywhere in the image. No readable surfaces, no signs, no shop signs, no posters, no house numbers, no visible writing paper, no open books, "
        "no open notebooks, no open newspapers, no front-facing screens: any phone shows only its plain back and any laptop is closed. Any paper, note, list, letter or envelope "
        "is folded shut or lies face down, never legible writing. Any bottle, jar or box is plain with no label. Any bank card is a plain solid colour with no numbers. "
        "Any vehicle has no number plate and no markings.\n\n"
        "STYLE: Clean cel-shaded editorial illustration anchored to the published FR A0 Friends Marseille cover 'Le fauteuil descend' (two women carrying a green armchair "
        "down a pale stone staircase with a black wrought-iron handrail): thick crisp linework, flat saturated warm colour fills, warm ochre and pale-yellow Milanese plaster walls, "
        "dark-green wooden shutters, black wrought-iron railings, grey stone steps, simple graphic shadows, adult figures at middle distance with realistic adult proportions, "
        "natural skin with no blush, natural eyes, bright and warm even at night, 16:9 landscape.\n\n"
        "FRAMING: the characters occupy the middle third of the frame, waist-up or fuller, and the illustration fills the entire canvas edge to edge with no borders or empty margins.\n\n"
        "SCENE: ")

T = [
 ("pets-and-strays", "Pets & Strays", ["ELISA", "DAVIDE"], DOG, [
  ("un-cane-alla-ringhiera", "Un cane alla ringhiera", 1,
   "In the cobbled inner courtyard of an old casa di ringhiera on via Padova in Milan, at the foot of the stone staircase, two o'clock at night, heavy rain, the wet cobbles shining under one warm lamp above a green door. BISCOTTO, thin, soaked and trembling, with no collar, is tied by a short rope to the black iron railing of the stairs. DAVIDE crouches beside the dog untying the rope with both hands, hair wet, sleepy and resigned; ELISA stands over them in the rain holding open a plain navy-blue silk scarf ready to dry the dog, her wet hair stuck to her neck, anxious. Medium shot, both waist up or fuller.", "Davide va con su sudadera roja, no en pijama: la ficha manda. El foulard es la unica pieza de la divisa."),
  ("due-ciabatte-in-meno", "Due ciabatte in meno", 2,
   "In DAVIDE's small first-floor living room in the casa di ringhiera, bright morning sun through a tall window with green shutters open, a worn mustard-yellow sofa, a terracotta tiled floor. DAVIDE sits on the edge of the sofa holding up one chewed brown slipper, trying not to laugh; BISCOTTO, still with no collar, sits squarely on DAVIDE's feet looking up at him adoringly; ELISA leans against the window frame with her phone in one hand, its plain back to the viewer, laughing. Medium shot, both waist up or fuller.", "Sin collar todavia: se compra en la 3."),
  ("meta-e-meta", "Metà e metà", 3,
   "On the long first-floor iron-railed balcony walkway of the casa di ringhiera, outside DAVIDE's green front door, early morning, low golden light, two terracotta pots of geraniums against the ochre wall, the courtyard visible below through the black railing. BISCOTTO eats from a new plain steel bowl on the floor, wearing a brand-new plain red collar with no tag; ELISA kneels beside the dog with one hand resting on its back, biting her lip, torn; DAVIDE stands leaning on the railing holding up three fingers of one hand, counting out the plan, practical. Medium shot, both waist up or fuller.", "Primera escena con el collar rojo: desde aqui la ficha del perro lo lleva."),
 ]),
 ("work-and-shifts", "Work & Shifts", ["ELISA", "DAVIDE", "NICOLA"], DOG + COLLAR, [
  ("quattro-sabati-per-nicola", "Quattro sabati per Nicola", 1,
   "On a quiet tree-lined residential street in NoLo, Milan, no shopfronts or facades in view, just plain apartment building walls and a row of plane trees, early afternoon, dappled shade on the pavement. NICOLA sits astride a plain yellow bicycle with no markings, one foot on the ground, turning back over his shoulder with a sly grin and holding up four fingers of one hand; DAVIDE stands beside the bicycle with one hand on his chest, grateful and relieved; ELISA stands a step back in the shade holding BISCOTTO's lead, frowning at DAVIDE. Medium shot, all three waist up or fuller.", "Sin fachada de Correos: calle arbolada sin comercios, para no invitar a un rotulo."),
  ("otto-ore-da-solo", "Otto ore da solo", 2,
   "On the third-floor landing inside the old stone stairwell of the casa di ringhiera, two o'clock in the afternoon, a shaft of dusty sunlight from a small high window, worn grey stone steps and a black iron banister, ELISA's green door standing open. ELISA sits on the stone floor in front of the door hugging BISCOTTO tightly, eyes closed, tired and guilty; BISCOTTO wags and licks her chin; DAVIDE stands two steps below with one hand gripping the banister, sad, his head lowered. Medium shot, both waist up or fuller.", "Nicola no sale: solo habla por telefono al principio. La nota de la vecina no aparece."),
  ("il-calendario-sul-frigo", "Il calendario sul frigo", 3,
   "In ELISA's bright third-floor kitchen, early morning light, pale-blue painted cupboards, a small round wooden table, a plain white fridge with two round red magnets and nothing else on its door. DAVIDE stands by the fridge holding a large sheet of paper rolled up tight, ready to hang it, hopeful; ELISA sits at the table with both hands around a white coffee cup, looking up at him with a decided, serious face; BISCOTTO lies under the table. Medium shot, both waist up or fuller.", "Nicola no sale. La hoja va ENROLLADA: un calendario abierto sale siempre con numeros."),
 ]),
 ("neighbours-and-noise", "Neighbours & Noise", ["ELISA", "DAVIDE", "SERENA"], DOG + COLLAR, [
  ("concerto-al-secondo-piano", "Concerto al secondo piano", 1,
   "On the second-floor iron-railed balcony walkway of the casa di ringhiera, one o'clock in the afternoon, hard white midday sun and short sharp shadows, a row of closed dark-green shutters behind, a line of drying laundry out of focus across the courtyard. SERENA stands in front of her open window holding a closed laptop flat against her chest with both arms, stern and tired; DAVIDE stands facing her with a bunch of keys in one hand, rubbing the back of his neck with the other, embarrassed and nervous. Close medium shot, both waist up.", "Elisa no sale: esta volando a Palermo. El perro no sale: aulla detras de la puerta del tercero."),
  ("le-regole-del-cortile", "Le regole del cortile", 2,
   "In the courtyard of the casa di ringhiera at dusk, the evening condominium meeting, a string of warm bulbs overhead, a plain ground-floor wall with closed green shutters behind. DAVIDE has just stood up from a folding wooden chair with one hand raised like a promise, sincere; BISCOTTO sleeps curled up under DAVIDE's empty chair; ELISA sits on the next folding chair looking up at DAVIDE, worried, both hands on her knees; SERENA stands facing them holding a small note folded shut, her mouth firm, still upset but listening. Tight medium shot on these three only, all three waist up or fuller; there are no other chairs and nobody else in the frame.", "El administrador y los treinta vecinos quedan fuera: encuadre cerrado, sin sillas de mas que inviten a rellenar."),
  ("giovedi-senza-calcetto", "Giovedì senza calcetto", 3,
   "Inside SERENA's cosy second-floor flat at nine o'clock at night, warm lamp light, a round rust-red rug, a wooden desk with a closed laptop and a green desk lamp, a bookshelf of plain solid-colour book spines with no titles. DAVIDE kneels on the rug scooping BISCOTTO up into his arms, laughing with relief; BISCOTTO licks his beard; SERENA sits sideways on her desk chair with one hand on the closed laptop, amused and friendly. Medium shot, both waist up or fuller.", "Elisa no sale. El movil con la foto del equipo no aparece."),
 ]),
 ("bills-and-expenses", "Bills & Expenses", ["ELISA", "DAVIDE", "NOEMI"], DOG + COLLAR, [
  ("chi-paga-il-calzino", "Chi paga il calzino?", 1,
   "In a small neighbourhood veterinary clinic on via Padova late at night, cool white ceiling light, bare pale-green walls with nothing hanging on them, a steel examination table. BISCOTTO lies on the table, drowsy but safe; NOEMI stands behind the table holding up a small striped sock pinched in long steel tweezers, relieved; ELISA stands at the end of the table holding out a plain dark-blue bank card, her eyes closed for a moment; DAVIDE stands beside ELISA with one hand on the dog's back, embarrassed. Medium shot, all three waist up.", "Sin carteles ni lamina anatomica en la pared: la pared va desnuda."),
  ("anche-il-caffe", "Anche il caffè?", 2,
   "In DAVIDE's tiny first-floor kitchen in the evening, one low pendant lamp over a narrow table, white and cobalt-blue patterned wall tiles, a dark window. DAVIDE presses one flat hand down on a closed plain black notebook on the table, speaking loudly, hurt; ELISA sits across from him holding a yellow pencil, her mouth open, caught out. Tight shot across the table, both waist up.", "Noemi y el perro no salen. El cuaderno va CERRADO. Cocina de Davide, no la de Elisa de la 6."),
  ("davide-vende-la-bici", "Davide vende la bici", 3,
   "On the high third-floor iron-railed balcony walkway of the casa di ringhiera at sunset, seen from beside them, the courtyard far below in long orange light with one empty iron bicycle rack against the wall. ELISA leans on the railing looking down at the empty rack, sad and surprised; DAVIDE stands beside her holding out a plain white envelope folded shut, a proud, awkward smile; BISCOTTO sits between their feet. Medium shot, both waist up or fuller.", "Noemi no sale. El comprador (un 'ragazzo giovane') NO sale: seria un adolescente. Se cuenta con el hueco de la bici."),
 ]),
 ("repairs-and-diy", "Repairs & DIY", ["ELISA", "DAVIDE", "TOMMASO"], DOG + COLLAR, [
  ("tre-gambe-e-mezzo", "Tre gambe e mezzo", 1,
   "At the open double wooden doors of a small carpenter's workshop on the ground floor of the courtyard, fresh morning light, stacked planks and a sawhorse inside in soft shadow, curls of wood shavings on the threshold. TOMMASO leans in the doorway wiping his hands on a cloth, giving advice with a raised eyebrow; DAVIDE stands in front of him with an old dark-wood chair tucked under one arm, chin up, overconfident; ELISA stands beside DAVIDE holding the broken chair leg in both hands, worried. Medium shot, all three waist up or fuller.", "El perro no sale. Sin rotulo en la bottega. Tommaso sin barba gris (el plan la tenia): una barba gris lo envejece en portada."),
  ("davide-prende-il-trapano", "Davide prende il trapano", 2,
   "In ELISA's kitchen on a Sunday afternoon, seen low from floor level, the terracotta floor covered in fine sawdust, the old dark-wood chair wobbling on three legs and a half. DAVIDE sits on the floor with his back against a cupboard, a cordless drill hanging from one hand, exhausted and defeated; ELISA stands over him with one hand over her mouth, laughing and crying at once; BISCOTTO peeks out from under the table, dusty. Medium shot, both waist up or fuller.", "Tommaso no sale. Movil con el video fuera de cuadro. Encuadre a ras de suelo, no el de la mesa de la 6."),
  ("una-gamba-diversa", "Una gamba diversa", 3,
   "Inside TOMMASO's carpenter's workshop, warm late-afternoon light through a dusty window, a long workbench, hand tools hanging on the wall with no labels, drifting wood shavings. ELISA sits carefully on the repaired old chair, which now has three dark-brown legs and one new pale wood leg, her face lighting up in surprise; TOMMASO stands behind the chair with one hand on its backrest, satisfied; DAVIDE crouches beside it brushing sawdust off his sleeve, sheepish; BISCOTTO sniffs the new pale leg. Medium shot, all three waist up or fuller.", ""),
 ]),
 ("summer-and-holidays", "Summer & Holidays", ["ELISA", "DAVIDE", "GABRIELE"], DOG + COLLAR, [
  ("milano-e-vuota", "Milano è vuota", 1,
   "In the doorway of ELISA's tiny bathroom on a hot August night, sticky heat, blue night light from a small open window and a warm glow from the hall, pale-blue square floor tiles. BISCOTTO lies stretched flat on the cool tiles; ELISA sits on the tiled floor beside the dog with her back against the door frame, fanning herself with a folded paper fan, half laughing at the heat. Medium shot, waist up or fuller.", "Solo Elisa y el perro: Davide esta en Puglia y Gabriele aun no sale."),
  ("gabriele-non-chiude-mai", "Gabriele non chiude mai", 2,
   "On a sun-baked street corner in NoLo at noon in August, empty and bright, a traditional green cast-iron Milanese drinking fountain running with water, the plain striped awning of a small gelato shop with no sign, deep blue sky. BISCOTTO drinks from the fountain's stream; GABRIELE has just stepped out of the shop and holds out a small paper cup of pink strawberry gelato towards the dog, smiling; ELISA stands beside the fountain holding her own small cup of green pistachio gelato, laughing in surprise. Medium shot, both waist up or fuller.", "Davide no sale. Sin gato, abeja ni coches: el unico animal es el perro."),
  ("davide-torna-prima", "Davide torna prima", 3,
   "On the empty pavement just outside the portone of the casa di ringhiera on via Padova at five o'clock in the morning, pale pink dawn light, the ochre facade behind, the street silent and empty. DAVIDE stands on the pavement with a dark-blue backpack still on one shoulder, slightly sun-tanned, having just arrived, grinning; BISCOTTO leaps up at him on its lead; ELISA stands facing him holding the lead with both hands, moved and grateful. Medium shot, both waist up or fuller; the street is completely empty of other people.", "Se saca de la estacion (paneles, relojes, rotulos) al portone del cortile, sin rotulacion. Gabriele no sale."),
 ]),
 ("couples-and-living-together", "Couples & Living Together", ["ELISA", "DAVIDE", "ARIANNA"], DOG + COLLAR, [
  ("arianna-starnutisce", "Arianna starnutisce", 1,
   "Just inside the big open wooden entrance doors of the casa di ringhiera courtyard on a bright September Saturday morning, a stack of plain brown cardboard boxes with no markings on the cobbles, a potted lemon tree by the wall. ARIANNA crouches to stroke BISCOTTO with one hand while sneezing into the crook of her other elbow; DAVIDE stands behind her carrying one plain box on his shoulder, laughing; ELISA stands to the side holding one plain box in both arms, smiling warmly. Medium shot, all three waist up or fuller.", "Encuadre en el portone, no al pie de la escalera de la 1."),
  ("davide-dorme-sulle-scale", "Davide dorme sulle scale", 2,
   "On the cold stone steps just outside DAVIDE's first-floor door late at night, one dim yellow wall lamp, deep blue shadows in the stairwell. DAVIDE sits on a step with a grey wool blanket around his shoulders and BISCOTTO pressed warm against his side, one hand in the dog's fur, tired; ELISA sits down on the step just below him, turned towards him, one hand on his knee, gently worried. Close medium shot, both waist up.", "Arianna no sale: duerme dentro. La manta gris sustituye al 'maglione grigio' para no romper la ficha de Davide."),
  ("si-chiama-biscotto", "Si chiama Biscotto", 3,
   "In ELISA's sunny third-floor living room on an October afternoon, a tall window with green shutters open onto the railing, a low shelf of green plants, a small wooden coffee table. ELISA holds out a new plain red collar with one small blank round metal tag towards DAVIDE, a quiet smile; DAVIDE takes it in one hand, surprised and moved; ARIANNA stands beside DAVIDE holding a pink cake box with both hands, tears of happiness in her eyes; BISCOTTO sits at ELISA's feet wearing its usual plain red collar. Medium shot, all three waist up or fuller.", "El nombre NO se escribe en la placa: placa lisa. Momento de la entrega del collar, no el cortile de la escena final (ya hay balcones en 3, 7 y 12)."),
 ]),
]

out = []
for topic, label, names, dog, stories in T:
    out.append({"topic": topic, "label": label, "place": "Milan, Italy", "names": names + ["BISCOTTO"], "sheet": sheet(names, dog),
                "stories": [{"slug": s, "title": ti, "slot": sl, "prompt": HEAD + sc, "note": no} for s, ti, sl, sc, no in stories]})
json.dump(out, open("scripts/_itA1cov/portadas.json", "w"), ensure_ascii=False, indent=1)
open("scripts/_itA1cov/portadas.json", "a").write("\n")
print(f"{len(out)} temas, {sum(len(t['stories']) for t in out)} portadas")

# --- para-el-doc.txt: mismo formato que scripts/_frB1cov/para-el-doc.txt ---
doc = []
doc.append("[Journey-planning-2] PETICIÓN IT A1 Friends: 21 portadas + 7 cast sheets, carpeta italia-a1-friends bajo la raíz 1sFlqVaqsLy1cGqPNpLh5JJE03Dw1rnZP")
doc.append("")
for topic, label, names, dog, stories in T:
    doc.append(f"TEMA: {label} ({topic})")
    doc.append("Lugar: Milan, Italy")
    doc.append("Reparto:")
    for nm in names:
        doc.append(f"- {nm}: {C[nm]}.")
    doc.append(f"- {dog}.")
    doc.append("")
    doc.append("CAST SHEET:")
    doc.append(sheet(names, dog))
    doc.append("")
    for i, (s, ti, sl, sc, no) in enumerate(stories, start=1):
        doc.append(f"PORTADA {i}: {ti} ({s})")
        doc.append(HEAD + sc)
        doc.append(f"note: {no}")
        doc.append("")
    doc.append("")
open("scripts/_itA1cov/para-el-doc.txt", "w").write("\n".join(doc).rstrip("\n") + "\n")
print("para-el-doc.txt escrito")
