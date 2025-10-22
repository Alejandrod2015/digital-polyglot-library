// DESPUÉS
'use client';

import { useEffect, useState } from 'react';
import { getStoriesReadCount, getStoriesLimit } from '@/utils/readingLimits';

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
    const limit = getStoriesLimit(userPlan);
    const reached = count >= limit;

    setLimitReached(reached);
    setStoriesLeft(Math.max(0, limit - count));
  }, [storyId, userPlan]);

  if (userPlan !== 'free' && userPlan !== 'basic') return null;

  const baseText =
    userPlan === 'free'
      ? `You have ${storiesLeft ?? 0} of 10 free stories left.`
      : `You have ${storiesLeft ?? 0} stories available today.`;

  return (
    <div
      className={`text-sm mb-4 ${
        limitReached ? 'text-red-400 font-semibold' : 'text-gray-400'
      }`}
    >
      <p>{baseText}</p>

      {userPlan === 'basic' && limitReached && (
        <p className="text-xs text-gray-500 mt-1 italic">
          Come back tomorrow to unlock a new story.
        </p>
      )}
    </div>
  );
}
