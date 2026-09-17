"""Compone scripts/_itA0cov/portadas.json (Friends IT A0, Genova, palazzo del
centro storico) con el formato de scripts/_frA2cov/portadas.json: una ficha de
reparto por tema y un prompt por historia. Las fichas se escriben UNA vez y se
repiten literales, para que ningun rasgo cambie entre portadas. Escribe tambien
para-el-doc.txt desde la misma fuente. No genera nada.
  python3 scripts/_itA0cov/build.py
"""
import json

C = {
 "ALICE": "woman, exactly 34 years old, slim build, medium height, light olive skin, dark-brown straight hair cut in a bob to the jawline, WITH a straight blunt fringe, no glasses; wears a mustard-yellow knit cardigan over a plain white t-shirt, dark blue jeans and white canvas sneakers",
 "MATTEO": "man, exactly 35 years old, broad sturdy build, tall, a head taller than ALICE, tanned skin, short curly black hair, WITHOUT fringe, short neat black beard, no glasses; wears a plain navy-blue t-shirt, beige canvas trousers and brown leather boat shoes",
 "FRANCESCA": "woman, exactly 33 years old, tall slender build, a little taller than ALICE, fair skin with light freckles, long straight golden-blonde hair pulled back in a high ponytail, WITHOUT fringe, no glasses; wears an emerald-green light zip jacket over a plain white t-shirt, light-grey jeans and grey sneakers",
 "RICCARDO": "man, exactly 36 years old, stocky build, a little shorter than MATTEO, pale fair skin, completely shaved head, full thick black beard, rectangular black-framed glasses; wears a light sky-blue crew-neck sweater, dark charcoal-grey trousers and black leather shoes",
 "FEDERICA": "woman, exactly 31 years old, petite build, a little shorter than ALICE, fair skin, long curly copper-red hair falling past the shoulders, WITHOUT fringe, no glasses; wears a bright orange hooded raincoat over a plain black sweater, black jeans and black rubber ankle boots",
 "LORENZO": "man, exactly 38 years old, lean build, the same height as MATTEO, light skin, short straight chestnut-brown hair, WITHOUT fringe, clean-shaven, no glasses; wears a plain white cotton apron over a plain black t-shirt, grey trousers and black clogs",
 "VALENTINA": "woman, exactly 30 years old, tall slim build, a little taller than ALICE, warm light-brown skin, long straight glossy black hair worn loose to the middle of the back, WITHOUT fringe, no glasses; wears a plum-purple light spring coat over a plain grey sweater, black trousers and black ankle boots",
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
        "no children, no teenagers, no elderly people, no crowd, no spectators, not even in the background. "
        "No text, letters or numbers anywhere in the image. No readable surfaces, no signs, no shop signs, no posters, no visible writing paper, no open books, no open newspapers, "
        "no front-facing screens: any phone shows only its plain back, and any television is seen from behind or from the side with its screen hidden. "
        "Any paper, note, card or paper napkin is folded shut or lies face down, never legible writing. "
        "Any football shirt or scarf is plain solid colour fabric with no numbers, no crest, no badge and no sponsor. "
        "Any bottle or jar is plain glass with no label. Any box or package is a plain solid colour with no marks. "
        "Any ferry or boat has no name painted on it, any car has no roof sign, no lettering and no visible number plate, "
        "and any lift or doorway has no floor numbers, numbered buttons or name plates. Any birthday candles are plain thin candles, never number candles.\n\n"
        "STYLE: Clean cel-shaded editorial illustration anchored to the published FR A0 Friends Marseille and FR A1 Friends Paris covers: thick crisp linework, "
        "flat saturated warm colour fills, ochre, pink and pale stone Genoese facades, strong clear Mediterranean daylight, simple graphic shadows, adult figures at middle distance, "
        "natural skin with no blush, natural eyes, bright daylight unless the scene says otherwise, 16:9 landscape.\n\n"
        "FRAMING: the characters occupy the middle third of the frame, waist-up or fuller, and the illustration fills the entire canvas edge to edge with no borders or empty margins.\n\n"
        "SCENE: ")

TERRACE = "the rooftop terrace of an old palazzo in the centro storico of Genoa, Italy, pale terracotta floor tiles, a wooden pergola, terracotta pots of basil, a view over tall ochre and pink facades, grey slate rooftops and the blue harbour beyond"
STORM_TERRACE = "the rooftop terrace of an old palazzo in the centro storico of Genoa, Italy, pale terracotta floor tiles, tall ochre and pink facades and grey slate rooftops around"
STAIRS = "the old staircase of a palazzo in the centro storico of Genoa, Italy, worn grey slate steps, a black wrought-iron railing, pale ochre plastered walls and a tall narrow window"
APT = "Alice's small top-floor apartment in an old palazzo in the centro storico of Genoa, Italy, pale ochre walls, a red-and-white tiled floor, a tall window with green wooden shutters"
KITCHEN = "the small kitchen of Alice's top-floor apartment in an old palazzo in Genoa, Italy, pale ochre walls, white tiles, a white ceramic sink under a window with green wooden shutters"
SHOP = "a small focacceria at street level in a narrow alley of the centro storico of Genoa, Italy, a wooden counter, big metal trays of golden focaccia, warm oven light, no shop sign"
ALLEY = "a narrow cobbled alley in the centro storico of Genoa, Italy, tall ochre and pink facades with green shutters, fresh morning light"

T = [
 ("birthdays-and-wishes", "Birthdays & Wishes", ["ALICE", "MATTEO"], [
  ("una-torta-per-dodici", "Una torta per dodici", 1,
   f"On {TERRACE}, warm evening light. A long table is set with twelve empty white plates and one big cream birthday cake with plain thin lit candles. MATTEO sits at the table holding two forks, grinning, ready to eat; ALICE stands beside the table holding her phone with its plain back to the viewer, laughing at last, one hand on her chest. No guests are visible. Medium shot, both waist up or fuller.", "Solo los dos: los invitados fallan y no se dibujan. Velas lisas, sin numeros."),
  ("e-solo-uno-scherzo", "È solo uno scherzo", 2,
   f"On {TERRACE}, evening, warm lamp light, a cake with a few slices missing and plain thin blown-out candles on the table. MATTEO leans across the table holding out an old yellowed paper napkin folded shut, laughing; ALICE sits across from him laughing too loudly, a glass raised close to her face, her eyes uneasy. Medium shot across the table, both waist up.", "La servilleta del pacto va doblada: la historia la lee en voz alta, pero en la portada nunca se ve escrita."),
  ("il-traghetto-delle-sei", "Il traghetto delle sei", 3,
   f"On a landing of {STAIRS}, just before dawn, cold blue light through the window and one warm wall lamp. MATTEO, a big dark-grey backpack on one shoulder, kisses ALICE quickly on the cheek, already turning to run down the stairs; ALICE stands still, one hand deep in her cardigan pocket, her mouth half open as if about to speak. Medium shot, both waist up or fuller.", "En la historia Alice baja en pijama; la portada mantiene la ficha (cardigan mostaza) para no romper el reparto. El taxi del callejon no se dibuja."),
 ]),
 ("dating-and-first-impressions", "Dating & First Impressions", ["ALICE", "MATTEO", "FRANCESCA"], [
  ("scrivi-tu-per-favore", "Scrivi tu, per favore", 1,
   f"At the open front door of {APT}, daytime. ALICE stands in the doorway typing slowly on MATTEO's phone, its plain back to the viewer, with a small tight smile; MATTEO leans in beside her, cheerful and hopeful, pointing at the phone. Medium shot, both waist up.", "Francesca no sale: solo es una foto en el movil, que va de espaldas."),
  ("due-spritz-in-terrazza", "Due spritz in terrazza", 2,
   f"On a landing of {STAIRS}, early evening, warm light from the tall window. FRANCESCA comes up the stairs smiling warmly and waving hello; ALICE stands two steps above her, hiding a plain black rubbish bag behind her back, awkward and embarrassed, forcing a smile. Medium shot, both waist up or fuller.", "Matteo no sale: espera arriba. Las velas y los spritz no entran en cuadro."),
  ("i-fiori-sbagliati", "I fiori sbagliati", 3,
   f"In {APT}, ten o'clock at night, warm lamp light, a plain glass vase of water on a small wooden table. MATTEO stands in the doorway, pale and sad, holding out three red roses; ALICE stands facing him, taking the roses, looking down at her shoes. Medium shot, both waist up.", "Francesca no sale: la cita ya termino."),
 ]),
 ("football-and-rivalries", "Football & Rivalries", ["ALICE", "MATTEO", "RICCARDO"], [
  ("il-derby-della-lanterna", "Il derby della Lanterna", 1,
   f"On {TERRACE}, evening, string lights, a small television on a low table seen from the side with its screen hidden, a plate of focaccia. RICCARDO sits on a small wicker sofa with a plain solid blue scarf around his neck, laughing and holding out his hand for a bet; ALICE stands in front of him reaching to shake his hand, determined; MATTEO sits in a chair behind them happily eating a slice of focaccia, not paying attention. Medium shot, all three waist up.", "Pantalla de lado y oculta. Bufanda azul lisa, sin escudo ni letras. Sin publico: el derby es en la tele."),
  ("la-maglia-in-palio", "La maglia in palio", 2,
   f"On {TERRACE}, night, string lights, three chairs and a bowl of crisps around a small television seen from behind with its screen hidden. RICCARDO stands on his chair dancing with a plain solid blue scarf raised above his head, celebrating; ALICE holds out a folded plain red-and-dark-blue halved football shirt towards him, hugging herself with her other arm, cold and defeated; MATTEO sits beside her shrugging with a careless smile. Medium shot, all three waist up or fuller.", "Alice entrega la camiseta doblada en vez de llevarla puesta, para no cambiar la ropa de la ficha. Camiseta lisa en dos mitades roja y azul, sin numero, escudo ni patrocinador."),
  ("solo-per-una-foto", "Solo per una foto", 3,
   f"In {ALLEY}, in front of the palazzo door, a plain white car with no roof sign and no lettering parked beside them, its number plate out of view. ALICE stands with a plain solid blue scarf around her neck, ashamed, clutching a wet, dirty plain red-and-dark-blue halved football shirt tight against her chest; RICCARDO stands in front of her lowering his phone with its plain back to the viewer, grinning at the joke. Medium shot, both waist up.", "Matteo no sale: mira desde la terraza y a ese tamano quedaria como una figura sin describir. Alice baja en pijama en la historia; la portada mantiene la ficha."),
 ]),
 ("weather-and-storms", "Weather & Storms", ["ALICE", "MATTEO", "FEDERICA"], [
  ("allerta-rossa", "Allerta rossa", 1,
   f"On a landing of {STAIRS}, during a violent rainstorm, dark stormy light through the tall window streaked with rain. ALICE and MATTEO have just run down from the roof, both soaking wet, hair dripping; MATTEO holds a single terracotta pot of basil against his chest; FEDERICA stands on the landing holding out a folded white towel to ALICE with a kind smile, a second towel over her arm. Medium shot, all three waist up.", "La pergola caida y la terraza no entran: la portada es el rellano del final, donde se presenta Federica."),
  ("un-segreto-tra-noi-due", "Un segreto tra noi due", 2,
   f"Inside a small old wrought-iron cage lift stuck between two floors of an old palazzo in Genoa, darkness lit only by the white beam of a phone torch, no buttons, numbers or plates visible. FEDERICA holds her phone with its plain back to the viewer, the torch pointing up, listening calmly and kindly; ALICE stands close to her in the narrow lift, looking up at the small light, trembling, her hands pressed together as she speaks. Medium shot, both waist up.", "Matteo no sale. A oscuras, solo con la linterna, como en la historia."),
  ("dopo-la-tempesta", "Dopo la tempesta", 3,
   f"On {STORM_TERRACE}, the morning after the storm, a clean bright blue sky, the sea sparkling beyond, mud on the tiles, fallen leaves, one broken wooden chair and no pergola. ALICE and MATTEO kneel side by side planting one small green basil plant in a new plain terracotta pot; MATTEO smiles as he pats the soil, ALICE looks at him with a quiet, warm face. Medium shot, both waist up or fuller.", "Federica no sale. La pergola ya no esta."),
 ]),
 ("cooking-and-recipes", "Cooking & Recipes", ["ALICE", "MATTEO", "LORENZO"], [
  ("il-pesto-vuole-pazienza", "Il pesto vuole pazienza", 1,
   f"Inside {SHOP}, Sunday morning. LORENZO stands behind the counter among trays of golden focaccia with olives and rosemary, flour on his hands, looking at ALICE with an amused, kind smile; ALICE stands at the counter hugging a small terracotta pot with a tiny basil plant, sleepy, pleading. Medium shot across the counter, both waist up.", "Matteo no sale: esta en el ferry. Sin letrero de la tienda ni precios."),
  ("un-mortaio-in-due-pezzi", "Un mortaio in due pezzi", 2,
   f"In {KITCHEN}, midday. ALICE stands at the white ceramic sink, her wet hands raised in shock, staring down at a heavy white marble mortar broken cleanly in two pieces in the sink; on the counter beside her sits a small bowl of bright green pesto. Medium shot, waist up.", "Solo Alice: Lorenzo ya volvio a la focacceria cuando se rompe el mortero, que es el titulo."),
  ("trofie-per-due", "Trofie per due", 3,
   f"On {TERRACE}, two o'clock in the afternoon, bright sun, two plates of trofie pasta with green pesto and a plain unlabelled glass bottle of water on the table, beside them a tray with the two halves of a broken white marble mortar. MATTEO looks at the broken pieces with a small sad smile, a little pesto on his beard; ALICE sits across from him wiping a tear, her plate untouched. Medium shot across the table, both waist up.", "Lorenzo no sale."),
 ]),
 ("quarrels-and-apologies", "Quarrels & Apologies", ["ALICE", "MATTEO", "VALENTINA"], [
  ("non-e-divertente", "Non è divertente", 1,
   f"On {TERRACE}, sunny Sunday lunch, a table set for three with plates, a cake and a plain unlabelled glass bottle of wine. MATTEO stands raising a full glass for a toast, laughing; VALENTINA sits laughing along; ALICE sits very still, pale, her fork put down, staring at her plate, hurt. Medium shot, all three waist up.", ""),
  ("domenica-senza-terrazza", "Domenica senza terrazza", 2,
   f"In {APT}, Sunday, grey cloudy light through the window. ALICE sits on a small sofa hugging a cushion, puffy-eyed and sad; VALENTINA sits beside the windowsill turned towards her, a brown paper bag of bread set down next to her, talking gently with one hand raised. A phone lies face down on the table. Medium shot, both waist up.", "Matteo no sale: esa semana no se ven."),
  ("focaccia-sulle-scale", "Focaccia sulle scale", 3,
   f"On {STAIRS}, afternoon, soft light from the tall window. ALICE and MATTEO sit side by side on the slate steps sharing a warm focaccia torn in two, each holding a half; MATTEO chews with a tentative small smile, ALICE looks down at her piece, relieved but still a little guarded, a small gap between them on the step. Medium shot, both waist up or fuller.", "Valentina no sale. En la historia Matteo lleva chandal viejo y barba larga; la portada mantiene la ficha."),
 ]),
 ("secrets-and-confessions", "Secrets & Confessions", ["ALICE", "MATTEO"], [
  ("trentacinque-candeline", "Trentacinque candeline", 1,
   f"On {TERRACE}, sunset, soft pink light over the harbour, a strawberry birthday cake with plain thin lit candles and a small open gift box with a red ribbon on the table. ALICE, standing, sets an old yellowed paper napkin folded shut in four on the table beside the cake, her hands trembling, her face serious; MATTEO sits looking up at her, puzzled and gentle. Medium shot, both waist up.", "Servilleta doblada en cuatro, sin letras. Velas lisas, sin numeros."),
  ("ti-voglio-bene-ma", "Ti voglio bene, ma", 2,
   f"On {TERRACE}, dusk, the sea darkening and a few seagulls far away over the water, the old paper napkin lying folded shut on the table. ALICE sits crying, wiping her tears with a white handkerchief; MATTEO sits close beside her, pale and sad, gently stroking her hair, staying with her. Medium shot, both waist up.", "La servilleta vuelve a quedar doblada sobre la mesa: nunca abierta ni legible."),
  ("due-piatti-come-sempre", "Due piatti, come sempre", 3,
   f"On {TERRACE}, Sunday midday, bright sun, a church bell tower with no clock far away across the rooftops. A table with two plates and a focaccia; beside it the two halves of a white marble mortar used as small pots, a green basil plant growing in them. ALICE and MATTEO sit facing each other eating, calm, ALICE smiling softly and MATTEO relieved, crumbs on the table. Medium shot across the table, both waist up.", "La servilleta rota en la papelera no se dibuja (papel). En la historia Matteo lleva camisa limpia; la portada mantiene la ficha."),
 ]),
]

out = []
for topic, label, names, stories in T:
    out.append({"topic": topic, "label": label, "place": "Genoa, Italy", "names": names, "sheet": sheet(names),
                "stories": [{"slug": s, "title": ti, "slot": sl, "prompt": HEAD + sc, "note": no} for s, ti, sl, sc, no in stories]})
json.dump(out, open("scripts/_itA0cov/portadas.json", "w"), ensure_ascii=False, indent=1)
open("scripts/_itA0cov/portadas.json", "a").write("\n")
print(f"{len(out)} temas, {sum(len(t['stories']) for t in out)} portadas")

# --- para-el-doc.txt: mismo formato que scripts/_frA2cov/para-el-doc.txt ---
doc = []
doc.append("[Journey-planning, 2026-09-14] PETICIÓN IT A0 Friends: 21 portadas + 7 cast sheets, carpeta italia-a0-friends bajo la raíz 1sFlqVaqsLy1cGqPNpLh5JJE03Dw1rnZP")
doc.append("")
for topic, label, names, stories in T:
    doc.append(f"TEMA: {label} ({topic})")
    doc.append("Lugar: Genoa, Italy")
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
open("scripts/_itA0cov/para-el-doc.txt", "w").write("\n".join(doc).rstrip("\n") + "\n")
print("para-el-doc.txt escrito")
