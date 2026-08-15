/**
 * Cover de UNA historia del journey Traveler IT A0. Mismo molde que
 * `_ptbrCover.ts`: prompt a mano, porque `buildCoverPrompt` devuelve la media
 * estadística del journey y no ESTA escena.
 *
 * Tres cosas que Flux ignora si se dicen en negativo, así que van en POSITIVO:
 * los ojos (almendrados, con iris visible), la piel (tono mate uniforme, sin
 * círculos rosados) y la edad (adultos con pelo oscuro completo). Y las manos
 * no se describen nunca: en cuanto se mencionan, Flux dibuja manos rezando.
 *
 *   npx tsx scripts/_itCover.ts <slug>
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { generateFluxImageBuffer } from "../src/lib/coverGenerator";
import { uploadPublicObject } from "../src/lib/objectStorage";

const SLUG = process.argv[2] ?? "la-macchinetta-gialla";

// Escenas de CARTEL, no de ilustración recargada. Mirados los covers de
// Brasil (2026-08-14) son: dos figuras GRANDES, un solo elemento gráfico que
// llena el cuadro, pocos colores planos, y NADIE de fondo. Lo que yo tenía
// escrito aquí antes ("densas, llenan el cuadro de objetos y de gente") era
// falso y produjo veinte figurantes y cincuenta trastos por imagen.
const SCENES: Record<string, string> = {
  "la-macchinetta-gialla":
    "A platform inside a large Roman railway station in the morning, crowded " +
    "with a waiting regional train, luggage trolleys, rolled suitcases, a " +
    "metal bin and iron roof pillars, but only two people in the frame. An " +
    "Italian " +
    "woman around 30 with a heavy suitcase stands in front of a small yellow " +
    "ticket-stamping machine mounted on a pillar, her eyes on the slot. An " +
    "Italian man around 40 in an orange work jacket stands beside the machine " +
    "looking at the same slot. Both faces in profile to the viewer, calm and " +
    "restrained, mouths closed, nobody laughing.",
  "il-regionale-ferma-dappertutto":
    "Inside an old Italian regional train carriage in the afternoon, seen down " +
    "the aisle, with worn blue seats on both sides, a bicycle standing inside " +
    "the carriage against the doors, shopping bags on the floor and a backpack " +
    "on a seat. Two Italian women sit side by side in the same row by the " +
    "window and both are fully visible in the frame: the younger one around 30 " +
    "in the window seat looks out at olive groves and yellow fields, and the " +
    "older one around 40 in the aisle seat beside her holds a wrapped sandwich " +
    "on her lap and keeps her eyes down on it. The younger one has her head " +
    "turned away towards the window so the viewer sees the side of her face; " +
    "the older one has her head tilted down towards her lap. Neither woman " +
    "turns towards the viewer and neither face is seen from the front. The " +
    "photograph is cropped at waist height: both women are shown from the " +
    "waist up only and no legs appear anywhere in the picture. Calm " +
    "restrained faces, mouths closed.",
  "i-biglietti-li-vende-il-tabaccaio":
    "Inside a narrow Italian tobacconist's shop seen from the doorway, the " +
    "counter crowded with jars of sweets, newspapers, sheets of stamps, a till " +
    "and a pad of bus tickets, a doorway onto the street behind, but only " +
    "two people in the frame. An Italian shopkeeper around 45 behind the " +
    "counter tears two thin tickets from a pad, his eyes down on the pad. An " +
    "Italian woman around 30 waits on the near side watching the tickets. Calm " +
    "restrained faces in profile, mouths closed, nobody laughing.",
  "il-caffe-si-beve-in-piedi":
    "Inside a busy Naples coffee bar in the Quartieri Spagnoli, the marble " +
    "counter crowded with espresso cups, saucers, a chrome coffee machine, " +
    "glasses of water, a pastry case and a shelf of bottles, but only " +
    "two people in the frame. An Italian man around 30 stands at the marble " +
    "counter with a tiny espresso cup in front of him, his eyes on the cup. An " +
    "Italian waiter around 40 in a white jacket stands behind the counter " +
    "looking at the same cup. Calm restrained faces in profile, mouths closed.",
  "prima-si-paga-poi-si-beve":
    "Inside a crowded Naples coffee bar in the morning, seen from the queue: a " +
    "till on a raised desk, a paper receipt roll, a pastry case full of " +
    "cornetti, a chrome coffee machine behind, sugar bowls and napkin " +
    "dispensers, but only two people in the frame. An Italian woman around 40 " +
    "sits at the till desk holding out a long narrow receipt, her eyes on the " +
    "paper. An Italian man around 30 in front of the desk looks down at the " +
    "same receipt. Calm restrained faces in profile, mouths closed.",
  "il-caffe-sospeso":
    "Inside a small old Naples coffee bar in the afternoon, the counter " +
    "crowded with espresso cups, a chrome machine, a sugar bowl, an open " +
    "notebook and a pen beside the till, and a small handwritten yellow sign " +
    "taped to the wall, but only two people in the frame. An Italian barman " +
    "around 40 marks a stroke in the open notebook, his eyes on the page. An " +
    "Italian man around 35 in a blue coat stands at the far end of the counter " +
    "looking towards the door. Calm restrained faces in profile, mouths closed.",
  "qui-non-ce-la-bolognese":
    "Inside a small Bologna trattoria at lunchtime, six tables with " +
    "red-checked cloths, wine bottles, baskets of bread, hanging copper pans " +
    "and a window onto the two towers, but only two people in the frame. An " +
    "Italian woman around 30 sits at a table looking down at a plate of wide " +
    "tagliatelle with thick meat ragu. An Italian innkeeper around 45 in a " +
    "white apron stands beside the table, his eyes on the same plate. Calm " +
    "restrained faces in profile, mouths closed, nobody laughing.",
  "il-coperto-si-paga-sempre":
    "Inside a warm crowded Bologna trattoria in the evening, lamplight and a " +
    "haze of steam in the air, a table set with a checked cloth, a basket " +
    "spilling bread and long breadsticks, a carafe catching the light, a small " +
    "bill on a saucer with two coins. An Italian woman around 30 leans over " +
    "the bill with her eyebrows raised, caught in the middle of asking a " +
    "question, mouth slightly open mid-word. An Italian waiter around 40 " +
    "bends towards the saucer with a small amused smile, one shoulder " +
    "dropped, mid-movement rather than posed. Behind them another waiter " +
    "hurries past with a loaded tray and other diners talk over full tables. " +
    "Both main faces are seen in profile and neither turns towards the viewer.",
  "il-conto-non-arriva-da-solo":
    "Inside a Bologna trattoria late in the evening, tables with empty wine " +
    "glasses, folded napkins, a water carafe and used plates, a square outside " +
    "the window, but only two people in the frame. An Italian woman around 30 " +
    "sits at a cleared table with one arm raised towards the room, her eyes " +
    "following a waiter. An Italian waiter around 40 crosses the room with a " +
    "water jug, his eyes on the tables. Calm restrained faces in profile, " +
    "mouths closed, nobody laughing.",
  "a-palermo-si-dice-arancina":
    "A packed fried-food stall at a Palermo street market under a green " +
    "awning, steam rising off a tray of golden rice balls, oil shining in the " +
    "fryer, paper wraps, crates of lemons and a hanging scale, the aisle " +
    "behind full of shoppers walking past. A WOMAN, an Italian stall holder " +
    "around 45 in an apron with her hair tied back, leans over the tray and " +
    "lifts one eyebrow at him, the corner of her mouth just turned up. An " +
    "Italian man around 30 on the near side draws his chin back a little, " +
    "eyes widened. " + "Expression is carried by the eyes, the eyebrows and the tilt of the head, " +
    "never by an open mouth: closed-lipped, understated faces, nobody " +
    "shouting, nobody laughing, no exaggerated cartoon expressions. The " +
    "movement is in the bodies and in the room around them. " + "Both faces are seen in profile and " +
    "neither turns towards the viewer.",
  "nessuno-ha-spiccioli":
    "A busy fruit stall at the Ballaro market in Palermo in the morning, the " +
    "counter piled high with lemons, tomatoes and artichokes, a tin of coins " +
    "tipped open, paper bags, a swinging hanging scale, crates stacked behind " +
    "and shoppers moving through the aisle. An Italian stall holder around 45 " +
    "throws both palms up over a large banknote on the counter, shoulders " +
    "raised, laughing at the situation. An Italian man around 30 on the near " +
    "side winces with an apologetic grimace. Both faces are seen in profile " +
    "and neither turns towards the viewer.",
  "il-prezzo-lo-dice-il-pescivendolo":
    "A busy illustrated fish stall at a Palermo street market at midday, " +
    "wooden crates of silver sardines on ice, bunches of parsley, a steel " +
    "scale still swinging, shoppers crowding the aisle behind. An Italian " +
    "fishmonger around 45 in an apron calls out the price with his mouth " +
    "open and his chin lifted, one arm swung out over the crates. An Italian " +
    "man around 30 on the near side leans in towards the scale, squinting to " +
    "work out the number. Both faces are seen in profile and neither turns " +
    "towards the viewer. This is a drawing, not a photograph.",
  "niente-spalle-scoperte":
    "The stone entrance of a Florence church in summer, a wooden box of folded " +
    "paper shawls on a table, a printed sign on a stand, a rope barrier, " +
    "candles glowing in the dark nave behind and tourists queueing along the " +
    "wall. An Italian woman around 30 in a sleeveless dress stops at the " +
    "threshold and glances down at her own bare shoulder, eyebrows slightly " +
    "raised, mouth closed. An Italian man around 45 beside the box turns " +
    "towards the sign without any particular expression. Both faces are seen " +
    "in profile and neither turns towards the viewer.",
  "i-gradini-non-finiscono-mai":
    "The top of a Florence cathedral dome at midday, a narrow stone walkway " +
    "with an iron handrail and a low parapet, the red-tiled roofs of the " +
    "whole city spread out below with aerials, washing lines and hills " +
    "beyond, wind pushing at hair and clothes. An Italian woman around 30 " +
    "leans both forearms on the parapet, shoulders dropped, looking out over " +
    "the roofs. An Italian man around 35 comes up the last steps behind her " +
    "with his head tipped back towards the sky. Neither of them turns " +
    "towards the viewer and neither face is seen from the front.",
  "la-piazza-si-riempie-alle-sei":
    "An Italian town square in the early evening, arcades down one side, a " +
    "stone fountain running in the centre, café tables coming out onto the " +
    "stones, shop shutters half rolled up, bicycles leaning on a wall, dogs " +
    "on leads and families crossing the square from every direction. An " +
    "Italian woman around 30 sits alone on a stone bench with an ice cream, " +
    "watching the fountain. An Italian man around 35 walks past under the " +
    "arcades looking ahead down the colonnade. Neither of them turns towards " +
    "the viewer and neither face is seen from the front.",
  "due-baci-e-basta":
    "Inside a warm crowded Roman kitchen in the evening, the table covered " +
    "with wine bottles, glasses, bowls of olives, a chopping board and " +
    "stacked plates, coats piled by the door, other guests talking around " +
    "them. An Italian woman around 35 gives an Italian man around 30 the " +
    "standard Italian cheek greeting: her head passes beside his head, her " +
    "lips touching the air next to his cheekbone, the two faces side by side " +
    "and pointing in opposite directions. Their mouths never meet and this " +
    "is not a romantic kiss. He stands a beat too stiff, one shoulder " +
    "raised, eyebrows just lifted. Neither of them turns towards the viewer.",
  "nessuno-mangia-da-solo-qui":
    "A café terrace in Trastevere, Rome, in the evening, small round tables " +
    "with beer glasses, an ashtray, a closed book with a bookmark, ivy on " +
    "the wall, warm lamps overhead and other tables full of people talking. " +
    "An Italian man around 30 sits with his hand still resting on the closed " +
    "book, eyebrows slightly raised, caught between answering and reading. " +
    "Across the same small table sits another young Italian man of about " +
    "thirty-five, bare-headed, with thick dark hair and a clean jaw, leaning " +
    "in over his beer. Two young men, both in their thirties. Both faces are " +
    "seen in profile and neither turns towards the viewer.",
  "ci-vediamo-a-trastevere":
    "A narrow cobbled alley in Trastevere, Rome, at night, washing hung " +
    "overhead, warm yellow lamps, ivy climbing the walls, scooters parked " +
    "along the kerb, a small fountain at the corner and people spilling out " +
    "of a doorway. A woman and a man walk down the middle of the alley " +
    "together: an Italian woman around 30 in a summer top raises a hand to " +
    "someone off to the side, and beside her a MAN, an Italian man around 30 " +
    "with short dark hair and a flat chest in a shirt, looks up at the lamps " +
    "and the washing lines. One female figure and one male figure, clearly " +
    "different. Neither of them turns towards the viewer.",
  "il-traghetto-non-aspetta-nessuno":
    "A small island harbour early in the morning, seen close up. The frame is " +
    "dominated by one big shape: the pale hull and open gangway of a ferry " +
    "filling the right half, flat water below it. There are exactly TWO " +
    "people in this picture and no others: ONE single Italian woman around " +
    "30, alone, with an open backpack, climbing the gangway with one foot " +
    "already on it and her eyes on the deck; and ONE Italian sailor around " +
    "40 on the quay looking down at a coiled mooring rope. No crowd, no " +
    "passers-by, no second woman, no faces in the background. Very few " +
    "objects: the rope, one bollard, one life ring. Behind them a low row of " +
    "flat pastel houses in three or four colours. Neither of them turns " +
    "towards the viewer.",
  "la-spiaggia-libera-e-piccola":
    "An Italian beach at midday seen from the sand. The frame is dominated by " +
    "one big graphic pattern: long even rows of identical orange beach " +
    "umbrellas covering almost the whole picture like a repeating grid, with " +
    "a single narrow empty strip of bare sand cutting through them and a flat " +
    "band of blue sea across the top. There are exactly TWO people and no " +
    "others: ONE Italian woman around 30 sitting large in the foreground on a " +
    "towel in the narrow strip, looking out at the water, and ONE Italian " +
    "lifeguard around 35 standing at the edge of the umbrellas looking " +
    "towards the sea. No crowd, no other bathers, no faces in the " +
    "background. Neither of them turns towards the viewer.",
  "alle-sette-il-mare-e-gelato":
    "A small rocky bay very early in the morning, seen close up. The frame is " +
    "dominated by one big shape: a wide sheet of completely flat glassy " +
    "turquoise water filling most of the picture, with pale stone steps and a " +
    "wooden swimming platform cutting in from one side. There is exactly ONE " +
    "person in this picture: a single Italian woman around 30, large in the " +
    "frame, standing at the edge of the wooden platform with one foot in the " +
    "water, looking down at it. Nobody else at all: no swimmers, no crowd, no " +
    "faces. Very few objects: one rolled towel on the stone and one small " +
    "buoy far out on the water. She does not turn towards the viewer.",
};

const SCENE = SCENES[SLUG];
if (!SCENE) {
  console.error(`sin escena para "${SLUG}". Escríbela en SCENES antes de tirar.`);
  process.exit(1);
}

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
  "EVERY face, foreground and background alike, has open almond-shaped eyes " +
  "with a clearly visible dark iris and eyelid line, large enough to read as " +
  "real human eyes. All skin is a single even matte tone with no pink or red " +
  "circles on the cheeks. Every single person in the frame is an adult between " +
  "25 and 45 with full dark brown or black hair and smooth unlined skin, in " +
  "their physical prime. Every person looks at what they are doing or past the " +
  "edge of the frame; nobody faces the viewer.";

const PALETTE =
  "Palette: warm Mediterranean daylight with a full range of colour, vividly " +
  "saturated. Terracotta and ochre on the walls, deep green shutters and " +
  "awnings, warm cream stone, sea blue and teal in water and sky, olive green " +
  "and dusty rose in clothing. Never a single-hue orange wash, never muted, " +
  "never sepia, never dark.";

const FRAME =
  "Poster-like composition: two large figures close to the viewer, one " +
  "dominant graphic element filling much of the frame, a small number of flat " +
  "saturated colours, generous empty areas, and no background crowd. " +
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
