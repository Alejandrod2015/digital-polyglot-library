"use client";

import Link from "next/link";
import { trackGa4Event } from "@/lib/ga4";
import PhoneDemo from "./marketing/PhoneDemo";
import styles from "./marketing/LandingPage.module.css";

function track(cta: string) {
  trackGa4Event("landing_cta_click", { cta });
}

const RING_C = 2 * Math.PI * 20.5;

function Ring() {
  return (
    <svg width="46" height="46">
      <circle
        cx="23"
        cy="23"
        r="20.5"
        fill="none"
        stroke="rgba(255,255,255,0.10)"
        strokeWidth="2.5"
        strokeDasharray={`${RING_C} ${RING_C}`}
      />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={`${styles.frame} ${styles.navInner}`}>
          <Link href="/" className={styles.brand}>
            Digital Polyglot
          </Link>
          <div className={styles.navLinks}>
            <a href="#features">Features</a>
            <a href="#languages">Languages</a>
            <Link href="/beta">iPhone beta</Link>
          </div>
          <div className={styles.navCta}>
            <Link
              href="/sign-in"
              onClick={() => track("nav_sign_in")}
              className={`${styles.btn} ${styles.btnQuiet}`}
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              onClick={() => track("nav_get_started")}
              className={`${styles.btn} ${styles.btnPrimary}`}
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.frame}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <span className={styles.kicker}>
                <span className={styles.kickerDot} />
                iPhone beta · invite only
              </span>
              <h1>
                Stories that read <span className={styles.lime}>with</span> you.
              </h1>
              <p className={styles.heroSub}>
                Stories with word-synced narration and instant tap-to-translate.
                Built for people who already love reading.
              </p>
              <div className={styles.heroCtas}>
                <Link
                  href="/sign-up"
                  onClick={() => track("hero_start_reading")}
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  Start reading free
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link
                  href="/beta"
                  onClick={() => track("hero_ios_beta")}
                  className={`${styles.btn} ${styles.btnSky}`}
                >
                  ⚡ Join the iPhone beta
                </Link>
              </div>
            </div>

            <PhoneDemo />
          </div>
        </div>
      </header>

      <section
        id="features"
        className={styles.section}
        style={{ paddingTop: 32 }}
      >
        <div className={styles.frame}>
          <div className={styles.sectionHead}>
            <span className={styles.kicker}>
              <span className={styles.kickerDot} />
              What you get
            </span>
            <h2 className={styles.sectionTitle}>
              Read, listen, look up{" "}
              <span className={styles.lime}>in one tap.</span>
            </h2>
            <p className={styles.sectionLead}>
              No streaks. No pop-quizzes. Just stories and the quietest help
              you&apos;ve ever had reading them.
            </p>
          </div>

          <div className={styles.features}>
            <div className={styles.feat}>
              <div className={`${styles.featIco} ${styles.featIcoLime}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18V6l11-2v12" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="17" cy="16" r="3" />
                </svg>
              </div>
              <h4>Word-synced audio</h4>
              <p>
                Every word lights up while it&apos;s read aloud. Slow the
                narration down without distortion.
              </p>
            </div>
            <div className={styles.feat}>
              <div className={`${styles.featIco} ${styles.featIcoSky}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3 8-8" />
                  <path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h7" />
                </svg>
              </div>
              <h4>Tap to translate</h4>
              <p>
                One tap, glossed in context. Save the word, come back to it
                later. No flashcards required.
              </p>
            </div>
            <div className={styles.feat}>
              <div className={`${styles.featIco} ${styles.featIcoFire}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </div>
              <h4>Read at your pace</h4>
              <p>
                0.5× to 1.5× with the pitch kept natural. Slow hard paragraphs,
                breeze through easy ones.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="languages"
        className={styles.section}
        style={{ paddingTop: 0 }}
      >
        <div className={styles.frame}>
          <div className={styles.sectionHead}>
            <span className={styles.kicker}>
              <span className={styles.kickerDot} />
              Languages
            </span>
            <h2 className={styles.sectionTitle}>
              Pick a language{" "}
              <span className={styles.lime}>to read in.</span>
            </h2>
          </div>

          <div className={styles.langs}>
            <div className={styles.langRow}>
              <div className={styles.ringWrap}>
                <Ring />
                <span className={styles.ringFlag}>🇲🇽</span>
              </div>
              <div>
                <div className={styles.langName}>Spanish</div>
              </div>
            </div>
            <div className={styles.langRow}>
              <div className={styles.ringWrap}>
                <Ring />
                <span className={styles.ringFlag}>🇩🇪</span>
              </div>
              <div>
                <div className={styles.langName}>German</div>
              </div>
            </div>
            <div className={styles.langRow}>
              <div className={styles.ringWrap}>
                <Ring />
                <span className={styles.ringFlag}>🇵🇹</span>
              </div>
              <div>
                <div className={styles.langName}>Portuguese</div>
              </div>
            </div>
            <div className={styles.langRow}>
              <div className={styles.ringWrap}>
                <Ring />
                <span className={styles.ringFlag}>🇮🇹</span>
              </div>
              <div>
                <div className={styles.langName}>Italian</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="beta" className={styles.ctaFinal}>
        <div className={styles.frame}>
          <h2>
            Open a story. <span className={styles.lime}>Press play.</span>
          </h2>
          <p>That&apos;s the entire onboarding. No card. No quiz.</p>
          <div className={styles.ctaFinalCtas}>
            <Link
              href="/sign-up"
              onClick={() => track("cta_final_start_reading")}
              className={`${styles.btn} ${styles.btnPrimary}`}
            >
              Start reading free
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/beta"
              onClick={() => track("cta_final_ios_beta")}
              className={`${styles.btn} ${styles.btnSky}`}
            >
              ⚡ Join the iPhone beta
            </Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={`${styles.frame} ${styles.footInner}`}>
          <span className={styles.footCopy}>
            © {new Date().getFullYear()} Digital Polyglot
          </span>
          <div className={styles.footLinks}>
            <Link href="/blog">Blog</Link>
            <a href="https://shop.digitalpolyglot.com">Shop</a>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/impressum">Impressum</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
