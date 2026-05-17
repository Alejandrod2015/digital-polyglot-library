"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { trackGa4Event } from "@/lib/ga4";
import styles from "./LandingPage.module.css";

const SHOP_URL = "https://shop.digitalpolyglot.com";

function track(cta: string) {
  trackGa4Event("nav_click", { cta });
}

const ACTIVE_LINK_STYLE: React.CSSProperties = {
  color: "#fff",
  background: "rgba(255,255,255,0.06)",
};

export default function MarketingNav() {
  const pathname = usePathname() ?? "";
  const isBlog = pathname === "/blog" || pathname.startsWith("/blog/");
  const isBeta = pathname === "/beta" || pathname.startsWith("/beta/");

  return (
    <nav className={styles.nav}>
      <div className={`${styles.frame} ${styles.navInner}`}>
        <Link href="/" className={styles.brand} onClick={() => track("logo")}>
          Digital Polyglot
        </Link>
        <div className={styles.navLinks}>
          <Link
            href="/blog"
            onClick={() => track("blog")}
            style={isBlog ? ACTIVE_LINK_STYLE : undefined}
          >
            Blog
          </Link>
          <a href={SHOP_URL} onClick={() => track("shop")}>
            Shop
          </a>
          <Link
            href="/beta"
            onClick={() => track("beta")}
            style={isBeta ? ACTIVE_LINK_STYLE : undefined}
          >
            iPhone beta
          </Link>
        </div>
        <div className={styles.navCta}>
          <Link
            href="/sign-in"
            onClick={() => track("sign_in")}
            className={`${styles.btn} ${styles.btnQuiet}`}
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            onClick={() => track("get_started")}
            className={`${styles.btn} ${styles.btnPrimary}`}
          >
            Get started
          </Link>
        </div>
      </div>
    </nav>
  );
}
