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
        <h2 className="text-2xl font-semibold mb-4">Restricted Access</h2>
        <p className="max-w-md">
          This book is available only for users who have purchased it or have a Premium plan.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
