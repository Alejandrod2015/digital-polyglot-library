import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const J = "cmtgelq560007j84n3ujx9bpd";

// Imperfecto de subjuntivo: -ara/-aras/-ara/-aramos/-aran, -iera/... y -ase/-iese.
const IMP = /\b\w{3,}(?:ara|aras|áramos|aran|iera|ieras|iéramos|ieran|ase|ases|ásemos|asen|iese|ieses|iésemos|iesen)\b/gi;
// Falsos amigos frecuentes (sustantivos / pretéritos / otros).
const NO = new Set(["cara","caras","para","mara","clara","claras","vara","varas","tiara","escalera","escaleras","madera","maderas","espera","esperas","manera","maneras","primera","primeras","cualquiera","tercera","frontera","fronteras","carretera","carreteras","pulsera","cera","acera","aceras","bandera","banderas","heladera","cartera","carteras","ligera","ligeras","entera","enteras","severa","fiera","hilera","panadera","frutera","costera","pesquera","delantera","trasera","montera","cabecera","papelera","nevera","tijera","tijeras","llavero","afuera","siquiera","gaseosa","casera","caseras","cocinera","enfermera","compañera","compañeras","peluquera","viajera","extranjera","ojera","ojeras","sombrerera","alcancera","tercera","verdadera","verdulera"]);

async function main() {
  const ss = await p.journeyStory.findMany({ where: { journeyId: J }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }], select: { slug: true, topic: true, slotIndex: true, text: true, audioUrl: true } });
  for (const s of ss) {
    const plain = (s.text || "").replace(/<[^>]+>/g, " ");
    const hits = [...new Set((plain.match(IMP) || []).map((w) => w.toLowerCase()))].filter((w) => !NO.has(w));
    if (!hits.length) continue;
    console.log(`${s.topic} #${s.slotIndex} ${s.audioUrl ? "[AUDIO]" : "[sin audio]"} ${s.slug}: ${hits.join(", ")}`);
    for (const h of hits) {
      const m = plain.match(new RegExp("[^.!?“”]*\\b" + h + "\\b[^.!?“”]*", "i"));
      if (m) console.log("    · " + m[0].trim());
    }
  }
  await p.$disconnect();
}
main();
