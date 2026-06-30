'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, ChevronDown } from 'lucide-react';
import type { Plan } from '@domain/access';
import {
  GOOGLE_PLAY_PREMIUM_ANNUAL_PRODUCT_ID,
  GOOGLE_PLAY_PREMIUM_MONTHLY_PRODUCT_ID,
  STRIPE_PREMIUM_ANNUAL_PRICE_ID,
  STRIPE_PREMIUM_MONTHLY_PRICE_ID,
  STRIPE_PREMIUM_MONTHLY_PRICE_FALLBACK,
  STRIPE_PREMIUM_ANNUAL_PRICE_FALLBACK,
} from '@domain/billingCatalog';

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
  const [stripePrices, setStripePrices] = useState<{
    monthly: string | null;
    annual: string | null;
  }>({ monthly: null, annual: null });
  const [entitlement, setEntitlement] = useState<{
    plan: string;
    source: string | null;
    productId?: string | null;
    hasEntitlement: boolean;
  } | null>(null);
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

  // Live prices from Stripe (single source of truth); falls back to the
  // labels in billingCatalog if the lookup fails.
  useEffect(() => {
    if (billingMode !== 'stripe') return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/stripe/prices');
        if (!res.ok) return;
        const data: { monthly: string | null; annual: string | null } = await res.json();
        if (!cancelled) {
          setStripePrices({
            monthly: data.monthly ?? null,
            annual: data.annual ?? null,
          });
        }
      } catch {
        // keep fallback labels
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [billingMode]);

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

  // Paid/creator accounts are NOT redirected away from /plans anymore. They see
  // a status panel (with a monthly→annual nudge when relevant) and can still
  // reveal the full plans via "See all plans". We fetch the entitlement to know
  // the billing interval (monthly vs annual) and offer subscription management.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/billing/entitlement');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setEntitlement(data);
      } catch {
        // keep null; status panel falls back to a generic message
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

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
      : stripePrices.monthly ?? STRIPE_PREMIUM_MONTHLY_PRICE_FALLBACK;
  const annualPriceLabel =
    billingMode === 'google_play'
      ? playPrices[GOOGLE_PLAY_PREMIUM_ANNUAL_PRODUCT_ID] ?? 'Google Play price'
      : stripePrices.annual ?? STRIPE_PREMIUM_ANNUAL_PRICE_FALLBACK;
  // Launch promo (plan B): web/Stripe only. Activated by NEXT_PUBLIC_LAUNCH_ANNUAL_PRICE
  // (e.g. "€89"); must be set together with STRIPE_LAUNCH_COUPON_ID on the server.
  const launchAnnualPrice = process.env.NEXT_PUBLIC_LAUNCH_ANNUAL_PRICE?.trim();
  const annualPromoActive = billingMode === 'stripe' && !!launchAnnualPrice;
  const annualDisplayPrice = annualPromoActive ? (launchAnnualPrice as string) : annualPriceLabel;
  const annualStrike = annualPromoActive ? annualPriceLabel : undefined;
  const annualUnit = annualPromoActive ? 'first year' : '/year';
  const annualFooter =
    billingMode === 'google_play'
      ? 'Pricing via Google Play.'
      : annualPromoActive
        ? `Then ${annualPriceLabel}/year. Cancel anytime.`
        : `Then ${annualPriceLabel}/year.`;
  const annualFeatures = [
    'Authentic language in every story',
    'Audio for every story',
    'Offline access',
    'Personalized recommendations',
    annualPromoActive ? 'Save €60 your first year' : 'Save 17% vs monthly',
  ];
  const faqs = [
    {
      question: 'When will I be charged?',
      answer:
        billingMode === 'google_play'
          ? 'Google Play controls charge timing, renewals, trial eligibility, and local pricing.'
          : `After your 14-day free trial, on ${chargeDate}, unless you cancel before then.`,
    },
    {
      question: 'Can I cancel during the trial?',
      answer:
        billingMode === 'google_play'
          ? 'Yes. Manage cancellation from Google Play on Android.'
          : 'Yes. Cancel anytime before the charge date and you won’t be billed.',
    },
    {
      question: 'What stays free?',
      answer:
        'Limited daily access, the weekly highlighted story, and a lightweight library and favorites.',
    },
  ] as const;

  const planIsPaid =
    isSignedIn && (plan === 'premium' || plan === 'polyglot' || plan === 'owner');
  const subProductId = entitlement?.productId ?? null;
  const subInterval: 'monthly' | 'annual' | null = !subProductId
    ? null
    : subProductId === STRIPE_PREMIUM_ANNUAL_PRICE_ID || subProductId.includes('annual')
      ? 'annual'
      : subProductId === STRIPE_PREMIUM_MONTHLY_PRICE_ID || subProductId.includes('monthly')
        ? 'monthly'
        : null;
  const hasStripeSub = !!entitlement?.hasEntitlement && entitlement.source === 'stripe';
  const hasPlaySub = !!entitlement?.hasEntitlement && entitlement.source === 'google_play';
  const hasAppStoreSub = !!entitlement?.hasEntitlement && entitlement.source === 'app_store';

  const openBillingPortal = async () => {
    if (hasPlaySub) {
      window.open('https://play.google.com/store/account/subscriptions', '_blank');
      return;
    }
    if (hasAppStoreSub) {
      window.open('https://apps.apple.com/account/subscriptions', '_blank');
      return;
    }
    try {
      setLoading('portal');
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data?.url) window.location.href = data.url as string;
    } catch {
      // noop
    } finally {
      setLoading(null);
    }
  };

  // A real paying subscriber (Stripe/Play/App Store). Polyglot/owner are NOT
  // managed: they keep the normal cards (only the owner has those tiers).
  const isManaged = hasStripeSub || hasPlaySub || hasAppStoreSub;
  const managedCta = (cardInterval: 'free' | 'monthly' | 'annual') => {
    const isCurrent =
      (cardInterval === 'annual' && subInterval === 'annual') ||
      (cardInterval === 'monthly' && subInterval === 'monthly');
    if (isCurrent) {
      return (
        <button
          disabled
          className="w-full rounded-full border px-4 py-3 text-[13px] font-extrabold cursor-default"
          style={{
            borderColor: 'var(--card-border)',
            background: 'var(--chip-bg)',
            color: 'var(--muted)',
          }}
        >
          Current plan
        </button>
      );
    }
    return (
      <button
        onClick={openBillingPortal}
        disabled={loading === 'portal'}
        className="w-full rounded-full border px-4 py-3 text-[13px] font-extrabold transition-colors hover:bg-[var(--card-bg-hover)] disabled:opacity-60"
        style={{
          borderColor: 'var(--card-border)',
          background: 'var(--card-bg)',
          color: 'var(--foreground)',
        }}
      >
        {loading === 'portal'
          ? 'Opening…'
          : cardInterval === 'free'
            ? 'Cancel subscription'
            : 'Manage subscription'}
      </button>
    );
  };

  return (
    <div
      className="mx-auto px-4 py-10 sm:px-6 sm:py-12 text-[var(--foreground)]"
      style={{ maxWidth: 980 }}
    >
      {/* ── Hero corto. Sin eyebrow ni billing card lateral. ── */}
      <header className="mb-8 text-center sm:mb-10">
        <h1 className="text-[28px] sm:text-[36px] font-black tracking-tight leading-tight">
          Learn the language people really speak
        </h1>
        <p className="mt-2 text-[14px] sm:text-[15px] text-[var(--muted)]">
          14-day free trial · cancel anytime.
        </p>
      </header>

      {planIsPaid && !isManaged ? (
        <PlanStatusBanner
          plan={plan}
          interval={subInterval}
          manageable={hasStripeSub || hasPlaySub || hasAppStoreSub}
          source={entitlement?.source ?? null}
          loading={loading === 'portal'}
          onManage={openBillingPortal}
        />
      ) : null}

      {/* ── 3 plan cards ── */}
      <section className="grid gap-4 sm:grid-cols-3">
        {/* Free */}
        <PlanCard
          eyebrow="Free"
          price="€0"
          unit="forever"
          features={[
            'Weekly highlighted story',
            'Limited daily access',
            'Lightweight library',
          ]}
          cta={
            isManaged ? (
              managedCta('free')
            ) : isSignedIn ? (
              <button
                disabled
                className="w-full rounded-full border px-4 py-3 text-[13px] font-extrabold cursor-default"
                style={{
                  borderColor: 'var(--card-border)',
                  background: 'var(--chip-bg)',
                  color: 'var(--muted)',
                }}
              >
                Current plan
              </button>
            ) : (
              <button
                onClick={() => router.push('/sign-up?redirect_url=%2Fplans')}
                className="w-full rounded-full border px-4 py-3 text-[13px] font-extrabold transition-colors hover:bg-[var(--card-bg-hover)]"
                style={{
                  borderColor: 'var(--card-border)',
                  background: 'var(--card-bg)',
                  color: 'var(--foreground)',
                }}
              >
                Join for free
              </button>
            )
          }
        />

        {/* Premium Annual; destacado */}
        <PlanCard
          eyebrow="Annual"
          price={annualDisplayPrice}
          strikePrice={annualStrike}
          unit={annualUnit}
          highlighted
          badge={annualPromoActive ? 'LAUNCH OFFER' : 'BEST VALUE'}
          features={annualFeatures}
          cta={
            isManaged ? (
              managedCta('annual')
            ) : (
            <button
              onClick={() => handleSubscribe(annualBillingId)}
              disabled={loading === annualBillingId}
              className="w-full rounded-full px-4 py-3 text-[13px] font-extrabold transition hover:brightness-105 disabled:opacity-60"
              style={{ background: 'var(--color-gold)', color: 'var(--color-gold-ink)' }}
            >
              {loading === annualBillingId
                ? 'Processing…'
                : billingMode === 'google_play'
                  ? 'Subscribe on Play'
                  : 'Start free trial'}
            </button>
            )
          }
          footer={annualFooter}
        />

        {/* Premium Monthly */}
        <PlanCard
          eyebrow="Monthly"
          price={monthlyPriceLabel}
          unit="/month"
          features={[
            'Authentic language in every story',
            'Audio for every story',
            'Offline access',
            'Personalized recommendations',
            'Cancel anytime',
          ]}
          cta={
            isManaged ? (
              managedCta('monthly')
            ) : (
            <button
              onClick={() => handleSubscribe(monthlyBillingId)}
              disabled={loading === monthlyBillingId}
              className="w-full rounded-full border px-4 py-3 text-[13px] font-extrabold transition-colors hover:bg-[var(--card-bg-hover)] disabled:opacity-60"
              style={{
                borderColor: 'var(--card-border)',
                background: 'var(--card-bg)',
                color: 'var(--foreground)',
              }}
            >
              {loading === monthlyBillingId
                ? 'Processing…'
                : billingMode === 'google_play'
                  ? 'Subscribe on Play'
                  : 'Start free trial'}
            </button>
            )
          }
          footer={
            billingMode === 'google_play'
              ? 'Pricing via Google Play.'
              : `Then ${monthlyPriceLabel}/month.`
          }
        />
      </section>

      {/* ── Legal acceptance (compact) ── */}
      <div
        className="mt-6 flex items-start gap-3 rounded-2xl border px-4 py-3 text-[12px] leading-5"
        style={{
          borderColor: 'var(--card-border)',
          background: 'var(--card-bg)',
          color: 'var(--muted)',
        }}
      >
        <input
          id="legal-accept"
          type="checkbox"
          checked={legalAccepted}
          onChange={(e) => setLegalAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--color-gold)]"
        />
        <label htmlFor="legal-accept" className="cursor-pointer">
          I agree to the{' '}
          <Link href="/terms" className="underline text-[var(--foreground)]">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline text-[var(--foreground)]">
            Privacy Policy
          </Link>
          . Subscriptions renew automatically until cancelled.
        </label>
      </div>

      {billingNotice ? (
        <p className="mt-3 text-[13px] font-bold text-amber-400">{billingNotice}</p>
      ) : null}

      {/* ── FAQ accordion compacto ── */}
      <section className="mt-10">
        <h2 className="mb-3 text-[15px] font-extrabold uppercase tracking-[0.18em] text-[var(--muted)]">
          Questions
        </h2>
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}
        >
          {faqs.map((item, i) => (
            <Faq
              key={item.question}
              question={item.question}
              answer={item.answer}
              isLast={i === faqs.length - 1}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─────────────── Sub-components ───────────────

function PlanStatusBanner({
  plan,
  interval,
  manageable,
  source,
  loading,
  onManage,
}: {
  plan: Plan;
  interval: 'monthly' | 'annual' | null;
  manageable: boolean;
  source: string | null;
  loading: boolean;
  onManage: () => void;
}) {
  const planLabel =
    plan === 'polyglot' ? 'Creator' : plan === 'owner' ? 'Owner' : 'Premium';
  const intervalLabel =
    interval === 'annual' ? 'Annual' : interval === 'monthly' ? 'Monthly' : null;
  const showAnnualNudge = plan === 'premium' && interval === 'monthly' && manageable;

  return (
    <div
      className="mb-6 flex flex-col items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 text-center sm:flex-row sm:text-left"
      style={{
        borderColor: 'var(--color-gold)',
        background:
          'linear-gradient(180deg, rgba(252,211,77,0.08), var(--card-bg) 60%)',
      }}
    >
      <div>
        <p className="text-[13px] font-extrabold">
          You&apos;re on {planLabel}
          {intervalLabel ? ` · ${intervalLabel}` : ''}; full access.
        </p>
        {showAnnualNudge ? (
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">
            Switch to Annual and pay once a year instead of every month.
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {showAnnualNudge ? (
          <button
            onClick={onManage}
            disabled={loading}
            className="rounded-full px-4 py-2 text-[12px] font-extrabold transition hover:brightness-105 disabled:opacity-60"
            style={{ background: 'var(--color-gold)', color: 'var(--color-gold-ink)' }}
          >
            {loading ? 'Opening…' : 'Switch to Annual'}
          </button>
        ) : null}
        {manageable ? (
          <button
            onClick={onManage}
            disabled={loading}
            className="rounded-full border px-4 py-2 text-[12px] font-extrabold transition-colors hover:bg-[var(--card-bg-hover)] disabled:opacity-60"
            style={{
              borderColor: 'var(--card-border)',
              background: 'var(--card-bg)',
              color: 'var(--foreground)',
            }}
          >
            {loading
              ? 'Opening…'
              : source === 'google_play'
                ? 'Manage in Google Play'
                : source === 'app_store'
                  ? 'Manage in App Store'
                  : 'Manage'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

type PlanCardProps = {
  eyebrow: string;
  price: string;
  unit: string;
  features: string[];
  cta: React.ReactNode;
  footer?: string;
  highlighted?: boolean;
  badge?: string;
  strikePrice?: string;
};

function PlanCard({
  eyebrow,
  price,
  unit,
  features,
  cta,
  footer,
  highlighted,
  badge,
  strikePrice,
}: PlanCardProps) {
  return (
    <article
      className="relative rounded-[20px] border p-5 flex flex-col"
      style={{
        borderColor: highlighted ? 'var(--color-gold)' : 'var(--card-border)',
        background: highlighted
          ? 'linear-gradient(180deg, rgba(252,211,77,0.08), var(--card-bg) 60%)'
          : 'var(--card-bg)',
        boxShadow: highlighted
          ? '0 12px 28px -10px rgba(252,211,77,0.25)'
          : undefined,
      }}
    >
      {badge ? (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-black tracking-[0.18em]"
          style={{ background: 'var(--color-gold)', color: 'var(--color-gold-ink)' }}
        >
          {badge}
        </div>
      ) : null}
      <p
        className="text-[11px] font-extrabold uppercase tracking-[0.22em]"
        style={{ color: highlighted ? 'var(--color-gold)' : 'var(--muted)' }}
      >
        {eyebrow}
      </p>
      <div className="mt-2 flex items-baseline gap-1.5">
        {strikePrice ? (
          <span className="text-[18px] font-bold text-[var(--muted)] line-through">
            {strikePrice}
          </span>
        ) : null}
        <span className="text-[32px] font-black tracking-tight">{price}</span>
        <span className="text-[13px] font-bold text-[var(--muted)]">{unit}</span>
      </div>
      <ul className="mt-4 mb-5 space-y-2 text-[13px]">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check
              size={14}
              strokeWidth={2.6}
              className="mt-0.5 shrink-0"
              style={{ color: highlighted ? 'var(--color-gold)' : 'var(--muted)' }}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto">{cta}</div>
      {footer ? (
        <p className="mt-2 text-[11px] text-[var(--muted)] text-center">{footer}</p>
      ) : null}
    </article>
  );
}

function Faq({
  question,
  answer,
  isLast,
}: {
  question: string;
  answer: string;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid var(--card-border)' }}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span className="text-[14px] font-extrabold">{question}</span>
        <ChevronDown
          size={16}
          className="shrink-0 transition-transform text-[var(--muted)]"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {open ? (
        <p
          className="px-4 pb-4 text-[13px] leading-6"
          style={{ color: 'var(--muted)' }}
        >
          {answer}
        </p>
      ) : null}
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
