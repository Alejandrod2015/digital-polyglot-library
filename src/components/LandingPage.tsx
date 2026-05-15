"use client";

import Image from "next/image";
import Link from "next/link";
import { trackGa4Event } from "@/lib/ga4";

const SHOP_URL = "https://shop.digitalpolyglot.com";

function track(cta: string) {
  trackGa4Event("landing_cta_click", { cta });
}

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const WEBAPP_FEATURES = [
  {
    icon: (
      <svg {...ICON_PROPS} aria-hidden>
        <path d="M3 18v-13a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v13" />
        <path d="M13 18v-13a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v13" />
        <path d="M3 18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2" />
      </svg>
    ),
    title: "Stories worth finishing",
    body: "Real plots, real culture, real language. Not drills, not flashcards.",
  },
  {
    icon: (
      <svg {...ICON_PROPS} aria-hidden>
        <path d="M3 12v3a9 9 0 0 0 18 0v-3" />
        <path d="M3 12a9 9 0 0 1 18 0" />
        <rect x="3" y="12" width="4" height="7" rx="1" />
        <rect x="17" y="12" width="4" height="7" rx="1" />
      </svg>
    ),
    title: "Word-synced narration",
    body: "Listen at natural pace. Every word lights up as it is spoken so reading and listening stay in step.",
  },
  {
    icon: (
      <svg {...ICON_PROPS} aria-hidden>
        <circle cx="12" cy="8" r="4" />
        <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      </svg>
    ),
    title: "Heritage-aware",
    body: "Built for learners who grew up around a language, not just those starting from zero.",
  },
];

const SHOP_BOOKS = [
  {
    cover: "/covers/ss-es-mx.jpg",
    title: "Mexican Spanish Stories",
    sub: "Colloquial · Print + ebook",
  },
  {
    cover: "/covers/ss-es-arg.jpg",
    title: "Argentinian Spanish Stories",
    sub: "Rioplatense · Print + ebook",
  },
  {
    cover: "/covers/ss-es-es.jpg",
    title: "Castilian Spanish Stories",
    sub: "Peninsular · Print + ebook",
  },
  {
    cover: "/covers/ss-de-de.jpg",
    title: "German Stories",
    sub: "Standard · Print + ebook",
  },
];

export default function LandingPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(20,184,166,0.18),transparent_70%)]" />

      <header className="sticky top-0 z-30 border-b border-[var(--card-border)] bg-[var(--background)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/digital-polyglot-logo.png"
              alt="Digital Polyglot"
              width={36}
              height={36}
              className="h-9 w-9"
              priority
            />
            <span className="hidden text-base font-extrabold tracking-tight sm:inline">
              Digital Polyglot
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-[var(--muted)] md:flex">
            <a href="/blog" className="transition hover:text-[var(--foreground)]">
              Blog
            </a>
            <a href={SHOP_URL} className="transition hover:text-[var(--foreground)]">
              Shop
            </a>
            <Link href="/beta" className="transition hover:text-[var(--foreground)]">
              iOS beta
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/sign-in"
              onClick={() => track("nav_sign_in")}
              className="hidden rounded-full px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--foreground)] sm:inline-block"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              onClick={() => track("nav_get_started")}
              className="rounded-full bg-[var(--studio-accent)] px-4 py-2 text-sm font-bold text-[#0b1220] transition hover:brightness-110"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-20 pt-16 sm:pt-24">
        <div className="flex flex-col items-center text-center">
          <p className="mb-5 inline-block rounded-full border border-[var(--studio-accent)]/40 bg-[var(--studio-accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--studio-accent)]">
            Spanish · German · Portuguese · Italian
          </p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Learn languages through stories you actually want to finish.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            Read and listen along with word-synced narration. Built for heritage speakers and
            serious learners who want plots, not pop-quizzes.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              onClick={() => track("hero_webapp")}
              className="inline-flex items-center justify-center rounded-full bg-[var(--studio-accent)] px-6 py-3 text-base font-bold text-[#0b1220] transition hover:brightness-110"
            >
              Try the webapp free
            </Link>
            <a
              href={SHOP_URL}
              onClick={() => track("hero_shop")}
              className="inline-flex items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-6 py-3 text-base font-semibold text-[var(--foreground)] transition hover:border-[var(--studio-accent)] hover:text-[var(--studio-accent)]"
            >
              Browse print and ebooks
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="mb-10 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--studio-accent)]">
            The webapp
          </p>
          <h2 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            A library of stories you can read, listen to, and practice on every device.
          </h2>
          <p className="max-w-2xl text-[var(--muted)]">
            Start free, no card needed. Upgrade when you want offline downloads and the full
            catalogue.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {WEBAPP_FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--studio-accent-soft)] text-[var(--studio-accent)]">
                {f.icon}
              </div>
              <h3 className="mb-1 text-sm font-bold text-[var(--foreground)]">{f.title}</h3>
              <p className="text-xs leading-relaxed text-[var(--muted)]">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/sign-up"
            onClick={() => track("webapp_section")}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--studio-accent)] px-5 py-2.5 text-sm font-bold text-[#0b1220] transition hover:brightness-110"
          >
            Start reading free
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="mb-10 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--studio-accent)]">
            The shop
          </p>
          <h2 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Prefer paper? Pick up the print and ebook editions.
          </h2>
          <p className="max-w-2xl text-[var(--muted)]">
            Polished collections for the bookshelf, with the same stories available in the
            webapp.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SHOP_BOOKS.map((b) => (
            <a
              key={b.cover}
              href={SHOP_URL}
              onClick={() => track("shop_cover")}
              className="group flex flex-col gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 transition hover:border-[var(--studio-accent)]"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-black/20">
                <Image
                  src={b.cover}
                  alt={b.title}
                  fill
                  sizes="(min-width: 640px) 240px, 50vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="px-1">
                <p className="text-xs font-bold leading-snug text-[var(--foreground)]">
                  {b.title}
                </p>
                <p className="text-[11px] leading-snug text-[var(--muted)]">{b.sub}</p>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <a
            href={SHOP_URL}
            onClick={() => track("shop_section")}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--studio-accent)] hover:text-[var(--studio-accent)]"
          >
            Visit the shop
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-8 sm:p-10">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--studio-accent)]">
                iOS app · TestFlight
              </p>
              <h3 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
                The mobile experience is coming. Help us shape it.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                We are inviting a small group of heritage and serious learners to test the iOS
                app before launch. Apply in under a minute.
              </p>
            </div>
            <Link
              href="/beta"
              onClick={() => track("beta_section")}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--studio-accent)] px-5 py-3 text-sm font-bold text-[#0b1220] transition hover:brightness-110"
            >
              Join the beta
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--card-border)] px-6 py-10 text-sm text-[var(--muted)]">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <Image
              src="/digital-polyglot-logo.png"
              alt="Digital Polyglot"
              width={28}
              height={28}
              className="h-7 w-7"
            />
            <span className="font-bold text-[var(--foreground)]">Digital Polyglot</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a href="/blog" className="hover:text-[var(--foreground)]">Blog</a>
            <a href={SHOP_URL} className="hover:text-[var(--foreground)]">Shop</a>
            <Link href="/beta" className="hover:text-[var(--foreground)]">iOS beta</Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)]">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--foreground)]">Terms</Link>
            <Link href="/impressum" className="hover:text-[var(--foreground)]">Impressum</Link>
          </nav>
          <p className="text-xs">© {new Date().getFullYear()} Digital Polyglot</p>
        </div>
      </footer>
    </main>
  );
}
