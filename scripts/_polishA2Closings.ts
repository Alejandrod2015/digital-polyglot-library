/**
 * Pulido de últimas líneas del Traveler ES/Spain A2. NO toca arcos ni tramas:
 * la rotación ya está válida y el arcType de cada historia se queda como está.
 *
 * Lo que quita es la coletilla de frase-lema con la que cerraban, que leída de
 * corrido hacía que las siete ciudades sonaran a la misma voz sentenciando.
 * Cada sustituta dice algo concreto de un personaje concreto en vez de resumir
 * la moraleja de la historia.
 *
 * Conserva a la fuerza las palabras del vocab que vivían en la línea: hay un
 * check de que el item aparece literal en el cuerpo, y "se hace corto" es un
 * item entero, así que la frase se reescribe ALREDEDOR de él.
 */
import * as fs from "fs";

type Polish = { slug: string; from: string; to: string; why: string };

const POLISH: Polish[] = [
  {
    slug: "una-caseta-mas-o-menos",
    why: "fuera 'La Feria es así', que era una de las tres veces que alguien se encoge de hombros explicando cómo funcionan las cosas aquí",
    from: "Curro: Una caseta equivocada y una noche redonda. La Feria es así.",
    to: "Curro: Una caseta equivocada y una noche redonda. Mañana volvemos a la de Reme.",
  },
  {
    slug: "quiero-tener-mis-sitios",
    why: "fuera 'Casi siempre acabas encontrando algo bueno', moraleja pura; ahora Marc contesta con un dato suyo",
    from: "Marc: Yo llevo veinte años perdiéndome por aquí y todavía sigo encontrando calles.",
    to: "Marc: Veinte años perdiéndome por aquí y todavía sigo encontrando calles.",
  },
  {
    slug: "fijate-solo-en-la-linea",
    why: "'se hace corto' es un item del vocab y no se puede tocar, así que le doy la vuelta: de aforismo a observación concreta de alguien que hace ese trayecto a diario",
    from: "David: Para mí es la rutina. Pero hoy, con compañía, hasta se hace corto.",
    to: "David: Yo lo hago cada día y nunca se hace corto. Hoy sí.",
  },
  {
    slug: "con-abrigo-y-con-mapa",
    why: "fuera 'Esa es mi chica', que era un lazo sentimental pegado al final; el guiño a la jata se queda, que ese sí es el callback de la historia",
    from: "Begoña: Esa es mi chica. Y la próxima, la jata se la devuelves tú al vecino.",
    to: "Begoña: Con abrigo, con mapa y conmigo delante. Y la jata se la devuelves tú al vecino.",
  },
];

const stories = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Array<{
  slug: string; text: string; arcType: string; vocab: Array<{ word: string }>;
}>;

for (const p of POLISH) {
  const s = stories.find((x) => x.slug === p.slug);
  if (!s) throw new Error(`No existe la historia ${p.slug}`);
  if (!s.text.includes(p.from)) throw new Error(`La línea a sustituir no aparece tal cual en ${p.slug}`);
  const before = s.text;
  const arcBefore = s.arcType;
  s.text = s.text.replace(p.from, p.to);

  if (s.arcType !== arcBefore) throw new Error(`${p.slug}: el arco no debe cambiar en el pulido`);
  const lost = s.vocab
    .map((v) => v.word)
    .filter((w) => before.toLowerCase().includes(w.toLowerCase()) && !s.text.toLowerCase().includes(w.toLowerCase()));
  if (lost.length) throw new Error(`${p.slug}: el pulido se llevó vocab por delante: ${lost.join(", ")}`);

  console.log(`${p.slug}  [${s.arcType}, sin cambios]`);
  console.log(`  ${p.why}`);
  console.log(`  antes: ${p.from}`);
  console.log(`  ahora: ${p.to}\n`);
}

fs.writeFileSync(process.argv[3], JSON.stringify(stories, null, 2));
console.log(`pulidas ${POLISH.length} · escrito ${process.argv[3]}`);
