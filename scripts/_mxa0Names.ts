import { PrismaClient } from '../src/generated/prisma';
const p = new PrismaClient();
const STOP = new Set(['El','La','Los','Las','Un','Una','En','Y','Pero','Que','Cuando','Hoy','Ahora','Después','Luego','Al','A','De','Del','Por','Para','Con','Sin','Su','Sus','Mi','Es','Está','No','Sí','Ella','Él','Ellos','Todo','Todos','Nadie','Alguien','Esa','Ese','Esta','Este','Aquí','Allí','Ya','También','Más','Muy','Entonces','Así','Mientras','Antes','Nunca','Siempre','Otra','Otro','Dos','Tres','Gracias','Hola','Buenos','Buenas','Claro','Bueno','Vale','Ah','Ay','Oye','Mira','Hay','Se','Le','Lo','Como','Qué','Quién','Dónde','Cómo','Cuánto','Nos','Me','Te','Va','Van','Voy','Tiene','Tienen','Dice','Sabe','Hace','Quiere','Puede','Desde','Sobre','Aunque','Porque','Tal','Cada','Nada','Ni','O','Sus','Uno','Una','Primero','Ella','Nosotros','Ustedes','Señora','Señor','Doña','Don','Casi','Solo','Sólo','Algo','Ok','Pues','Bien','Hasta','Durante','Según','Cerca','Fue','Era','Están','Estoy','Somos','Semana','Santa','Año','Día','Batalla','Flores','Inti','Raymi','Viejo','Nuevo','Navidad','México','España','Chile','Colombia','Argentina','Perú','Brasil']);
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journey: { language: 'spanish', status: { not: 'archived' } }, text: { not: null } },
    select: { text: true, journey: { select: { name:true, variant:true, levels:true } } },
  });
  const byJ: Record<string, Map<string,number>> = {};
  for (const r of rows) {
    const k = `${r.journey?.name}/${r.journey?.variant}/${(r.journey?.levels??[]).join(',')}`;
    byJ[k] ??= new Map();
    const t = String(r.text);
    for (const m of t.matchAll(/(?<![.!?¿¡“"]\s)(?<!^)\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})\b/gm)) {
      const w = m[1]; if (STOP.has(w)) continue;
      byJ[k].set(w, (byJ[k].get(w) ?? 0) + 1);
    }
  }
  for (const [k,v] of Object.entries(byJ)) {
    const top = [...v.entries()].filter(([,n])=>n>=4).sort((a,b)=>b[1]-a[1]).slice(0,22);
    console.log(`\n${k}\n  ${top.map(([w,n])=>`${w}(${n})`).join(', ')}`);
  }
  await p.$disconnect();
})();
