"""Compone scripts/_frA0cov/portadas.json (Friends FR A0, Le Panier, Marseille)
con el formato de los portadas.json de los otros journeys (PT B1): una ficha de
reparto por tema y un prompt por historia. Las fichas se escriben UNA vez y se
repiten literales, para que ningun rasgo cambie entre portadas. No genera nada.
  python3 scripts/_frA0cov/build.py
"""
import json

C = {
 "LÉA": "woman, exactly 29 years old, slim build, medium height, olive Mediterranean skin, long straight black hair in a single thick braid over her right shoulder, WITHOUT fringe, no glasses; wears a rust-red cotton apron over a plain white short-sleeved t-shirt, dark blue jeans and white canvas trainers",
 "HUGO": "man, exactly 32 years old, tall and lanky build, a head taller than LÉA, light skin with a light summer tan, short wavy chestnut-brown hair, WITHOUT fringe, short neat brown stubble, no glasses; wears a sky-blue linen shirt with the sleeves rolled up, beige chino trousers and brown leather boat shoes",
 "THÉO": "man, exactly 25 years old, clearly a young adult man and not a teenager, slim build, a little taller than LÉA and shorter than HUGO, dark brown skin, short black curly hair, WITHOUT fringe, clean-shaven, no glasses; wears a long black waiter's apron over a plain white shirt, black trousers and black shoes",
 "CHLOÉ": "woman, exactly 41 years old, sturdy build with broad shoulders, the same height as LÉA but clearly wider, pale fair skin, very short cropped blond hair above the ears, WITHOUT fringe, round red-framed glasses; wears green cotton work overalls over a grey t-shirt and brown leather work boots",
 "MAXIME": "man, exactly 34 years old, stocky build, as tall as HUGO, light-brown skin, shaved head, short thick black beard, black rectangular glasses; wears a dark green bomber jacket over a plain grey t-shirt, black jeans and white trainers",
 "LOUISE": "woman, exactly 35 years old, LÉA's older sister, rounder and fuller build, a little shorter than LÉA, the same olive skin as LÉA, chin-length curly dark-red hair WITH a straight fringe, no glasses; wears a lilac knitted cardigan over a white blouse, a knee-length grey skirt and black ankle boots",
 "ANTOINE": "man, exactly 50 years old, clearly a man in his early fifties and not elderly, heavy build with a round belly, a little taller than LÉA and shorter than HUGO, ruddy light skin, thick dark-brown hair combed back, WITHOUT fringe, clean-shaven, rectangular silver-framed glasses; wears a navy blazer over a light-blue shirt with no tie, grey trousers and black leather shoes",
 "CLARA": "woman, exactly 31 years old, athletic build, a little taller than LÉA, fair skin, shoulder-length wavy brown hair worn loose, WITHOUT fringe, thin round gold-rimmed glasses; wears a bright yellow knee-length coat over a plain white t-shirt, light-blue jeans and tan leather ankle boots",
}
DOG = "her medium-sized white dog with brown ears"
POS = {2: ["LEFT", "RIGHT"], 3: ["LEFT", "CENTER", "RIGHT"], 4: ["FAR LEFT", "LEFT", "RIGHT", "FAR RIGHT"]}

def sheet(names):
    n = len(names)
    parts = [f"{POS[n][i]} is {nm}: {C[nm]}." for i, nm in enumerate(names)]
    return ("Character model sheet for a story series, clean cel-shaded editorial illustration, crisp clean linework, flat vivid warm colour fills, "
            "plain pure white background, landscape 16:9.\n\n"
            f"Exactly {n} adult characters, drawn as a reference sheet: top row shows all of them full body from head to feet, standing straight, "
            "front view, neutral expression; bottom row shows the same characters as head-and-shoulders close-ups.\n\n"
            + "\n\n".join(parts)
            + "\n\nGenerous white margin around every figure, no props, no animals, no scenery, no shadows on the background, and absolutely no text, labels or numbers anywhere in the image.")

HEAD = ("LOCK: The image provided is the cast sheet for this story. KEEP every character's face, hair, facial hair, body build, height difference, skin tone "
        "and clothing IDENTICAL to the sheet; only pose, framing, light and background change. Draw only the characters the scene names. "
        "No text, letters or numbers anywhere in the image.\n\n"
        "STYLE: Clean cel-shaded editorial illustration, smooth flat shading, crisp clean linework, vivid warm colour, bright daylight unless the scene says otherwise, 16:9 landscape.\n\n"
        "FRAMING: the characters occupy the middle third of the frame, waist-up or fuller, and the illustration fills the entire canvas edge to edge with no borders or empty margins.\n\n"
        "SCENE: ")
PANIER = "in the Panier quarter of Marseille, with ochre and pastel facades, green wooden shutters and narrow stone streets"

T = [
 ("sports-and-games", "Sports & Games", ["LÉA", "HUGO"], [
  ("une-boule-sous-le-platane", "Une boule sous le platane", 1,
   f"A small gravel square under a huge plane tree {PANIER}, Sunday afternoon, warm golden sun and dappled shade. LÉA crouches on the gravel, one arm still stretched out after rolling a shiny silver boule that has stopped right next to a small round wooden jack; HUGO stands beside her clapping his hands once, grinning. Two more silver boules rest on a wooden bench and a café terrace with empty chairs sits at the edge of the square. Wide shot from low on the gravel, both full body.", ""),
  ("deux-carreaux-pour-hugo", "Deux carreaux pour Hugo", 2,
   f"The same gravel square {PANIER} on a windy morning, the mistral bending the plane tree branches and blowing dry leaves through the air, clear blue sky. LÉA stands with her knees bent and a silver boule in her right hand, arm swung back to throw; HUGO stands just behind her, guiding her elbow with one hand. Two white coffee cups on a small round café table nearby. Medium shot from the side, both full body.", ""),
  ("si-je-gagne-tu-restes", "Si je gagne, tu restes", 3,
   f"The gravel square {PANIER} at dusk, a deep red sky over the rooftops and one lit street lamp. HUGO crouches on the gravel stretching a piece of white string between a silver boule and the small wooden jack, measuring; LÉA leans over him holding her own boule in both hands against her chest, holding her breath. A chalk circle drawn on the gravel. Low-angle medium shot, both full body.", ""),
 ]),
 ("talking-and-listening", "Talking & Listening", ["LÉA", "HUGO", "THÉO"], [
  ("theo-ecoute-pour-lea", "Théo écoute pour Léa", 1,
   "Inside Léa's small café in the Panier, midday, sunlight through the front window, every table covered with empty cups and saucers after a busy lunch. THÉO sits on a tall wooden stool by the counter with white earphones in his ears, holding a mobile phone whose screen faces away from the viewer, frowning in concentration; LÉA stands close beside him with one hand flat on the counter, leaning in to hear. A metal tray and a stack of cups on the counter. Medium shot across the counter, both waist-up.", "HUGO no sale: es la voz del mensaje."),
  ("la-ligne-coupe-apres-hugo", "La ligne coupe après Hugo", 2,
   "A flat rooftop terrace above the Panier, windy late afternoon, blue sky with fast white clouds, white sheets and shirts flapping on washing lines strung between old chimney pots, the sea far behind. LÉA stands alone holding a mobile phone to her ear with the screen facing away from the viewer, eyes closed, her other hand pressed flat against her chest. Terracotta roof tiles all around. Medium shot from the side, LÉA waist-up or fuller.", "HUGO no sale: está al otro lado del teléfono."),
  ("le-torchon-a-la-main", "Le torchon à la main", 3,
   "Inside Léa's café in the evening, the shop window dark behind them, one warm lamp over the counter. LÉA stands at the sink drying a white cup with a striped tea towel, looking down at the cup; HUGO leans on the counter holding out his mobile phone towards her with the screen facing away from the viewer, smiling proudly. A shelf of clean cups and a metal coffee pot. Medium shot from the end of the counter, both waist-up.", "THÉO no sale: solo se le nombra."),
 ]),
 ("helping-and-favours", "Helping & Favours", ["LÉA", "HUGO", "CHLOÉ"], [
  ("le-fauteuil-descend", "Le fauteuil descend", 1,
   "A narrow stone staircase inside an old building in the Panier, morning light from a small window. CHLOÉ, a coil of rope over one shoulder, walks backwards down the steps holding the front of a heavy green velvet armchair; LÉA holds the back of the armchair two steps above her, straining. A cold iron handrail along the wall. Shot from the bottom of the stairs looking up, both full body.", "HUGO no sale: está trabajando."),
  ("mille-euros-sans-compter", "Mille euros sans compter", 2,
   "Behind the counter of Léa's café, late afternoon, soft light. LÉA holds out a plain brown paper envelope with both hands; HUGO takes it, embarrassed, his other hand on the back of his neck. A small pink ceramic piggy bank stands open on the counter and a big old chrome coffee machine sits behind them. Close medium shot, both waist-up.", ""),
  ("une-goutte-chaque-nuit", "Une goutte chaque nuit", 3,
   "The small kitchen at the back of Léa's café, afternoon. HUGO kneels under the sink holding a wrench while water sprays out of the pipe onto his shirt; LÉA stands beside him laughing, holding a yellow sponge. A metal bucket on the wet tiled floor and an open toolbox. Medium shot from the kitchen door, both full body.", ""),
 ]),
 ("words-and-meanings", "Words & Meanings", ["LÉA", "HUGO", "MAXIME"], [
  ("tu-prends-la-carte", "Tu prends la carte?", 1,
   "The café terrace on the square in the Panier, bright morning. MAXIME sits at a small round table with a big black duffel bag at his feet, holding up a plain blue card with no printing and laughing; LÉA stands beside the table holding a closed leather menu folder with a plain cover, one hand over her mouth, laughing too. A glass of orange juice and a small cup of black coffee on the table. Medium shot from the side, both waist-up.", "HUGO no sale: solo se le nombra."),
  ("vingt-minutes-c-est-long", "Vingt minutes, c'est long", 2,
   "A table by the window of Léa's café, afternoon, the masts of small boats in the Old Port visible through the glass. HUGO leans across the table talking, both hands open as if measuring something; LÉA sits opposite him and places her wristwatch face down on the table, not looking at it. Two cups of coffee. Medium shot across the table, both waist-up.", ""),
  ("les-mots-a-l-envers", "Les mots à l'envers", 3,
   "A corner table in Léa's café at night, a round moon and one bright star in the dark window. LÉA sits holding a pencil above a closed notebook with a plain cover, frowning; HUGO sits next to her with a cup of coffee and gently squeezes her other hand on the table. A checked tablecloth and a small lamp. Close medium shot, both waist-up.", ""),
 ]),
 ("parties-and-gifts", "Parties & Gifts", ["LÉA", "HUGO", "LOUISE"], [
  ("la-boule-porte-bonheur", "La boule porte-bonheur", 1,
   "Behind the counter of Léa's café, morning, an open wooden drawer. LOUISE ties a red ribbon into a bow around a small round parcel wrapped in plain red paper; LÉA holds a single shiny silver boule in her open palm, looking at it one last time. A roll of red paper and a pair of scissors on the counter. Close medium shot, both waist-up.", "HUGO no sale: el regalo es para él."),
  ("trente-trois-bougies", "Trente-trois bougies", 2,
   f"The gravel square {PANIER} on a warm evening, paper lanterns hanging under the plane trees and a string of warm lights between the branches. LÉA holds a big round cake covered with many small lit candles; HUGO bends over it with puffed cheeks, blowing the candles out. A table with a bottle and glasses behind them. Medium shot, both waist-up.", "Los amigos de la fiesta no se dibujan."),
  ("a-toi-la-boule", "À toi la boule", 3,
   f"The gravel square {PANIER} the morning after the party, fresh morning light, a big ginger cat asleep on a wooden bench among fallen leaves. HUGO holds the shiny silver boule in his open hands, surprised; LÉA closes his fingers over it with both of her hands, smiling. Torn red wrapping paper on the bench and a broom leaning against the plane tree. Close medium shot, both waist-up.", ""),
 ]),
 ("houses-and-neighbours", "Houses & Neighbours", ["LÉA", "HUGO", "ANTOINE", "CLARA"], [
  ("l-annonce-du-couloir", "L'annonce du couloir", 1,
   "The doorway of Léa's café, late morning. ANTOINE stands in the doorway holding up a big ring of old iron keys, speaking; LÉA stands behind the counter gripping its edge with both hands, leaning towards him, upset. A row of plain unmarked metal letterboxes on the hallway wall behind him. Medium shot from inside the café, both waist-up.", "HUGO y CLARA no salen."),
  ("une-plante-pour-lea", "Une plante pour Léa", 2,
   "An empty flat with freshly painted white walls and a bare light bulb hanging from the ceiling, daylight through an open window with green shutters. HUGO holds out a green potted plant towards LÉA with both hands; LÉA takes it by the pot without smiling. A paint roller in a tray on the wooden floor. Medium shot from the window, both waist-up.", ""),
  ("des-pas-au-dessus", "Des pas au-dessus", 3,
   f"The bottom of the narrow stone staircase of the old building, morning. CLARA comes down the last steps holding the lead of {DOG}, which pulls ahead; LÉA stands at the foot of the stairs holding a cup of coffee, looking up at her. An iron handrail and a small window with morning light. Shot from the side of the staircase, both full body.", "ANTOINE no sale: la escena es el encuentro con la inconnue."),
 ]),
 ("travel-and-goodbyes", "Travel & Goodbyes", ["LÉA", "HUGO", "CLARA"], [
  ("a-samedi-hugo", "À samedi, Hugo", 1,
   "A street near the Old Port of Marseille, early morning, soft pink light, fishing boats in the background. HUGO lifts a heavy suitcase into the open boot of a plain dark-blue car seen from the side with no number plate visible; LÉA stands close beside him with one hand in her apron pocket, eyes wet, holding back tears. Seagulls in the sky. Medium shot from the pavement, both full body.", "CLARA no sale: la escena es la despedida."),
  ("clara-tient-la-boule", "Clara tient la boule", 2,
   f"The gravel square {PANIER} on a sunny spring afternoon, dust floating in the light. CLARA, wearing a green cap with her yellow coat open, bends her knees and holds a silver boule ready to throw; LÉA stands behind her correcting the position of her elbow with one hand. {DOG[0].upper()+DOG[1:]} lies in the shade of the bench, next to a water bottle. Medium shot from the front, both full body.", ""),
  ("treize-comme-avant", "Treize, comme avant", 3,
   f"The gravel square {PANIER} on a bright April afternoon. LÉA raises both arms in victory; HUGO leans in and kisses her on the cheek, laughing; CLARA claps her hands beside the bench. Silver boules scattered around the small wooden jack on the gravel. Wide shot from the edge of the square, all three full body.", ""),
 ]),
]

out = []
for topic, label, names, stories in T:
    out.append({"topic": topic, "label": label, "place": "Marseille, France", "names": names, "sheet": sheet(names),
                "stories": [{"slug": s, "title": ti, "slot": sl, "prompt": HEAD + sc, "note": no} for s, ti, sl, sc, no in stories]})
json.dump(out, open("scripts/_frA0cov/portadas.json", "w"), ensure_ascii=False, indent=1)
open("scripts/_frA0cov/portadas.json", "a").write("\n")
print(f"{len(out)} temas, {sum(len(t['stories']) for t in out)} portadas")
