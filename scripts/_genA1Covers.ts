/**
 * Portadas del A1 ES/Spain "Village Life in Andalusia".
 *
 * Mismo candado de estilo B que el A0 de Spain (`_genSpainCovers.ts`), con una
 * diferencia: aquí el gate de rubor `_coverGate.py` corre ANTES de subir nada,
 * y una tirada que lo incumple se descarta y se repite. En el A0 el control era
 * mirar la imagen después de pagarla.
 *
 *   npx tsx scripts/_genA1Covers.ts [slug] [--dry]
 *
 * Sin argumentos hace las que falten. Con `--dry` genera y mide pero no sube
 * ni escribe en la base; la tirada se gasta igual, así que --dry solo sirve
 * para calibrar el prompt, no para ahorrar.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { execFile } from "child_process";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import { PrismaClient } from "../src/generated/prisma";
import { generateFluxImageBuffer } from "../src/lib/coverGenerator";
import { uploadPublicObject } from "../src/lib/objectStorage";

const exec = promisify(execFile);
const p: any = new PrismaClient();
const J = "cmsvz6mz9000732gsgsfer0ko";

// Candado B + guardas de ojos y rubor (feedback_cover_no_blush_real_eyes).
const STYLE =
  "STYLE (critical): clean digital editorial illustration, smooth flat cel shading and soft gradients, crisp clean linework, flat vivid but warm color fields, polished vector-like finish, bright and cheerful, adult realistic proportions. " +
  // El primer plano general del comedor salió con media docena de niños. El
  // bloque de estilo pedía "proporciones adultas" y "sin rasgos infantilizados",
  // que habla de CÓMO se dibuja a alguien, no de QUIÉN sale. En una escena de
  // multitud eso no basta: hay que decir que el reparto es adulto.
  "CAST (critical): every single person visible in the scene is an adult roughly between 20 and 55 years old. NO children, NO babies, NO teenagers, NO elderly people anywhere in the frame, not even small in the background. " +
  "EYES (critical): every visible character has clearly drawn open realistic eyes, each with a white sclera, a colored iris, a pupil and eyebrows; NEVER draw eyes as plain black dots, single dark marks or tiny featureless dots; show the faces in a natural three-quarter view so their detailed eyes are clearly visible. " +
  "GAZE (critical): the characters look naturally at the scene, at the activity they are doing, or at each other while talking; they do NOT look at the camera or the viewer, and they are NOT posing frontally for a portrait; avoid a flat straight-to-camera stare and avoid full side-profile. " +
  "BODY LANGUAGE (critical): the people are neighbours and friends, not a couple; friendly platonic body language at a natural friendly distance, absorbed in the moment; NO romantic embrace, NO hugging cheek-to-cheek, NO gazing into each other's eyes. " +
  "SKIN (absolutely critical, top priority): every face has pale, cool, completely flat matte skin in ONE single uniform tone; the cheeks are the exact same pale color as the forehead, nose and chin, or even paler; there is ZERO color difference on the cheeks. ABSOLUTELY NO blush, NO rosy cheeks, NO pink cheeks, NO red cheeks, NO peach cheeks, NO warm cheek tint, NO circular color patch on the cheeks, NO flushed skin, NO cheek highlight, NO makeup. Cheeks must look plain and uncolored. No freckles. No infantilized features. " +
  "ABSOLUTELY NO oil painting, NO gouache, NO painterly brushstrokes, NO canvas texture, NO paper grain, NO impasto, NO visible brush marks, NO sketchy pencil texture. Smooth and clean only. Landscape composition. TEXT (critical): the image contains NO written words anywhere: no signs with letters, no shop names, no lettering on walls or doors, no numbers, no logos, no watermark. Any sign or board in the scene is blank.";

/**
 * Ficha de personaje, literal y repetida en cada escena.
 *
 * WHY (2026-08-18): puestas las 6 primeras portadas en fila, Irene tenía pelo
 * castaño en una y negro en cinco, y Rocío cambiaba de peinado, de edad
 * aparente y de ropa en cada una. Decir "una joven de pelo oscuro" deja a Flux
 * elegir, y elige distinto cada vez. Este journey es de tipo Expat, con los
 * mismos personajes en las 21 historias: si no se reconocen, la portada deja
 * de ser la de ESA historia y pasa a ser una ilustración cualquiera.
 *
 * El color de la ropa va fijo a propósito, que es lo único que un modelo de
 * imagen respeta con fiabilidad entre tiradas; la cara la respeta a medias.
 */
const IRENE =
  "IRENE (recurring main character, must look identical in every image): a woman of about thirty, straight BLACK hair cut to the shoulders with a middle parting, slim build, pale skin, dark eyes, wearing a plain LIGHT BLUE short-sleeved top and dark navy trousers.";
const ROCIO =
  "ROCÍO (recurring neighbour, must look identical in every image): a Spanish woman of about forty-five, wavy MID-BROWN hair to the jaw (plain brown, NOT red, NOT auburn, NOT ginger), sturdier build, warm expression, wearing a WARM CORAL blouse and a long dark skirt.";

// El registro visual se repite en cada escena, no solo en el bloque de estilo:
// las tres del tema 2 salieron apagadas y con textura de pared porque el plano
// general arrastró al modelo hacia ilustración editorial.
const REGISTRO =
  "RENDERING (critical): flat saturated cel colour with bold clean outlines, the same bright picture-book register in every image; NO muted or dusty palette, NO visible wall texture or paper grain, NO thin sketchy linework, NO desaturated editorial illustration look. " +
  // Ancla explícita en la portada 1 (Nerja huele a pan), que es la que el
  // usuario eligió como referencia: cal blanca, sol fuerte y figuras a media
  // distancia. Ni primer plano de cara ni figuras diminutas.
  "FRAMING AND LIGHT (critical): the same look as a sunlit whitewashed Andalusian village scene: bright white walls, strong clear daylight, deep blue sky where the sky shows, terracotta and warm wood as the only strong accents. The people are seen at a comfortable MIDDLE DISTANCE, head to knee or full body, never a close-up of a face filling the frame and never tiny specks in a landscape.";
const SCENES: Record<string, string> = {
  "la-barra-manda":
    // EXACTAMENTE tres personas, las tres descritas. Las cinco versiones
    // anteriores dejaban figuras sin describir ("dos adultos más al fondo") y
    // Flux las rellenaba con niños o adolescentes, una y otra vez.
    "The inside of a small village bar in Andalusia. THERE ARE EXACTLY THREE PEOPLE IN THE IMAGE AND NOBODY ELSE: (1) IRENE, standing at the bar counter ordering; (2) the owner, an adult man of about forty in a shirt, working behind the counter facing her; (3) one adult man of about fifty sitting on a stool at the far end of the counter, his hand resting on a newspaper FOLDED SHUT, seen edge-on with no open page. NO other figures anywhere: no customers at the tables, no faces in the background, no children, no teenagers, no elderly people. The tables behind them are empty, with the chairs tucked in. Whitewashed walls, bottles on a wooden shelf, warm bright daylight through the open door.",
  "nadie-ha-pedido-esa-tapa":
    "A bar counter in an Andalusian village on a summer evening, adults only, NO children. IRENE stands at the counter looking with puzzled surprise at a small plate of food that has arrived beside her drink without being ordered; the owner, an adult man of about forty, works behind the bar without looking up; on her other side an adult man holds up his own identical small plate to show her. IRENE has NO fringe: her black hair is parted in the middle exactly as in every other image. There are NO signs, NO boards and NO labels anywhere in the bar; every surface is free of writing. Whitewashed walls, hanging hams and bottles behind the bar, warm bright light.",
  "apunta-la-cuenta-con-tiza":
    "A quiet Sunday morning inside a small Andalusian village bar, almost empty. IRENE stands at the counter facing the owner, an adult man of about forty, who points down at a set of white chalk marks drawn on the dark wooden bar top. An empty coffee cup and a plate beside her. Whitewashed walls, bright morning light through the open door, calm mood.",
  "la-madre-antes-que-el-pan":
    "Inside a small village bakery in Andalusia, early in the morning. IRENE stands at the wooden counter facing the baker, an adult woman of about forty in an apron, who is chatting warmly while wrapping bread; shelves and baskets of golden loaves behind her. Whitewashed walls, bright morning light through the door, friendly mood.",
  "media-calle-comparte-apellido":
    "A small terrace table outside a bar in an Andalusian village in the afternoon. ROCÍO leans over the table drawing a family tree of names on a paper napkin with a pen while IRENE watches, following the drawing with her finger; two coffee cups between them. Whitewashed wall, potted geraniums, bright warm light.",
  "rocio-tarda-un-segundo":
    "A narrow landing at the top of a whitewashed staircase in an Andalusian village building. IRENE and ROCÍO stand talking face to face on the small landing, ROCÍO pausing mid-answer with a thoughtful expression, IRENE listening; a closed wooden door behind them and a small high window letting in bright daylight. Calm attentive mood.",
  "ya-veremos-no-era-un-no":
    "Evening in a small whitewashed kitchen in an Andalusian village. IRENE, already in a plain house cardigan, stands at the open window looking down into the street, a covered dish still in her hands; below in the narrow street ROCÍO looks up and calls to her. Warm lamp light inside, deep blue evening sky outside, surprised amused mood.",
  "invita-el-que-cumple-anos":
    "A birthday gathering inside a village bar in Andalusia. IRENE stands holding a small wrapped present, looking uncertain, while an adult woman of about forty beside her explains something with an easy gesture; three other adults nearby hold small beer glasses and laugh. Whitewashed walls, bright warm light, festive friendly mood.",
  "rechaza-la-boda-gana-el-postre":
    "A doorway onto a small whitewashed patio in an Andalusian village on a rainy Saturday. IRENE stands in the doorway talking with ROCÍO, explaining something with an open friendly gesture; ROCÍO listens without offence. Wet floor tiles, potted plants, grey rain outside but warm light from inside, easy relaxed mood.",
  "la-farmacia-no-tiene-estantes":
    "Inside a small Andalusian village pharmacy where nothing is on display. IRENE stands at the counter facing the pharmacist, an adult woman of about forty in a white coat, behind whom the whole wall is a grid of closed wooden drawers with small handles. No open shelves, no products within reach. Whitewashed walls, bright clean daylight, slightly awkward mood.",
  "rocio-cuenta-sus-sintomas":
    "Inside the same small Andalusian village pharmacy. IRENE and ROCÍO stand together at the counter; ROCÍO does the talking with a wide explaining gesture while the pharmacist, an adult woman of about forty in a white coat, listens and looks only at ROCÍO; IRENE stands slightly behind, quiet. Wall of closed wooden drawers behind the counter, whitewashed walls, bright daylight.",
  "sale-con-jarabe-y-sin-ayuda":
    "Inside the same small Andalusian village pharmacy, IRENE alone at the counter. She holds a small folded piece of paper and speaks from it, calm and prepared; the pharmacist, an adult woman of about forty in a white coat, has stopped what she was doing and listens attentively, a bottle of syrup on the counter between them. Wall of closed wooden drawers, whitewashed walls, bright daylight, quietly proud mood.",
  "todos-lo-sabian-desde-mayo":
    "A narrow whitewashed street in an Andalusian village. IRENE stands close to a shop window reading a plain BLANK sheet of paper taped inside the glass; beside her the baker, an adult woman of about forty in an apron, explains it with a matter-of-fact gesture. Bright strong sunlight, terracotta pots along the wall, surprised mood.",
  "un-recado-para-la-mesa-larga":
    "A whitewashed stairwell and landing in an Andalusian village building. IRENE stands in the middle holding her phone, looking from one side to the other while three adult neighbours, all women between thirty and fifty, lean out from different doorways and steps around her, each answering at once with a different gesture. Bright daylight from a high window, busy overlapping friendly mood.",
  "el-salmorejo-se-acaba-primero":
    // De noche con luces cálidas gastó 6 tiradas seguidas: la luz naranja sobre
    // la piel dispara el detector de rubor. Pasada a mediodía, que además es la
    // luz de la portada de referencia.
    "A village square in Andalusia at midday, set with long tables covered in white cloths under the open sky. IRENE stands beside an empty serving tray, the only tray already finished, while two adult women of about forty ask her something with interest; ROCÍO stands a little apart with her arms folded, commenting. Whitewashed facades and a church tower behind, strong clear sunlight, deep blue sky, proud happy mood.",

  "nerja-huele-a-pan":
    "A narrow whitewashed street in a small Andalusian village on a bright July morning. IRENE stands in a doorway with a suitcase beside her, talking with ROCÍO, who leans out from her own doorway a few steps away; both turned toward each other mid-conversation, seen at a comfortable distance so neither face fills the frame. A small bakery with warm bread in the window a few steps away, red geraniums in pots on the white walls, strong warm sunlight, welcoming cheerful mood.",
  "el-paquete-duerme-cuatro-meses":
    "Early morning at the door of a small whitewashed flat in an Andalusian village, seen from across the street so the two figures are small in the frame. ROCÍO, in her WARM CORAL blouse and long dark skirt, holds out a brown paper parcel tied with string with BOTH HANDS; IRENE, in her LIGHT BLUE top, has not taken it yet and looks at the parcel with puzzled amusement, one hand still on her own door and the other empty at her side. The parcel is clearly in ROCÍO's hands, not in Irene's. Narrow white street behind them, soft early light, calm friendly mood.",
  "seis-naranjas-y-un-delantal":
    "A small bright kitchen in an Andalusian village flat, WIDE SHOT of the whole room so the two figures are small in the frame. IRENE laughs beside ROCÍO, who wears a plain apron over her blouse; six ripe oranges spill across the wooden table between them and a few more sit in a bowl. Open window with white walls and blue sky outside, warm morning light, warm and funny friendly mood.",

  // Tema 2, horarios y horas de comer. Misma paleta de cal blanca que el tema 1
  // a propósito: la coherencia entre portadas de un journey no la mide ningún
  // gate, así que se fija en el prompt.
  // Plano general a propósito. De las 20 tiradas del 2026-08-17, las que
  // pasaron el gate a la primera eran todas encuadre abierto con caras
  // pequeñas; las de primer plano con dos caras grandes gastaron 12 tiradas
  // para 2 portadas. Menos superficie de mejilla, menos sitio donde Flux
  // pinta rubor.
  //
  // Y reparto CORTO. La versión con el comedor lleno gastó 5 tiradas: al
  // poblar el fondo, Flux metió primero media docena de niños y luego media
  // docena de ancianos, las dos cosas prohibidas. Aquí las sillas vacías y
  // las mesas ya puestas cuentan que el sitio se va a llenar, sin necesidad
  // de dibujar a nadie más.
  "a-las-dos-no-cabe-nadie":
    "WIDE SHOT of a nearly empty dining room in a small Andalusian village restaurant, seen from across the room, the figures small in the frame. ONLY FOUR PEOPLE IN THE WHOLE IMAGE, all adults: IRENE sits alone at a small table near the window finishing her plate; two adult men in work clothes eat at a table further back; a waiter in a dark apron sets out cutlery. Every other table is empty but already laid with paper cloths and glasses, chairs neatly tucked in, a long row of them waiting. A round clock on the whitewashed wall reads five past two. Bright midday light through the open door, calm and quiet mood just before the rush.",
  "el-portal-sigue-vacio":
    "A narrow whitewashed street in an Andalusian village at siesta time, completely deserted. IRENE stands alone beside a doorway with a cloth shopping bag, glancing down at her watch and then along the empty street; the bar next door has its metal shutter rolled down, closed wooden shutters on every window, hard midday shadows on the white walls, quiet and still mood.",
  "ya-llega-cuando-llegan-todos":
    "WIDE SHOT of the whole stairwell of a small whitewashed building in an Andalusian village, seen from below, the two figures small in the frame. ROCÍO pauses halfway up the stone steps with a basket on her arm and talks to IRENE, who stands on the landing above her; both turned toward each other mid-conversation, relaxed and unhurried. Tall white wall, iron handrail, potted plants on the steps, warm evening light falling from a small high window, calm friendly mood.",
};

/**
 * Mide la imagen TAL CUAL sale de Flux. Sin deblush delante.
 *
 * WHY (2026-08-17): pasar `_deblush.py` antes del gate parecía ahorrar tiradas
 * y lo que hacía era fabricar aprobados falsos. Suaviza la mancha lo justo
 * para caer bajo el umbral relativo, pero el rubor se sigue viendo: una
 * portada del paquete pasó así y la MISMA imagen en crudo falla con 15,5%.
 * El deblush sigue sirviendo para arreglar una portada ya elegida; delante
 * del gate, ciega al gate.
 */
async function gate(buf: Buffer): Promise<{ ok: boolean; detail: string }> {
  const dir = mkdtempSync(path.join(tmpdir(), "cover-"));
  const f = path.join(dir, "raw.png");
  writeFileSync(f, buf);
  try {
    const { stdout } = await exec(".venv-cv/bin/python", ["scripts/_coverGate.py", f]);
    return { ok: true, detail: stdout.trim().split("\n").pop() ?? "" };
  } catch (e: any) {
    return { ok: false, detail: String(e.stdout ?? e.message).trim().split("\n").pop() ?? "" };
  }
}

async function main() {
  const dry = process.argv.includes("--dry");
  const only = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
  const slugs = only ? [only] : Object.keys(SCENES);
  const ok: string[] = [];
  const fail: string[] = [];

  for (const slug of slugs) {
    const s = await p.journeyStory.findFirst({ where: { journeyId: J, slug }, select: { id: true, coverUrl: true } });
    if (!s) { console.log(`SIN HISTORIA ${slug}`); fail.push(slug); continue; }
    if (s.coverUrl && !only) { console.log(`skip ${slug} (ya tiene portada)`); continue; }

    const prompt = SCENES[slug] + " " + IRENE + " " + ROCIO + " " + REGISTRO + " " + STYLE;
    let done = false;
    // DOS tiradas como máximo. El bucle de tres del primer intento gastó 9
    // tiradas para 1 portada sin avisar; a dos, el techo por tema es 6.
    // El gate mide rubor, que es la única prohibición dura automatizable; los
    // ojos punto, la edad y la coherencia de estilo siguen necesitando mirarla.
    for (let attempt = 1; attempt <= 2 && !done; attempt++) {
      try {
        const buf = await generateFluxImageBuffer(prompt);
        const g = await gate(buf);
        if (!g.ok) { console.log(`  ${slug} tirada ${attempt}: RUBOR en cara, se descarta. ${g.detail}`); continue; }
        if (dry) { console.log(`[dry] ${slug} pasa el gate (${buf.length} bytes), no se sube`); done = true; continue; }
        const key = `media/generated/images/${slug}-a1spain-${buf.length}.png`;
        const up = await uploadPublicObject({ key, body: buf, contentType: "image/png" });
        if (!up) throw new Error("upload null");
        const url = `https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/${key}`;
        await p.journeyStory.update({ where: { id: s.id }, data: { coverUrl: url, coverDone: true } });
        console.log(`OK ${slug} -> ${url}`);
        ok.push(slug);
        done = true;
      } catch (e: any) {
        console.log(`  retry ${slug} (intento ${attempt}): ${e.message}`);
      }
    }
    if (!done) fail.push(slug);
  }
  console.log(`\n=== ${ok.length} OK, ${fail.length} fallaron${fail.length ? ": " + fail.join(", ") : ""}`);
  await p.$disconnect();
}
main().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
