"use client";

// Single source of truth for the marketing-area nav (landing, /beta, /blog,
// /blog/[slug]). Each route used to render its own copy of the same nav
// markup, which drifted (Blog vs Features) and read as "two separate sites"
// once /blog moved off WordPress. This component is rendered everywhere so
// the menu looks identical no matter where the visitor lands.
//
// `active` highlights one entry by href prefix; pass undefined on the home
// page to skip highlighting altogether.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { trackGa4Event } from "@/lib/ga4";
import styles from "./LandingPage.module.css";

const LINKS: Array<{ href: string; label: string; external?: boolean }> = [
  { href: "/blog", label: "Blog" },
  { href: "/beta", label: "iPhone beta" },
  { href: "https://shop.digitalpolyglot.com", label: "Shop", external: true },
];

function track(cta: string) {
  trackGa4Event("landing_cta_click", { cta });
}

export default function MarketingNav() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className={styles.nav}>
      <div className={`${styles.frame} ${styles.navInner}`}>
        <Link href="/" className={styles.brand}>
          Digital Polyglot
        </Link>
        <div className={styles.navLinks}>
          {LINKS.map((l) => {
            const isActive = !l.external && pathname.startsWith(l.href);
            const activeStyle = isActive
              ? { color: "#fff", background: "rgba(255,255,255,0.06)" }
              : undefined;
            return l.external ? (
              <a key={l.href} href={l.href} style={activeStyle}>
                {l.label}
              </a>
            ) : (
              <Link key={l.href} href={l.href} style={activeStyle}>
                {l.label}
              </Link>
            );
          })}
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
  );
}
