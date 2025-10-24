'use client';

import { useUser } from '@clerk/nextjs';
import { useMemo } from 'react';
import { getOwnedBooks, canReadWholeBook, canAccessFeaturedStory, Plan } from '@/lib/access';

/**
 * Hook que devuelve el acceso del usuario: lectura completa y featured stories.
 */
export function useAccess(bookSlug: string) {
  const { user } = useUser();

  return useMemo(() => {
    if (!user) {
      return {
        canRead: false,
        canAccessDay: false,
        canAccessWeek: true,
        ownedBooks: [] as string[],
        plan: "free" as Plan,
      };
    }

    const ownedBooks = getOwnedBooks(user.publicMetadata);
    const plan =
      (user.publicMetadata?.plan as Plan) ?? "free";

    return {
      canRead: canReadWholeBook({ plan, ownedBooks, bookSlug }),
      canAccessDay: canAccessFeaturedStory({ plan, kind: "day" }),
      canAccessWeek: canAccessFeaturedStory({ plan, kind: "week" }),
      ownedBooks,
      plan,
    };
  }, [user, bookSlug]);
}

export default {};
