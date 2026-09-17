"""Compone scripts/_esB1cultCov/portadas.json (Cultural ES latam B1, Alondra y
Ulises, siete tradiciones de siete paises) con el formato de
scripts/_b2lcov/portadas.json: una ficha de reparto por tema y un prompt por
historia. Las fichas se escriben UNA vez y se repiten literales, para que
ningun rasgo cambie entre portadas. Estilo: el vigente desde el 2026-09-11
(flat vector de cartel serigrafiado, contorno negro grueso, sin degradados),
anclado a las portadas aprobadas del Traveler ES latam B2.
Escribe tambien para-el-doc.txt desde la misma fuente. No genera nada.
  python3 scripts/_esB1cultCov/build.py
"""
import json

# Fichas literales. ALONDRA y ULISES salen en todo el journey con la misma ficha.
# Cada secundario contrasta con ALONDRA (si es mujer) o con ULISES (si es hombre)
# en pelo, complexion y tono de piel, no solo en la ropa.
C = {
 "ALONDRA": "woman, exactly 34 years old, slim build, medium height, warm brown skin, long straight black hair tied in a high ponytail, WITHOUT fringe, no facial hair, no glasses, no earrings; wears a plain mustard-yellow long-sleeved blouse with no print, dark-blue jeans, a brown leather belt and brown flat ankle boots",
 "ULISES": "man, exactly 39 years old, stocky broad-shouldered build, half a head taller than ALONDRA, medium brown skin, very short black hair cropped close to the head, WITHOUT fringe, a short neat black beard, no glasses; wears a plain forest-green cotton work jacket with no logo, buttoned, over a plain white t-shirt, dark-grey trousers and black lace-up boots",
 "YATIRI": "woman, exactly 50 years old, short and plump build, a head shorter than ALONDRA, deep brown skin, black hair parted in the middle and worn in two long braids down her back, WITHOUT fringe, no glasses; wears a dark-brown bowler hat, a plain crimson-red pleated skirt to mid-calf, a plain cream-white blouse, a fringed dark-green shawl over her shoulders and black flat shoes",
 "MAYRA": "woman, exactly 45 years old, sturdy broad-shouldered build, a little shorter than ALONDRA, very dark brown skin, short black curly hair cropped close to the head, WITHOUT fringe, no glasses, small silver stud earrings; wears a plain white sleeveless vest top, a plain red cotton scarf tied at the neck, black loose trousers and black canvas shoes",
 "SAUL": "man, exactly 42 years old, lean wiry build, the same height as ALONDRA, medium brown skin, short straight black hair combed to the side, WITHOUT fringe, a thin black moustache and no beard, no glasses; wears a plain sky-blue short-sleeved shirt with the sleeves rolled up, stained plain grey work trousers and black rubber boots",
 "BRENDA": "woman, exactly 52 years old, plump sturdy build, a little shorter than ALONDRA, light olive skin, black hair worn in one single thick braid over her shoulder, WITHOUT fringe, no glasses; wears a plain white long-sleeved blouse, a plain dark-navy ankle-length skirt with a red sash at the waist, a wide pale straw hat with a plain black ribbon and black flat shoes",
 "GERARDO": "man, exactly 46 years old, tall lanky build, a head taller than ALONDRA, light skin tanned by the sun, short wavy dark-brown hair, WITHOUT fringe, clean-shaven, no glasses; wears a plain rust-orange zip-up windbreaker with no logo over a plain black t-shirt, faded blue jeans and grey trainers",
 "PERLA": "woman, exactly 38 years old, short and round build, a head shorter than ALONDRA, light brown skin, dark-brown wavy hair cut in a chin-length bob WITH a straight blunt fringe, thin black-framed glasses; wears a plain purple cotton apron over a plain pale-pink t-shirt, black leggings and white trainers",
 "ALDO": "man, exactly 44 years old, heavyset build with a round belly, a little shorter than ULISES, dark brown skin, shaved bald head, WITHOUT any hair, a thick black moustache and no beard, no glasses; wears a plain white sleeveless vest top, plain beige shorts to the knee and brown leather sandals",
}
POS = {2: ["LEFT", "RIGHT"], 3: ["LEFT", "CENTER", "RIGHT"]}

SHEET_STYLE = ("flat vector screen-printed poster illustration, thick even black outlines, flat solid saturated colour fills, "
               "no gradients, no shading, no texture, plain pure white background, landscape 16:9")

def sheet(names):
    n = len(names)
    parts = [f"{POS[n][i]} is {nm}: {C[nm]}." for i, nm in enumerate(names)]
    return (f"Character model sheet for a story series, {SHEET_STYLE}.\n\n"
            f"Exactly {n} adult characters, drawn as a reference sheet: top row shows all of them full body from head to feet, standing straight, "
            "front view, neutral expression, even matte skin with no blush, large natural almond-shaped eyes with a visible dark iris in every face; "
            "bottom row shows the same characters as head and shoulders close ups.\n\n"
            + "\n\n".join(parts)
            + "\n\nNo two characters wear the same garment or the same colour: each wears only what this sheet gives them. "
            "Generous white margin around every figure, no props, no animals, no scenery, no shadows on the background, "
            "and absolutely no text, labels or numbers anywhere in the image.")

HEAD = ("LOCK: The image provided is the cast sheet for this story. KEEP every character's face, hair, facial hair, body build, height difference, skin tone "
        "and clothing IDENTICAL to the sheet; only pose, framing, light and background change. No two characters wear the same garment or the same colour: "
        "each wears only what the sheet gives them. Every face in the image has large natural almond-shaped eyes with a visible dark iris and even matte skin "
        "with no rosy blush circles on the cheeks. Every figure has exactly two arms, two hands with five fingers and two legs, each limb growing from where it "
        "belongs. Draw only the characters the scene names, and no other people: no children, no teenagers, no elderly people, no crowd, no passers-by, "
        "no vendors, no musicians, no dancers, no marchers, not even in the background, at a window or as a silhouette. No animals anywhere. "
        "No text, letters, numbers or flags anywhere in the image. No readable surfaces, no signs, no shop signs, no street signs, no banners, no posters, "
        "no price tags, no visible writing paper, no open notebooks, no open books, no banknotes, no coins with faces, no front-facing screens: any phone shows "
        "only its plain back. Any paper, note, permit or sheet is folded shut or lies face down, never legible writing. Any bottle, jar, box or bag is plain "
        "with no label. Any vehicle is plain with no number plate and no lettering.\n\n"
        "STYLE: Flat vector screen-printed poster illustration anchored to the approved Traveler ES latam B2 covers: thick even black outlines around every "
        "shape, flat solid saturated colour fills, no gradients, no shading, no texture, no painterly effects, simple graphic shapes, a limited vivid palette "
        "of warm ochres, deep reds, turquoise and sun yellow, strong flat daylight or flat warm lamp light, adult figures at middle distance with realistic "
        "adult proportions and large readable faces, 16:9 landscape.\n\n"
        "FRAMING: the named characters stand close together with no empty gap between them, they occupy the middle third of the frame, waist-up or fuller, "
        "their faces large enough to read clearly, and the illustration fills the entire canvas edge to edge with no borders or empty margins.\n\n"
        "SCENE: ")

# Anclas de lugar, sin bandera ni nombre escrito: se reconocen por la escena.
LAPAZ = "a steep street of La Paz in January, red-brick houses climbing the hillside behind, the snow-capped peak of Illimani white against a deep blue sky"
ALASITA = "a canvas-roofed stall of the Alasita fair in La Paz, its table covered with tiny miniature objects: little houses, little cars, little sacks and little suitcases, none with any writing"
GALPON = "a candombe comparsa's shed in Barrio Sur, Montevideo, brick walls, a small open fire on the concrete floor, a row of barrel-shaped tamboril drums with worn hides leaning against the wall"
ANTIGUA_PATIO = "an open patio in Antigua Guatemala, ochre-yellow colonial walls with a terracotta tile roof, tin buckets of dyed sawdust in bright red, green, purple and yellow, the green cone of Volcan de Agua rising behind the wall"
ANTIGUA_STREET = "a cobbled street in Antigua Guatemala with ochre-yellow and deep-red colonial facades, the yellow stone arch of Santa Catalina spanning the street in the distance"
SANTA_ELENA = "a green hillside above Medellin in Santa Elena, a low greenhouse of white plastic, rows of carnations and gladioli in red, white and pink, blue mountains in the distance"
RAMADA = "a fonda tent in a Santiago park in September, a roof of dry branches over wooden posts, colourful plain paper garlands with no writing, a smoking grill, a plain wooden table"
CERRO = "a grassy hilltop above Santiago in September, the snow-topped Andes along the horizon, a bright blue windy sky full of small diamond-shaped paper kites in red, yellow, blue and white"
VECINDAD = "the central courtyard of a vecindad in Mexico City in December, pink and ochre walls with iron railings on the upper floor, strings of small rectangular sheets of perforated coloured tissue paper hung across the courtyard with no writing, a few star-shaped seven-pointed pinatas hanging from a rope"
PERLA_TALLER = "Perla's pinata workshop in Mexico City, shelves of clay pots, rolls of tissue paper in bright colours, three finished seven-pointed star pinatas hanging from the ceiling"
GUAYAQUIL = "a warm street of Guayaquil on the last night of the year, pastel painted houses with balconies, palm trees, the colourful hillside houses of Cerro Santa Ana behind, a dark sky with small fireworks"
GUAYAQUIL_DAY = "a warm street of Guayaquil in the late afternoon, pastel painted houses with balconies, palm trees, the colourful hillside houses of Cerro Santa Ana behind under a clear warm sky"

T = [
 ("wishes-and-bargaining", "Wishes & Bargaining", "La Paz, Bolivia", ["ALONDRA", "ULISES", "YATIRI"], [
  ("el-ekeko-no-espera", "El ekeko no espera", 1,
   f"At {ALASITA}, midday in strong flat sunlight, {LAPAZ} behind. ALONDRA stands at the stall holding a tiny Ekeko figurine in her open palm at chest height, a fist-sized moustached figure with a little bowler hat and loaded with tiny sacks, and she looks down at it with a flat disappointed face; ULISES stands beside her holding a plain cardboard box against his hip, tired, raising his eyebrows at the figurine. Medium shot, both waist up.",
   "La fila de cien personas no sale: solo ALONDRA y ULISES. La YATIRI no sale en esta escena. El ekeko es una figurita de puno sin letras."),
  ("nadie-challa-para-vender", "Nadie challa para vender", 2,
   f"Under a plain canvas tent at the Alasita fair in La Paz, the ground covered in coloured confetti and paper streamers, a small brazier smoking on the floor, {LAPAZ} visible through the open side. The YATIRI stands at a low table sprinkling flower petals from her cupped hand over the tiny Ekeko figurine; ALONDRA stands across the table pointing with her whole hand at ULISES, her mouth open mid-word, caught out; ULISES stands next to ALONDRA holding the small figurine in both hands, surprised. Medium shot, all three waist up.",
   "Tres en cuadro. La yatiri con bombin y trenzas es la ficha, no una anciana: 50 anos exactos."),
  ("el-tari-guarda-un-nombre", "El tari guarda un nombre", 3,
   f"At the closing hour of the Alasita fair in La Paz, low golden evening light, stalls behind with rows of identical small plastic Ekeko figurines, {LAPAZ} in the background. ALONDRA stands holding open a small striped woven cloth pouch in one hand and tucking a folded piece of paper into it with the other, satisfied for the first time; ULISES stands close beside her holding one of the identical plastic figurines up between two fingers with a doubtful look. Medium shot, both waist up.",
   "El vendedor no sale. El papel va doblado, sin escritura visible. El tari es una bolsita tejida a rayas."),
 ]),
 ("turns-and-belonging", "Turns & Belonging", "Montevideo, Uruguay", ["ALONDRA", "ULISES", "MAYRA"], [
  ("el-repique-no-tiene-dueno", "El repique no tiene dueño", 1,
   f"Inside {GALPON}, evening, warm flat firelight. MAYRA crouches by the small fire holding a barrel-shaped tamboril drum tilted towards the flames to warm its hide, not looking up; ALONDRA stands right beside her with one hand resting on the worn hide of another drum in the row, asking, leaning in. Medium shot, both waist up or fuller.",
   "ULISES no sale en esta historia. La comparsa que se viste no sale: solo ALONDRA y MAYRA."),
  ("lo-que-se-tira-cada-verano", "Lo que se tira cada verano", 2,
   f"Inside {GALPON}, daytime, flat light from a wide open door. MAYRA stands at a wooden workbench cutting the worn old hide off a drum with a small thin knife, focused; ALONDRA stands next to her holding out a small closed plain paper envelope in one hand, firm; ULISES stands on the other side of ALONDRA with his arms at his sides, one hand half raised, about to warn her and thinking better of it. Medium shot, all three waist up.",
   "Tres en cuadro. El pago va en un sobre de papel liso y cerrado, no en billetes: el LOCK prohibe banknotes."),
  ("un-tambor-frio-no-suena", "Un tambor frío no suena", 3,
   f"A cobbled street of Barrio Sur, Montevideo, at night, low old painted houses in ochre and pale blue, warm street lamps. ALONDRA stands with a tamboril drum hanging from a strap over her shoulder, one hand flat on its hide, her face fallen after a dead thud; MAYRA stands beside her with her own drum hung at her hip, one stick in her hand, looking at ALONDRA without contempt, explaining. Medium shot, both waist up or fuller.",
   "ULISES no sale en esta historia. La cuerda de tambores y los tamborileros que se dan vuelta no salen: solo ALONDRA y MAYRA."),
 ]),
 ("vigils-and-waiting", "Vigils & Waiting", "Antigua, Guatemala", ["ALONDRA", "SAUL"], [
  ("el-aserrin-no-se-guarda", "El aserrín no se guarda", 1,
   f"In {ANTIGUA_PATIO}, mid-morning, strong flat sunlight. SAUL crouches over a tin bucket stirring bright red sawdust with a wooden stick; ALONDRA crouches close beside him with her sleeves pushed up, both hands deep in a bucket of green sawdust, concentrating. Medium shot, both waist up or fuller.",
   "Los cucuruchos que pasan no salen: solo ALONDRA y SAUL."),
  ("nadie-duerme-el-jueves", "Nadie duerme el jueves", 2,
   f"On {ANTIGUA_STREET} at night, a long carpet of coloured sawdust laid down the middle of the cobbles in geometric bands of red, green, purple and yellow, plain warm lamps on stands lighting it. ALONDRA kneels on the cobbles at the edge of the carpet pressing a wooden stencil flat with one hand and brushing yellow sawdust over it with a small brush in the other; SAUL kneels beside her holding a second stencil, showing her where the next band goes. Medium shot from low over the carpet, both waist up or fuller.",
   "Sin petalos ni flores todavia: van al final. La plantilla es un tablero de madera con formas geometricas, sin letras."),
  ("pasan-encima-a-las-seis", "Pasan encima a las seis", 3,
   f"On {ANTIGUA_STREET} at seven in the morning, cool flat early light, the cobbles freshly swept with only faint smears of red and purple sawdust left in the cracks, a broom leaning on a wall. SAUL stands holding out an old worn wooden stencil with both hands, offering it; ALONDRA stands in front of him reaching to take it with one hand, her other hand empty and her phone nowhere in sight, moved. Medium shot, both waist up or fuller.",
   "La procesion, el anda y los cucuruchos no salen: la escena es la calle ya barrida y el molde regalado, que es como termina la historia."),
 ]),
 ("weight-and-endurance", "Weight & Endurance", "Santa Elena, Medellín, Colombia", ["ALONDRA", "ULISES", "BRENDA"], [
  ("la-silleta-dura-un-dia", "La silleta dura un día", 1,
   f"On {SANTA_ELENA}, morning, strong flat sunlight. BRENDA kneels on a woven mat tilting a half-built round silleta of carnations up on its side to show the worn wooden frame with short legs underneath it; ALONDRA crouches close in front of her looking at the wooden frame and not at the flowers; ULISES stands just behind them holding a stack of two plain empty cardboard boxes against his chest. Medium shot, all three waist up or fuller.",
   "Tres en cuadro. El armazon de madera visible bajo las flores es lo que cuenta la historia."),
  ("nadie-carga-sin-dos-anos", "Nadie carga sin dos años", 2,
   f"On a dirt path on {SANTA_ELENA}, afternoon, flat warm light. ALONDRA stands bent forward under a round silleta of carnations on her back, a wide woven strap across her forehead, both hands gripping the strap, her face strained; BRENDA walks right beside her with one hand steadying the edge of the silleta, calm; ULISES stands a step behind them holding two plain cardboard boxes stacked in his arms, watching worried. Medium shot, all three waist up or fuller.",
   "Tres en cuadro. Cada uno sujeta UNA cosa: Alondra la correa, Brenda el borde, Ulises las cajas."),
  ("lo-que-queda-es-el-armazon", "Lo que queda es el armazón", 3,
   f"At the wooden wall of Brenda's flower shed in Santa Elena at night, flat warm lamp light, a heap of wilted cut carnations on the ground and a bare wooden silleta frame propped against the wall. BRENDA stands pointing with her whole arm at the old bare wooden frame; ALONDRA stands beside her lifting the empty frame with both hands, its short legs in the air, a small hopeful smile. Medium shot, both waist up or fuller.",
   "ULISES no sale en esta escena. El desfile de dos mil silleteros no sale: la escena es la noche, con las flores tiradas y el armazon regalado."),
 ]),
 ("stalls-and-crowds", "Stalls & Crowds", "Santiago, Chile", ["ALONDRA", "GERARDO"], [
  ("sin-patente-no-hay-puesto", "Sin patente no hay puesto", 1,
   f"Inside {RAMADA}, afternoon, flat warm light through the branch roof, a bundle of diamond-shaped paper kites in red, blue and yellow leaning against a post. GERARDO stands pointing with his open hand at a small modest wooden table in the corner; ALONDRA stands in front of him folding a sheet of paper in half so nothing on it can be read, her mouth tight. Medium shot, both waist up or fuller.",
   "El funcionario de chaleco naranja no sale: solo ALONDRA y GERARDO. La musica y la multitud de la ramada no salen. El papel del permiso va doblado."),
  ("el-hilo-curado-corta-todo", "El hilo curado corta todo", 2,
   f"On {CERRO}, afternoon, strong wind. GERARDO stands holding a large wooden kite reel with both hands, his eyes up on the sky, jaw set; ALONDRA stands right beside him holding a single loose kite string that has just gone slack in her raised hand, her face indignant, one cut-loose red kite drifting away small above them. Medium shot from slightly below, both waist up or fuller.",
   "El del hilo curado de abajo no sale. Los volantines del cielo son formas de papel sin letras."),
  ("el-volantin-vuela-una-vez", "El volantín vuela una vez", 3,
   f"On {CERRO}, late afternoon, warm low sun. ALONDRA stands with her arms at her sides winding a length of white string around her open hand, turn over turn, looking calmly at the sky where a single hand-made diamond kite of white tissue paper with red edges drifts away small towards the horizon; GERARDO stands just behind her shoulder holding the empty wooden reel in one hand, quiet and loyal. Medium shot, both waist up or fuller.",
   "La cueca de abajo no sale. Gerardo no mira sin mas: sujeta el carrete vacio."),
 ]),
 ("hosting-and-processions", "Hosting & Processions", "Ciudad de México, México", ["ALONDRA", "PERLA"], [
  ("la-pinata-se-rompe-entera", "La piñata se rompe entera", 1,
   f"Inside {PERLA_TALLER}, daytime, flat warm light. PERLA sits at a low worktable pasting a strip of red tissue paper onto a half-covered clay pot, not looking up; ALONDRA stands beside the table holding a single paper cone from a pinata point in her hand, about to set it down, her face irritated. Medium shot, both waist up.",
   "Solo ALONDRA y PERLA. Las pinatas colgadas son estrellas de siete picos, sin caras ni letras."),
  ("tres-veces-te-dicen-no", "Tres veces te dicen no", 2,
   f"At night at the wooden door of a ground-floor home in {VECINDAD}, cold blue night air, a string of warm lit lanterns. ALONDRA stands outside the door holding a small lit candle in a paper cone in both hands, her mouth open in song, half laughing; PERLA stands in the warm lit doorway behind the half-open door, one hand on its edge, calling out from inside with a straight face. Medium shot, both waist up or fuller.",
   "Los doce peregrinos no salen: solo ALONDRA fuera y PERLA en la puerta."),
  ("siete-picos-y-una-venda", "Siete picos y una venda", 3,
   f"In {VECINDAD} at night, warm lantern light, a large seven-pointed star pinata in red, gold and green hanging from a rope high above. ALONDRA stands with a plain red cloth blindfold over her eyes gripping a wooden stick raised over her shoulder with both hands, her body turned mid-swing; PERLA stands close beside her holding the end of the rope with both hands, biting back a smile. Medium shot from slightly below, both waist up or fuller, the pinata at the top of the frame.",
   "La vecindad que mira no sale: solo ALONDRA y PERLA. La venda es un pano rojo liso."),
 ]),
 ("endings-and-forgiveness", "Endings & Forgiveness", "Guayaquil, Ecuador", ["ALONDRA", "ULISES", "ALDO"], [
  ("aldo-se-lo-vende-sin-mas", "Aldo se lo vende sin más", 1,
   f"On the pavement of {GUAYAQUIL_DAY}, flat warm light, a life-size straw-stuffed effigy of a man in old clothes seated on a plain wooden chair. ALDO sits on a low stool stuffing straw into the effigy's sleeve, not looking up, calm; ALONDRA stands beside him hugging a large painted papier-mache mask of a grinning face against her chest with both arms, its weight pulling her forward, her face confused. Medium shot, both waist up or fuller.",
   "ULISES no sale en esta escena. La mascara es una cara pintada sin letras, no un personaje real."),
  ("el-testamento-la-nombra", "El testamento la nombra", 2,
   f"On {GUAYAQUIL} at eleven at night, warm lamp light, the straw effigy with its grinning mask propped on a chair between them. ALONDRA stands with both hands raised mid-clap, laughing openly; ULISES stands beside her leaning towards her ear with one hand cupped to explain, grinning. Medium shot, both waist up or fuller.",
   "El vecino de la corbata que lee el testamento, las viudas y la cuadra no salen: solo ALONDRA y ULISES con el monigote. Nada de hojas con escritura."),
  ("quemarlo-salio-mas-barato", "Quemarlo salió más barato", 3,
   f"On {GUAYAQUIL} at midnight, the straw effigy burning in tall flat orange and yellow flames in the middle of the street, small fireworks in the dark sky. ALONDRA stands closest to the fire with her hands in her jeans pockets, watching the flames with a calm face, no phone in sight; ULISES stands next to her holding a plain glass bowl of grapes in one hand; ALDO stands on ALONDRA's other side holding a plain red plastic petrol can by the handle, sober. Medium shot lit by the fire, all three waist up or fuller.",
   "Tres en cuadro. La cuadra y las viudas no salen. El bidon es rojo liso, sin letras."),
 ]),
]

out = []
for topic, label, place, names, stories in T:
    out.append({"topic": topic, "label": label, "place": place, "names": names, "sheet": sheet(names),
                "stories": [{"slug": s, "title": ti, "slot": sl, "prompt": HEAD + sc, "note": no} for s, ti, sl, sc, no in stories]})
json.dump(out, open("scripts/_esB1cultCov/portadas.json", "w"), ensure_ascii=False, indent=1)
open("scripts/_esB1cultCov/portadas.json", "a").write("\n")
print(f"{len(out)} temas, {sum(len(t['stories']) for t in out)} portadas")

# --- para-el-doc.txt: mismo formato que scripts/_frB1cov/para-el-doc.txt ---
doc = []
doc.append("[Journey-planning-2, 2026-09-17] PETICIÓN ES B1 Cultural latam: 21 portadas + 7 cast sheets, carpeta latam-b1-cultural bajo la raíz 1sFlqVaqsLy1cGqPNpLh5JJE03Dw1rnZP")
doc.append("")
for topic, label, place, names, stories in T:
    doc.append(f"TEMA: {label} ({topic})")
    doc.append(f"Lugar: {place}")
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
open("scripts/_esB1cultCov/para-el-doc.txt", "w").write("\n".join(doc).rstrip("\n") + "\n")
print("para-el-doc.txt escrito")
