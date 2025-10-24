// /src/utils/readingLimits.ts
type UserPlan = 'free' | 'basic' | 'premium' | 'polyglot';
type StoryProgress = {
  storyId: string;
  date: string; // ISO
};

const STORAGE_KEY = 'dp_reading_history_v1';
const BONUS_KEY = 'dp_basic_bonus_v1';

export function getReadingHistory(): StoryProgress[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReadingHistory(history: StoryProgress[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function addStoryToHistory(storyId: string) {
  const history = getReadingHistory();
  if (!history.some((s) => s.storyId === storyId)) {
    history.push({ storyId, date: new Date().toISOString() });
    saveReadingHistory(history);
  }
}

export function clearReadingHistory() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

// 🎁 Bono inicial para usuarios BASIC
export function hasBonusStories(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(BONUS_KEY) === '1';
}

export function grantBonusStories() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BONUS_KEY, '1');
}

export function clearBonusStories() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(BONUS_KEY);
}

/* ========================================================================
   🔒 SISTEMA DE LÍMITES DE LECTURA (CONGELADO TEMPORALMENTE)
   - Mantenemos el código comentado por si se reactiva en el futuro.
   - Las funciones activas a continuación ignoran límites, pero preservan historial.
   ======================================================================== */

// 📊 Versión activa (sin límites reales)
export function getStoriesReadCount(plan: UserPlan): number {
  const history = getReadingHistory();
  return history.length; // solo informativo
}

export function getStoriesLimit(plan: UserPlan): number {
  return Infinity; // sin límites activos
}

/* 
// 📊 Versión original (guardar para reactivación futura)
export function getStoriesReadCount(plan: UserPlan): number {
  const history = getReadingHistory();
  if (plan === 'basic') {
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = history.filter((s) => s.date.startsWith(today)).length;
    const totalCount = history.length;
    const bonus = hasBonusStories() ? 10 : 0;
    if (totalCount < bonus) {
      return totalCount;
    }
    return todayCount;
  }
  if (plan === 'free') {
    return history.length;
  }
  return 0;
}

export function getStoriesLimit(plan: UserPlan): number {
  if (plan === 'basic') {
    const bonus = hasBonusStories() ? 10 : 0;
    const history = getReadingHistory();
    return history.length < bonus ? bonus : 1;
  }
  if (plan === 'free') return 10;
  return Infinity;
}
*/
