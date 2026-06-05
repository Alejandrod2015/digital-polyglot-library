import { Suspense } from "react";
import EmailPreferencesClient from "./EmailPreferencesClient";

export const metadata = {
  title: "Email preferences · Digital Polyglot",
};

// Reads a ?token from the URL, so render dynamically.
export const dynamic = "force-dynamic";

export default function EmailPreferencesPage() {
  return (
    <Suspense fallback={null}>
      <EmailPreferencesClient />
    </Suspense>
  );
}
