import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Deletion Instructions | Digital Polyglot",
  description: "How to request account and personal data deletion for Digital Polyglot.",
};

export default function DataDeletionPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 text-[var(--foreground)]">
      <h1 className="text-3xl font-bold">Data Deletion Instructions</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Last updated: March 5, 2026</p>

      <p className="mt-8 text-[15px] leading-7">
        If you signed in to Digital Polyglot using Facebook and want your account and associated
        personal data deleted, follow the steps below.
      </p>

      <h2 className="mt-8 text-xl font-semibold">How to request deletion</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-6 text-[15px] leading-7">
        <li>
          Send an email to{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>{" "}
          with subject: <span className="font-medium">Data Deletion Request</span>.
        </li>
        <li>Include the email address used in your Digital Polyglot account.</li>
        <li>For verification, we may ask you to confirm account ownership.</li>
      </ol>

      <h2 className="mt-8 text-xl font-semibold">What we delete</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
        <li>Account profile data and login association.</li>
        <li>Learning history, favorites, saved stories/books, and related user-generated records.</li>
        <li>Personal identifiers stored in operational systems.</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">What may be retained</h2>
      <p className="mt-3 text-[15px] leading-7">
        We may retain limited information where required by law, fraud prevention, security, or
        legitimate accounting/compliance obligations.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Timeline</h2>
      <p className="mt-3 text-[15px] leading-7">
        We aim to complete verified deletion requests within 30 days.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Contact</h2>
      <p className="mt-3 text-[15px] leading-7">
        Questions or requests:{" "}
        <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
          support@digitalpolyglot.com
        </a>
      </p>
    </main>
  );
}
