import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

const CITIES = [
 // ES
 "Madrid","Barcelona","Sevilla","Valencia","Granada","Málaga","Bilbao","San Sebastián","Salamanca","Santiago de Compostela","Vitoria","Cádiz","Toledo","Córdoba","Zaragoza","Pamplona","Gijón","Oviedo","A Coruña","Murcia","Alicante","Palma",
 // LATAM
 "Buenos Aires","Córdoba","Rosario","Mendoza","Bariloche","Salta","Santiago","Valparaíso","Bogotá","Medellín","Cartagena","Cali","Barranquilla","Bucaramanga","Pereira","Ciudad de México","Guadalajara","Monterrey","Oaxaca","Puebla","Mérida","Tulum","Cancún","Guanajuato","Lima","Cusco","Quito","Montevideo","La Paz","Asunción","La Habana","San Juan",
 // BR/PT
 "Rio de Janeiro","São Paulo","Brasília","Salvador","Recife","Fortaleza","Belo Horizonte","Manaus","Curitiba","Porto Alegre","Natal","Paraty","Niterói","Florianópolis","Lisboa","Porto",
 // FR
 "Paris","Marseille","Lyon","Bordeaux","Toulouse","Nice","Nantes","Strasbourg","Lille","Montpellier","Rennes","Roubaix","Clermont-Ferrand","Clermont",
 // DE
 "Berlin","Hamburg","München","Munich","Köln","Frankfurt","Stuttgart","Düsseldorf","Leipzig","Dresden","Bremen","Hannover","Nürnberg","Rostock","Münster","Heidelberg","Freiburg",
 // IT
 "Roma","Milano","Napoli","Firenze","Venezia","Torino","Bologna","Palermo","Genova","Verona","Padova","Bari","Pisa","Siena",
 // PL/KO/AR
 "Kraków","Warszawa","Gdańsk","Wrocław","Zakopane","Seoul","Busan","El Cairo","Cairo","القاهرة","Alejandría",
];

(async () => {
  const js = await p.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    include: { stories: { select: { title: true, text: true, synopsis: true } } },
    orderBy: [{ language: "asc" }, { variant: "asc" }, { name: "asc" }],
  });
  for (const j of js) {
    const written = j.stories.filter(s => (s.text ?? "").length > 50).length;
    const counts: [string, number][] = [];
    for (const c of [...new Set(CITIES)]) {
      const n = j.stories.filter(s => {
        const blob = [s.title ?? "", s.synopsis ?? "", s.text ?? ""].join("\n");
        return new RegExp(`(^|[^\\p{L}])${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u").test(blob);
      }).length;
      if (n > 0) counts.push([c, n]);
    }
    counts.sort((a, b) => b[1] - a[1]);
    console.log(`\n${j.status.toUpperCase()} | ${j.name} ${j.language}/${j.variant} ${j.levels.join(",")} | ${j.id} | escritas ${written}/${j.stories.length}`);
    console.log("  " + (counts.map(([c, n]) => `${c}:${n}`).join("  ") || "(ninguna ciudad de la lista)"));
    console.log("  temas: " + j.topics.join(", "));
  }
  await p.$disconnect();
})();
