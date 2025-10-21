// /src/sanity/actions/updateStoryOfTheWeek.ts
import { writeClient, client } from "@/sanity/lib/client";

/**
 * Actualiza automáticamente la historia semanal o diaria,
 * eligiendo una historia nueva entre las publicadas y
 * evitando repetir hasta agotar todas.
 *
 * @param tz Zona horaria del usuario (por defecto UTC)
 * @param period "week" | "day"
 */
export async function updateStoryOfTheWeek(
  tz: string = "UTC",
  period: "week" | "day" = "week"
) {
  // 🕐 Calcular la clave de periodo (semana o día)
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));

  const periodKey =
    period === "week"
      ? `${local.getFullYear()}-W${Math.ceil(
          (local.getDate() - local.getDay() + 1) / 7
        )}`
      : local.toISOString().slice(0, 10);

  // 🧠 Leer documento único de configuración
  const scheduler = await client.fetch<{
    _id: string;
    currentWeeklyStory?: { _id: string } | null;
    nextWeeklyStory?: { _id: string } | null;
    currentDailyStory?: { _id: string } | null;
    nextDailyStory?: { _id: string } | null;
    usedWeeklyStories?: string[];
    usedDailyStories?: string[];
    autoSelectWeekly?: boolean;
    autoSelectDaily?: boolean;
  } | null>(`*[_type == "storyScheduler"][0]{
      _id,
      currentWeeklyStory->{_id},
      nextWeeklyStory->{_id},
      currentDailyStory->{_id},
      nextDailyStory->{_id},
      usedWeeklyStories,
      usedDailyStories,
      autoSelectWeekly,
      autoSelectDaily
    }`);

  if (!scheduler?._id) {
    console.warn("⚠️ No existe storyScheduler en Sanity.");
    return null;
  }

  // 🔍 Determinar si es modo semanal o diario
  const isWeekly = period === "week";
  const autoSelect = isWeekly
    ? scheduler.autoSelectWeekly
    : scheduler.autoSelectDaily;

  const currentField = isWeekly
    ? "currentWeeklyStory"
    : "currentDailyStory";
  const nextField = isWeekly
    ? "nextWeeklyStory"
    : "nextDailyStory";
  const usedField = isWeekly
    ? "usedWeeklyStories"
    : "usedDailyStories";
  const updatedAtField = isWeekly
    ? "weeklyUpdatedAt"
    : "dailyUpdatedAt";

  // ✅ Si hay historia manual actual → respetarla
  if (scheduler[currentField]?.["_id"]) {
    console.log(`ℹ️ ${period}ly story already set manually — skipping auto.`);
    return scheduler[currentField];
  }

  // ❌ Si el modo automático está desactivado → no hacer nada
  if (!autoSelect) {
    console.log(`ℹ️ Auto-select for ${period} is disabled.`);
    return scheduler[currentField] || null;
  }

  // 🧩 Obtener todas las historias publicadas
  const allStories = await client.fetch<{ _id: string }[]>(
    `*[_type == "story" && published == true]{ _id }`
  );

  if (!allStories.length) {
    console.warn("⚠️ No hay historias publicadas para seleccionar.");
    return null;
  }

  // 🧠 Evitar repetir hasta agotar todas
  const used = new Set(scheduler[usedField] ?? []);
  const pool = allStories.filter((s) => !used.has(s._id));
  const available = pool.length > 0 ? pool : allStories;

  const pick = available[Math.floor(Math.random() * available.length)]._id;
  const newUsed = pool.length > 0 ? [...used, pick] : [pick];

  // 🧾 Actualizar el documento en Sanity
  await writeClient
    .patch(scheduler._id)
    .set({
      [currentField]: { _type: "reference", _ref: pick },
      [usedField]: newUsed,
      [updatedAtField]: new Date().toISOString(),
    })
    .commit({ autoGenerateArrayKeys: true });

  // 🔁 Si no existe “next” → preparar una siguiente aleatoria
  if (!scheduler[nextField]) {
    const remaining = available.filter((s) => s._id !== pick);
    const nextPick =
      remaining.length > 0
        ? remaining[Math.floor(Math.random() * remaining.length)]._id
        : pick;

    await writeClient
      .patch(scheduler._id)
      .set({
        [nextField]: { _type: "reference", _ref: nextPick },
      })
      .commit();
  }

  console.log(
    `✅ ${isWeekly ? "Story of the Week" : "Story of the Day"} actualizada (${periodKey})`
  );

  return { _id: pick, period, periodKey };
}
