import { requireStudioUser } from "@/lib/requireStudioUser";
import StudioShell from "@/components/studio/StudioShell";
import BetaProgramClient from "./BetaProgramClient";

export default async function BetaProgramPage() {
  await requireStudioUser("/studio/beta");

  return (
    <StudioShell
      title="Beta Program"
      description="Applicants triage themselves in. Feedback comes back structured. Build notes tell every tester what their reports changed."
      breadcrumbs={[{ label: "Studio", href: "/studio" }, { label: "Beta Program" }]}
    >
      <BetaProgramClient />
    </StudioShell>
  );
}
