'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

export default function PlansPage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (priceId: string) => {
    // 🔒 Si el usuario no está logueado, redirigir al login de Clerk con retorno a /plans
    if (isLoaded && !isSignedIn) {
      router.push(`/sign-in?redirect_url=/plans`);
      return;
    }

    try {
      setLoading(priceId);

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Error creating checkout session');
      }
    } catch (err) {
      console.error(err);
      alert('Unexpected error');
    } finally {
      setLoading(null);
    }
  };

  // ⏳ Esperar a que Clerk cargue el estado de sesión
  if (!isLoaded) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-950 text-white">
      <h1 className="text-3xl font-bold">Choose your plan</h1>

      <div className="flex flex-col gap-4">
        <button
          onClick={() => handleSubscribe('price_1SI5WW6ytrKVzptQW7CBTx2G')}
          disabled={loading === 'price_1SI5WW6ytrKVzptQW7CBTx2G'}
          className="px-6 py-3 bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60"
        >
          Subscribe to Premium (€14.99/mo)
        </button>

        <button
          onClick={() => handleSubscribe('price_1SI5Wv6ytrKVzptQkzfg7emI')}
          disabled={loading === 'price_1SI5Wv6ytrKVzptQkzfg7emI'}
          className="px-6 py-3 bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-60"
        >
          Subscribe to Polyglot (€24.99/mo)
        </button>
      </div>
    </div>
  );
}
