import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressum | Digital Polyglot",
  description: "Legal notice and provider identification for Digital Polyglot.",
};

export default function ImpressumPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 text-[var(--foreground)]">
      <h1 className="text-3xl font-bold">Impressum</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Last updated: March 8, 2026</p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Provider information</h2>
        <p className="mt-3 text-[15px] leading-7">
          Alberto Alejandro Del Carpio Olemar
          <br />
          Digital Polyglot
          <br />
          Sole proprietor / Einzelunternehmen
          <br />
          Heußweg 3
          <br />
          20257 Hamburg
          <br />
          Germany
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p className="mt-3 text-[15px] leading-7">
          Legal contact:{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:contact@digitalpolyglot.com">
            contact@digitalpolyglot.com
          </a>
          <br />
          Support:{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>
          <br />
          Phone: <a className="text-[var(--primary)] hover:underline" href="tel:+4915142899581">+49 1514 2899581</a>
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Tax information</h2>
        <p className="mt-3 text-[15px] leading-7">
          No VAT ID has been provided.
          <br />
          Small business status applies under <span className="font-medium">§ 19 UStG</span>
          {" "}(Kleinunternehmerregelung).
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Commercial register</h2>
        <p className="mt-3 text-[15px] leading-7">Not entered in the commercial register.</p>
      </section>
    </main>
  );
}
