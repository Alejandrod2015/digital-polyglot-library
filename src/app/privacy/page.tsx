import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Digital Polyglot",
  description: "Privacy Policy for the Digital Polyglot Reader app.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 text-[var(--foreground)]">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Last updated: May 7, 2026</p>

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
          Alberto Alejandro Del Carpio Olemar
          <br />
          Digital Polyglot
          <br />
          Heußweg 3, 20257 Hamburg, Germany
          <br />
          Questions or requests:{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>
          <br />
          Legal contact:{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:contact@digitalpolyglot.com">
            contact@digitalpolyglot.com
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
          <li>Mobile device identifiers, operating system, and app version (when you use the mobile app).</li>
          <li>Push notification tokens (when you enable reminders or notifications).</li>
          <li>In-app purchase metadata (when applicable).</li>
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
        <p className="mt-3 text-[15px] leading-7">
          We may use aggregated and de-identified usage data to develop, train, and evaluate
          algorithmic and machine-learning systems that improve learning recommendations, content
          quality, and educational outcomes. We use identifiable data to train such systems only
          where we have a valid legal basis under applicable data protection law or your explicit
          consent.
        </p>
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
          We use third-party processors to operate and improve the Services. Current processors
          include:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
          <li>Clerk (authentication and identity)</li>
          <li>Stripe (payments and billing)</li>
          <li>Vercel (hosting and edge infrastructure)</li>
          <li>Sentry (error monitoring)</li>
          <li>Google Analytics (web analytics, used only with your consent)</li>
          <li>OpenAI (speech-to-text transcription and content generation in the Studio editorial workflow)</li>
          <li>Anthropic (content generation and editorial review in the Studio)</li>
          <li>ElevenLabs (text-to-speech generation for story narration)</li>
          <li>Sanity (content management for stories, vocabulary, and assets)</li>
          <li>Modal (compute infrastructure for self-hosted text-to-speech)</li>
        </ul>
        <p className="mt-3 text-[15px] leading-7">
          We do not sell identifiable personal data for money. We may share aggregated,
          de-identified, or anonymized data (data that cannot reasonably be used to identify you)
          for research, product improvement, partnerships, and analytics purposes, in compliance
          with applicable law.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">7) Business Transfers</h2>
        <p className="mt-3 text-[15px] leading-7">
          If we are involved in a merger, acquisition, reorganization, sale of assets, or insolvency
          event, personal data may be transferred or disclosed as part of that transaction, subject
          to the receiving party honoring the protections of this Privacy Policy or providing
          equivalent protections. We will provide notice where required by applicable law.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">8) International Transfers</h2>
        <p className="mt-3 text-[15px] leading-7">
          Several of our service providers are located outside the European Economic Area, including
          in the United States (for example: Clerk, Stripe, Vercel, Sentry, Google Analytics,
          OpenAI, Anthropic, ElevenLabs, Sanity, and Modal). Where we transfer personal data outside
          the EEA, we apply safeguards such as the Standard Contractual Clauses adopted by the
          European Commission (Decision 2021/914/EU), the EU-US Data Privacy Framework where the
          recipient is certified, or other lawful transfer mechanisms.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">9) Retention</h2>
        <p className="mt-3 text-[15px] leading-7">
          We retain personal data only as long as needed to provide Services, support your account,
          comply with legal obligations, and resolve disputes. Indicative retention periods:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
          <li>Account and profile data: until you request deletion or close your account.</li>
          <li>Learning data and progress: while your account is active; aggregated or anonymized after deletion where permitted by law.</li>
          <li>Product usage events and analytics: typically up to 24 months in identifiable form, then aggregated or deleted.</li>
          <li>Technical logs: typically up to 90 days.</li>
          <li>Support and feedback communications: typically up to 24 months after the last contact.</li>
          <li>Billing, invoicing, and tax records: retained as required by law (in Germany, generally up to 10 years under §147 AO).</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">10) Your Rights</h2>
        <p className="mt-3 text-[15px] leading-7">
          Depending on your location, you may have rights to access, correct, delete, port, or
          restrict processing of your personal data, and to withdraw consent where applicable.
          Contact us at{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>
          .
        </p>
        <p className="mt-3 text-[15px] leading-7">
          If you are in the EEA/UK, you may also have the right to lodge a complaint with your
          local supervisory authority. For users in Germany, the competent authority for our
          establishment is the Hamburgische Beauftragte für Datenschutz und Informationsfreiheit.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">11) Account &amp; Data Deletion</h2>
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
        <h2 className="text-xl font-semibold">12) Security</h2>
        <p className="mt-3 text-[15px] leading-7">
          We implement reasonable technical and organizational safeguards, but no system is
          completely secure.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">13) Children</h2>
        <p className="mt-3 text-[15px] leading-7">
          The Services are intended for users aged 16 and older. We do not knowingly collect
          personal data from children under 16. If you become aware that a child under 16 has
          provided personal data without verifiable parental consent, please contact{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>{" "}
          and we will delete it.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">14) Policy Changes</h2>
        <p className="mt-3 text-[15px] leading-7">
          We may update this policy and will publish updates on this page with a revised date.
        </p>
      </section>
    </main>
  );
}
