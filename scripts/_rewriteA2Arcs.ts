/**
 * Reescribe el CIERRE de las historias cuyo arco tiene que cambiar, sobre el
 * JSON de trabajo. Cada entrada dice qué párrafo final se sustituye y por cuál,
 * y el arcType nuevo va junto al texto nuevo a propósito: cambiar la etiqueta
 * sin cambiar la historia sería hacerle trampa al gate.
 *
 * Reglas que respeta cada reescritura:
 *  - No mueve trama ni personajes, solo la forma del último beat.
 *  - Conserva todas las palabras del vocab que vivían en el párrafo tocado
 *    (hay un check de que el item aparece literalmente en el cuerpo).
 *  - No usa una palabra del vocab en un sentido distinto al de su glosa.
 *  - Mata la coletilla de frase-moraleja final, que estaba en las 21.
 */
import * as fs from "fs";

type Rewrite = { slug: string; arcType: string; from: string; to: string; why: string };

const REWRITES: Rewrite[] = [
  {
    slug: "por-algo-se-empieza",
    arcType: "mini-cliffhanger",
    why: "cerraba resuelto y mirando al sábado con ilusión; ahora cierra en lo que NO sabe, que es lo que engancha con la historia siguiente",
    from: "Elena cuelga y se queda mirando el techo. Por primera vez en tres semanas, le apetece que llegue el sábado.",
    to: "Elena cuelga y se queda mirando el techo. No le ha preguntado la hora, ni el apellido. Solo sabe lo de la bufanda roja.",
  },
  {
    slug: "levanta-el-arroz",
    arcType: "reframe-turn",
    why: "el hilo entero venía montado como leña contra gas; el último beat lo recoloca en un detalle de reloj, que reencuadra las dos historias anteriores. Fuera el 'quién manda', que era otra frase-lema",
    from: "Vicente: Las dos. Que las prueben y comparen. El arroz dirá quién manda.",
    to: "Vicente: Las dos, y que comparen. Ya dirá cada arroz lo suyo.\nSergio: Espera, tío. ¿La mía tampoco iba mal?\nVicente: Iba bien. La sacaste cinco minutos antes, nada más.",
  },
  {
    slug: "apuntado-tio",
    arcType: "recurring-character-callback",
    why: "cerraba con dos frases-moraleja seguidas; ahora cierra Pilar, que ya había dicho en esta misma historia que el arroz de abajo tira mucho, y se cobra la cuchara del fondo",
    from: "Vicente: ¿Veis? El arroz no entiende de prisas. Solo de buena leña y buena mesa.\nSergio: Apuntado, tío. El domingo que viene, tú y yo, una sola paella.",
    to: "Vicente: Sin prisas, con buena leña y en buena mesa. Ya está.\nSergio: Apuntado, tío. El domingo que viene, tú y yo, una sola paella.\nPilar: Con una condición. La cuchara del fondo me la guardáis a mí.",
  },
  {
    slug: "otra-vez-gotea-abajo",
    arcType: "harmonic-close",
    why: "cerraba con gancho y repetía literal el 'Cada cosa a su tiempo' de la historia anterior; ahora la gotera se arregla con un plato debajo de cada maceta y la escena baja sola",
    from: "Rosario: Cada cosa a su tiempo, ya te lo dije. El domingo se verá.\nHugo: ¿Otra vez con secretos? Primero el baúl, ahora el patio.\nRosario: Vosotros regad las flores. Yo me ocupo de la junta del domingo.",
    to: "Rosario: El domingo se verá. Yo me ocupo de la junta de vecinos.\nHugo: ¿Y los secretos para cuándo? Primero el baúl, ahora el patio.\nRosario: Para el domingo también. Hoy toca regar, y poner un plato debajo de cada maceta.",
  },
  {
    slug: "los-vivos-todos-los-anos",
    arcType: "harmonic-close",
    why: "la revelación ya había caído a mitad de historia, así que el cierre no tenía que cargarla otra vez; ahora acaba en la cocina repartiendo tazas, que es donde estaba de verdad el final",
    from: "Sabela: No me lo sé entero. Pero lo repito contigo, palabra por palabra.",
    to: "Sabela: No me lo sé entero. Pero lo repito contigo, palabra por palabra.\nVecina: Pues empieza tú, que este año te toca. Y reparte las tazas mientras.",
  },
  {
    slug: "la-bufanda-nunca-falla",
    arcType: "juxtaposition-discovery",
    why: "cerraba prometiendo un sitio para mañana; ahora cierra en el choque que ya estaba en la historia, tres semanas sin hablar con nadie y él pasando por su puerta cada día",
    from: "Marc: Oye, mañana es domingo. ¿Te apetece que te enseñe mi Barcelona?\nElena: ¿La tuya? ¿Y esa cuál es?\nMarc: Mañana lo verás. Hay un sitio que tienes que conocer.",
    to: "Marc: Tres semanas sin hablar con nadie, y yo pasando por tu puerta cada día.\nElena: Y al final nos conocemos por un anuncio, no en la calle.\nMarc: Mañana es domingo. ¿Te apetece que te enseñe mi Barcelona? Ya verás.",
  },
  {
    slug: "el-mundo-es-un-panuelo",
    arcType: "harmonic-close",
    why: "cerraba con Paco guardándose tres rutas para mañana, o sea otro gancho; ahora se cierra hoy, con los dos sabiendo lo mismo y el café pagado",
    from: "Clara: Mañana me toca otra vez. ¿Me recomienda alguna ruta nueva?\nPaco: Mañana te cuento tres. Pero el café, que sea de los grandes.",
    to: "Clara: Mañana me toca otra vez, y ya me sé la ruta.\nPaco: Esa y alguna nueva, que haberlas hay. El café, que sea de los grandes.",
  },
];

/**
 * Los tres items que el juez sitúa legítimamente en B1. La palabra se queda en
 * el CUERPO (la regla i+2 permite hasta B2 en el body de un A2); lo que sale es
 * el item del vocab, que sí tiene que estar en nivel. Cada uno se sustituye por
 * una palabra que ya vive en la misma historia.
 */
const VOCAB_SWAPS: Array<{ slug: string; drop: string; add: { word: string; type: string; definition: string } | null }> = [
  {
    // Sin reemplazo: probé con "tiempo" y el item caía en un párrafo que ya
    // iba cargado, así que disparaba el cap de concentración por párrafo.
    // La historia se queda en 23 items, que está dentro del rango del resto.
    slug: "el-arroz-manda",
    drop: "cualquiera",
    add: null,
  },
  {
    slug: "la-bufanda-nunca-falla",
    drop: "casualidad",
    add: { word: "plaza", type: "noun", definition: "A square, the open space in a town where people meet." },
  },
  {
    // Sin reemplazo: probé con "café" y el gate lo rechaza por cognado, con
    // razón, que un angloparlante lo lee sin ayuda.
    slug: "el-mundo-es-un-panuelo",
    drop: "promete",
    add: null,
  },
];

const stories = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Array<{
  slug: string; text: string; arcType: string;
  vocab: Array<{ word: string; type?: string; definition?: string; register?: string }>;
}>;

for (const sw of VOCAB_SWAPS) {
  const s = stories.find((x) => x.slug === sw.slug);
  if (!s) throw new Error(`No existe la historia ${sw.slug}`);
  const i = s.vocab.findIndex((v) => v.word.toLowerCase() === sw.drop.toLowerCase());
  if (i < 0) throw new Error(`${sw.slug}: no encuentro el item "${sw.drop}" en el vocab`);
  if (sw.add) {
    if (!s.text.toLowerCase().includes(sw.add.word.toLowerCase())) {
      throw new Error(`${sw.slug}: la palabra de reemplazo "${sw.add.word}" no aparece en el cuerpo`);
    }
    if (s.vocab.some((v) => v.word.toLowerCase() === sw.add!.word.toLowerCase())) {
      throw new Error(`${sw.slug}: "${sw.add.word}" ya estaba en el vocab`);
    }
  }
  s.vocab.splice(i, 1, ...(sw.add ? [sw.add] : []));
  console.log(
    `${sw.slug}: vocab "${sw.drop}" (B1) → ${sw.add ? `"${sw.add.word}"` : "fuera, sin reemplazo"} (${s.vocab.length} items). La palabra sigue en el cuerpo.`,
  );
}
console.log();

for (const r of REWRITES) {
  const s = stories.find((x) => x.slug === r.slug);
  if (!s) throw new Error(`No existe la historia ${r.slug}`);
  if (!s.text.includes(r.from)) throw new Error(`El párrafo a sustituir no aparece tal cual en ${r.slug}`);

  const before = s.text;
  s.text = s.text.replace(r.from, r.to);
  s.arcType = r.arcType;

  // Control: ninguna palabra del vocab puede haberse caído del cuerpo.
  const lost = s.vocab
    .map((v) => v.word)
    .filter((w) => before.toLowerCase().includes(w.toLowerCase()) && !s.text.toLowerCase().includes(w.toLowerCase()));
  if (lost.length) throw new Error(`${r.slug}: la reescritura se llevó por delante vocab: ${lost.join(", ")}`);

  const words = (t: string) => t.trim().split(/\s+/).length;
  console.log(`${r.slug}  →  ${r.arcType}`);
  console.log(`  motivo: ${r.why}`);
  console.log(`  palabras: ${words(before)} → ${words(s.text)}`);
  console.log(`  antes: ${r.from}`);
  console.log(`  ahora: ${r.to}\n`);
}

fs.writeFileSync(process.argv[3], JSON.stringify(stories, null, 2));
console.log(`reescritas ${REWRITES.length} · escrito ${process.argv[3]}`);
