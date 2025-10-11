'use client';

import { useEffect, useState } from 'react';
import { getStoriesReadCount, addStoryToHistory } from '@/utils/readingLimits';

type UserPlan = 'free' | 'basic' | 'premium' | 'polyglot' | 'owner';

export default function StoryAccessInfo({
  storyId,
  userPlan,
}: {
  storyId: string;
  userPlan: UserPlan;
}) {
  const [storiesLeft, setStoriesLeft] = useState<number | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => {
    if (userPlan !== 'free' && userPlan !== 'basic') return;

    const count = getStoriesReadCount(userPlan);
    const limit = userPlan === 'free' ? 10 : 1;
    const reached = count >= limit;
    setLimitReached(reached);
    setStoriesLeft(Math.max(0, limit - count));

    if (!reached) addStoryToHistory(storyId);
  }, [storyId, userPlan]);

  if (userPlan !== 'free' && userPlan !== 'basic') return null;

  const baseText =
    userPlan === 'free'
      ? `Te quedan ${storiesLeft ?? 0} de 10 historias gratuitas.`
      : `Te queda ${storiesLeft ?? 0} historia disponible hoy.`;

  return (
    <div
      className={`text-sm mb-4 ${
        limitReached ? 'text-red-400 font-semibold' : 'text-gray-400'
      }`}
    >
      <p>{baseText}</p>

      {/* 🕐 Mostrar mensaje adicional solo si es BASIC y ya llegó al límite */}
      {userPlan === 'basic' && limitReached && (
        <p className="text-xs text-gray-500 mt-1 italic">
          Vuelve mañana para desbloquear una nueva historia.
        </p>
      )}
    </div>
  );
}
