// /src/sanity/actions/updateStoryOfTheWeek.ts
import { writeClient, client } from "@/sanity/lib/client";

/**
 * Actualiza automáticamente la historia semanal o diaria,
 * eligiendo una historia nueva entre las publicadas y
 * evitando repetir hasta agotar todas.
 *
 * Si hay una historia manual, se respeta solo durante el mismo
 * período (día o semana). Al cambiar el período, el sistema
 * vuelve a seleccionar automáticamente.
 */
export async function updateStoryOfTheWeek(
  tz: string = "UTC",
  period: "week" | "day" = "week"
) {
  const now = new Date();
  const local = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const periodKey =
    period === "week"
      ? getISOWeekKey(local, tz)
      : local.toISOString().slice(0, 10);

  // 🧠 Leer documento único sin cache
  const scheduler = await writeClient.fetch<{
    _id: string;
    currentWeeklyStory?: { _id: string } | null;
    nextWeeklyStory?: { _id: string } | null;
    currentDailyStory?: { _id: string } | null;
    nextDailyStory?: { _id: string } | null;
    usedWeeklyStories?: string[];
    usedDailyStories?: string[];
    autoSelectWeekly?: boolean;
    autoSelectDaily?: boolean;
    weeklyUpdatedAt?: string;
    dailyUpdatedAt?: string;
  } | null>(`*[_type == "storyScheduler"][0]{
    _id,
    currentWeeklyStory->{_id},
    nextWeeklyStory->{_id},
    currentDailyStory->{_id},
    nextDailyStory->{_id},
    usedWeeklyStories,
    usedDailyStories,
    autoSelectWeekly,
    autoSelectDaily,
    weeklyUpdatedAt,
    dailyUpdatedAt
  }`);

  if (!scheduler?._id) {
    console.warn("⚠️ No existe storyScheduler en Sanity.");
    return null;
  }

  const isWeekly = period === "week";
  const autoSelect = isWeekly
    ? scheduler.autoSelectWeekly
    : scheduler.autoSelectDaily;

  const currentField = isWeekly ? "currentWeeklyStory" : "currentDailyStory";
  const nextField = isWeekly ? "nextWeeklyStory" : "nextDailyStory";
  const usedField = isWeekly ? "usedWeeklyStories" : "usedDailyStories";
  const updatedAtField = isWeekly ? "weeklyUpdatedAt" : "dailyUpdatedAt";

  // ✅ Si hay historia manual actual, respetarla solo durante el mismo período
  if (scheduler[currentField]?.["_id"]) {
  const lastUpdate = scheduler[updatedAtField];
  let samePeriod = false;

  if (lastUpdate) {
    const last = new Date(lastUpdate);
    samePeriod =
      period === "week"
        ? getISOWeekKey(last, tz) === getISOWeekKey(local, tz)
        : last.toISOString().slice(0, 10) === local.toISOString().slice(0, 10);
  }

  if (samePeriod) {
    console.log(
      `ℹ️ ${period}ly story already set manually — still valid for this period.`
    );
    // ⚠️ No retornamos: continuamos para asegurar que "next" exista.
  } else {
    console.log(`🔁 ${period}ly story expired — selecting new automatically.`);
  }
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

  // 🧾 Actualizar historia actual
  await writeClient
    .patch(scheduler._id)
    .set({
      [currentField]: { _type: "reference", _ref: pick },
      [usedField]: newUsed,
      [updatedAtField]: new Date().toISOString(),
    })
    .commit({ autoGenerateArrayKeys: true });

  // 🔁 Releer documento actualizado (sin cache) para asegurar estado fresco
  const updated = await writeClient.fetch(
    `*[_id == $id][0]{ ${nextField}->{_id} }`,
    { id: scheduler._id }
  );

  const nextValue = updated?.[nextField];
  const isEmptyNext =
    !nextValue || (typeof nextValue === "object" && !("_id" in nextValue));

  // 🧩 Generar siguiente historia automáticamente si falta
  if (isEmptyNext) {
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
      .commit({ autoGenerateArrayKeys: true });

    console.log(`🔮 Nueva ${period}ly next story generada automáticamente.`);
  }

  console.log(
    `✅ ${isWeekly ? "Story of the Week" : "Story of the Day"} actualizada (${periodKey})`
  );
  return { _id: pick, period, periodKey };
}

/**
 * Devuelve la clave ISO (año + número de semana) según zona horaria
 */
function getISOWeekKey(date: Date, tz: string) {
  const local = new Date(date.toLocaleString("en-US", { timeZone: tz }));
  const firstJan = new Date(local.getFullYear(), 0, 1);
  const days = Math.floor(
    (local.getTime() - firstJan.getTime()) / (24 * 60 * 60 * 1000)
  );
  const week = Math.ceil((local.getDay() + 1 + days) / 7);
  return `${local.getFullYear()}-W${week}`;
}
