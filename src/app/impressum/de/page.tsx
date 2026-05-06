import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Impressum | Digital Polyglot",
  description: "Anbieterkennzeichnung und rechtlicher Hinweis für Digital Polyglot.",
};

export default function ImpressumDePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 text-[var(--foreground)]">
      <h1 className="text-3xl font-bold">Impressum</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Stand: 8. März 2026</p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        <Link href="/impressum" className="text-[var(--primary)] hover:underline">
          Read this page in English
        </Link>
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Anbieter</h2>
        <p className="mt-3 text-[15px] leading-7">
          Alberto Alejandro Del Carpio Olemar
          <br />
          Digital Polyglot
          <br />
          Einzelunternehmen
          <br />
          Heußweg 3
          <br />
          20257 Hamburg
          <br />
          Deutschland
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Kontakt</h2>
        <p className="mt-3 text-[15px] leading-7">
          Rechtlicher Kontakt:{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:contact@digitalpolyglot.com">
            contact@digitalpolyglot.com
          </a>
          <br />
          Support:{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>
          <br />
          Telefon:{" "}
          <a className="text-[var(--primary)] hover:underline" href="tel:+4915142899581">
            +49 1514 2899581
          </a>
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Steuerliche Angaben</h2>
        <p className="mt-3 text-[15px] leading-7">
          Es wurde keine Umsatzsteuer-Identifikationsnummer angegeben.
          <br />
          Es gilt die <span className="font-medium">Kleinunternehmerregelung gemäß § 19 UStG</span>.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Handelsregister</h2>
        <p className="mt-3 text-[15px] leading-7">Nicht im Handelsregister eingetragen.</p>
      </section>
    </main>
  );
}
