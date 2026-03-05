import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Digital Polyglot",
  description: "Privacy Policy for the Digital Polyglot Reader app.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 text-[var(--foreground)]">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Last updated: March 5, 2026</p>

      <section className="mt-8 space-y-4 text-[15px] leading-7">
        <p>
          Digital Polyglot (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the Digital Polyglot Reader app and
          related services at <span className="font-medium">reader.digitalpolyglot.com</span> (the
          &quot;Services&quot;). This Privacy Policy explains how we collect, use, and protect personal data
          when you use the Services.
        </p>
        <p>
          If you also use our ecommerce store, that store may be covered by a separate privacy policy.
          This page is specific to the Reader app.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">1) Data Controller</h2>
        <p className="mt-3 text-[15px] leading-7">
          Digital Polyglot
          <br />
          Heußweg 3, 20257, DE
          <br />
          Questions or requests:{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">2) Data We Collect</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
          <li>Account data (name, email, user ID, auth provider ID).</li>
          <li>Authentication metadata (including social login identifiers).</li>
          <li>Subscription and billing status (plan, trial status, Stripe customer/subscription IDs).</li>
          <li>Learning data (progress, favorites, saved content, listening/reading activity).</li>
          <li>Technical and device data (IP, browser, logs, timestamps).</li>
          <li>Analytics and product usage events.</li>
          <li>Support and feedback communications.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">3) Sources of Data</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
          <li>Directly from you.</li>
          <li>Automatically through app usage and cookies/local storage.</li>
          <li>From service providers (authentication, payments, infrastructure).</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">4) How We Use Data</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
          <li>Provide and secure your account and the Services.</li>
          <li>Personalize story recommendations and learning experience.</li>
          <li>Manage subscriptions, trials, and billing.</li>
          <li>Measure product performance and improve features.</li>
          <li>Prevent fraud and abuse; comply with legal obligations.</li>
          <li>Provide customer support and service communications.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">5) Legal Bases (EEA/UK)</h2>
        <p className="mt-3 text-[15px] leading-7">
          Where applicable, we process data under contract performance, legitimate interests,
          consent (when required), and legal obligations.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">6) Service Providers</h2>
        <p className="mt-3 text-[15px] leading-7">
          We use third-party processors to operate the Services, including Clerk (authentication),
          Stripe (payments), Vercel (hosting), database providers, Google Analytics (analytics), and
          Sentry (error monitoring). We do not sell personal data for money.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">7) International Transfers</h2>
        <p className="mt-3 text-[15px] leading-7">
          Your data may be processed outside your country. Where required, we apply safeguards such
          as Standard Contractual Clauses or equivalent mechanisms.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">8) Retention</h2>
        <p className="mt-3 text-[15px] leading-7">
          We retain personal data only as long as needed to provide Services, support your account,
          comply with legal obligations, and resolve disputes.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">9) Your Rights</h2>
        <p className="mt-3 text-[15px] leading-7">
          Depending on your location, you may have rights to access, correct, delete, port, or
          restrict processing of your personal data, and to withdraw consent where applicable.
          Contact us at{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>
          .
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">10) Account & Data Deletion</h2>
        <p className="mt-3 text-[15px] leading-7">
          You can request account/data deletion by emailing{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>
          . For Facebook Login users, deletion instructions are available at{" "}
          <a className="text-[var(--primary)] hover:underline" href="/data-deletion">
            /data-deletion
          </a>
          .
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">11) Security</h2>
        <p className="mt-3 text-[15px] leading-7">
          We implement reasonable technical and organizational safeguards, but no system is
          completely secure.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">12) Children</h2>
        <p className="mt-3 text-[15px] leading-7">
          The Services are not intended for children under the legal minimum age in their
          jurisdiction.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">13) Policy Changes</h2>
        <p className="mt-3 text-[15px] leading-7">
          We may update this policy and will publish updates on this page with a revised date.
        </p>
      </section>
    </main>
  );
}
