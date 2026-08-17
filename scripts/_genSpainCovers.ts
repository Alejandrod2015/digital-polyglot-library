import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { generateFluxImageBuffer } from "../src/lib/coverGenerator";
import { uploadPublicObject } from "../src/lib/objectStorage";
const p: any = new PrismaClient();
const J = "cmrr5hnbl000032k1esry5n8g"; // Friends ES Spain A0

// Candado B style + eyes/blush guard (feedback_cover_no_blush_real_eyes).
const STYLE = "STYLE (critical): clean digital editorial illustration, smooth flat cel shading and soft gradients, crisp clean linework, flat vivid but warm color fields, polished vector-like finish, bright and cheerful, adult realistic proportions. EYES (critical): every visible character has clearly drawn open realistic eyes, each with a white sclera, a colored iris, a pupil and eyebrows; NEVER draw eyes as plain black dots, single dark marks or tiny featureless dots; show the faces in a natural three-quarter view so their detailed eyes are clearly visible. GAZE (critical): the characters look naturally at the scene, at the activity they are doing, or toward the landscape; they do NOT look at the camera or the viewer, and they are NOT posing frontally for a portrait; avoid a flat straight-to-camera stare and avoid full side-profile. BODY LANGUAGE (critical): the people are friends, not a couple; friendly platonic body language at a natural friendly distance, absorbed in the moment; NO romantic embrace, NO hugging cheek-to-cheek, NO gazing into each other's eyes. SKIN (absolutely critical, top priority): every face has pale, cool, completely flat matte skin in ONE single uniform tone; the cheeks are the exact same pale color as the forehead, nose and chin, or even paler; there is ZERO color difference on the cheeks. ABSOLUTELY NO blush, NO rosy cheeks, NO pink cheeks, NO red cheeks, NO peach cheeks, NO warm cheek tint, NO circular color patch on the cheeks, NO flushed skin, NO cheek highlight, NO makeup. Cheeks must look plain and uncolored. No freckles. No infantilized features. ABSOLUTELY NO oil painting, NO gouache, NO painterly brushstrokes, NO canvas texture, NO paper grain, NO impasto, NO visible brush marks, NO sketchy pencil texture. Smooth and clean only. Landscape composition, no text, no logos.";

// Lucía = a young woman with long brown hair, casual clothes (recurring traveler).
const SCENES: Record<string, string> = {
"la-barceloneta-despierta": "A sunny morning on Barceloneta beach in Barcelona. A young woman with long brown hair (Lucía) walks on the sand with her friend Pau, a friendly young Spanish man; he carries water and fruit, she carries a blue towel. Calm turquoise sea, warm golden light, cheerful relaxed mood.",
"la-boqueria-huele-a-fruta": "The colorful La Boquería market in Barcelona. A young woman with long brown hair (Lucía) and her friend Pau look at market stalls piled with bright fruit; a smiling older female vendor hands Lucía a red strawberry. Warm daylight, vivid awnings, lively cheerful mood.",
"lucia-mira-la-sagrada-familia": "In front of the Sagrada Familia in Barcelona. A young woman with long brown hair (Lucía) and her friend Pau look up in awe at the tall towers reaching the sky; warm sunlight, a few tourists nearby, wonder-struck joyful mood.",
"lucia-llega-a-bilbao": "The riverside of Bilbao by the ría. A young woman with long brown hair (Lucía) happily greets her friend Ander, a friendly young man holding a big black umbrella; they stand a friendly distance apart, smiling at each other as they say hello, gesturing toward the river and the city; light rain clearing to sun, bridges of the city behind, warm cheerful reunion mood.",
"el-museo-guggenheim": "Outside the Guggenheim museum in Bilbao. A young woman with long brown hair (Lucía) and her friend Ander stand before the giant flower-covered puppy sculpture and the shiny silver museum; a tall metal spider sculpture in the background. Bright daylight, amazed cheerful mood.",
"pintxos-en-el-casco-viejo": "A lively pintxo bar in Bilbao's old town at night. A young woman with long brown hair (Lucía), her friend Ander and his friend Nerea stand at a bar counter full of small pintxos on bread; warm interior light, friendly festive mood.",
"las-tapas-son-gratis": "A small tapas bar in Granada's Albaicín. A young woman with long brown hair (Lucía) and her friend Nuria sit with cold drinks and a free plate of ham tapas; white houses and the Alhambra visible through a window. Warm afternoon light, relaxed happy mood.",
"el-plan-de-nuria": "A scenic viewpoint over the Alhambra in Granada. A young woman with long brown hair (Lucía) and her friend Nuria stand side by side at a mirador, both looking out at the golden palace towers glowing in the sun; Nuria points at the view, both facing the palace, friendly and relaxed. Bright warm daylight, awe and joy mood.",
"la-nieve-de-sierra-nevada": "Snowy Sierra Nevada mountains near Granada. A young woman with long brown hair (Lucía) in a hat and gloves touches the white snow with delight beside her friend Nuria, who holds a snowball. Bright cold sunlight, blue sky, playful joyful mood.",
"marta-ensena-el-retiro": "The Retiro park lake in Madrid. A young woman with long brown hair (Lucía) and her friend Marta row a small boat on calm water; tall green trees, a duck nearby, the sun shining on the lake. Warm daylight, cheerful gentle mood.",
"churros-en-la-gran-via": "A cozy café near Gran Vía in Madrid while it rains outside. THREE friends sit together around a small round café table sharing cups of hot chocolate and a plate of churros: a young woman with long brown hair (Lucía), her friend Marta (another young woman), and Marta's brother Diego (a young man); all three smiling in a friendly group, facing the table and each other. Warm interior glow, grey rainy street through the window, happy cozy mood.",
"suena-la-plaza-mayor": "The Plaza Mayor in Madrid at golden hour. A young woman with long brown hair (Lucía) smiles as her friend Marta dances with Diego to a street guitarist; a lively crowd claps, warm orange sky above the square, festive joyful mood.",
"lucia-llega-a-san-sebastian": "Playa de la Concha in San Sebastián on a sunny day. A young woman with long brown hair (Lucía) arrives with her friend Iñaki, a friendly young man carrying her suitcase; the curved bay and clear blue sea behind them, bright cheerful welcoming mood.",
"ane-trae-mas-pintxos": "A busy pintxo bar in San Sebastián's old town. A young woman with long brown hair (Lucía), her friend Iñaki and his friend Ane enjoy plates of pintxos, ham and shrimp; warm interior light, narrow street outside, friendly cheerful mood.",
"un-funicular-hasta-igueldo": "The old Igueldo funicular above San Sebastián at sunset. A young woman with long brown hair (Lucía) and her friend Iñaki stand at the hilltop railing, turned three-quarters toward the viewer, smiling as Iñaki gestures toward the bay; an old amusement park with colorful lights nearby, the huge bay and orange evening sky, wonder and fun mood.",
"naranjas-para-dos-amigas": "A sunny terrace in Seville in the morning. A young woman with long brown hair (Lucía) and her friend Carmen toast with glasses of fresh orange juice at a small table; an orange tree full of ripe oranges in the patio, warm light, happy welcoming mood.",
"la-giralda-desde-arriba": "The top of the Giralda tower in Seville. A young woman with long brown hair (Lucía) and her friend Carmen stand side by side at the railing, both looking out over the red rooftops and the river far below; Carmen points at the view, both facing the city, friendly and cheerful; big bells nearby, fresh breeze, bright daylight, awe and joy mood.",
"triana-y-su-ceramica-azul": "A small ceramics shop in the Triana neighborhood of Seville by the river. A young woman with long brown hair (Lucía) and her friend Carmen admire colorful blue ceramic plates; the Guadalquivir river and a bridge outside, warm orange evening light, calm content mood.",
"naranjas-en-el-mercado": "A bright fruit market in Valencia in the morning. A young woman with long brown hair (Lucía) and her friend Vicente buy sweet oranges from Amparo, a friendly older female vendor at a stall full of fruit and vegetables. Warm daylight, colorful stalls, cheerful mood.",
"paella-en-la-malvarrosa": "The Malvarrosa beach in Valencia at midday. A young woman with long brown hair (Lucía) and her friend Vicente eat a big yellow paella at a seaside restaurant table; golden sand and blue sea behind, a cheeky bird stealing a shrimp from the plate, sunny playful mood.",
"la-ciudad-de-las-artes": "The City of Arts and Sciences in Valencia at night. A young woman with long brown hair (Lucía), her friend Vicente and his sister Rosa (arriving on a bike) admire the white modern buildings; glowing lights reflected on the water, deep blue evening sky, magical peaceful mood.",
};

async function main() {
  const only = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
  const slugs = only ? [only] : Object.keys(SCENES);
  const ok: string[] = []; const fail: string[] = [];
  for (const slug of slugs) {
    const existing = await p.journeyStory.findFirst({ where: { journeyId: J, slug }, select: { coverUrl: true } });
    if (existing?.coverUrl && !only) { console.log(`skip ${slug} (ya tiene portada)`); continue; }
    const prompt = SCENES[slug] + " " + STYLE;
    let done = false;
    for (let attempt = 1; attempt <= 2 && !done; attempt++) {
      try {
        const buf = await generateFluxImageBuffer(prompt);
        const key = `media/generated/images/${slug}-spaina0-${buf.length}.png`;
        const up = await uploadPublicObject({ key, body: buf, contentType: "image/png" });
        if (!up) throw new Error("upload null");
        const url = `https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/${key}`;
        const s = await p.journeyStory.findFirst({ where: { journeyId: J, slug }, select: { id: true } });
        await p.journeyStory.update({ where: { id: s.id }, data: { coverUrl: url, coverDone: true } });
        console.log(`OK ${slug} -> ${url}`);
        ok.push(slug); done = true;
      } catch (e: any) {
        console.log(`  retry ${slug} (intento ${attempt}): ${e.message}`);
        if (attempt === 2) fail.push(slug);
      }
    }
  }
  console.log(`\n=== ${ok.length} OK, ${fail.length} fallaron ${fail.length ? ": " + fail.join(", ") : ""}`);
  await p.$disconnect();
}
main().catch(e => { console.error("FATAL", e.message); process.exit(1); });
