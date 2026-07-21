import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccountPanel, type DeleteAccountCopy } from "../DeleteAccountPanel";

export const metadata: Metadata = {
  title: "Anweisungen zur Datenlöschung | Digital Polyglot",
  description:
    "So beantragen Sie die Löschung Ihres Kontos und Ihrer personenbezogenen Daten bei Digital Polyglot.",
};

const DE_COPY: DeleteAccountCopy = {
  signedOutTitle: "Konto jetzt löschen",
  signedOutBody:
    "Melden Sie sich auf diesem Gerät an, um Ihr Konto und Ihre Daten sofort zu löschen. Falls Sie sich nicht anmelden können, nutzen Sie die E-Mail-Methode unten.",
  signedInTitle: "Konto jetzt löschen",
  signedInBody:
    "Dies löscht Ihr Konto und alle zugehörigen Daten dauerhaft: Lernverlauf, Favoriten, gespeicherte Storys, Metriken und Abrechnungsdaten. Dies kann nicht rückgängig gemacht werden.",
  accountLabel: "Konto",
  deleteButton: "Mein Konto löschen",
  confirmButton: "Ja, alles löschen",
  deletingLabel: "Wird gelöscht…",
  cancelButton: "Abbrechen",
  doneBody: "Ihr Konto und Ihre personenbezogenen Daten wurden gelöscht. Sie werden abgemeldet…",
  genericError: "Löschung fehlgeschlagen. Bitte erneut versuchen oder schreiben Sie uns.",
};

export default function DataDeletionDePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 text-[var(--foreground)]">
      <h1 className="text-3xl font-bold">Anweisungen zur Datenlöschung</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Stand: 5. März 2026</p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        <Link href="/data-deletion" className="text-[var(--primary)] hover:underline">
          Read this page in English
        </Link>
      </p>

      <p className="mt-8 text-[15px] leading-7">
        Sie können Ihr Digital-Polyglot-Konto und alle zugehörigen personenbezogenen Daten jederzeit
        löschen. Am schnellsten geht es über die Selbstbedienungsoption unten; alternativ steht ein
        E-Mail-Weg zur Verfügung.
      </p>

      <DeleteAccountPanel copy={DE_COPY} />

      <h2 className="mt-8 text-xl font-semibold">Lieber per E-Mail beantragen?</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-6 text-[15px] leading-7">
        <li>
          Senden Sie eine E-Mail an{" "}
          <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
            support@digitalpolyglot.com
          </a>{" "}
          mit dem Betreff: <span className="font-medium">Antrag auf Datenlöschung</span>.
        </li>
        <li>
          Geben Sie die E-Mail-Adresse an, die in Ihrem Digital-Polyglot-Konto verwendet wird.
        </li>
        <li>
          Zur Verifizierung können wir Sie bitten, die Inhaberschaft des Kontos zu bestätigen.
        </li>
      </ol>

      <h2 className="mt-8 text-xl font-semibold">Was wir löschen</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
        <li>Konto-Profildaten und Login-Verknüpfung.</li>
        <li>
          Lernverlauf, Favoriten, gespeicherte Storys und Bücher sowie zugehörige nutzergenerierte
          Daten.
        </li>
        <li>Personenbezogene Identifikatoren in operativen Systemen.</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">Was möglicherweise aufbewahrt wird</h2>
      <p className="mt-3 text-[15px] leading-7">
        Wir können bestimmte Daten in eingeschränktem Umfang aufbewahren, soweit dies aufgrund
        gesetzlicher Vorgaben, zur Betrugsprävention, zur Sicherheit oder aus berechtigten
        buchhalterischen oder regulatorischen Pflichten erforderlich ist.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Zeitrahmen</h2>
      <p className="mt-3 text-[15px] leading-7">
        Wir bemühen uns, verifizierte Löschanträge innerhalb von 30 Tagen zu bearbeiten.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Kontakt</h2>
      <p className="mt-3 text-[15px] leading-7">
        Fragen oder Anliegen:{" "}
        <a className="text-[var(--primary)] hover:underline" href="mailto:support@digitalpolyglot.com">
          support@digitalpolyglot.com
        </a>
      </p>
    </main>
  );
}
