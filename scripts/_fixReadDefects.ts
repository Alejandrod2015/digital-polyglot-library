/**
 * Arregla los defectos que salieron al LEER las 21 historias enteras y
 * seguidas, no solo los finales. Los cinco son míos: los introduje al
 * reescribir cierres, y cada uno pasa el validador sin problema porque son
 * fallos de coherencia con lo que dice el resto de la página.
 *
 * Ninguno cambia el arcType: la rotación ya está válida y se queda como está.
 */
import * as fs from "fs";

type Fix = { slug: string; from: string; to: string; why: string };

const FIXES: Fix[] = [
  {
    slug: "levanta-el-arroz",
    why: "mi reencuadre decía que Sergio sacó la paella cinco minutos antes, pero en la misma historia él dice 'treinta minutos justos' y 'ya casi está'. Se contradecían. El reencuadre ahora apunta al fuego final, que es lo que Vicente ya había explicado",
    from: "Vicente: Iba bien. La sacaste cinco minutos antes, nada más.",
    to: "Vicente: Iba bien. Lo que le faltó fue fuego fuerte al final, nada más.",
  },
  {
    slug: "otra-vez-gotea-abajo",
    why: "mi cierre ya resolvía la gotera con un plato debajo de cada maceta, y en la historia siguiente Marta lo propone como idea nueva y don Andrés reacciona como si lo oyera por primera vez. Quito la solución de aquí y la dejo donde toca",
    from: "Rosario: Para el domingo también. Hoy toca regar, y poner un plato debajo de cada maceta.",
    to: "Rosario: Para el domingo también. Hoy toca regar, que las plantas no esperan.",
  },
  {
    slug: "los-vivos-todos-los-anos",
    why: "la vecina le pedía a Sabela que empezara ella el conxuro justo después de que Sabela dijera que no se lo sabe entero. Ahora le pide lo único que sí puede hacer",
    from: "Vecina: Pues empieza tú, que este año te toca. Y reparte las tazas mientras.",
    to: "Vecina: Y este año te toca a ti repartir las tazas, Sabela.",
  },
  {
    slug: "quiero-tener-mis-sitios",
    why: "Marc tiene veintipocos en el cast y aprendió inglés con una aplicación; que lleve veinte años perdiéndose por Barcelona no le cuadra la edad",
    from: "Marc: Veinte años perdiéndome por aquí y todavía sigo encontrando calles.",
    to: "Marc: Llevo aquí toda la vida y todavía sigo encontrando calles.",
  },
  {
    slug: "el-mundo-es-un-panuelo",
    why: "'que haberlas hay' es una construcción opaca para un A2, no se enseña en ninguna parte y no aporta nada. Fuera",
    from: "Paco: Esa y alguna nueva, que haberlas hay. El café, que sea de los grandes.",
    to: "Paco: Esa y alguna nueva. El café, que sea de los grandes.",
  },
];

const stories = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Array<{
  slug: string; text: string; arcType: string; vocab: Array<{ word: string }>;
}>;

for (const f of FIXES) {
  const s = stories.find((x) => x.slug === f.slug);
  if (!s) throw new Error(`No existe ${f.slug}`);
  if (!s.text.includes(f.from)) throw new Error(`La línea a sustituir no aparece tal cual en ${f.slug}`);
  const before = s.text;
  const arcBefore = s.arcType;
  s.text = s.text.replace(f.from, f.to);
  if (s.arcType !== arcBefore) throw new Error(`${f.slug}: el arco no debe cambiar`);
  const lost = s.vocab.map((v) => v.word)
    .filter((w) => before.toLowerCase().includes(w.toLowerCase()) && !s.text.toLowerCase().includes(w.toLowerCase()));
  if (lost.length) throw new Error(`${f.slug}: se cayó vocab: ${lost.join(", ")}`);
  console.log(`${f.slug}\n  ${f.why}\n  antes: ${f.from}\n  ahora: ${f.to}\n`);
}

fs.writeFileSync(process.argv[3], JSON.stringify(stories, null, 2));
console.log(`arreglados ${FIXES.length} · escrito ${process.argv[3]}`);
