"""Compone scripts/_frA2cov/portadas.json (Friends FR A2, Nantes, Chantenay)
con el formato de scripts/_deA0cov/portadas.json: una ficha de reparto por tema
y un prompt por historia. Las fichas se escriben UNA vez y se repiten literales,
para que ningun rasgo cambie entre portadas. Escribe tambien para-el-doc.txt
desde la misma fuente. No genera nada.
  python3 scripts/_frA2cov/build.py
"""
import json

C = {
 "ROMAIN": "man, exactly 32 years old, lean athletic build, tall, fair skin, short light-brown hair, WITHOUT fringe, short neat light-brown beard, no glasses; wears an olive-green canvas work jacket over a plain grey t-shirt, dark blue jeans and tan leather work boots",
 "JUSTINE": "woman, exactly 30 years old, slim build, a head shorter than ROMAIN, light olive skin, curly black hair falling to the shoulders, WITHOUT fringe, no glasses; wears a bright yellow cotton cardigan over a plain white t-shirt, dark navy trousers and white canvas sneakers",
 "MATHILDE": "woman, exactly 30 years old, curvy build, the same height as JUSTINE, fair skin with light freckles, auburn reddish-brown hair gathered in a high messy bun, WITHOUT fringe, round black-framed glasses; wears a navy-blue knit sweater, light-grey trousers and brown leather ankle boots",
 "NATHALIE": "woman, exactly 54 years old but youthful and energetic, slim upright build, a little taller than JUSTINE, fair skin with a smooth face and only faint smile lines, short chestnut-brown hair in a neat pixie cut with warm caramel highlights, WITHOUT fringe, no grey hair, no glasses; wears a burgundy wool cardigan over a plain cream blouse, dark grey trousers and black leather loafers",
 "JULIEN": "man, exactly 34 years old, stocky build, a little shorter than ROMAIN, light-tanned skin, short dark-brown hair under a plain black baseball cap with no logo, clean-shaven, no glasses; wears a plain grey hoodie, black work trousers and black safety boots",
 "KARIM": "man, exactly 31 years old, wiry athletic build, as tall as ROMAIN, warm light-brown skin, black hair buzzed very short, clean-shaven, no glasses; wears a plain bright red t-shirt, black track trousers and grey sneakers",
 "ÉLISE": "woman, exactly 31 years old, tall slender build, a little taller than JUSTINE, fair skin, long straight blonde hair worn loose past the shoulders, WITHOUT fringe, no glasses; wears a plain white knee-length dress with short sleeves and white flat shoes",
 "ANAÏS": "woman, exactly 28 years old, petite build, a little shorter than JUSTINE, fair skin, straight light-brown hair cut to the chin, WITH a straight blunt fringe, no glasses; wears a teal-blue wool coat over a plain black turtleneck, black jeans and black ankle boots",
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
        "STYLE: Clean cel-shaded editorial illustration anchored to the published FR A0 Friends Marseille and FR A1 Friends Paris covers: thick crisp linework, "
        "flat saturated warm colour fills, white walls and pale stone, strong clear French daylight, simple graphic shadows, adult figures at middle distance, "
        "natural skin with no blush, natural eyes, bright daylight unless the scene says otherwise, 16:9 landscape.\n\n"
        "FRAMING: the characters occupy the middle third of the frame, waist-up or fuller, and the illustration fills the entire canvas edge to edge with no borders or empty margins.\n\n"
        "SCENE: ")

APT = "Justine's small bright apartment in the Chantenay district of Nantes, on the hillside above the Loire, white walls, pale wooden floorboards, tall French windows"
KITCHEN = "the small kitchen of Justine's apartment in Chantenay, Nantes, white walls, pale wooden shelves, a tall window looking over grey slate rooftops towards the wide Loire"
BALCONY = "the narrow balcony of Justine's apartment in Chantenay, Nantes, a black wrought-iron railing, grey slate rooftops below and the wide Loire river beyond"
REZE = "Nathalie's house in Rezé, just south of Nantes, a bright dining room with white walls, a long wooden table with a white tablecloth and a dark wooden sideboard"
SALLE = "an old village salle des fêtes near Nantes, a high wooden ceiling, strings of warm round bulbs, a small wooden stage"

T = [
 ("home-life-and-habits", "Home Life & Habits", ["ROMAIN", "JUSTINE"], [
  ("l-etagere-du-haut", "L'étagère du haut", 1,
   f"In the bedroom of {APT}, morning light. ROMAIN stands in front of a tall open wooden wardrobe packed full of women's coats, sweaters and boots, one hand on the door, looking at it with a polite, slightly lost expression; two plain brown cardboard boxes with no markings sit at his feet. JUSTINE stands in the bedroom doorway holding two steaming coffee cups, her face apologetic. Medium shot, both waist up or fuller.", ""),
  ("il-ronfle-elle-lit", "Il ronfle, elle lit", 2,
   f"In the bedroom of {APT} at night, only a warm bedside lamp lit, a dark window on ROMAIN's side of the bed and a white radiator on JUSTINE's side. JUSTINE sits up against the pillows, a closed paperback with a plain solid blue cover on the bedside table, one hand gently shaking ROMAIN's shoulder, looking tired; ROMAIN lies under a white duvet pulled up to his chest, one eye open, embarrassed. Medium shot across the bed, both waist up.", ""),
  ("une-chemise-pour-lundi", "Une chemise pour lundi", 3,
   f"On {BALCONY}, mild autumn afternoon under a pale cloudless sky. ROMAIN stands at a small folding drying rack pinning a crisp white shirt in the middle of his laundry, looking pleased with himself; JUSTINE leans in the open French window behind him, arms crossed, one eyebrow raised in warning. Medium shot from the side, both waist up or fuller.", ""),
 ]),
 ("jokes-and-memories", "Jokes & Memories", ["ROMAIN", "JUSTINE", "MATHILDE"], [
  ("tout-le-monde-rit", "Tout le monde rit", 1,
   f"In {APT}, evening, warm lamp light, a dinner table with a stack of golden crêpes, bowls of cider and a plain unlabelled green glass bottle. MATHILDE raises her glass high, grinning; JUSTINE sits beside her with her eyes squeezed shut and one hand over her face, laughing; ROMAIN sits across from them laughing a little too loudly, his eyes uncertain. The rest of the table is out of frame and no other guests are visible. Medium shot across the table, all three waist up.", "Solo tres de la bande en cuadro: el resto de la mesa queda fuera, para no dejar huecos sin describir."),
  ("il-y-a-douze-ans", "Il y a douze ans", 2,
   f"In the living room of {APT}, Sunday morning, soft daylight through the tall French windows. MATHILDE sits on a green sofa holding a large open photo album turned towards ROMAIN, its pages facing away from the viewer, laughing as she tells the story; ROMAIN sits beside her leaning in, a hesitant half smile, one hand rubbing the back of his neck. JUSTINE does not appear in this scene. Medium shot, both waist up.", "Justine no sale: esta corriendo junto al Loira. Las fotos del album no se ven."),
  ("monsieur-crachin", "Monsieur Crachin", 3,
   f"In {KITCHEN}, evening apéritif, warm lamp light, small bowls of olives and glasses of white wine on the table. ROMAIN stands at the head of the table telling his story, one hand raised as if showing the sky; MATHILDE sits slapping the table with her palm, laughing hard; JUSTINE sits beside her clapping, delighted. No other guests are visible. Medium shot, all three waist up.", "Solo tres de la bande en cuadro."),
 ]),
 ("family-and-manners", "Family & Manners", ["ROMAIN", "JUSTINE", "NATHALIE"], [
  ("le-vin-reste-ferme", "Le vin reste fermé", 1,
   f"At the open front door of {REZE}, a clear October midday, a pale stone doorstep and a potted rosemary. NATHALIE stands in the doorway with a composed, slightly formal smile, one hand gesturing him inside; ROMAIN stands on the doorstep holding out a tall slender plain glass wine bottle with no label, both hands on it, nervous and very polite. Medium shot from the side, both full body.", "Justine no sale: la historia no la nombra en la escena. Nathalie tiene 54: la ficha la pide juvenil, sin canas."),
  ("la-sauce-ne-tient-pas", "La sauce ne tient pas", 2,
   f"In the kitchen of Nathalie's house in Rezé, midday, white tiles and a gas hob. ROMAIN stands at the hob holding a wooden spoon over a small saucepan where the butter sauce has split into oily yellow and watery parts, a thin wisp of smoke rising, his face horrified; NATHALIE walks back in through the doorway holding a small plain white ceramic salt pot, calm and unbothered. Medium shot, both waist up.", "Justine no sale."),
  ("un-cafe-pour-romain", "Un café pour Romain", 3,
   f"In {REZE}, late afternoon, the lights back on, an empty cake plate with a few crumbs and a burnt-down candle on the table. ROMAIN stands with grey dust on his jacket and hands, a little tired, smiling; NATHALIE holds out a white cup of coffee to him with a warm, relaxed smile. Medium shot, both waist up.", "Justine no sale: esta arriba con la familia, que no se dibuja."),
 ]),
 ("housework-and-fairness", "Housework & Fairness", ["ROMAIN", "JUSTINE", "JULIEN"], [
  ("julien-compte-les-points", "Julien compte les points", 1,
   f"Inside the open side door of a plain white work van with no markings, parked on a Nantes building site at lunch break, coils of cable and toolboxes around them, bright daylight. JULIEN sits holding his phone up with its plain back to the viewer, the screen turned towards ROMAIN, explaining proudly; ROMAIN sits beside him with a half-eaten baguette sandwich, nodding, impressed. Medium shot, both waist up.", "Justine no sale: solo se la nombra."),
  ("une-liste-dans-la-tete", "Une liste dans la tête", 2,
   f"In {KITCHEN}, Saturday midday. ROMAIN kneels beside an open dishwasher holding a small repaired plastic part up proudly, grinning; JUSTINE stands over him, serious, counting on the fingers of one raised hand. A single sheet of paper lies face down on the table. Medium shot, both waist up or fuller.", "Julien no sale. El planning va boca abajo."),
  ("romain-pense-au-pain", "Romain pense au pain", 3,
   f"In {KITCHEN}, Sunday morning, soft sunlight, a round loaf of warm bread on a wooden board, two plain unlabelled glass jars of honey and jam and two coffee cups on the table. ROMAIN sets the bread down, a little shy; JUSTINE sits at the table holding a sheet of paper folded shut, smiling at him for the first time in days. Medium shot, both waist up.", "Julien no sale. La lista va plegada."),
 ]),
 ("arguments-and-apologies", "Arguments & Apologies", ["ROMAIN", "JUSTINE", "KARIM"], [
  ("encore-une-voie", "Encore une voie", 1,
   "Inside a bright indoor climbing gym in Nantes, evening, a tall grey wall covered in colourful plastic holds, no route tags, numbers or signs. ROMAIN clings to the wall a little above the ground in a climbing harness, looking down with a proud, breathless grin; KARIM stands below holding the belay rope, pointing up at the next route, laughing and cheering. Medium shot, both full body.", "Justine no sale: canta en el concierto."),
  ("tu-exageres", "Tu exagères", 2,
   f"In {KITCHEN}, midday. ROMAIN stands in the doorway holding an enormous colourful bouquet of flowers in front of his chest, hopeful; JUSTINE stands by the table with her arms crossed, looking at the flowers and then at him, hurt and unimpressed. Medium shot, both waist up.", "Karim no sale: solo manda un mensaje."),
  ("sans-mais", "Sans mais", 3,
   f"In {KITCHEN}, evening, warm light, a coffee cup steaming on the table. JUSTINE stands by the tall window singing softly, eyes half closed, hands resting on the window sill; ROMAIN sits on a kitchen chair facing her, leaning forward, one hand on his chest, listening intently. No phone is visible. Medium shot, both waist up.", "Karim no sale."),
 ]),
 ("ceremonies-and-public-speaking", "Ceremonies & Public Speaking", ["ROMAIN", "JUSTINE", "ÉLISE"], [
  ("elise-demande-un-service", "Élise demande un service", 1,
   f"In the living room of {APT}, Tuesday evening, lamp light. ÉLISE sits on a green sofa with a plain red box of chocolates on her knees, leaning forward and asking with an eager, pleading smile; JUSTINE sits beside her, amused; ROMAIN stands holding a coffee pot, hesitating. Medium shot, all three waist up.", ""),
  ("un-discours-sans-lumiere", "Un discours sans lumière", 2,
   f"At the foot of a narrow backstage wooden staircase in {SALLE}, the warm bulbs just back on. ROMAIN comes up the last steps with blackened hands, out of breath; JUSTINE, holding a sheet of paper folded shut, kisses him on the cheek; ÉLISE stands beside them wiping happy tears with the back of her hand. No guests are visible. Medium shot, all three waist up.", "Los invitados no se dibujan: la escena va junto a la escalera de detras del escenario."),
  ("trois-phrases-au-micro", "Trois phrases au micro", 3,
   f"In {SALLE}, night, warm bulbs glowing. ROMAIN stands on the small wooden stage holding a plain black microphone, nervous but smiling; JUSTINE stands just below the stage raising her glass towards him in encouragement; ÉLISE stands beside her clapping. The rest of the hall is out of frame and no guests are visible. Medium shot, all three waist up or fuller.", "Sin publico en cuadro: el tio, los primos y la tia no se dibujan."),
 ]),
 ("homesickness-and-belonging", "Homesickness & Belonging", ["ROMAIN", "JUSTINE", "ANAÏS"], [
  ("un-kouglof-pour-nantes", "Un kouglof pour Nantes", 1,
   f"In the living room of {APT}, Saturday afternoon, a round fluted kouglof cake dusted with sugar on the table. ANAÏS places a sealed white envelope blank side up and with no writing on the table, looking at her brother seriously; ROMAIN sits across from her staring at the envelope, surprised. Medium shot across the table, both waist up.", "Justine no sale: esta en la cocina y no oye nada. El sobre va cerrado y sin letras."),
  ("une-flammekueche-maison", "Une flammekueche maison", 2,
   f"In {KITCHEN}, Sunday evening, a thin rectangular flammekueche with cream and onions on a wooden board. JUSTINE has just put her fork down and stares at ROMAIN, hurt and shocked; ANAÏS sits beside her with one hand over her mouth, embarrassed; ROMAIN sits across the table looking down at his plate. Medium shot across the table, all three waist up.", ""),
  ("deux-noms-sur-la-boite", "Deux noms sur la boîte", 3,
   f"On {BALCONY}, early morning, a very fine silvery drizzle, the Loire grey and calm. JUSTINE rests her head on ROMAIN's shoulder, holding a white cup of cold coffee in both hands; ROMAIN stands beside her with one arm around her, both looking out over the river, quiet and relieved. Medium shot from behind and to the side, both waist up.", "Anais no sale. El buzon no se dibuja: llevaria los nombres escritos."),
 ]),
]

out = []
for topic, label, names, stories in T:
    out.append({"topic": topic, "label": label, "place": "Nantes, France", "names": names, "sheet": sheet(names),
                "stories": [{"slug": s, "title": ti, "slot": sl, "prompt": HEAD + sc, "note": no} for s, ti, sl, sc, no in stories]})
json.dump(out, open("scripts/_frA2cov/portadas.json", "w"), ensure_ascii=False, indent=1)
open("scripts/_frA2cov/portadas.json", "a").write("\n")
print(f"{len(out)} temas, {sum(len(t['stories']) for t in out)} portadas")

# --- para-el-doc.txt: mismo formato que scripts/_deA0cov/para-el-doc.txt ---
doc = []
doc.append("[Journey-planning, 2026-09-14] PETICIÓN FR A2 Friends: 21 portadas + 7 cast sheets, carpeta francia-a2 bajo la raíz 1sFlqVaqsLy1cGqPNpLh5JJE03Dw1rnZP")
doc.append("")
for topic, label, names, stories in T:
    doc.append(f"TEMA: {label} ({topic})")
    doc.append("Lugar: Nantes, France")
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
open("scripts/_frA2cov/para-el-doc.txt", "w").write("\n".join(doc).rstrip("\n") + "\n")
print("para-el-doc.txt escrito")
