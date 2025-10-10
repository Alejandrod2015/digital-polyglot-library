'use client';

import { useUser } from '@clerk/nextjs';
import { useMemo } from 'react';
import { getOwnedBooks, canReadWholeBook } from '@/lib/access';

/**
 * Hook que devuelve si el usuario puede acceder a un libro completo.
 * Sirve tanto para ocultar botones como para permitir leer todas las historias.
 */
export function useAccess(bookSlug: string) {
  const { user } = useUser();

  return useMemo(() => {
    if (!user) return { canRead: false, ownedBooks: [] as string[] };

    const ownedBooks = getOwnedBooks(user.publicMetadata);
    const plan =
      (user.publicMetadata?.plan as 'basic' | 'premium' | undefined) ?? undefined;

    return {
      canRead: canReadWholeBook({ plan, ownedBooks, bookSlug }),
      ownedBooks,
    };
  }, [user, bookSlug]);
}
export default {};
