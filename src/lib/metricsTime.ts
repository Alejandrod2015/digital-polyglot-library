/**
 * Huso horario de los informes.
 *
 * Las cifras que hablan de "hoy" tienen que cuadrar con el día de quien las
 * mira. El panel las contaba en UTC (y el DAU, en una ventana móvil de 24 h),
 * así que la columna de hoy empezaba a las 02:00 y el DAU bajaba solo, sin que
 * pasara ninguna medianoche, cuando a alguien se le cumplían las 24 h desde su
 * último evento.
 *
 * Aquí vive el único huso del panel. La retención NO usa esto a propósito:
 * cuenta días desde el alta de cada persona, no fechas de calendario, y ahí
 * dos horas no mueven nada.
 */
export const METRICS_TZ = "Europe/Madrid";

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: METRICS_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** La fecha local de ese instante, en ISO corto (en-CA ya da YYYY-MM-DD). */
export function localDayKey(date: Date): string {
  return dayKeyFormat.format(date);
}

/**
 * Cuánto se desvía el huso del UTC en ese instante, en milisegundos. Se mide
 * formateando el instante en el huso y volviéndolo a leer como si fuera UTC,
 * que es la forma de preguntarle a `Intl` por el desfase sin tablas propias.
 */
function tzOffsetMs(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: METRICS_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

/** El instante en que empezó el día local que contiene a `date`. */
export function startOfLocalDay(date: Date): Date {
  const [y, m, d] = localDayKey(date).split("-").map(Number);
  // Medianoche local leída como UTC; el desfase la lleva al instante real.
  const asUtc = Date.UTC(y, m - 1, d, 0, 0, 0);
  return new Date(asUtc - tzOffsetMs(new Date(asUtc)));
}

/**
 * El instante en que empezó el día local de hace `days` días. Con days=6 sale
 * el arranque de una ventana de 7 días de calendario contando hoy.
 */
export function startOfLocalDaysAgo(date: Date, days: number): Date {
  const start = startOfLocalDay(date);
  // Se resta sobre el mediodía del día objetivo para que un cambio de hora no
  // deje la resta a las 23:00 del día anterior.
  const mediodia = new Date(start.getTime() - days * 86400000 + 12 * 3600000);
  return startOfLocalDay(mediodia);
}
