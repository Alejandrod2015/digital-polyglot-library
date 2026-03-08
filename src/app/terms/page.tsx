import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Digital Polyglot",
  description: "Terms of Service for Digital Polyglot Reader subscriptions and use.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 text-[var(--foreground)]">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Last updated: March 8, 2026</p>

      <section className="mt-8 space-y-4 text-[15px] leading-7">
        <p>
          These Terms govern your use of the Digital Polyglot Reader app and related services at{" "}
          <span className="font-medium">reader.digitalpolyglot.com</span>.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">1) Operator</h2>
        <p className="mt-3 text-[15px] leading-7">
          Digital Polyglot
          <br />
          Heußweg 3, 20257, DE
          <br />
          Contact:{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">2) Accounts</h2>
        <p className="mt-3 text-[15px] leading-7">
          You are responsible for your account credentials and for activity under your account.
          We may suspend access for abuse, fraud, security issues, or material violations of these terms.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">3) Subscriptions and trials</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
          <li>Paid access is offered as a recurring subscription.</li>
          <li>Prices and billing intervals are shown on the plans page and at checkout.</li>
          <li>Trials, when offered, convert automatically into a paid subscription unless cancelled before the billing date.</li>
          <li>Billing is processed by Stripe.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">4) Renewals, cancellation, and billing management</h2>
        <p className="mt-3 text-[15px] leading-7">
          Subscriptions renew automatically until cancelled. You can manage billing, change plans,
          or cancel through the billing settings/Stripe customer portal.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">5) Digital services and withdrawal information</h2>
        <p className="mt-3 text-[15px] leading-7">
          When you start a paid trial or subscription and receive immediate access to digital
          content/services, you expressly request that performance begin right away. Where
          applicable under consumer law, this may affect or limit withdrawal rights once digital
          performance has started or been fully provided. This does not limit any mandatory rights
          you have under applicable law.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">6) Acceptable use</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
          <li>Do not misuse the service, interfere with its security, or scrape content unlawfully.</li>
          <li>Do not share paid access in a way that breaches the subscription model.</li>
          <li>Do not upload or generate unlawful, infringing, or abusive content.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">7) Intellectual property</h2>
        <p className="mt-3 text-[15px] leading-7">
          The app, stories, branding, and related materials remain the property of Digital Polyglot
          or its licensors unless stated otherwise. These terms grant you a limited, non-exclusive
          right to use the service for personal learning purposes.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">8) Availability and changes</h2>
        <p className="mt-3 text-[15px] leading-7">
          We may update features, pricing, and content over time. We do not guarantee uninterrupted
          availability, though we aim to operate the service reliably.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">9) Liability</h2>
        <p className="mt-3 text-[15px] leading-7">
          To the extent permitted by law, our liability is limited to foreseeable damage caused by
          breach of essential obligations. Nothing in these terms excludes liability where exclusion
          is not permitted by applicable law.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">10) Governing law</h2>
        <p className="mt-3 text-[15px] leading-7">
          These terms are governed by the laws of Germany, without limiting any mandatory consumer
          protections that apply in your country of residence.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">11) Contact</h2>
        <p className="mt-3 text-[15px] leading-7">
          Questions:{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>
        </p>
      </section>
    </main>
  );
}
