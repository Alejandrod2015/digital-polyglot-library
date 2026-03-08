import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy | Digital Polyglot",
  description: "Cookie Policy for Digital Polyglot Reader.",
};

export default function CookiePolicyPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 text-[var(--foreground)]">
      <h1 className="text-3xl font-bold">Cookie Policy</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Last updated: March 8, 2026</p>

      <section className="mt-8 space-y-4 text-[15px] leading-7">
        <p>
          This Cookie Policy explains how Digital Polyglot uses cookies and similar technologies
          on <span className="font-medium">reader.digitalpolyglot.com</span>.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">1) Types of cookies we use</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
          <li><span className="font-medium">Strictly necessary cookies</span> for authentication, security, and core app functionality.</li>
          <li><span className="font-medium">Preference storage</span> for settings such as theme and reading state on your device.</li>
          <li><span className="font-medium">Analytics cookies</span> only if you consent, to understand usage and improve the product.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">2) Providers</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
          <li>Clerk for authentication and session management.</li>
          <li>Stripe for checkout and billing-related session handling.</li>
          <li>Google Analytics 4 for analytics, only where consent has been given.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">3) Managing consent</h2>
        <p className="mt-3 text-[15px] leading-7">
          On first visit, we ask whether you want to allow analytics cookies. If you reject them,
          analytics scripts are not loaded. Essential cookies remain active because they are needed
          to provide the service securely.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">4) Device storage</h2>
        <p className="mt-3 text-[15px] leading-7">
          We also use local storage for app functionality such as progress, preferences, reading
          state, and cached content. These items support core product behavior and are not used for
          advertising.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">5) Contact</h2>
        <p className="mt-3 text-[15px] leading-7">
          Questions about cookies or privacy:{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>
        </p>
      </section>
    </main>
  );
}
