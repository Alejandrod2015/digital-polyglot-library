import { requireStudioUser } from "@/lib/requireStudioUser";
import StudioShell from "@/components/studio/StudioShell";
import BetaSignupsClient from "./BetaSignupsClient";

export default async function BetaSignupsPage() {
  await requireStudioUser("/studio/beta-signups");

  return (
    <StudioShell
      title="Beta Signups"
      description="Applications from the public /beta form. Review, invite, and track TestFlight beta testers."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Beta Signups" },
      ]}
    >
      <BetaSignupsClient />
    </StudioShell>
  );
}
