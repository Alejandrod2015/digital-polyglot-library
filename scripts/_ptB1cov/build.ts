/**
 * Construye scripts/_ptB1cov/portadas.json: los prompts de las 21 portadas del
 * Traveler PT-BR B1 (journey cmtrcpgso00073232h8vaf7na). No genera imagenes.
 * Los bloques LOCK/STYLE/FRAMING y la plantilla del cast sheet son literales
 * del encargo del chat de planificacion; solo cambian fichas y escenas.
 *
 * Uso: npx tsx scripts/_ptB1cov/build.ts
 */
import * as fs from "fs";

const LOCK = "LOCK: The image provided is the cast sheet for this story. KEEP every character's face, hair, facial hair, body build, height difference, skin tone and clothing IDENTICAL to the sheet; only pose, framing, light and background change. Draw only the characters the scene names. No text, letters or numbers anywhere in the image.\n\nSTYLE: Flat cel-shaded editorial illustration, thick clean outlines, vivid saturated colour, flat colour fills, no gradients, no texture, no painterly shading, 16:9 landscape.\n\nFRAMING: the characters occupy the middle third of the frame, waist-up or fuller, and the illustration fills the entire canvas edge to edge with no borders or empty margins.\n\nSCENE: ";

const sheet = (n1: string, f1: string, n2: string, f2: string) =>
  `Character model sheet for a story series, flat cel-shaded editorial illustration, thick clean outlines, vivid saturated colour, flat colour fills with no gradients and no texture, plain pure white background, landscape 16:9.\n\nExactly 2 adult characters, drawn as a reference sheet: top row shows both full body from head to feet, standing straight, front view, neutral expression; bottom row shows the same two as head-and-shoulders close-ups.\n\nLEFT is ${n1}: ${f1}.\n\nRIGHT is ${n2}: ${f2}.\n\nGenerous white margin around every figure, no props, no scenery, no shadows on the background, and absolutely no text, labels or numbers anywhere in the image.`;

// Renata es la protagonista de los siete temas: su ficha no cambia salvo la
// altura, que se dice siempre respecto a la otra persona del cuadro.
const renata = (altura: string) =>
  `woman, exactly 38 years old, slim build, medium height, ${altura}, warm light-brown skin, dark brown wavy hair down to the shoulders tied in a low ponytail, WITHOUT fringe, no facial hair, no glasses; wears a teal-blue lightweight zip-up jacket over a plain white round-neck t-shirt, dark grey cotton trousers and tan leather ankle boots`;

type Story = { slug: string; title: string; slot: number; scene: string; note: string };
type Topic = { topic: string; label: string; place: string; partner: string; renataAltura: string; ficha: string; stories: Story[] };

const T: Topic[] = [
  {
    topic: "salvador", label: "Classrooms & Exams", place: "Salvador, Brasil", partner: "GILSON",
    renataAltura: "a head shorter than GILSON",
    ficha: "man, exactly 26 years old, clearly a young adult man and not a teenager, lean build, a head taller than RENATA, dark brown skin, black hair cropped very short, WITHOUT fringe, clean-shaven, no glasses; wears a plain navy-blue short-sleeved work shirt with no logo, khaki cotton trousers and black canvas trainers",
    stories: [
      { slug: "a-lousa-e-nenhum-livro", title: "A lousa e nenhum livro", slot: 1, note: "",
        scene: "An old classroom with tall wooden shutters in the Pelourinho, Salvador, early morning, soft yellow light. GILSON stands at a dark green blackboard that is completely blank and wiped clean, holding a stick of white chalk up as if about to draw; RENATA stands beside him holding a closed hardback notebook against her chest, watching the chalk. Rows of empty wooden chairs, a broom leaning against the wall and a bare teacher's desk with no books on it. Wide shot from the back of the room, both full body." },
      { slug: "o-preco-nao-a-ideia", title: "O preço, não a ideia", slot: 2, note: "",
        scene: "The doorway of a small old bookshop on a steep cobbled street in Salvador, late afternoon, warm orange light. GILSON holds out a single closed book with a plain cover towards RENATA with both hands; RENATA raises one palm, refusing with a half smile. Shelves of closed books seen only by their plain coloured spines and an old ceiling fan turning above them. Medium shot from the side, both waist-up." },
      { slug: "a-ladeira-na-sexta", title: "A ladeira na sexta", slot: 3, note: "",
        scene: "The stone steps outside a colonial library in Salvador at dusk, deep blue sky and one lit street lamp. GILSON sits on a step with a closed leather folder on his knees, speaking with one hand raised; RENATA stands two steps below him, arms crossed, listening closely. Pastel colonial facades and a steep empty cobbled slope behind them. Low-angle shot from the bottom of the steps, both full body." },
    ],
  },
  {
    topic: "recife", label: "Pharmacy & Small Aches", place: "Recife, Brasil", partner: "NILZA",
    renataAltura: "a little taller than NILZA",
    ficha: "woman, exactly 56 years old, clearly a woman in her mid-fifties and not elderly, plump build, a little shorter than RENATA, medium brown skin, black hair streaked with grey pulled back into a tight bun, WITHOUT fringe, no facial hair, round gold-framed glasses; wears a plain white pharmacist's coat with no badge over a lilac blouse, black trousers and white clogs",
    stories: [
      { slug: "a-dor-nao-e-doenca", title: "A dor não é doença", slot: 1, note: "",
        scene: "The counter of a small corner pharmacy in Recife, midday, bright white light. NILZA stands behind the counter holding up a small plain brown glass bottle with no label; RENATA stands in front of the counter with one hand pressed to the side of her neck and her head tilted stiffly. Shelves of plain white boxes with no printing and a potted plant by the door. Medium shot straight across the counter, both waist-up." },
      { slug: "o-quarto-morno-da-pousada", title: "O quarto morno da pousada", slot: 2, note: "",
        scene: "The counter of the small corner pharmacy in Recife at one in the morning, on the night shift, lit by one cold white ceiling light. NILZA has stepped out from behind the counter with a cup of coffee in one hand, showing a slow breath with her other hand on her chest; RENATA stands facing her in her jacket, arms wrapped around herself, tired. Shelves of plain white boxes with no printing and a dark street behind the glass door. Close medium shot from slightly above, both waist-up." },
      { slug: "o-pano-com-sangue-seco", title: "O pano com sangue seco", slot: 3, note: "",
        scene: "Inside the same corner pharmacy in Recife, early morning. NILZA sits on a stool behind the counter resting her hand, wrapped in a white cloth, on a cushion; RENATA leans over the counter handing her a small cup of coffee. A glass jar of cotton wool and a closed first-aid box on the counter. Over-the-shoulder shot from behind RENATA, both waist-up." },
    ],
  },
  {
    topic: "jericoacoara", label: "Kitchens & Chores", place: "Jericoacoara, Brasil", partner: "EDILSON",
    renataAltura: "a little shorter than EDILSON",
    ficha: "man, exactly 31 years old, stocky build, a little taller than RENATA, dark brown skin, short black curly hair, WITHOUT fringe, short neat black beard, no glasses; wears an orange baseball cap with no logo, a faded sky-blue t-shirt, knee-length grey shorts and black flip-flops",
    stories: [
      { slug: "o-fogao-de-quatro-bocas", title: "O fogão de quatro bocas", slot: 1, note: "",
        scene: "The shared kitchen of a sandy-floored guesthouse in Jericoacoara, late afternoon, sun through a wide window. EDILSON stands at a sink piled with dirty plates, scrubbing a plate; RENATA stands next to him holding a yellow sponge, turning to look at an old four-burner stove. Forks in a metal rack, a broom against the wall and a frying pan on the stove. Wide shot from the kitchen door, both full body." },
      { slug: "a-batata-crua-no-feijao", title: "A batata crua no feijão", slot: 2, note: "",
        scene: "The same guesthouse kitchen at night, lit by a hanging bulb. EDILSON, still wearing his cap, tastes from a wooden spoon over a large pot of beans with a serious face; RENATA stands beside him holding a raw potato cut in four on a small board, watching him. An onion, a tomato and a pot of white rice on the counter. Close medium shot, both waist-up." },
      { slug: "a-regra-vale-ou-nao-vale", title: "A regra vale ou não vale?", slot: 3, note: "",
        scene: "The same kitchen in the middle of the day, hot and still. RENATA drains pasta into a colander over the sink; EDILSON leans in the doorway with his arms crossed and one eyebrow raised. An open fridge showing only plain food containers, a bowl of lettuce and carrot, and one crusted pan on the stove. High-angle shot from above the counter, both waist-up or fuller." },
    ],
  },
  {
    topic: "lencois-maranhenses", label: "Storms & Changed Plans", place: "Lençóis Maranhenses, Brasil", partner: "DAMIÃO",
    renataAltura: "a head shorter than DAMIÃO",
    ficha: "man, exactly 45 years old, wiry and muscular build, a head taller than RENATA, deep brown weathered skin, short black hair with grey at the temples, WITHOUT fringe, clean-shaven, no glasses; wears a faded mustard-yellow long-sleeved cotton shirt with the sleeves rolled up, navy trousers rolled to the knee, barefoot",
    stories: [
      { slug: "a-passagem-ja-comprada", title: "A passagem já comprada", slot: 1, note: "",
        scene: "The covered wooden porch of a small guesthouse near the Lençóis Maranhenses in heavy rain, grey morning light. DAMIÃO stands at the edge of the porch looking up at the grey sky with one hand shading his eyes; RENATA stands just behind him under the roof, arms folded tight, looking out at a flooded field. Rain dripping from the roof edge and a muddy track fading into the mist. Wide shot from inside the porch, both full body." },
      { slug: "se-puxar-a-gente-vira", title: "Se puxar, a gente vira", slot: 2, note: "",
        scene: "A narrow wooden canoe on a high, fast brown river beside dark green forest, early morning under a heavy sky. DAMIÃO sits at the back rowing hard with a single wooden paddle; RENATA sits at the front gripping the wooden bench with both hands, leaning away from the tilting side. Splashing water along the hull and a tall pale sand dune on the far bank. Side-on medium shot from water level, both waist-up or fuller." },
      { slug: "a-lagoa-entre-as-dunas", title: "A lagoa entre as dunas", slot: 3, note: "",
        scene: "A wide shallow turquoise lagoon between white sand dunes at dawn, a pale moon low in a pink sky. RENATA stands waist-deep in the clear water with her arms open, laughing; DAMIÃO stands on the sand at the edge beside the beached canoe, watching her. A single small green plant on the dune. Very wide shot from the top of a dune, both full body." },
    ],
  },
  {
    topic: "campo-grande", label: "Buses & Night Rides", place: "Campo Grande, Brasil", partner: "CLEIDE",
    renataAltura: "a little taller than CLEIDE",
    ficha: "woman, exactly 52 years old, clearly a woman in her early fifties and not elderly, medium build, a little shorter than RENATA, fair skin with light freckles, dyed auburn hair in a short bob WITH a side-swept fringe, no facial hair, no glasses, small silver stud earrings; wears a plain navy-blue uniform blazer with no badge or logo over a white blouse, navy trousers and black low shoes",
    stories: [
      { slug: "um-papel-que-ja-nao-vale", title: "Um papel que já não vale", slot: 1, note: "",
        scene: "A ticket window at the bus station of Campo Grande at night, under cold white strip lights. CLEIDE sits behind the glass of the only open window, shaking her head gently with one palm raised; RENATA stands at the window holding a sheet of paper folded in half, frowning. A row of closed shutters on the other windows and an empty metal bench. Medium shot from the side of the counter, both waist-up." },
      { slug: "a-senhora-nao-dorme", title: "A senhora não dorme?", slot: 2, note: "CLEIDE no sale: la escena es el viaje nocturno. El motorista y el pasajero que ronca no se dibujan.",
        scene: "Inside a long-distance bus at night, dark blue light and an empty aisle. RENATA sits on a narrow window seat, awake, one hand gripping the seat back in front, looking out at the dark road; the frame is cropped tight on her, so the neighbouring seat stays out of the picture. Rows of empty seat backs and the orange glow of a traffic light through the wet window. Close shot from the aisle, RENATA waist-up." },
      { slug: "sete-minutos-de-moto", title: "Sete minutos de moto", slot: 3, note: "CLEIDE no sale: la escena es el garaje. El mototaxista y los dos mozos no se dibujan.",
        scene: "A bus depot in Campo Grande at sunrise, pink sky and long shadows. RENATA stands on the step of a parked bus holding a closed notebook high with both hands, relieved; the bus door is open behind her. Two more parked buses with blank sides, a red motorbike parked on the concrete and a stack of suitcases. Low-angle wide shot from the ground, RENATA full body." },
    ],
  },
  {
    topic: "petropolis", label: "Laptops & Deadlines", place: "Petrópolis, Brasil", partner: "WILSON",
    renataAltura: "a little shorter than WILSON",
    ficha: "man, exactly 48 years old, slightly overweight build, a little taller than RENATA, light-brown skin, short black hair thinning on top, WITHOUT fringe, neatly trimmed grey goatee, rectangular black-framed glasses; wears a plain maroon polo shirt with no logo, beige chino trousers and brown leather shoes",
    stories: [
      { slug: "um-generico-ate-segunda", title: "Um genérico até segunda", slot: 1, note: "",
        scene: "The counter of a small computer repair shop in Petrópolis on a cold morning, pale misty light at the window. WILSON holds up a black laptop charger cable, checking its plug closely; RENATA stands across the counter with her laptop closed in front of her, waiting. A small green light glowing on a power strip, coiled cables on hooks and a mug of coffee. Medium shot across the counter, both waist-up." },
      { slug: "tem-uma-solucao-mas-e-ma", title: "Tem uma solução, mas é má", slot: 2, note: "",
        scene: "A small table at the back of the same shop, early morning. RENATA sits at the table facing an open laptop whose screen faces away from the viewer, one hand on her forehead, tense; WILSON sets a cup of coffee down beside her. A second empty table, a closed metal cabinet and grey light from a high window. Shot from behind the laptop screen, both waist-up." },
      { slug: "o-barbante-de-um-real", title: "O barbante de um real", slot: 3, note: "",
        scene: "The same shop counter in the afternoon. RENATA ties a thick brown paper parcel with rough string; WILSON leans over the counter handing her a pair of scissors. A roll of string, a closed printer with its lid down and a pile of folded brown paper bags. High-angle shot from above the counter, both waist-up or fuller." },
    ],
  },
  {
    topic: "gramado", label: "Laundry & Cold Nights", place: "Gramado, Brasil", partner: "NEUZA",
    renataAltura: "a little taller than NEUZA",
    ficha: "woman, exactly 58 years old, clearly a woman in her late fifties and not elderly, sturdy build, a little shorter than RENATA, dark brown skin, short curly black hair streaked with grey, WITHOUT fringe, no facial hair, no glasses; wears a lavender quilted vest over a thick cream turtleneck sweater, dark brown corduroy trousers, black ankle boots and a plain blue cotton apron",
    stories: [
      { slug: "nada-minha-filha", title: "Nada, minha filha", slot: 1, note: "",
        scene: "The open door of a small corner laundry on a cold grey afternoon in Gramado, wooden houses and pine trees behind. NEUZA hangs wet socks on a long wooden pole; RENATA stands beside an open brown cardboard box, holding a thick folded red jumper against her chest. A green scarf and a single grey glove on top of the box. Wide shot from the street, both full body." },
      { slug: "a-fronha-gelada", title: "A fronha gelada", slot: 2, note: "",
        scene: "Inside the warm laundry at dusk, lit by one yellow lamp. NEUZA pours tea from a metal kettle into a worn mug, glancing fondly at the window; RENATA holds the mug with both hands close to her face. Folded towels on a shelf and steam rising from the mug. Close medium shot, both waist-up." },
      { slug: "o-desfile-na-ultima-manha", title: "O desfile na última manhã", slot: 3, note: "",
        scene: "The pavement outside the laundry on a bright cold morning, colourful paper bunting strung across the street and one red balloon floating up into the blue sky. RENATA holds out the folded red jumper; NEUZA pushes it gently back towards her, laughing. A puddle on the pavement and a pine tree behind. Low-angle medium shot from the pavement, both waist-up or fuller." },
    ],
  },
];

const out = T.map((t) => ({
  topic: t.topic,
  label: t.label,
  place: t.place,
  names: ["RENATA", t.partner],
  sheet: sheet("RENATA", renata(t.renataAltura), t.partner, t.ficha),
  stories: t.stories.map((s) => ({ slug: s.slug, title: s.title, slot: s.slot, prompt: LOCK + s.scene, note: s.note })),
}));
fs.writeFileSync("scripts/_ptB1cov/portadas.json", JSON.stringify(out, null, 1) + "\n");
console.log(`${out.length} temas, ${out.reduce((n, t) => n + t.stories.length, 0)} portadas`);
