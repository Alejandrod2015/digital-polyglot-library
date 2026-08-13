/**
 * Cover de UNA historia del journey PT-BR A0. Prompt a mano con los seis
 * bloques del spec §5 (escena → personajes → props → estilo → paleta → marco),
 * porque `buildCoverPrompt` devuelve la media estadística y no esta historia.
 *
 * Los dos anclajes en POSITIVO (piel mate, ojos almendrados con iris) están
 * ahí porque Flux ignora las negaciones: decir "no dot eyes" no basta.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { generateFluxImageBuffer } from "../src/lib/coverGenerator";
import { uploadPublicObject } from "../src/lib/objectStorage";

const SLUG = process.argv[2] ?? "palmas-no-arpoador";

// 1. Escena: una o dos frases, sin describir manos (Flux dibuja rezo), y
// DENSA. Los covers live llenan el cuadro de objetos y de gente haciendo
// cosas; los primeros dos míos salieron vacíos al lado de ellos.
const SCENES: Record<string, string> = {
  "a-areia-queima-os-pes":
    "A stretch of Ipanema beach in Rio de Janeiro at midday, the sand crowded " +
    "with striped umbrellas, folding chairs, cool boxes, rolled towels and " +
    "stray flip-flops, but only two people in the frame. A Brazilian man " +
    "around 30 in a t-shirt and shorts is caught mid-stride on the burning " +
    "sand with his flip-flops in one hand, and a Brazilian woman around 35 " +
    "sitting under an umbrella points him towards the wet sand by the surf. " +
    "Calm restrained faces, mouths closed, nobody laughing.",
  "um-balde-uma-onda":
    "A stretch of Ipanema beach in Rio de Janeiro in the afternoon, the sand " +
    "around them full of buckets, spades, rolled towels and a cool box, with a " +
    "kiosk counter behind, but only two people in the frame. A Brazilian woman " +
    "around 35 in a loose t-shirt kneels beside a large sandcastle with three " +
    "towers, both of her eyes fixed on the wall of the castle. A Brazilian man " +
    "around 30 crouches next to her holding a red bucket, his head turned down " +
    "towards the wave washing into the base of the castle. Both of them look " +
    "at the sandcastle and at the water, their faces in profile to the viewer. " +
    "Calm restrained faces, mouths closed, nobody laughing.",
  "duas-moedas-para-copacabana":
    "Inside a crowded Rio de Janeiro city bus in the afternoon, the aisle full " +
    "of handrails, shopping bags, a fruit bag on a lap and a metal turnstile, " +
    "seen past two people. A Brazilian woman around 30 with a heavy suitcase " +
    "holds out two small coins to a Brazilian man around 40 sitting at the " +
    "fare collector's post behind the turnstile, who counts them. Through the " +
    "window a strip of blue sea between tall buildings. Calm restrained " +
    "faces, mouths closed, nobody laughing.",
  "a-ladeira-guarda-mil-azulejos":
    "A steep staircase in Santa Teresa, Rio de Janeiro, every step and wall " +
    "covered edge to edge in thousands of coloured ceramic tiles, with potted " +
    "plants, a broom and a bucket on the steps, but only two people in the " +
    "frame. A Brazilian woman around 30 sits on a blue tiled step looking up " +
    "at the tiled wall, and a Brazilian man around 40 sweeps the steps a " +
    "little above her. Calm restrained faces, mouths closed, nobody laughing.",
  "a-ultima-barca-para-niteroi":
    "The open upper deck of the Rio de Janeiro to Niteroi ferry at dusk, with " +
    "rows of empty plastic benches, a life ring on the rail, a rolled rope and " +
    "a metal turnstile behind, but only two people in the frame. A Brazilian " +
    "woman around 30 stands at the rail with her shoulders dropped, looking " +
    "out at the water, and a Brazilian man around 40 in a work shirt closes " +
    "the gate behind her. Sugarloaf Mountain dark against an orange sky. Calm " +
    "restrained faces, mouths closed, nobody laughing.",
  "acabou-a-coxinha":
    "Inside a busy Sao Paulo bakery at lunchtime, the counter crowded with a " +
    "glass display case, metal trays, a coffee machine, paper napkin holders " +
    "and a till, but only two people in the frame. A Brazilian woman around 40 " +
    "in an apron wipes the empty glass case with a cloth, her eyes on the " +
    "glass. A Brazilian man around 30 stands at the counter looking down into " +
    "the empty tray where the coxinhas were. Both faces in profile to the " +
    "viewer, mouths closed, nobody laughing.",
  "a-cana-vira-caldo-doce":
    "A Saturday street market in Pinheiros, Sao Paulo, seen from the side. A " +
    "tall green sugar cane press stands on a wooden counter in the centre of " +
    "the frame, a stream of pale green juice pouring from it into a metal " +
    "bucket. Behind the counter a Brazilian stall holder around 35 in an apron " +
    "works the press, his eyes down on the stream of juice. On the near side " +
    "of the counter a Brazilian customer around 30 stands watching the same " +
    "stream of juice, clearly separated from him by the counter and the " +
    "machine. Neither man looks at the other. Crates of mangoes, long stalks " +
    "of sugar cane, hanging scales and plastic crates around them. Mouths " +
    "closed, nobody laughing.",
  "a-primeira-fornada-sai-quente":
    "Inside an empty Sao Paulo bakery just after opening, before dawn, the " +
    "room full of wooden chairs on tables, a radio on a shelf, flour sacks, a " +
    "large oven and a metal tray of round golden cheese breads, with only two " +
    "people in the frame. A Brazilian baker around 40 in a white apron slides " +
    "the tray out of the oven, his eyes on the tray. A Brazilian man around 30 " +
    "sits alone at the window table looking at the bread. Both faces in " +
    "profile to the viewer, mouths closed, nobody laughing. Dark street " +
    "outside the window, warm lamp light inside.",
  "o-sanduiche-custa-caro":
    "Inside the Mercadao market hall in Sao Paulo, the deli counter piled with " +
    "huge mortadella sandwiches, hanging sausages, a price sign, paper wrappers " +
    "and a till, with tall stained-glass windows behind, but only two people in " +
    "the frame. A Brazilian woman around 30 stands at the counter reading the " +
    "price sign, her eyes on the sign. A Brazilian man around 40 in an apron " +
    "behind the counter cuts mortadella, his eyes on the meat. Neither looks at " +
    "the other. Mouths closed, nobody laughing.",
  "uma-fatia-gratis":
    "A fruit stall inside the Mercadao market hall in Sao Paulo, the counter " +
    "piled with jackfruit, mangoes and papaya, a hanging scale, plastic crates " +
    "and a napkin holder, but only two people in the frame. A Brazilian man " +
    "around 40 behind the counter holds out a slice of yellow jackfruit on a " +
    "napkin, his eyes on the slice. A Brazilian woman around 30 in front of the " +
    "counter looks down at the scale where four whole fruits sit. Neither looks " +
    "at the other. Mouths closed, nobody laughing.",
  "sem-troco-na-banca":
    "A nut and cheese stall inside the Mercadao market hall in Sao Paulo, the " +
    "counter covered with open sacks of cashews and brazil nuts, paper bags, an " +
    "open till drawer and a hanging scale, but only two people in the frame. A " +
    "Brazilian woman around 35 behind the counter counts coins out of the open " +
    "drawer, her eyes on the coins. A Brazilian woman around 30 in front of the " +
    "counter holds a large banknote and watches the coins too. Neither looks at " +
    "the other. Mouths closed, nobody laughing.",
  "tres-nos-na-fita":
    "A colonial street in the Pelourinho, Salvador, lined with pastel " +
    "buildings, a church facade, a stall hung with hundreds of coloured " +
    "Bonfim ribbons, crates and a wooden bench, but only two people in the " +
    "frame. A Brazilian woman around 40 in a white dress ties a coloured " +
    "ribbon around the wrist of a Brazilian woman around 30, both of them " +
    "looking down at the wrist and the knot. Neither looks at the other or at " +
    "the viewer. Mouths closed, nobody laughing.",
  "meu-rei-minha-filha":
    "A small corner shop in Salvador seen from inside, shelves packed with " +
    "bottles of water, biscuits, a fridge, a counter with a till and a bowl of " +
    "coins, and the bright street through the doorway, but only two people in " +
    "the frame. A Brazilian shop owner around 45 behind the counter puts a " +
    "bottle of water into a bag, her eyes on the bag. A Brazilian woman around " +
    "30 in front of the counter looks down at the coins in her own hand. " +
    "Neither looks at the other. Mouths closed, nobody laughing.",
  "um-berimbau-abre-a-roda":
    "A stone square in the Pelourinho, Salvador, at the end of the afternoon. " +
    "In the centre a Brazilian man around 35 plays a tall berimbau bow, his " +
    "eyes down on the string, with a tambourine and a drum resting on the " +
    "stones beside him. A few metres away a Brazilian woman around 30 stands " +
    "holding a wristwatch in both hands, looking down at the watch. Neither " +
    "looks at the other. Colonial facades, worn paving stones, a low wall. " +
    "Mouths closed, nobody laughing.",
  "tinta-fresca-no-beco":
    "A narrow alley in Vila Madalena, Sao Paulo at night, both walls covered " +
    "floor to roof in dense graffiti murals, with paint cans, a stepladder, " +
    "rolled tarpaulin and a bicycle against the wall, but only two people in " +
    "the frame. A Brazilian man around 25 with a backpack paints a blue fish " +
    "over an older mural, his eyes on his own brush. A Brazilian man around 30 " +
    "stands a few steps back looking at the lower half of the wall. Neither " +
    "looks at the other. Warm street lamps overhead. Mouths closed, nobody " +
    "laughing.",
  "a-parte-que-todo-mundo-canta":
    "Inside a small samba bar in Vila Madalena, Sao Paulo at night, a round " +
    "wooden table in the middle covered with a cavaquinho, a tambourine, beer " +
    "bottles and glasses, with bottles on shelves behind, but only two people " +
    "in the frame. A Brazilian woman around 35 sings with her eyes on the " +
    "table of instruments. A Brazilian man around 30 stands just behind her " +
    "looking down at the same table. Neither looks at the other. Warm lamp " +
    "light. Mouths closed on the man, nobody laughing.",
  "o-refrao-sai-na-rua":
    "A street corner in Vila Madalena, Sao Paulo late at night, wet pavement " +
    "reflecting warm light from an open bar door, with stacked crates, a " +
    "queue rope, parked bicycles and cigarette ends, but only two people in " +
    "the frame. A Brazilian man around 30 walks away down the pavement with " +
    "his eyes on the street ahead. Behind him a Brazilian woman around 35 " +
    "leans in the bar doorway looking back inside. Neither looks at the other. " +
    "Mouths closed, nobody laughing.",
  "macacos-na-trilha":
    "A forest trail near Paraty, Brazil, dense green foliage on both sides, " +
    "with a fallen log, tree roots across the path, a water bottle and an open " +
    "backpack on the ground, but only one person in the frame. A Brazilian " +
    "woman around 30 crouches beside the open backpack with her eyes on it, " +
    "while three small brown monkeys sit on a branch just above her, one of " +
    "them holding a banana. She does not look at the viewer. Bright dappled " +
    "daylight through the leaves. Mouth closed, nobody laughing.",
  "os-peixes-nao-tem-medo":
    "A clear shallow river between two large rocks near Paraty, Brazil, the " +
    "riverbed of pale sand and pebbles visible through the water, with ferns, " +
    "a rolled towel and sandals on a flat rock, but only one person in the " +
    "frame. A Brazilian woman around 30 stands waist deep in the water looking " +
    "down at a dozen small silver fish gathered around her legs. She does not " +
    "look at the viewer. Green forest wall behind, bright daylight. Mouth " +
    "closed, nobody laughing.",
  "a-chuva-dura-dez-minutos":
    "A straw-roofed shelter beside a forest trail near Paraty, Brazil, in " +
    "heavy rain, with water streaming off the thatch, a muddy brown stream " +
    "running down the path, large wet leaves and two backpacks on a bench, " +
    "but only two people in the frame. A Brazilian woman around 30 stands " +
    "under the thatch with her arms crossed looking out at the rain. A " +
    "Brazilian man around 40 stands a little apart pressing a backpack " +
    "against his chest, his eyes on the falling water. Neither looks at the " +
    "other. Mouths closed, nobody laughing.",
  "palmas-no-arpoador":
    "The Arpoador rock in Rio de Janeiro at sunset, packed shoulder to " +
    "shoulder with adults applauding the sea, some holding phones up, others " +
    "with beach bags, towels and cans, surfboards leaning on the rock behind " +
    "them. In the middle a Brazilian man around 30 stands with his arms still " +
    "down at his sides, the only one not joining in, glancing at the Brazilian " +
    "woman around 35 beside him.",
};
const SCENE = SCENES[SLUG];



// 4. Estilo (redacción obligatoria del spec) + anclas positivas de memoria.
const STYLE =
  // Copiado de scripts/_genA0Covers.ts, que es lo que produjo los covers
  // aprobados de Traveler MX A0. El spec §5 pide lo CONTRARIO (dibujado a
  // mano, con grano de papel); está desactualizado y no es lo que se usa.
  "STYLE (critical): clean digital editorial illustration, smooth flat cel " +
  "shading and soft gradients, crisp clean linework, flat vivid but warm color " +
  "fields, polished vector-like finish, bright and cheerful, adult realistic " +
  "proportions. ABSOLUTELY NO oil painting, NO gouache, NO painterly " +
  "brushstrokes, NO canvas texture, NO paper grain, NO impasto, NO visible " +
  "brush marks, NO sketchy pencil texture. Smooth and clean only. Landscape " +
  "composition, no text, no logos. " +
  // Anclas en positivo: Flux ignora las negaciones.
  "EVERY face, foreground and background alike, has open almond-shaped eyes " +
  "with a clearly visible dark iris and eyelid line, large enough to read as " +
  "real human eyes. All skin is a single even matte tone with no pink or red " +
  "circles on the cheeks. Every single person in the frame is an adult between " +
  "25 and 45 with full dark brown or black hair and smooth unlined skin, in " +
  "their physical prime.";

// 5. Paleta.
const PALETTE =
  "Palette: warm golden-hour light but with a full range of colour, vividly " +
  "saturated. Warm amber and golden yellow in the sky, deep sea blue and teal " +
  "in the water, terracotta and dusty rose on the rock, fresh sage and soft " +
  "sky blue in clothing. Never a single-hue orange wash, never muted, never " +
  "sepia, never dark.";

// 6. Marco.
const FRAME =
  "Wide horizontal 16:9 landscape frame, 1536x1024 resolution. No text, no " +
  "letters, no captions, no logos, no borders, no watermark.";

const PROMPT = [SCENE, STYLE, PALETTE, FRAME].join(" ");

async function main() {
  const p = new PrismaClient();
  const story = await p.journeyStory.findFirst({
    where: { slug: SLUG }, select: { id: true, title: true },
  });
  if (!story) throw new Error(`no existe ${SLUG}`);
  const buf = await generateFluxImageBuffer(PROMPT);
  const key = `media/generated/images/${SLUG}-${buf.length}.png`;
  const up = await uploadPublicObject({ key, body: buf, contentType: "image/png" });
  if (!up) throw new Error("upload devolvió null");
  const url = `https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/${key}`;
  await p.journeyStory.update({
    where: { id: story.id }, data: { coverUrl: url, coverDone: true },
  });
  console.log(url);
  await p.$disconnect();
}
main();
