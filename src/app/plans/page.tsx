'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Plan } from '@/lib/access';

function PlansInner() {
  const { isSignedIn, isLoaded, user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const chargeDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  }, []);

  const plan: Plan =
    (user?.publicMetadata?.plan as Plan | undefined) ?? 'free';

  const trackMetric = async (eventType: string, value?: number) => {
    if (!isSignedIn) return;
    try {
      await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          storySlug: '__plans__',
          bookSlug: 'billing',
          eventType,
          value,
        }),
      });
    } catch {
      // noop
    }
  };

  // 1) Si ya es premium/polyglot/owner → HOME
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return;

    if (plan === 'premium' || plan === 'polyglot' || plan === 'owner') {
      router.replace('/');
    }
  }, [isLoaded, isSignedIn, plan, router]);

  // 2) Checkout real (POST)
  const goToCheckout = async (priceId: string) => {
    try {
      setLoading(priceId);
      await trackMetric('checkout_started');

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });

      const data: unknown = await res.json();

      if (
        typeof data === 'object' &&
        data !== null &&
        'url' in data &&
        typeof (data as { url?: unknown }).url === 'string' &&
        (data as { url: string }).url.length > 0
      ) {
        await trackMetric('checkout_redirected');
        window.location.href = (data as { url: string }).url;
        return;
      }

      const errorMsg =
        typeof data === 'object' &&
        data !== null &&
        'error' in data &&
        typeof (data as { error?: unknown }).error === 'string'
          ? (data as { error: string }).error
          : 'Error creating checkout session';

      await trackMetric('checkout_failed');
      alert(errorMsg);
    } catch (err) {
      console.error(err);
      await trackMetric('checkout_failed');
      alert('Unexpected error');
    } finally {
      setLoading(null);
    }
  };

  // 3) Click en plan
  const handleSubscribe = (priceId: string) => {
    if (!isLoaded) return;

    // No logueado → sign-in con redirect URL ENCODEADA
    if (!isSignedIn) {
      const target = `/plans?priceId=${priceId}&autoCheckout=1`;
      const redirectUrl = `/sign-in?redirect_url=${encodeURIComponent(
        target
      )}`;
      router.push(redirectUrl);
      return;
    }

    // Logueado (free/basic) → checkout directo
    void goToCheckout(priceId);
  };

  // 4) Volvió del sign-in → auto checkout
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return;
    void trackMetric('plans_viewed');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return;

    const auto = searchParams.get('autoCheckout');
    const priceId = searchParams.get('priceId');

    if (auto === '1' && priceId) {
      void goToCheckout(priceId);
    }
  }, [isLoaded, isSignedIn, searchParams]);

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 via-gray-950 to-black text-white px-6 py-16">
      <h1 className="text-4xl font-extrabold mb-12 text-center bg-gradient-to-r from-indigo-400 to-white bg-clip-text text-transparent">
        Choose your plan
      </h1>
      <p className="mb-8 max-w-2xl text-center text-sm text-indigo-100/90">
        Start a 14-day Premium trial with payment method. You will be charged on{' '}
        <span className="font-semibold text-white">{chargeDate}</span> unless you cancel before then.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-6xl w-full">
        {/* BASIC */}
        <div className="relative bg-gray-900 border border-gray-700/40 rounded-3xl p-8 text-center shadow-lg hover:shadow-gray-700/30 transition-all duration-300">
          <h2 className="text-2xl font-bold text-gray-200 mb-3">Basic</h2>
          <p className="text-4xl font-extrabold mb-2">€0</p>
          <p className="text-gray-400 text-sm mb-8">
            Enjoy one story per day and access weekly highlights.
          </p>

          {isSignedIn ? (
            <button
              disabled
              className="w-full py-3 rounded-xl bg-gray-800 font-semibold text-gray-400 cursor-default"
            >
              Current Plan
            </button>
          ) : (
            <button
              onClick={() => router.push('/sign-up')}
              className="w-full py-3 rounded-xl bg-gray-700 font-semibold hover:bg-gray-800 transition"
            >
              Join for Free
            </button>
          )}
        </div>

        {/* PREMIUM MONTHLY */}
        <div className="relative bg-gray-900 border border-indigo-700/40 rounded-3xl p-8 text-center shadow-lg hover:shadow-indigo-700/30 transition-all duration-300">
          <h2 className="text-2xl font-bold text-indigo-300 mb-3">
            Premium Monthly
          </h2>
          <p className="text-4xl font-extrabold mb-2">
            €14.99<span className="text-lg font-medium">/mo</span>
          </p>
          <p className="text-gray-400 text-sm mb-8">
            14-day free trial, then €14.99/month. Full access to stories, audio, and recommendations.
          </p>

          <button
            onClick={() =>
              handleSubscribe('price_1SbP7r6ytrKVzptQaTBIuAaZ')
            }
            disabled={loading === 'price_1SbP7r6ytrKVzptQaTBIuAaZ'}
            className="w-full py-3 rounded-xl bg-indigo-600 font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
          >
            {loading === 'price_1SbP7r6ytrKVzptQaTBIuAaZ'
              ? 'Processing...'
              : 'Start 14-day trial'}
          </button>
        </div>

        {/* PREMIUM YEARLY */}
        <div className="relative bg-gray-900 border border-indigo-500/40 rounded-3xl p-8 text-center shadow-lg hover:shadow-indigo-500/30 transition-all duration-300">
          <div className="absolute -top-4 right-4 bg-indigo-500 text-black text-xs font-bold px-3 py-1 rounded-full">
            Best Value
          </div>
          <h2 className="text-2xl font-bold text-indigo-200 mb-3">
            Premium Annual
          </h2>
          <p className="text-4xl font-extrabold mb-2">
            €149<span className="text-lg font-medium">/yr</span>
          </p>
          <p className="text-gray-400 text-sm mb-8">
            14-day free trial, then €149/year. Full access and best annual value.
          </p>

          <button
            onClick={() =>
              handleSubscribe('price_1SbP9H6ytrKVzptQQTz9v1hd')
            }
            disabled={loading === 'price_1SbP9H6ytrKVzptQQTz9v1hd'}
            className="w-full py-3 rounded-xl bg-indigo-500 font-semibold hover:bg-indigo-600 transition disabled:opacity-60"
          >
            {loading === 'price_1SbP9H6ytrKVzptQQTz9v1hd'
              ? 'Processing...'
              : 'Start 14-day trial'}
          </button>
        </div>
      </div>

      <p className="mt-10 text-gray-500 text-sm text-center">
        Payment method required for trial. Cancel anytime before {chargeDate} to avoid charges.
      </p>
    </div>
  );
}

export default function PlansPage() {
  return (
    <Suspense fallback={null}>
      <PlansInner />
    </Suspense>
  );
}
