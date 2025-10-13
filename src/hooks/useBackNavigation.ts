'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function useBackNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handlePopState = () => {
      const mainSections = ['/', '/explore', '/favorites', '/my-library', '/settings'];
      if (mainSections.includes(pathname)) {
        if (pathname === '/') {
          // Solo posible si es PWA o WebView (no funciona en navegador normal)
          if (window.navigator.userAgent.includes('wv') || window.matchMedia('(display-mode: standalone)').matches) {
            window.close();
          } else {
            console.log('🏠 Already at home.');
          }
        } else {
          router.push('/');
        }
      } else {
        router.back();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [pathname, router]);
}
