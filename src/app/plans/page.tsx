'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Plan } from '@/lib/access';
import {
  GOOGLE_PLAY_PREMIUM_ANNUAL_PRODUCT_ID,
  GOOGLE_PLAY_PREMIUM_MONTHLY_PRODUCT_ID,
  STRIPE_PREMIUM_ANNUAL_PRICE_ID,
  STRIPE_PREMIUM_MONTHLY_PRICE_ID,
} from '@/lib/billingCatalog';

const LEGAL_ACCEPTANCE_KEY = 'dp_checkout_legal_acceptance_v1';
const PLAY_BILLING_STORE = 'https://play.google.com/billing';

type BillingMode = 'loading' | 'stripe' | 'google_play';
type PlayPriceMap = Record<string, string>;
type PaymentResponseDetails = {
  purchaseToken?: string;
  token?: string;
};

function PlansInner() {
  const { isSignedIn, isLoaded, user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [billingMode, setBillingMode] = useState<BillingMode>('loading');
  const [billingNotice, setBillingNotice] = useState('');
  const [playService, setPlayService] = useState<DigitalGoodsService | null>(null);
  const [playPrices, setPlayPrices] = useState<PlayPriceMap>({});
  const chargeDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  }, []);

  const plan: Plan = (user?.publicMetadata?.plan as Plan | undefined) ?? 'free';

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
          metadata: { billingMode },
        }),
      });
    } catch {
      // noop
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setLegalAccepted(window.localStorage.getItem(LEGAL_ACCEPTANCE_KEY) === '1');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (legalAccepted) {
      window.localStorage.setItem(LEGAL_ACCEPTANCE_KEY, '1');
    } else {
      window.localStorage.removeItem(LEGAL_ACCEPTANCE_KEY);
    }
  }, [legalAccepted]);

  useEffect(() => {
    let cancelled = false;

    const initBillingMode = async () => {
      if (typeof window === 'undefined' || !window.getDigitalGoodsService) {
        if (!cancelled) setBillingMode('stripe');
        return;
      }

      try {
        const service = await window.getDigitalGoodsService(PLAY_BILLING_STORE);
        const details = await service.getDetails([
          GOOGLE_PLAY_PREMIUM_MONTHLY_PRODUCT_ID,
          GOOGLE_PLAY_PREMIUM_ANNUAL_PRODUCT_ID,
        ]);

        if (cancelled) return;

        const nextPrices: PlayPriceMap = {};
        for (const item of details) {
          if (item.price?.currency && item.price.value) {
            nextPrices[item.itemId] = new Intl.NumberFormat(navigator.language, {
              style: 'currency',
              currency: item.price.currency,
            }).format(Number(item.price.value));
          }
        }

        setPlayService(service);
        setPlayPrices(nextPrices);
        setBillingMode('google_play');
      } catch (error) {
        if (cancelled) return;
        console.warn('Google Play Billing unavailable in this context.', error);
        setBillingMode('stripe');
      }
    };

    void initBillingMode();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return;

    if (plan === 'premium' || plan === 'polyglot' || plan === 'owner') {
      router.replace('/');
    }
  }, [isLoaded, isSignedIn, plan, router]);

  const goToStripeCheckout = async (priceId: string) => {
    try {
      setLoading(priceId);
      setBillingNotice('');
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
      setBillingNotice(errorMsg);
    } catch (err) {
      console.error(err);
      await trackMetric('checkout_failed');
      setBillingNotice('Unexpected Stripe checkout error.');
    } finally {
      setLoading(null);
    }
  };

  const verifyGooglePlayPurchase = async (purchaseToken: string) => {
    const res = await fetch('/api/billing/google-play/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ purchaseToken }),
    });

    const data = (await res.json()) as { error?: string; hasEntitlement?: boolean };
    if (!res.ok) {
      throw new Error(data.error || 'Could not verify Google Play purchase.');
    }

    return data;
  };

  useEffect(() => {
    if (!playService || !isSignedIn) return;

    let cancelled = false;

    const syncPurchases = async () => {
      try {
        const purchases = await playService.listPurchases();
        if (cancelled || purchases.length === 0) return;

        for (const purchase of purchases) {
          await verifyGooglePlayPurchase(purchase.purchaseToken);
        }
      } catch (error) {
        console.warn('Could not sync Google Play purchases.', error);
      }
    };

    void syncPurchases();

    return () => {
      cancelled = true;
    };
  }, [playService, isSignedIn]);

  const goToGooglePlayCheckout = async (productId: string) => {
    if (!playService) {
      setBillingNotice('Google Play Billing is not available right now.');
      return;
    }

    try {
      setLoading(productId);
      setBillingNotice('');
      await trackMetric('checkout_started');

      const request = new PaymentRequest(
        [
          {
            supportedMethods: PLAY_BILLING_STORE,
            data: { sku: productId },
          } as PaymentMethodData,
        ],
        {
          total: {
            label: 'Total',
            amount: { currency: 'USD', value: '0' },
          },
        }
      );

      const paymentResponse = await request.show();
      const details = paymentResponse.details as PaymentResponseDetails;
      const purchaseToken = details.purchaseToken ?? details.token;

      if (!purchaseToken) {
        await paymentResponse.complete('fail');
        throw new Error('Google Play did not return a purchase token.');
      }

      await verifyGooglePlayPurchase(purchaseToken);
      await paymentResponse.complete('success');

      if (playService.acknowledge && details.token) {
        try {
          await playService.acknowledge(details.token, 'onetime');
        } catch (ackError) {
          console.warn('Purchase acknowledgement was skipped.', ackError);
        }
      }

      await trackMetric('checkout_redirected');
      router.replace('/');
    } catch (error) {
      console.error(error);
      await trackMetric('checkout_failed');

      if (error instanceof DOMException && error.name === 'AbortError') {
        setBillingNotice('Purchase was canceled.');
      } else {
        setBillingNotice(
          error instanceof Error
            ? error.message
            : 'Unexpected Google Play Billing error.'
        );
      }
    } finally {
      setLoading(null);
    }
  };

  const handleSubscribe = (billingId: string) => {
    if (!isLoaded) return;
    if (!legalAccepted) {
      setBillingNotice('Please confirm the legal terms before continuing.');
      return;
    }

    if (!isSignedIn) {
      const target =
        billingMode === 'google_play'
          ? `/plans?productId=${billingId}&autoCheckout=1`
          : `/plans?priceId=${billingId}&autoCheckout=1`;
      const redirectUrl = `/sign-in?redirect_url=${encodeURIComponent(target)}`;
      router.push(redirectUrl);
      return;
    }

    if (billingMode === 'google_play') {
      void goToGooglePlayCheckout(billingId);
      return;
    }

    void goToStripeCheckout(billingId);
  };

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return;
    void trackMetric('plans_viewed');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !legalAccepted) return;

    const auto = searchParams.get('autoCheckout');
    if (auto !== '1') return;

    if (billingMode === 'google_play') {
      const productId = searchParams.get('productId');
      if (productId) {
        void goToGooglePlayCheckout(productId);
      }
      return;
    }

    if (billingMode === 'stripe') {
      const priceId = searchParams.get('priceId');
      if (priceId) {
        void goToStripeCheckout(priceId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingMode, isLoaded, isSignedIn, legalAccepted, searchParams]);

  if (!isLoaded || billingMode === 'loading') return null;

  const monthlyBillingId =
    billingMode === 'google_play'
      ? GOOGLE_PLAY_PREMIUM_MONTHLY_PRODUCT_ID
      : STRIPE_PREMIUM_MONTHLY_PRICE_ID;
  const annualBillingId =
    billingMode === 'google_play'
      ? GOOGLE_PLAY_PREMIUM_ANNUAL_PRODUCT_ID
      : STRIPE_PREMIUM_ANNUAL_PRICE_ID;
  const monthlyPriceLabel =
    billingMode === 'google_play'
      ? playPrices[GOOGLE_PLAY_PREMIUM_MONTHLY_PRODUCT_ID] ?? 'Google Play price'
      : '€14.99';
  const annualPriceLabel =
    billingMode === 'google_play'
      ? playPrices[GOOGLE_PLAY_PREMIUM_ANNUAL_PRODUCT_ID] ?? 'Google Play price'
      : '€149';
  const comparisonRows = [
    ['Stories and books', 'Limited free access', 'Full access', 'Full access'],
    ['Audio narration', 'Weekly highlights only', 'Included', 'Included'],
    ['Offline access', 'Not included', 'Included', 'Included'],
    ['Saved library and favorites', 'Basic access', 'Included', 'Included'],
    ['Personalized recommendations', 'Limited', 'Included', 'Included'],
    [
      'Billing',
      'Free forever',
      billingMode === 'google_play' ? 'Google Play subscription' : 'Monthly after trial',
      billingMode === 'google_play' ? 'Google Play subscription' : 'Annual after trial',
    ],
  ] as const;
  const faqs = [
    {
      question: 'When will I be charged?',
      answer:
        billingMode === 'google_play'
          ? 'Google Play controls charge timing, renewals, trial eligibility, and local pricing for your Play subscription.'
          : `After your 14-day free trial ends, on ${chargeDate}, unless you cancel before then.`,
    },
    {
      question: 'Can I cancel during the trial?',
      answer:
        billingMode === 'google_play'
          ? 'Yes. Manage cancellation from Google Play on Android.'
          : 'Yes. You can cancel anytime before the charge date and you will not be billed.',
    },
    {
      question: 'Do I need a payment method?',
      answer:
        billingMode === 'google_play'
          ? 'Google Play manages the payment method configured for your Play account.'
          : 'Yes. A payment method is required to start either trial.',
    },
    {
      question: 'What stays free?',
      answer: 'The free plan still includes limited daily access, weekly highlights, and a lightweight library.',
    },
  ] as const;

  return (
    <div className="relative min-h-full overflow-hidden px-4 py-8 text-white sm:px-6 sm:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.28),rgba(37,99,235,0.08)_45%,transparent_72%)]"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 px-6 py-7 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:px-8">
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.95fr] lg:items-end">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-blue-200/80">
                Premium access
              </p>
              <h1 className="max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
                Learn with stories you will actually finish.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/78 sm:text-base">
                Unlock full story access, audio narration, saved library, and personalized
                recommendations. Start with the subscription flow that matches your device.
              </p>
            </div>
            <div className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-[#08172b]/80 p-4 text-sm text-blue-50/90 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-blue-200/75">Billing mode</p>
                <p className="mt-2 text-xl font-semibold">
                  {billingMode === 'google_play' ? 'Google Play' : 'Web checkout'}
                </p>
                <p className="mt-1 text-blue-100/70">
                  {billingMode === 'google_play'
                    ? 'Trusted Web Activity detected.'
                    : 'Stripe stays active on the open web.'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-blue-200/75">
                  {billingMode === 'google_play' ? 'Store pricing' : 'Charge date'}
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {billingMode === 'google_play' ? 'Live from Play' : chargeDate}
                </p>
                <p className="mt-1 text-blue-100/70">
                  {billingMode === 'google_play'
                    ? 'Price and eligibility come from Google Play.'
                    : 'Cancel before then to avoid charges.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr_0.8fr]">
          <article className="rounded-[1.75rem] border border-white/10 bg-[#09182c]/85 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200/70">
              Premium monthly
            </p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-4xl font-semibold">{monthlyPriceLabel}</span>
              <span className="pb-1 text-sm text-blue-100/70">/month</span>
            </div>
            <p className="mt-3 min-h-12 text-sm leading-6 text-blue-100/76">
              Best if you want flexibility and full access without a longer commitment.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-blue-50/88">
              <li>Full access to stories and books</li>
              <li>Audio narration and reading tools</li>
              <li>Offline access on your device</li>
              <li>Personalized recommendations</li>
            </ul>
            <button
              onClick={() => handleSubscribe(monthlyBillingId)}
              disabled={loading === monthlyBillingId}
              className="mt-5 w-full rounded-xl bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:opacity-60"
            >
              {loading === monthlyBillingId
                ? 'Processing...'
                : billingMode === 'google_play'
                  ? 'Subscribe with Google Play'
                  : 'Start free trial'}
            </button>
            <p className="mt-3 text-xs text-blue-100/55">
              {billingMode === 'google_play'
                ? 'Subscription, renewals, and local taxes are managed by Google Play.'
                : 'Then €14.99/month after the trial ends.'}
            </p>
          </article>

          <article className="relative rounded-[1.75rem] border border-[#6ea8ff]/45 bg-[linear-gradient(180deg,rgba(36,92,185,0.28),rgba(8,24,44,0.94))] p-5 shadow-[0_22px_70px_rgba(37,99,235,0.22)]">
            <div className="absolute right-4 top-4 rounded-full border border-[#9cc3ff]/35 bg-[#8eb8ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0d2140]">
              Best value
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100/80">
              Premium annual
            </p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-4xl font-semibold">{annualPriceLabel}</span>
              <span className="pb-1 text-sm text-blue-100/75">/year</span>
            </div>
            <p className="mt-3 min-h-12 text-sm leading-6 text-blue-50/82">
              Best if you plan to practice consistently and want the strongest value over time.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-blue-50/92">
              <li>Everything in Premium Monthly</li>
              <li>Offline access on your device</li>
              <li>Lower effective monthly cost</li>
              <li>Clear default plan for steady learners</li>
            </ul>
            <button
              onClick={() => handleSubscribe(annualBillingId)}
              disabled={loading === annualBillingId}
              className="mt-5 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#0d2140] transition hover:bg-blue-50 disabled:opacity-60"
            >
              {loading === annualBillingId
                ? 'Processing...'
                : billingMode === 'google_play'
                  ? 'Subscribe with Google Play'
                  : 'Start free trial'}
            </button>
            <p className="mt-3 text-xs text-blue-100/65">
              {billingMode === 'google_play'
                ? 'Google Play decides trial, grace period, resubscribe, and renewal behavior.'
                : 'Then €149/year after the trial ends.'}
            </p>
          </article>

          <aside className="rounded-[1.75rem] border border-amber-300/20 bg-[linear-gradient(180deg,rgba(255,202,85,0.08),rgba(8,24,44,0.92))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/85">
              Free access
            </p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-4xl font-semibold">€0</span>
              <span className="pb-1 text-sm text-amber-100/75">forever</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-blue-100/74">
              Good for browsing, trying a daily story, and seeing how the library feels before upgrading.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-blue-50/88">
              <li>Limited daily access</li>
              <li>Weekly highlighted story</li>
              <li>Lightweight library and favorites</li>
              <li>No offline access</li>
            </ul>
            {isSignedIn ? (
              <button
                disabled
                className="mt-5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-blue-100/55"
              >
                Current plan
              </button>
            ) : (
              <button
                onClick={() => router.push('/sign-up?redirect_url=%2Fplans')}
                className="mt-5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Join for free
              </button>
            )}
          </aside>
        </section>

        <section className="rounded-[1.75rem] border border-white/10 bg-[#08172b]/82 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200/75">
                Compare plans
              </p>
              <h2 className="mt-1 text-xl font-semibold">What changes when you upgrade</h2>
            </div>
            <p className="text-xs text-blue-100/55">
              {billingMode === 'google_play'
                ? 'Google Play pricing and renewal terms apply on Android.'
                : `Payment method required. Cancel anytime before ${chargeDate}.`}
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr] bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200/75">
              <div>Feature</div>
              <div>Free</div>
              <div>Monthly</div>
              <div>Annual</div>
            </div>
            {comparisonRows.map(([label, free, monthly, annual], idx) => (
              <div
                key={label}
                className={`grid grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr] px-4 py-3 text-sm ${
                  idx % 2 === 0 ? 'bg-white/[0.03]' : 'bg-transparent'
                }`}
              >
                <div className="font-medium text-white/92">{label}</div>
                <div className="text-blue-100/62">{free}</div>
                <div className="text-blue-50/86">{monthly}</div>
                <div className="text-blue-50/92">{annual}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.75rem] border border-white/10 bg-[#08172b]/82 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200/75">
              Before you start
            </p>
            <h2 className="mt-1 text-xl font-semibold">Short answers to the usual questions</h2>
            <div className="mt-4 space-y-4">
              {faqs.map((item) => (
                <div key={item.question} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="font-semibold text-white/94">{item.question}</p>
                  <p className="mt-1 text-sm leading-6 text-blue-100/72">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(8,24,44,0.9))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200/75">
              Why upgrade
            </p>
            <h2 className="mt-1 text-xl font-semibold">Built for consistent reading, not one-off sessions</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-blue-50/86">
              <p>Save the stories you want to finish, keep audio nearby, unlock offline access, and let the app adapt to your target languages and interests.</p>
              <p>
                {billingMode === 'google_play'
                  ? 'On Android TWA, checkout stays inside Google Play so pricing and renewals remain compliant with Play policy.'
                  : 'The annual plan is the clearest fit if you already know you want regular practice. Monthly stays there if you prefer flexibility.'}
              </p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => handleSubscribe(monthlyBillingId)}
                disabled={loading === monthlyBillingId}
                className="rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
              >
                {loading === monthlyBillingId
                  ? 'Processing...'
                  : billingMode === 'google_play'
                    ? 'Subscribe monthly'
                    : 'Start free trial'}
              </button>
              <button
                onClick={() => handleSubscribe(annualBillingId)}
                disabled={loading === annualBillingId}
                className="rounded-xl bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:opacity-60"
              >
                {loading === annualBillingId
                  ? 'Processing...'
                  : billingMode === 'google_play'
                    ? 'Subscribe annually'
                    : 'Start free trial'}
              </button>
            </div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <label className="flex items-start gap-3 text-sm leading-6 text-blue-50/86">
                <input
                  type="checkbox"
                  checked={legalAccepted}
                  onChange={(e) => setLegalAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-[#2563eb]"
                />
                <span>
                  I agree to the{' '}
                  <Link href="/terms" className="text-white underline underline-offset-2">
                    Terms of Service
                  </Link>
                  {' '}and{' '}
                  <Link href="/privacy" className="text-white underline underline-offset-2">
                    Privacy Policy
                  </Link>
                  . I understand the subscription renews automatically until cancelled, and that
                  digital access begins immediately once the trial/subscription starts.
                </span>
              </label>
              <p className="mt-3 text-xs leading-5 text-blue-100/60">
                Consumer rights may vary by country. See our Terms for details about billing,
                cancellation, and digital-service withdrawal information.
              </p>
              {billingNotice ? (
                <p className="mt-3 text-sm text-amber-200">{billingNotice}</p>
              ) : null}
            </div>
          </div>
        </section>
      </div>
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
