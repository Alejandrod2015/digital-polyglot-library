import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Nutzungsbedingungen | Digital Polyglot",
  description:
    "Nutzungsbedingungen für Abonnements und die Nutzung des Digital Polyglot Reader.",
};

export default function TermsDePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 text-[var(--foreground)]">
      <h1 className="text-3xl font-bold">Nutzungsbedingungen</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Stand: 8. März 2026</p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        <Link href="/terms" className="text-[var(--primary)] hover:underline">
          Read this page in English
        </Link>
      </p>

      <section className="mt-8 space-y-4 text-[15px] leading-7">
        <p>
          Diese Nutzungsbedingungen regeln Ihre Nutzung der Digital Polyglot Reader App und der
          zugehörigen Dienste unter <span className="font-medium">reader.digitalpolyglot.com</span>.
        </p>
        <p className="text-[13px] text-[var(--muted)]">
          Diese Fassung ist eine Übersetzung der englischen Originalfassung. Bei Abweichungen
          zwischen den Sprachfassungen gilt für Nutzer mit Wohnsitz in Deutschland die deutsche
          Fassung.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">1) Betreiber</h2>
        <p className="mt-3 text-[15px] leading-7">
          Alberto Alejandro Del Carpio Olemar
          <br />
          Digital Polyglot
          <br />
          Einzelunternehmen
          <br />
          Heußweg 3, 20257 Hamburg, Deutschland
          <br />
          Rechtlicher Kontakt:{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:contact@digitalpolyglot.com">
            contact@digitalpolyglot.com
          </a>
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">2) Konten</h2>
        <p className="mt-3 text-[15px] leading-7">
          Sie sind für Ihre Zugangsdaten und für Aktivitäten unter Ihrem Konto verantwortlich. Wir
          können den Zugang aussetzen bei Missbrauch, Betrug, Sicherheitsproblemen oder
          wesentlichen Verstößen gegen diese Bedingungen.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">3) Abonnements und Testzeiträume</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
          <li>Der kostenpflichtige Zugang wird als wiederkehrendes Abonnement angeboten.</li>
          <li>Preise und Abrechnungsintervalle werden auf der Tarifseite und beim Checkout angezeigt.</li>
          <li>
            Sofern angeboten, gehen Testzeiträume automatisch in ein kostenpflichtiges Abonnement
            über, sofern Sie nicht vor dem Abrechnungsdatum kündigen.
          </li>
          <li>Die Abrechnung erfolgt über Stripe.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">4) Verlängerung, Kündigung und Abrechnungsverwaltung</h2>
        <p className="mt-3 text-[15px] leading-7">
          Abonnements verlängern sich automatisch, bis sie gekündigt werden. Sie können die
          Abrechnung verwalten, den Tarif wechseln oder kündigen über die
          Abrechnungseinstellungen oder das Stripe-Kundenportal.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">5) Digitale Dienste und Widerrufsinformationen</h2>
        <p className="mt-3 text-[15px] leading-7">
          Wenn Sie einen kostenpflichtigen Testzeitraum oder ein Abonnement starten und sofort
          Zugriff auf digitale Inhalte oder Dienste erhalten, fordern Sie ausdrücklich, dass die
          Leistungserbringung sofort beginnt. Soweit nach Verbraucherrecht anwendbar, kann dies
          Widerrufsrechte einschränken oder ausschließen, sobald die digitale Leistung begonnen hat
          oder vollständig erbracht wurde. Zwingende Rechte nach geltendem Recht bleiben unberührt.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">6) Zulässige Nutzung</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
          <li>
            Missbrauchen Sie den Dienst nicht, beeinträchtigen Sie nicht dessen Sicherheit und
            scrapen Sie keine Inhalte unrechtmäßig.
          </li>
          <li>
            Teilen Sie keinen kostenpflichtigen Zugang in einer Weise, die das Abonnementmodell
            unterläuft.
          </li>
          <li>Laden oder generieren Sie keine rechtswidrigen, verletzenden oder missbräuchlichen Inhalte.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">7) Geistiges Eigentum</h2>
        <p className="mt-3 text-[15px] leading-7">
          Die App, die Storys, Marken und zugehörigen Materialien bleiben Eigentum von Digital
          Polyglot oder seiner Lizenzgeber, sofern nicht anders angegeben. Diese Bedingungen
          gewähren Ihnen ein eingeschränktes, nicht ausschließliches Recht zur Nutzung des Dienstes
          für persönliche Lernzwecke.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">8) Verfügbarkeit und Änderungen</h2>
        <p className="mt-3 text-[15px] leading-7">
          Wir können Funktionen, Preise und Inhalte im Laufe der Zeit aktualisieren. Wir
          garantieren keine ununterbrochene Verfügbarkeit, sind jedoch bestrebt, den Dienst
          zuverlässig zu betreiben.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">9) Haftung</h2>
        <p className="mt-3 text-[15px] leading-7">
          Soweit gesetzlich zulässig, ist unsere Haftung auf vorhersehbare Schäden beschränkt, die
          durch die Verletzung wesentlicher Pflichten verursacht werden. Eine Haftung, die nach
          geltendem Recht nicht ausgeschlossen werden kann, bleibt von diesen Bedingungen
          unberührt.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">10) Rückerstattungen und externe Shop-Links</h2>
        <p className="mt-3 text-[15px] leading-7">
          App-Abonnements unterliegen dem geltenden Verbraucherrecht und den
          Abrechnungs-/Zahlungsregeln des für den Kauf verwendeten Abonnementablaufs. Physische
          Produkte, die über externe Shop-Links erworben werden, unterliegen den Rückerstattungs-
          und Rückgaberichtlinien des jeweiligen Shops, nicht dieser App.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">11) Anwendbares Recht</h2>
        <p className="mt-3 text-[15px] leading-7">
          Es gilt das Recht der Bundesrepublik Deutschland, ohne zwingende
          Verbraucherschutzbestimmungen einzuschränken, die in Ihrem Wohnsitzland Anwendung finden.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">12) Kontakt</h2>
        <p className="mt-3 text-[15px] leading-7">
          Fragen:{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>
        </p>
      </section>
    </main>
  );
}
