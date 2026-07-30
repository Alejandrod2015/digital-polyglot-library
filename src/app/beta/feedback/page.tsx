import type { Metadata } from "next";
import landing from "@/components/marketing/LandingPage.module.css";
import MarketingNav from "@/components/marketing/MarketingNav";
import BetaFeedbackForm from "./BetaFeedbackForm";

export const metadata: Metadata = {
  title: "Beta feedback · Digital Polyglot",
  // Reachable only through a signed link in an email. Nothing here should be
  // indexed or followed.
  robots: { index: false, follow: false },
};

export default async function BetaFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; kind?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className={landing.page}>
      <MarketingNav />
      <div className={landing.frame}>
        <div className="mx-auto max-w-xl pb-20 pt-12 sm:pt-16">
          <BetaFeedbackForm token={params.token ?? ""} initialKind={params.kind ?? "bug"} />
        </div>
      </div>
    </main>
  );
}
