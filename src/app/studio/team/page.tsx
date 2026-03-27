import { requireStudioUser } from "@/lib/requireStudioUser";
import StudioShell from "@/components/studio/StudioShell";
import TeamClient from "./TeamClient";

export default async function TeamPage() {
  const { role } = await requireStudioUser("/studio/team");

  return (
    <StudioShell
      title="Team"
      description="Manage who has access to Studio and their roles."
      breadcrumbs={[
        { label: "Studio", href: "/studio" },
        { label: "Team" },
      ]}
    >
      <TeamClient currentRole={role} />
    </StudioShell>
  );
}
