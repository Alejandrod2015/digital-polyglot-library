// GET → current matrix for the Manager + Creator roles.
// PUT → save a new matrix. Admins only.
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  getRolePermissions,
  getStudioMember,
  saveRolePermissions,
  TOGGLEABLE_PERMISSIONS,
} from "@/lib/studio-access";

export const dynamic = "force-dynamic";

async function requireAdmin(): Promise<
  | { ok: true; email: string }
  | { ok: false; status: number; error: string }
> {
  const { userId } = await auth();
  if (!userId) return { ok: false, status: 401, error: "Unauthorized" };
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? "";
  if (!email) return { ok: false, status: 403, error: "No email on session" };
  const member = await getStudioMember(email);
  if (!member || member.role !== "admin") {
    return { ok: false, status: 403, error: "Admin only" };
  }
  return { ok: true, email };
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const matrix = await getRolePermissions();
  return NextResponse.json({
    toggleable: TOGGLEABLE_PERMISSIONS,
    permissions: {
      manager: matrix.manager,
      creator: matrix.content_creator,
    },
  });
}

export async function PUT(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = (await req.json().catch(() => null)) as
    | { manager?: string[]; creator?: string[] }
    | null;
  if (!body || !Array.isArray(body.manager) || !Array.isArray(body.creator)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  await saveRolePermissions({
    manager: body.manager.filter((p): p is string => typeof p === "string"),
    content_creator: body.creator.filter((p): p is string => typeof p === "string"),
  });
  const fresh = await getRolePermissions();
  return NextResponse.json({
    ok: true,
    permissions: { manager: fresh.manager, creator: fresh.content_creator },
  });
}
