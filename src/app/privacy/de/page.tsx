import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Datenschutzerklärung | Digital Polyglot",
  description: "Datenschutzerklärung für die Digital Polyglot Reader App.",
};

export default function PrivacyDePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 text-[var(--foreground)]">
      <h1 className="text-3xl font-bold">Datenschutzerklärung</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Stand: 7. Mai 2026</p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        <Link href="/privacy" className="text-[var(--primary)] hover:underline">
          Read this page in English
        </Link>
      </p>

      <section className="mt-8 space-y-4 text-[15px] leading-7">
        <p>
          Digital Polyglot (&quot;wir&quot;, &quot;uns&quot;, &quot;unser&quot;) betreibt die Digital Polyglot Reader App
          und zugehörige Dienste unter{" "}
          <span className="font-medium">reader.digitalpolyglot.com</span> (die &quot;Dienste&quot;). Diese
          Datenschutzerklärung erläutert, wie wir personenbezogene Daten erheben, verwenden und
          schützen, wenn Sie unsere Dienste nutzen.
        </p>
        <p>
          Sofern Sie auch unseren E-Commerce-Shop nutzen, kann dieser einer separaten
          Datenschutzerklärung unterliegen. Diese Seite gilt ausschließlich für die Reader App.
        </p>
        <p className="text-[13px] text-[var(--muted)]">
          Diese Fassung ist eine Übersetzung der englischen Originalfassung. Bei Abweichungen
          zwischen den Sprachfassungen gilt für Nutzer mit Wohnsitz in Deutschland die deutsche
          Fassung.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">1) Verantwortlicher</h2>
        <p className="mt-3 text-[15px] leading-7">
          Alberto Alejandro Del Carpio Olemar
          <br />
          Digital Polyglot
          <br />
          Heußweg 3, 20257 Hamburg, Deutschland
          <br />
          Anfragen oder Anliegen:{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>
          <br />
          Rechtlicher Kontakt:{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:contact@digitalpolyglot.com">
            contact@digitalpolyglot.com
          </a>
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">2) Welche Daten wir erheben</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
          <li>Kontodaten (Name, E-Mail, Nutzer-ID, Auth-Provider-ID).</li>
          <li>Authentifizierungsmetadaten (einschließlich Social-Login-Identifikatoren).</li>
          <li>Abonnement- und Abrechnungsstatus (Tarif, Trial-Status, Stripe-Kunden-/Abonnement-IDs).</li>
          <li>Lerndaten (Fortschritt, Favoriten, gespeicherte Inhalte, Hör- und Leseaktivitäten).</li>
          <li>Technische und Gerätedaten (IP-Adresse, Browser, Logs, Zeitstempel).</li>
          <li>Mobile Gerätekennungen, Betriebssystem und App-Version (bei Nutzung der mobilen App).</li>
          <li>Push-Benachrichtigungstokens (sofern Sie Erinnerungen oder Benachrichtigungen aktivieren).</li>
          <li>In-App-Kauf-Metadaten (sofern zutreffend).</li>
          <li>Analyse- und Produktnutzungsereignisse.</li>
          <li>Support- und Feedback-Kommunikation.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">3) Quellen der Daten</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
          <li>Direkt von Ihnen.</li>
          <li>Automatisch durch App-Nutzung sowie Cookies und lokalen Speicher.</li>
          <li>Von Dienstleistern (Authentifizierung, Zahlungen, Infrastruktur).</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">4) Wie wir Daten verwenden</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
          <li>Bereitstellung und Absicherung Ihres Kontos und der Dienste.</li>
          <li>Personalisierung von Story-Empfehlungen und Lernerfahrung.</li>
          <li>Verwaltung von Abonnements, Trials und Abrechnung.</li>
          <li>Messung der Produktleistung und Verbesserung der Funktionen.</li>
          <li>Verhinderung von Betrug und Missbrauch; Erfüllung gesetzlicher Pflichten.</li>
          <li>Bereitstellung von Kundensupport und Servicekommunikation.</li>
        </ul>
        <p className="mt-3 text-[15px] leading-7">
          Wir können aggregierte und anonymisierte Nutzungsdaten verwenden, um algorithmische und
          Machine-Learning-Systeme zu entwickeln, zu trainieren und zu evaluieren, die
          Lernempfehlungen, Inhaltsqualität und Lernergebnisse verbessern. Identifizierbare Daten
          verwenden wir zum Training solcher Systeme nur dann, wenn wir über eine gültige
          Rechtsgrundlage nach geltendem Datenschutzrecht oder Ihre ausdrückliche Einwilligung
          verfügen.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">5) Rechtsgrundlagen (EWR/UK)</h2>
        <p className="mt-3 text-[15px] leading-7">
          Soweit anwendbar, verarbeiten wir Daten auf Grundlage der Vertragserfüllung, berechtigter
          Interessen, Einwilligung (sofern erforderlich) und gesetzlicher Verpflichtungen.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">6) Auftragsverarbeiter</h2>
        <p className="mt-3 text-[15px] leading-7">
          Wir setzen Drittanbieter als Auftragsverarbeiter ein, um die Dienste zu betreiben und zu
          verbessern. Aktuelle Auftragsverarbeiter umfassen:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
          <li>Clerk (Authentifizierung und Identität)</li>
          <li>Stripe (Zahlungen und Abrechnung)</li>
          <li>Vercel (Hosting und Edge-Infrastruktur)</li>
          <li>Sentry (Fehlerüberwachung)</li>
          <li>Google Analytics (Webanalyse, nur mit Ihrer Einwilligung)</li>
          <li>
            OpenAI (Sprache-zu-Text-Transkription und Inhaltserzeugung im redaktionellen
            Studio-Workflow)
          </li>
          <li>Anthropic (Inhaltserzeugung und redaktionelle Überprüfung im Studio)</li>
          <li>ElevenLabs (Text-zu-Sprache-Erzeugung für Story-Vertonung)</li>
          <li>Sanity (Content-Management für Storys, Vokabular und Assets)</li>
          <li>Modal (Compute-Infrastruktur für selbst gehostete Text-zu-Sprache-Dienste)</li>
        </ul>
        <p className="mt-3 text-[15px] leading-7">
          Wir verkaufen keine identifizierbaren personenbezogenen Daten gegen Geld. Wir können
          aggregierte, de-identifizierte oder anonymisierte Daten (Daten, die nicht
          vernünftigerweise zur Identifizierung Ihrer Person verwendet werden können) für
          Forschung, Produktverbesserung, Partnerschaften und Analysezwecke teilen, im Einklang mit
          geltendem Recht.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">7) Übertragung im Rahmen von Unternehmenstransaktionen</h2>
        <p className="mt-3 text-[15px] leading-7">
          Sind wir an einer Fusion, Übernahme, Reorganisation, einem Verkauf von Vermögenswerten
          oder einem Insolvenzereignis beteiligt, können personenbezogene Daten als Teil der
          Transaktion übertragen oder offengelegt werden, sofern die empfangende Partei den Schutz
          dieser Datenschutzerklärung wahrt oder gleichwertige Schutzmaßnahmen bietet. Wir machen
          eine entsprechende Mitteilung, soweit dies gesetzlich erforderlich ist.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">8) Internationale Datenübermittlungen</h2>
        <p className="mt-3 text-[15px] leading-7">
          Mehrere unserer Auftragsverarbeiter befinden sich außerhalb des Europäischen
          Wirtschaftsraums, insbesondere in den Vereinigten Staaten (z. B. Clerk, Stripe, Vercel,
          Sentry, Google Analytics, OpenAI, Anthropic, ElevenLabs, Sanity und Modal). Bei
          Übermittlungen personenbezogener Daten außerhalb des EWR setzen wir Schutzmaßnahmen ein,
          etwa die von der Europäischen Kommission verabschiedeten Standardvertragsklauseln
          (Beschluss 2021/914/EU), das EU-US Data Privacy Framework, sofern der Empfänger
          zertifiziert ist, oder andere gesetzlich zulässige Übermittlungsmechanismen.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">9) Aufbewahrung</h2>
        <p className="mt-3 text-[15px] leading-7">
          Wir bewahren personenbezogene Daten nur so lange auf, wie es zur Bereitstellung der
          Dienste, zur Unterstützung Ihres Kontos, zur Erfüllung gesetzlicher Pflichten und zur
          Beilegung von Streitigkeiten erforderlich ist. Indikative Aufbewahrungsfristen:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
          <li>Konto- und Profildaten: bis Sie eine Löschung beantragen oder Ihr Konto schließen.</li>
          <li>
            Lerndaten und Fortschritt: solange Ihr Konto aktiv ist; nach Löschung aggregiert oder
            anonymisiert, soweit gesetzlich zulässig.
          </li>
          <li>
            Produktnutzungsereignisse und Analysen: in identifizierbarer Form typischerweise bis zu
            24 Monate, danach aggregiert oder gelöscht.
          </li>
          <li>Technische Logs: typischerweise bis zu 90 Tage.</li>
          <li>
            Support- und Feedback-Kommunikation: typischerweise bis zu 24 Monate nach dem letzten
            Kontakt.
          </li>
          <li>
            Rechnungs-, Buchhaltungs- und Steuerunterlagen: aufbewahrt nach gesetzlichen
            Anforderungen (in Deutschland in der Regel bis zu 10 Jahre gemäß §147 AO).
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">10) Ihre Rechte</h2>
        <p className="mt-3 text-[15px] leading-7">
          Je nach Wohnort haben Sie möglicherweise das Recht auf Auskunft, Berichtigung, Löschung,
          Datenübertragbarkeit oder Einschränkung der Verarbeitung Ihrer personenbezogenen Daten
          sowie auf Widerruf einer Einwilligung, sofern anwendbar. Sie erreichen uns unter{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>
          .
        </p>
        <p className="mt-3 text-[15px] leading-7">
          Sofern Sie sich im EWR/UK befinden, haben Sie zudem das Recht, Beschwerde bei Ihrer
          örtlichen Aufsichtsbehörde einzureichen. Für Nutzer in Deutschland ist die für unseren
          Sitz zuständige Aufsichtsbehörde der Hamburgische Beauftragte für Datenschutz und
          Informationsfreiheit.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">11) Konto- und Datenlöschung</h2>
        <p className="mt-3 text-[15px] leading-7">
          Sie können die Löschung Ihres Kontos und Ihrer Daten beantragen, indem Sie eine E-Mail an{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>{" "}
          senden. Für Nutzer mit Facebook-Login finden Sie Anweisungen zur Löschung unter{" "}
          <a className="text-[var(--primary)] hover:underline" href="/data-deletion">
            /data-deletion
          </a>
          .
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">12) Sicherheit</h2>
        <p className="mt-3 text-[15px] leading-7">
          Wir setzen angemessene technische und organisatorische Schutzmaßnahmen ein, jedoch ist
          kein System vollständig sicher.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">13) Kinder</h2>
        <p className="mt-3 text-[15px] leading-7">
          Die Dienste richten sich an Nutzer ab 16 Jahren. Wir erheben wissentlich keine
          personenbezogenen Daten von Kindern unter 16 Jahren. Sollten Sie feststellen, dass ein
          Kind unter 16 Jahren ohne nachweisbare Einwilligung der Eltern personenbezogene Daten
          übermittelt hat, wenden Sie sich bitte an{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>
          ; wir werden diese Daten löschen.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">14) Änderungen der Datenschutzerklärung</h2>
        <p className="mt-3 text-[15px] leading-7">
          Wir können diese Erklärung aktualisieren und Aktualisierungen mit einem geänderten Datum
          auf dieser Seite veröffentlichen.
        </p>
      </section>
    </main>
  );
}
