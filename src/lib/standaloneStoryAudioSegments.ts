import { AudioSegment, coerceAudioSegments } from "@/lib/audioSegments";

type StandaloneStoryAudioSegmentMap = Record<string, unknown>;

// Test harness for standalone-story clip playback in practice.
// Keep this registry intentionally small and opt-in so editorial workflows stay untouched.
const standaloneStoryAudioSegments: StandaloneStoryAudioSegmentMap = {
  "el-cuaderno-perdido-en-sacsayhuaman": [
    { id: "sentence-1", text: "Elena y su hermano Mateo caminaron por los antiguos caminos de Sacsayhuamán.", normalizedText: "elena y su hermano mateo caminaron por los antiguos caminos de sacsayhuamán", startSec: 2, endSec: 5.960000038146973, index: 0 },
    { id: "sentence-2", text: "Era una mañana tranquila, y el sol brillaba en el cielo azul.", normalizedText: "era una mañana tranquila y el sol brillaba en el cielo azul", startSec: 7.239999771118164, endSec: 10.420000076293945, index: 1 },
    { id: "sentence-3", text: "Elena sonrió y miró a su hermano.", normalizedText: "elena sonrió y miró a su hermano", startSec: 11.220000267028809, endSec: 13, index: 2 },
    { id: "sentence-4", text: "\"¡Mira esas piedras tan grandes!\"", normalizedText: "¡mira esas piedras tan grandes", startSec: 13.619999885559082, endSec: 15.4399995803833, index: 3 },
    { id: "sentence-5", text: "dijo, llena de entusiasmo. Mateo asintió.", normalizedText: "dijo llena de entusiasmo mateo asintió", startSec: 15.4399995803833, endSec: 18.040000915527344, index: 4 },
    { id: "sentence-6", text: "\"Sí, son impresionantes. ¿Tienes tu cuaderno?\"", normalizedText: "sí son impresionantes ¿tienes tu cuaderno", startSec: 18.579999923706055, endSec: 22.1200008392334, index: 5 },
    { id: "sentence-7", text: "Elena asintió de nuevo.", normalizedText: "elena asintió de nuevo", startSec: 22.1200008392334, endSec: 23.360000610351562, index: 6 },
    { id: "sentence-8", text: "\"Sí, quiero escribir sobre todo esto. La vista de Cusco es hermosa desde aquí.\"", normalizedText: "sí quiero escribir sobre todo esto la vista de cusco es hermosa desde aquí", startSec: 23.5, endSec: 28.8799991607666, index: 7 },
    { id: "sentence-9", text: "Mientras exploraban el lugar, Elena sacó su pequeño cuaderno y comenzó a anotar.", normalizedText: "mientras exploraban el lugar elena sacó su pequeño cuaderno y comenzó a anotar", startSec: 28.8799991607666, endSec: 33.58000183105469, index: 8 },
    { id: "sentence-10", text: "Sintió una emoción especial al escribir sobre la historia de Sacsayhuamán.", normalizedText: "sintió una emoción especial al escribir sobre la historia de sacsayhuamán", startSec: 34.279998779296875, endSec: 37.13999938964844, index: 9 },
    { id: "sentence-11", text: "Pero, de repente, se dio cuenta de que su cuaderno no estaba en su mano.", normalizedText: "pero de repente se dio cuenta de que su cuaderno no estaba en su mano", startSec: 38.2599983215332, endSec: 42.52000045776367, index: 10 },
    { id: "sentence-12", text: "\"¿Mateo? No puedo encontrar mi cuaderno!\"", normalizedText: "¿mateo no puedo encontrar mi cuaderno", startSec: 43.900001525878906, endSec: 45.779998779296875, index: 11 },
    { id: "sentence-13", text: "exclamó, mirando alrededor con preocupación.", normalizedText: "exclamó mirando alrededor con preocupación", startSec: 45.779998779296875, endSec: 48.41999816894531, index: 12 },
    { id: "sentence-14", text: "\"¿Cómo? ¿Dónde lo dejaste?\"", normalizedText: "¿cómo ¿dónde lo dejaste", startSec: 48.84000015258789, endSec: 51.040000915527344, index: 13 },
    { id: "sentence-15", text: "preguntó Mateo, frunciendo el ceño.", normalizedText: "preguntó mateo frunciendo el ceño", startSec: 51.040000915527344, endSec: 52.81999969482422, index: 14 },
    { id: "sentence-16", text: "Elena se mordió el labio.", normalizedText: "elena se mordió el labio", startSec: 53.599998474121094, endSec: 54.459999084472656, index: 15 },
    { id: "sentence-17", text: "\"Lo tenía hace un momento. Tal vez lo dejé en la roca de allí.\"", normalizedText: "lo tenía hace un momento tal vez lo dejé en la roca de allí", startSec: 54.880001068115234, endSec: 59.040000915527344, index: 16 },
    { id: "sentence-18", text: "Señaló hacia una gran piedra, pero no lo encontró.", normalizedText: "señaló hacia una gran piedra pero no lo encontró", startSec: 59.040000915527344, endSec: 61.31999969482422, index: 17 },
    { id: "sentence-19", text: "La ansiedad creció en su pecho.", normalizedText: "la ansiedad creció en su pecho", startSec: 61.900001525878906, endSec: 63.34000015258789, index: 18 },
    { id: "sentence-20", text: "\"Debemos buscarlo, Mateo. No sé qué haré sin él.\"", normalizedText: "debemos buscarlo mateo no sé qué haré sin él", startSec: 63.91999816894531, endSec: 66.9800033569336, index: 19 },
    { id: "sentence-21", text: "Mateo se acercó a su hermana.", normalizedText: "mateo se acercó a su hermana", startSec: 66.9800033569336, endSec: 68.23999786376953, index: 20 },
    { id: "sentence-22", text: "\"No te preocupes. Vamos a buscarlo juntos.\"", normalizedText: "no te preocupes vamos a buscarlo juntos", startSec: 68.54000091552734, endSec: 71.58000183105469, index: 21 },
    { id: "sentence-23", text: "Mientras comenzaban su búsqueda, Elena miró a su alrededor.", normalizedText: "mientras comenzaban su búsqueda elena miró a su alrededor", startSec: 71.58000183105469, endSec: 74.58000183105469, index: 22 },
    { id: "sentence-24", text: "La majestuosidad de Sacsayhuamán la rodeaba, pero su mente estaba enfocada en el cuaderno.", normalizedText: "la majestuosidad de sacsayhuamán la rodeaba pero su mente estaba enfocada en el cuaderno", startSec: 75.23999786376953, endSec: 80.30000305175781, index: 23 },
    { id: "sentence-25", text: "\"¿Por qué es tan importante para mí?\"", normalizedText: "¿por qué es tan importante para mí", startSec: 80.44000244140625, endSec: 82.58000183105469, index: 24 },
    { id: "sentence-26", text: "pensó.", normalizedText: "pensó", startSec: 82.58000183105469, endSec: 83.0199966430664, index: 25 },
    { id: "sentence-27", text: "Vieron a otros turistas tomando fotos y disfrutando de la vista.", normalizedText: "vieron a otros turistas tomando fotos y disfrutando de la vista", startSec: 83.45999908447266, endSec: 87.12000274658203, index: 26 },
    { id: "sentence-28", text: "Elena notó cómo la energía del lugar parecía vibrar a su alrededor.", normalizedText: "elena notó cómo la energía del lugar parecía vibrar a su alrededor", startSec: 87.81999969482422, endSec: 91.26000213623047, index: 27 },
    { id: "sentence-29", text: "\"Quizás, esto es más que solo un cuaderno,\" reflexionó.", normalizedText: "quizás esto es más que solo un cuaderno reflexionó", startSec: 91.87999725341797, endSec: 94.95999908447266, index: 28 },
    { id: "sentence-30", text: "Después de buscar por un tiempo, Mateo dijo, \"Elena, mira esa piedra grande.", normalizedText: "después de buscar por un tiempo mateo dijo elena mira esa piedra grande", startSec: 95.5199966430664, endSec: 100.4000015258789, index: 29 },
    { id: "sentence-31", text: "Vamos a ver si está allí.\"", normalizedText: "vamos a ver si está allí", startSec: 100.95999908447266, endSec: 102.55999755859375, index: 30 },
    { id: "sentence-32", text: "Corrieron hacia la piedra.", normalizedText: "corrieron hacia la piedra", startSec: 102.55999755859375, endSec: 103.68000030517578, index: 31 },
    { id: "sentence-33", text: "Elena sintió su corazón latir con esperanza.", normalizedText: "elena sintió su corazón latir con esperanza", startSec: 104.4800033569336, endSec: 106.4000015258789, index: 32 },
    { id: "sentence-34", text: "\"Por favor, que esté allí,\" deseó en silencio.", normalizedText: "por favor que esté allí deseó en silencio", startSec: 106.73999786376953, endSec: 109.80000305175781, index: 33 },
    { id: "sentence-35", text: "Cuando llegaron, su corazón se hundió.", normalizedText: "cuando llegaron su corazón se hundió", startSec: 110.44000244140625, endSec: 112.1500015258789, index: 34 },
    { id: "sentence-36", text: "No había cuaderno.", normalizedText: "no había cuaderno", startSec: 113.06999969482422, endSec: 113.83000183105469, index: 35 },
    { id: "sentence-37", text: "Pero, mientras miraba la vista de Cusco, algo cambió en su interior.", normalizedText: "pero mientras miraba la vista de cusco algo cambió en su interior", startSec: 114.33000183105469, endSec: 118.52999877929688, index: 36 },
    { id: "sentence-38", text: "\"Este lugar es mágico. No necesito el cuaderno para recordar esto,\" se dijo a sí misma.", normalizedText: "este lugar es mágico no necesito el cuaderno para recordar esto se dijo a sí misma", startSec: 119.06999969482422, endSec: 124.11000061035156, index: 37 },
    { id: "sentence-39", text: "Elena se volvió a Mateo y sonrió.", normalizedText: "elena se volvió a mateo y sonrió", startSec: 124.70999908447266, endSec: 126.51000213623047, index: 38 },
    { id: "sentence-40", text: "\"Gracias por ayudarme, hermano. Creo que el cuaderno perdido me ha enseñado algo importante.\"", normalizedText: "gracias por ayudarme hermano creo que el cuaderno perdido me ha enseñado algo importante", startSec: 126.97000122070312, endSec: 132.9499969482422, index: 39 },
    { id: "sentence-41", text: "Mateo sonrió también.", normalizedText: "mateo sonrió también", startSec: 132.9499969482422, endSec: 134.00999450683594, index: 40 },
    { id: "sentence-42", text: "\"A veces, lo mejor se encuentra en la experiencia, no en las notas.\"", normalizedText: "a veces lo mejor se encuentra en la experiencia no en las notas", startSec: 134.5500030517578, endSec: 137.88999938964844, index: 41 },
  ],
};

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

function buildStandaloneClipUrl(slug: string, segmentId: string): string {
  return `/story-clips/${encodeURIComponent(slug)}/${encodeURIComponent(segmentId)}.m4a`;
}

export function getConfiguredStandaloneStorySlugs(): string[] {
  return Object.keys(standaloneStoryAudioSegments)
    .map(normalizeSlug)
    .filter(Boolean);
}

export function getStandaloneStoryAudioSegments(slug: string): AudioSegment[] {
  const key = normalizeSlug(slug);
  if (!key) return [];
  return coerceAudioSegments(standaloneStoryAudioSegments[key]).map((segment) => ({
    ...segment,
    clipUrl: buildStandaloneClipUrl(key, segment.id),
  }));
}
