// Returns the current Clerk user's Studio role + effective permissions.
// Used by the sidebar to hide nav items the user can't access.
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  ADMIN_ONLY_HREFS,
  getEffectivePermissionsForRole,
  getRequiredPermission,
  getStudioMember,
} from "@/lib/studio-access";

export const dynamic = "force-dynamic";

// Same set the StudioShell sidebar enumerates. Kept in sync so the
// server can pre-compute which routes the user is allowed to see and
// the client doesn't have to redo the permission math.
const NAV_HREFS = [
  "/studio",
  "/studio/journey-stories",
  "/studio/library",
  "/studio/standalone-stories",
  "/studio/catalog-books",
  "/studio/audio",
  "/studio/audio-editor",
  "/studio/covers",
  "/studio/temas",
  "/studio/progreso",
  "/studio/metrics",
  "/studio/config",
  "/studio/beta-signups",
  "/studio/settings",
];

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ role: null, permissions: [], allowedHrefs: [] }, { status: 401 });
  }
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    "";
  if (!email) {
    return NextResponse.json({ role: null, permissions: [], allowedHrefs: [] });
  }
  const member = await getStudioMember(email);
  if (!member) {
    return NextResponse.json({ role: null, permissions: [], allowedHrefs: [] });
  }
  const permissions =
    member.role === "admin"
      ? ["*"]
      : await getEffectivePermissionsForRole(member.role);
  // Admins see everything; non-admins are filtered by the live matrix
  // saved in StudioConfig.role_permissions. ADMIN_ONLY_HREFS (ESTUDIO
  // + ADMIN groups) are hidden no matter what the matrix says.
  const allowedHrefs =
    member.role === "admin"
      ? NAV_HREFS
      : NAV_HREFS.filter((href) => {
          if (ADMIN_ONLY_HREFS.has(href)) return false;
          const required = getRequiredPermission(href);
          if (required === "studio:view") return true; // homepage stays open
          return permissions.includes(required);
        });
  return NextResponse.json({
    role: member.role,
    permissions,
    allowedHrefs,
    email: member.email,
    name: member.name,
  });
}
