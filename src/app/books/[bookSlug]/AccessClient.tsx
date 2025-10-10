'use client';

import { ReactNode } from 'react';
import { useAccess } from '@/hooks/useAccess';

interface Props {
  bookSlug: string;
  children: ReactNode;
}

export default function AccessClient({ bookSlug, children }: Props) {
  const { canRead } = useAccess(bookSlug);

  if (!canRead) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center text-gray-400">
        <h2 className="text-2xl font-semibold mb-4">🔒 Acceso restringido</h2>
        <p className="max-w-md">
          Este libro está disponible solo para usuarios que lo hayan comprado o tengan plan Premium.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
