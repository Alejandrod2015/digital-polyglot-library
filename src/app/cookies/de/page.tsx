import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie-Richtlinie | Digital Polyglot",
  description: "Cookie-Richtlinie für Digital Polyglot Reader.",
};

export default function CookiePolicyDePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 text-[var(--foreground)]">
      <h1 className="text-3xl font-bold">Cookie-Richtlinie</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Stand: 8. März 2026</p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        <Link href="/cookies" className="text-[var(--primary)] hover:underline">
          Read this page in English
        </Link>
      </p>

      <section className="mt-8 space-y-4 text-[15px] leading-7">
        <p>
          Diese Cookie-Richtlinie erläutert, wie Digital Polyglot Cookies und ähnliche Technologien
          auf <span className="font-medium">reader.digitalpolyglot.com</span> verwendet.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">1) Arten von Cookies, die wir verwenden</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
          <li>
            <span className="font-medium">Unbedingt erforderliche Cookies</span> für
            Authentifizierung, Sicherheit und grundlegende App-Funktionalität.
          </li>
          <li>
            <span className="font-medium">Speicherung von Präferenzen</span> für Einstellungen wie
            Theme und Lesezustand auf Ihrem Gerät.
          </li>
          <li>
            <span className="font-medium">Analyse-Cookies</span> nur mit Ihrer Einwilligung, um
            Nutzung zu verstehen und das Produkt zu verbessern.
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">2) Anbieter</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
          <li>Clerk für Authentifizierung und Sitzungsverwaltung.</li>
          <li>Stripe für Checkout und abrechnungsbezogene Sitzungsverwaltung.</li>
          <li>
            Google Analytics 4 für Analysen, ausschließlich nach erteilter Einwilligung.
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">3) Verwaltung der Einwilligung</h2>
        <p className="mt-3 text-[15px] leading-7">
          Beim ersten Besuch fragen wir, ob Sie Analyse-Cookies zulassen möchten. Wenn Sie diese
          ablehnen, werden Analyse-Skripte nicht geladen. Notwendige Cookies bleiben aktiv, da sie
          für die sichere Bereitstellung des Dienstes erforderlich sind.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">4) Speicherung auf dem Gerät</h2>
        <p className="mt-3 text-[15px] leading-7">
          Wir nutzen außerdem den lokalen Speicher Ihres Geräts für App-Funktionen wie Fortschritt,
          Präferenzen, Lesezustand und zwischengespeicherte Inhalte. Diese Daten unterstützen das
          Kernverhalten des Produkts und werden nicht für Werbezwecke verwendet.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">5) Kontakt</h2>
        <p className="mt-3 text-[15px] leading-7">
          Fragen zu Cookies oder Datenschutz:{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>
        </p>
      </section>
    </main>
  );
}
