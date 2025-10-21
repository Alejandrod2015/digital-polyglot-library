'use client';

import { useEffect, useState } from 'react';
import { getStoriesReadCount, getStoriesLimit } from '@/utils/readingLimits';

type Props = {
  plan: 'free' | 'basic' | 'premium' | 'polyglot' | 'owner';
  children: React.ReactNode;
  fallback: React.ReactNode;
  /** Cuando es historia destacada (día/semana) o promocional, forzamos acceso */
  forceAllow?: boolean;
};

export default function StoryClientGate({
  plan,
  children,
  fallback,
  forceAllow = false,
}: Props) {
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    if (forceAllow) {
      setAllowed(true);
      return;
    }
    if (plan === 'free' || plan === 'basic') {
      const count = getStoriesReadCount(plan);
      const limit = getStoriesLimit(plan);
      setAllowed(count < limit);
    } else {
      setAllowed(true);
    }
  }, [plan, forceAllow]);

  // ✅ Si el usuario no tiene acceso completo, mostramos el contenido parcial
  // pero también el fallback superpuesto (no lo reemplazamos)
  return (
    <>
      {children}
      {!allowed && !forceAllow && fallback}
    </>
  );
}
