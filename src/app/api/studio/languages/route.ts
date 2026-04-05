import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

function toSlug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

/** GET — list languages with variants */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const languages = await prisma.language.findMany({
    orderBy: { sortOrder: "asc" },
    include: { variants: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json(languages);
}

/** POST — create language. Body: { label, variants: [{ code, label }] } */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.label?.trim()) return NextResponse.json({ error: "label required" }, { status: 400 });

  const code = toSlug(body.label);
  const max = await prisma.language.aggregate({ _max: { sortOrder: true } });
  const lang = await prisma.language.create({
    data: {
      code, label: body.label.trim(), sortOrder: (max._max.sortOrder ?? 0) + 1,
      variants: {
        create: (body.variants || [{ code: toSlug(body.label), label: body.label.trim() }]).map((v: any, i: number) => ({
          code: toSlug(v.label || v.code), label: (v.label || v.code).trim(), sortOrder: i + 1,
        })),
      },
    },
    include: { variants: true },
  });
  return NextResponse.json(lang);
}

/** PATCH — update language. Body: { id, label? } */
export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const data: any = {};
  if (body.label) { data.label = body.label.trim(); data.code = toSlug(body.label); }

  // Handle variant updates
  if (body.addVariant) {
    await prisma.languageVariant.create({
      data: { languageId: body.id, code: toSlug(body.addVariant), label: body.addVariant.trim(), sortOrder: 99 },
    });
  }
  if (body.removeVariantId) {
    await prisma.languageVariant.delete({ where: { id: body.removeVariantId } });
  }
  if (body.renameVariant) {
    await prisma.languageVariant.update({
      where: { id: body.renameVariant.id },
      data: { label: body.renameVariant.label.trim(), code: toSlug(body.renameVariant.label) },
    });
  }

  if (Object.keys(data).length > 0) {
    await prisma.language.update({ where: { id: body.id }, data });
  }

  const updated = await prisma.language.findUnique({ where: { id: body.id }, include: { variants: { orderBy: { sortOrder: "asc" } } } });
  return NextResponse.json(updated);
}

/** DELETE — delete language. Body: { id } */
export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.language.delete({ where: { id: body.id } });
  return NextResponse.json({ ok: true });
}
