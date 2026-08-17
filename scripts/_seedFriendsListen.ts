import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const FRIENDS_ID = "cmrdqk484000032r4rt2vw4ej";
const APPLY = process.argv.includes("--apply");

// One listen_choose per story. sentence = EXACT segment text (real clip carves
// from narration). answer = surface form as heard. options[0]===answer, 3
// phonetically-confusable real-word distractors + English glosses aligned.
type Item = { slug: string; word: string; sentence: string; answer: string; options: string[]; tr: string[] };
const ITEMS: Item[] = [
  { slug: "le-toca-a-mateo", word: "lana", answer: "lana",
    sentence: "Ninguno quería quedar como el codo del cuento, pero a todos les daba hueva soltar la lana.",
    options: ["lana", "rana", "cana", "gana"], tr: ["cash", "frog", "grey hair", "urge"] },
  { slug: "rodrigo-se-lo-busco", word: "billete", answer: "billete",
    sentence: "Itzel no lo soltó y le preguntó de dónde había sacado tanto billete de repente.",
    options: ["billete", "filete", "juguete", "machete"], tr: ["cash / bill", "fillet", "toy", "machete"] },
  { slug: "todo-es-weon", word: "talla", answer: "talla",
    sentence: "Para entrar al weveo no hay que buscarle la lógica, sino sentirle la talla.",
    options: ["talla", "malla", "falla", "muralla"], tr: ["vibe / wit", "mesh", "fault", "wall"] },
  { slug: "marina-llega-con-visaje", word: "tinto", answer: "tinto",
    sentence: "Valeria salió de la cocina con un tinto y se sentó a chismosear también.",
    options: ["tinto", "pinto", "quinto", "lindo"], tr: ["black coffee", "I paint", "fifth", "pretty"] },
  { slug: "camila-no-da-mas", word: "mango", answer: "mango",
    sentence: "Encima el sueldo era una miseria, y con ese mango no le alcanzaba para nada.",
    options: ["mango", "tango", "rango", "fango"], tr: ["buck (peso)", "tango", "rank", "mud"] },
  { slug: "pilar-no-entiende-nada", word: "roche", answer: "roche",
    sentence: "Pero cada palabra rara la hundía más en el roche de no entender nada.",
    options: ["roche", "coche", "noche", "broche"], tr: ["embarrassment", "car", "night", "clasp"] },
  { slug: "el-corte-nuevo-de-andres", word: "tieso", answer: "tieso",
    sentence: "Apenas lo vio, Daniela le soltó un \"Ombe\" y le preguntó por ese peinado tan tieso, mane.",
    options: ["tieso", "hueso", "yeso", "queso"], tr: ["stiff", "bone", "plaster", "cheese"] },
  { slug: "ahorita-salgo", word: "morra", answer: "morra",
    sentence: "Cuando por fin apareció la morra, Mateo la recibió con una cara de falsa sorpresa.",
    options: ["morra", "gorra", "zorra", "porra"], tr: ["chick / girl", "cap", "vixen", "club"] },
  { slug: "el-psicologo-de-la-barra", word: "forro", answer: "forro",
    sentence: "\"Es un forro, sacátelo de la cabeza ya\", sentenció Tomás con autoridad.",
    options: ["forro", "gorro", "zorro", "morro"], tr: ["jerk", "hat", "fox", "snout"] },
  { slug: "almuerzo-en-el-jato", word: "jato", answer: "jato",
    sentence: "Al mediodía, Beto invitó a la chochera a su jato a jamear algo rico.",
    options: ["jato", "gato", "pato", "rato"], tr: ["pad (house)", "cat", "duck", "a while"] },
  { slug: "itzel-no-sabe-nada", word: "chavo", answer: "chavo",
    sentence: "Su amigo, un chavo medio tímido, prometió caer al bar sin falta.",
    options: ["chavo", "bravo", "clavo", "pavo"], tr: ["young guy", "fierce", "nail", "turkey"] },
  { slug: "la-lengua-de-julian", word: "guaro", answer: "guaro",
    sentence: "Entre risas y guaro, la lengua se le fue soltando más de la cuenta.",
    options: ["guaro", "claro", "raro", "faro"], tr: ["liquor", "clear", "odd", "lighthouse"] },
  { slug: "el-carrete-del-sabado", word: "copete", answer: "copete",
    sentence: "\"Yo llevo el copete, no se preocupen, tengo un pituto filete\", prometió Benjamín.",
    options: ["copete", "billete", "cohete", "juguete"], tr: ["booze / drinks", "bill", "rocket", "toy"] },
  { slug: "andres-en-la-pista", word: "traga", answer: "traga",
    sentence: "Andrés no le quitaba el ojo a una traga que bailaba sabroso en la mitad de la pista.",
    options: ["traga", "daga", "plaga", "vaga"], tr: ["crush", "dagger", "pest", "lazy"] },
  { slug: "la-chibola-nos-supero", word: "chato", answer: "chata",
    sentence: "\"Ya, me rindo, tú ganas, eres una crack, chata\", declaró entre risas.",
    options: ["chata", "pata", "rata", "lata"], tr: ["sweetie", "buddy", "rat", "drag"] },
  { slug: "cafe-y-pan-de-yema", word: "bola", answer: "bola",
    sentence: "El domingo siguiente, la bola se juntó tranquila en casa de Nayeli, con café y pan de yema.",
    options: ["bola", "cola", "ola", "sola"], tr: ["crew / group", "queue / tail", "wave", "alone"] },
  { slug: "llega-el-guachiman", word: "cuadre", answer: "cuadre",
    sentence: "Andrés por fin tenía el cuadre con la china y no lo pensaba soltar.",
    options: ["cuadre", "madre", "padre", "sastre"], tr: ["hookup / date", "mother", "father", "tailor"] },
  { slug: "el-asado-a-la-orilla", word: "pega", answer: "pega",
    sentence: "Pronto cada uno agarraría para su lado, con la pega y la vida tirando fuerte.",
    options: ["pega", "vega", "ciega", "llega"], tr: ["job / work", "meadow", "blind", "arrives"] },
  { slug: "el-mismo-chabon", word: "remera", answer: "remera",
    sentence: "Hasta la remera que describían, azul con letras blancas, era idéntica.",
    options: ["remera", "tijera", "manera", "pulsera"], tr: ["t-shirt", "scissors", "way", "bracelet"] },
  { slug: "el-domingo-se-arregla", word: "arepa", answer: "arepa",
    sentence: "El domingo, el parche se juntó en casa de Valeria con arepa y chocolate caliente.",
    options: ["arepa", "cepa", "pepa", "estepa"], tr: ["arepa (corn cake)", "vine stock", "seed", "steppe"] },
  { slug: "diez-intentos", word: "naco", answer: "naco",
    sentence: "\"Te ves bien naco\", le dijo Pablo, sin piedad.",
    options: ["naco", "flaco", "saco", "taco"], tr: ["tacky", "skinny", "jacket", "taco"] },
];

function selfCheck(it: Item): string | null {
  if (it.options.length !== 4) return "options!=4";
  if (it.tr.length !== 4) return "tr!=4";
  if (it.options[0] !== it.answer) return "options[0]!==answer";
  if (new Set(it.options).size !== 4) return "dup options";
  if (!it.sentence.includes(it.answer)) return `answer '${it.answer}' not in sentence`;
  return null;
}

async function run() {
  const stories = await p.journeyStory.findMany({
    where: { journeyId: FRIENDS_ID, status: "published" },
    select: { id: true, slug: true, audioFragments: true, audioSegments: true },
  });
  const bySlug = new Map(stories.map((s) => [s.slug, s]));
  let ok = 0, skip = 0, fail = 0;
  for (const it of ITEMS) {
    const chk = selfCheck(it);
    if (chk) { console.log(`FAIL ${it.slug}: ${chk}`); fail++; continue; }
    const story = bySlug.get(it.slug);
    if (!story) { console.log(`FAIL ${it.slug}: story not found`); fail++; continue; }
    const frags = (story.audioFragments as any[]) || [];
    const segs = (story.audioSegments as any[]) || [];
    const voiceId = frags.find((f) => f?.voiceId)?.voiceId || null;
    const segMatch = segs.some((g) => (g.text || "").trim() === it.sentence.trim());
    if (!voiceId) { console.log(`FAIL ${it.slug}: no narrator voiceId`); fail++; continue; }
    if (!segMatch) { console.log(`FAIL ${it.slug}: sentence not an exact segment`); fail++; continue; }

    const set = await p.storyPracticeSet.findUnique({ where: { storyId: story.id }, select: { id: true } });
    if (!set) { console.log(`FAIL ${it.slug}: no practice set`); fail++; continue; }
    const existing = await p.storyPracticeExercise.findFirst({ where: { setId: set.id, type: "listen_choose" }, select: { id: true } });
    if (existing) { console.log(`skip ${it.slug}: already has listen_choose`); skip++; continue; }
    const maxOrder = await p.storyPracticeExercise.aggregate({ where: { setId: set.id }, _max: { orderIndex: true } });
    const orderIndex = (maxOrder._max.orderIndex ?? -1) + 1;

    const payload = {
      prompt: "Which word did you hear?",
      answer: it.answer,
      options: it.options,
      optionTranslations: it.tr,
      language: "spanish",
      audioClip: { storySlug: it.slug, storySource: "user", sentence: it.sentence, targetWord: it.answer, language: "spanish", voiceId },
    };

    if (!APPLY) { console.log(`DRY ${it.slug}: would insert listen_choose '${it.answer}' order=${orderIndex} voice=${voiceId}`); ok++; continue; }
    await p.storyPracticeExercise.create({
      data: {
        setId: set.id, orderIndex, type: "listen_choose", word: it.word, sentence: it.sentence,
        audioUrl: null, payload, featured: false, language: "spanish",
      },
      select: { id: true },
    });
    console.log(`OK ${it.slug}: inserted listen_choose '${it.answer}' order=${orderIndex}`);
    ok++;
  }
  console.log(`\n${APPLY ? "APPLIED" : "DRY-RUN"} ok=${ok} skip=${skip} fail=${fail} of ${ITEMS.length}`);
}
run().catch((e) => { console.error("FATAL", e.message); process.exit(1); }).finally(() => p.$disconnect());
