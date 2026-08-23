/**
 * Prompt CERRADO de las 21 portadas del Expat FR A0 (Lyon).
 *
 * Escribe un fichero de escena por historia en `scripts/_covers/fra0/`, que es
 * lo que come el generador sancionado:
 *
 *   NODE_OPTIONS="--conditions=react-server -r dotenv/config" \
 *   DOTENV_CONFIG_PATH=.env.local npx tsx scripts/generateCover.ts \
 *     <storyId> scripts/_covers/fra0/<slug>.txt --dry
 *
 * El bloque de estilo NO se toca aquí: lo antepone `generateCover.ts` desde
 * `cover-style.json`. Este fichero aporta las cuatro cosas que el A1 ES/Spain
 * costó 80 tiradas aprender ([[feedback_cover_prompt_closed_before_first_render]]):
 * ficha literal por personaje, registro visual anclado, reparto contado y
 * descrito entero, y ni un objeto con letras en la escena.
 *
 *   npx tsx scripts/_frCoverScenes.ts [--print <slug>]
 */
import { mkdirSync, writeFileSync } from "fs";

const DIR = "scripts/_covers/fra0";

/** Ficha de personaje: edad, pelo (color, largo, flequillo) y color FIJO de
 *  ropa. El color de la ropa es lo único que el modelo respeta entre tiradas;
 *  sin él, Manon cambia de persona de una portada a otra. */
const C = {
  manon:
    "MANON (recurring main character, must look identical in every image): a woman of about twenty-nine, wavy DARK BROWN hair to the shoulders with a middle parting and NO fringe, slim build, light skin, brown eyes, wearing a plain MUSTARD YELLOW jumper and dark blue jeans.",
  sylvie:
    "SYLVIE (recurring neighbour, must look identical in every image): a woman of about forty-five, straight LIGHT BROWN hair in a short bob to the jaw, no fringe, sturdier build, calm friendly face, wearing a DEEP GREEN cardigan over a white shirt and grey trousers.",
  camille:
    "CAMILLE (recurring colleague, must look identical in every image): a woman of about thirty-two, BLACK hair pulled back in a low ponytail, no fringe, tall and slim, lively expression, wearing a WINE RED blouse and black trousers.",
  pauline:
    "PAULINE (recurring friend, must look identical in every image): a woman of about twenty-six, dark blonde hair tied in a high bun, no fringe, small and wiry, wearing a PURPLE zipped anorak and blue jeans.",
  juliette:
    "JULIETTE (recurring baker, must look identical in every image): a woman of about fifty, chestnut brown hair pinned up, no grey and no white hair, warm round face, wearing a SKY BLUE shirt under a plain WHITE baker's apron.",
  baptiste:
    "BAPTISTE (recurring manager, must look identical in every image): a man of about forty-five, short dark brown hair, clean shaven, no beard, medium build, quiet expression, wearing a NAVY BLUE shirt with no tie and grey trousers.",
  nicolas:
    "NICOLAS (recurring classmate, must look identical in every image): a man of about thirty-five, short black hair, clean shaven, no beard, broad shoulders, wearing a RUST ORANGE jumper and dark jeans.",
  antoine:
    "ANTOINE (new neighbour, appears once): a man of about twenty-six, short light brown curly hair, clean shaven, slim, wearing a TEAL BLUE jacket and blue jeans.",
  lea:
    "LEA (evening class teacher, appears once): a woman of about thirty-eight, BLACK hair in a short bob, no fringe, wearing a CHARCOAL GREY blazer over a white shirt.",
};

/** Registro visual anclado a las portadas de referencia aprobadas (las tres
 *  escenas berlinesas de `cover-style.json`), mas la paleta propia de Lyon.
 *  Va en TODAS las escenas, no solo en el bloque de estilo: en el A1 los planos
 *  generales arrastraban al modelo hacia ilustracion apagada con textura. */
const REGISTRO =
  "RENDERING (critical): flat saturated cel colour with bold clean outlines, the same bright picture-book register in every image; NO muted or dusty palette, NO visible wall texture or paper grain, NO thin sketchy linework, NO desaturated editorial illustration look. " +
  "PLACE AND LIGHT (critical): a French city of ochre, cream and dusty pink stone facades with terracotta roofs, tall shuttered windows, steep stone stair streets and two wide grey blue rivers; clear even daylight, or at night warm lamp light against a deep blue sky. " +
  "FRAMING (critical): the people are seen at a comfortable MIDDLE DISTANCE, head to knee or full body, never a close up of a face filling the frame and never tiny specks in a landscape. " +
  "TEXT (critical): the image contains NO written words anywhere: no shop names, no signs, no labels, no numbers, no price tags, no posters, no logos, no watermark; every board, paper, screen and shop front in the scene is completely blank.";

const SCENES: Array<[string, string[], string]> = [
  ["les-premieres-heures", [C.manon, C.sylvie],
   "A stairwell landing in an old French city building on a Thursday morning. THERE ARE EXACTLY TWO PEOPLE IN THE IMAGE AND NOBODY ELSE: (1) MANON, two suitcases beside her, pulling a stiff wooden door towards herself with both hands; (2) SYLVIE, a few steps higher on the dark wooden staircase, her coat folded over one arm, explaining the door with a small gesture. Cream ochre walls, a tall window with morning light, a bare bulb. Calm welcoming mood."],
  ["six-cartons-pleins", [C.manon],
   "A small kitchen on a rainy Sunday at midday. THERE IS EXACTLY ONE PERSON IN THE IMAGE AND NOBODY ELSE: MANON standing in front of six sealed cardboard boxes stacked against the wall, holding a phone to her ear, the screen turned away and not visible, her free hand on the back of a chair. A dry loaf and two apples on the counter, a coffee pot, closed curtains, grey rain on the window, an old radiator. Tired half smiling mood."],
  ["trop-grande-pour-le-lit", [C.manon],
   "A small bedroom at night. THERE IS EXACTLY ONE PERSON IN THE IMAGE AND NOBODY ELSE: MANON kneeling on the floor beside an opened cardboard box, unfolding a big heavy brown and cream wool blanket over a narrow bed that is clearly too small for it. A floor lamp stands on the boards beside her and fills the room with warm yellow light; an open suitcase and more cardboard boxes in the corner, black night in the window. Quiet contented mood."],
  ["camille-attend-depuis-vingt-minutes", [C.manon, C.pauline],
   "A lit tram shelter beside a wide river at night. THERE ARE EXACTLY TWO PEOPLE IN THE IMAGE AND NOBODY ELSE: (1) MANON, looking the wrong way down the street, confused; (2) PAULINE, standing beside her and pointing across the water to the far bank. A green city tram arrives on the left, its front number panel completely BLANK. Wet reflecting pavement, warm lamp light, a lit bridge in the distance, deep blue night sky."],
  ["la-boulangerie-etait-fermee", [C.manon],
   "A narrow street at nine in the evening in front of a bakery whose metal shutter is rolled down. THERE ARE EXACTLY TWO PEOPLE IN THE IMAGE AND NOBODY ELSE: (1) MANON standing in front of the closed shutter, hands in her pockets, shoes soaked; (2) an adult man of about forty in a dark apron, holding a bucket, pointing downhill to another street. The shop front above the shutter is completely blank with no name and no letters. Wet cobbles, street lamps, evening blue, resigned amused mood."],
  ["on-compte-a-deux", [C.manon],
   "A long stone stair street climbing a hill above the city, in the rain at midnight. THERE IS EXACTLY ONE PERSON IN THE IMAGE AND NOBODY ELSE: MANON sitting on a wet step halfway up, soaked, a phone in her hand held low with the screen turned away and not visible, looking down at the city. Below her the rooftops are black and wet, two dark rivers cross the view and an orange lit bridge spans one of them. Rain, warm lamps, deep blue night."],
  ["elle-n-a-pas-su-dire-non", [C.manon],
   "A busy market street in the morning at a cheese stall. THERE ARE EXACTLY TWO PEOPLE IN THE IMAGE AND NOBODY ELSE: (1) MANON, a wicker basket over her arm, tasting a small piece of cheese and unable to say no; (2) the stallholder, an adult man of about forty in a white apron, holding out a second piece on the flat of a knife. Wheels and wedges of cheese and crates of tomatoes on the stall, all price boards completely BLANK, striped awning, bright clear daylight."],
  ["la-carte-ne-passe-pas", [C.manon],
   "A supermarket checkout. THERE ARE EXACTLY THREE PEOPLE IN THE IMAGE AND NOBODY ELSE: (1) MANON at the till, holding a bank card, embarrassed; (2) the cashier, an adult woman of about forty in a green work polo shirt, seated at the till; (3) one other customer, an adult woman of about thirty five in a grey coat, setting a box of eggs on the belt behind her. The card terminal is seen from behind so its screen is not visible; milk, rice and soap on the belt; the shelves and every label are completely BLANK. Bright even indoor light."],
  ["sylvie-negocie-manon-paie", [C.manon, C.sylvie],
   "An outdoor flea market on a bright morning, at a trestle table of old objects. THERE ARE EXACTLY THREE PEOPLE IN THE IMAGE AND NOBODY ELSE: (1) SYLVIE, leaning over the table mid bargain, one hand raised in a friendly offer; (2) the stallholder, an adult man of about fifty in a brown jacket, arms folded, amused; (3) MANON standing a step behind them holding two paper coffee cups and looking at a GREEN table lamp on the table. Old plates, a stack of books all CLOSED with their spines turned away, no writing anywhere. Bright daylight, warm mood."],
  ["la-monnaie-exacte", [C.manon, C.camille],
   "An office corridor beside a coffee machine in the early morning. THERE ARE EXACTLY TWO PEOPLE IN THE IMAGE AND NOBODY ELSE: (1) CAMILLE, laughing, slapping the side of the machine with the flat of her hand; (2) MANON beside her, a coin between her fingers, watching a paper cup sit in the tray. The machine front and every button panel are completely BLANK with no words or numbers. Grey blue carpet, a window at the end of the corridor, bright even daylight."],
  ["la-question-de-baptiste", [C.manon, C.camille, C.baptiste],
   "A small bright meeting room with a pale wooden table. THERE ARE EXACTLY THREE PEOPLE IN THE IMAGE AND NOBODY ELSE: (1) BAPTISTE standing at the end of the table with a CLOSED folder under his arm, speaking quietly; (2) MANON seated, looking up at him, caught mid sentence; (3) CAMILLE seated beside her, glancing sideways at Manon. A closed laptop on the table, the wall behind completely BLANK with no board and no posters. Big window, clear daylight, a still attentive mood."],
  ["nicolas-part-en-juin", [C.manon, C.nicolas, C.lea],
   "An evening language class in a warm room, at one end of a big table with the other chairs empty. THERE ARE EXACTLY THREE PEOPLE IN THE IMAGE AND NOBODY ELSE: (1) MANON with one hand raised, about to try an answer; (2) NICOLAS beside her, writing in a small notebook held at an angle so the page shows no writing; (3) LEA, the teacher, standing beside a plain dark green board that is completely BLANK. A hot radiator under a black night window, warm lamp light, encouraging mood."],
  ["juliette-vend-la-boutique", [C.manon, C.juliette],
   "Inside a small bakery just before closing. THERE ARE EXACTLY TWO PEOPLE IN THE IMAGE AND NOBODY ELSE: (1) JULIETTE behind the wooden counter, handing a baguette wrapped in plain unmarked paper across to Manon with a smile; (2) MANON taking it with both hands. Golden loaves in the racks behind, two baguettes left in the basket, all shelf edges and the window completely BLANK with no prices and no shop name. Warm evening light through the glass."],
  ["a-huit-heures-pile", [C.manon, C.camille],
   "A living room at eight in the evening, around a low table. THERE ARE EXACTLY THREE PEOPLE IN THE IMAGE AND NOBODY ELSE: (1) CAMILLE standing, pouring a drink, relaxed; (2) MANON sitting on the sofa still holding the bottle she brought, hungry and unsure; (3) one other guest, an adult woman of about thirty five in a grey jumper, reaching for an olive. Olives, sliced sausage and glasses on the low table; the dining table behind is bare and NOT yet set. Open window, deep blue evening outside, warm lamp light."],
  ["la-truffade-et-le-telephone", [C.manon, C.sylvie, C.juliette],
   "A small kitchen full of steam. THERE ARE EXACTLY THREE PEOPLE IN THE IMAGE AND NOBODY ELSE: (1) MANON at the stove, both hands on a heavy black frying pan of melted cheese and potatoes; (2) SYLVIE beside her, leaning in to look into the pan; (3) JULIETTE at the table, eyes closed, tasting from a spoon. A phone lies face down on the table, its screen not visible. Butter, a garlic bulb and bread on the counter, open window, warm bright light, happy mood."],
  ["la-pharmacie-avant-le-medecin", [C.manon],
   "Inside a small pharmacy on a rainy evening. THERE ARE EXACTLY TWO PEOPLE IN THE IMAGE AND NOBODY ELSE: (1) the pharmacist, an adult woman of about forty in a white coat, setting a bottle of syrup and a small tin of pastilles on the counter; (2) MANON facing her, a scarf around her neck, one hand at her throat. A wall of small closed wooden drawers behind the counter, all completely BLANK with no labels; through the window a plain GREEN CROSS sign with no letters and no numbers, rain on the glass. Clean bright indoor light."],
  ["un-medecin-traitant-pour-deux-ans", [C.manon],
   "A small doctor's consulting room. THERE ARE EXACTLY TWO PEOPLE IN THE IMAGE AND NOBODY ELSE: (1) the doctor, an adult man of about fifty in a light blue shirt, seated at his desk with a pen in his hand resting on a completely BLANK sheet of paper, looking up mid sentence; (2) MANON seated across the desk, coat folded on her lap, listening carefully. The wall behind him has one empty picture frame with nothing in it and no diplomas, no calendar, no writing anywhere. Warm even daylight through a tall window, calm mood."],
  ["la-cheville-et-la-glace", [C.manon, C.sylvie],
   "A stairwell landing in daylight, the day after a fall. THERE ARE EXACTLY TWO PEOPLE IN THE IMAGE AND NOBODY ELSE: (1) MANON sitting on the top step, one shoe off, her bare foot resting on a cushion, holding a cloth wrapped ice pack against a swollen ankle; (2) SYLVIE crouched in front of her, holding the ice pack in place with one hand. A loaf of bread lies on the doormat behind them. Cream walls, dark wooden stairs, a high window with clear light, caring mood."],
  ["sa-chaise-reste-vide-deux-heures", [C.manon, C.sylvie],
   "An inner courtyard in the evening, set with long tables under plain string lights. THERE ARE EXACTLY THREE PEOPLE IN THE IMAGE AND NOBODY ELSE: (1) MANON seated at the table with one hand resting on the empty YELLOW chair beside her, keeping the place; (2) SYLVIE standing, pouring into a glass; (3) one neighbour, an adult woman of about forty five in a plum coloured blouse, talking across the table. A savoury tart between two salad bowls, cold chicken on a platter, no banners and no signs anywhere. Warm lamp light, deep blue sky above the courtyard."],
  ["deux-mille-marches-a-deux", [C.manon, C.pauline],
   "A stone stair street on a warm summer night, climbing between old buildings with every window open and lit. THERE ARE EXACTLY THREE PEOPLE IN THE IMAGE AND NOBODY ELSE: (1) MANON and (2) PAULINE walking up the steps together, mid conversation, Pauline counting on her fingers; (3) at the bottom corner under a street lamp, one musician, an adult man of about forty in a blue shirt, playing an accordion. Warm yellow windows, deep blue sky, no crowd, festive easy mood."],
  ["la-porte-qu-il-faut-tirer", [C.manon, C.antoine],
   "The same stairwell landing as the first image, on a bright morning. THERE ARE EXACTLY TWO PEOPLE IN THE IMAGE AND NOBODY ELSE: (1) ANTOINE, two suitcases beside him, a key in the lock of a stiff wooden door; (2) MANON one step away, miming a pull towards herself with one hand, smiling. Cream ochre walls, dark wooden staircase, a tall window with clear morning light, easy friendly mood."],
];

const PRINT = process.argv.indexOf("--print");
mkdirSync(DIR, { recursive: true });
for (const [slug, fichas, escena] of SCENES) {
  const texto = [...fichas, REGISTRO, escena].join("\n\n");
  writeFileSync(`${DIR}/${slug}.txt`, texto + "\n");
  if (PRINT > 0 && process.argv[PRINT + 1] === slug) console.log(texto);
}
if (PRINT < 0) console.log(`${SCENES.length} escenas -> ${DIR}/`);
