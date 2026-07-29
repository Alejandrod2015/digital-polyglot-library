// /src/app/menu/page.tsx
//
// Pantalla "Menu"; paridad con iPhone MobileLibraryShell.menuView.
// Se muestra al tap del tab "Menu" del MobileTabBar. Lista las
// secciones: Your activity (Progress / Library / Saved), Create
// (Create story + plan-gated SoTW/SoTD) y Account (Upgrade
// plan-gated, Settings, Sign out). Links plano, sin sidebar.

import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import MenuClient from "./MenuClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Menu | Digital Polyglot",
};

type Plan = "free" | "basic" | "premium" | "polyglot";

function readPlan(value: string): Plan {
  return value === "basic" || value === "premium" || value === "polyglot" || value === "free"
    ? value
    : "free";
}

export default async function MenuPage() {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in?redirect_url=/menu");
  }
  // `owner` is the internal tier, not a purchasable one. It grants at least the
  // polyglot entitlement server-side (packages/domain/src/access.ts), so map it
  // there for the plan-gated rows, and pass the raw fact separately: the
  // internal-tools row must never be reachable from a plan someone can buy.
  const rawPlan =
    typeof user?.publicMetadata?.plan === "string"
      ? user.publicMetadata.plan.trim().toLowerCase()
      : "";
  const isOwner = rawPlan === "owner";
  const plan = isOwner ? "polyglot" : readPlan(rawPlan);
  return <MenuClient plan={plan} isOwner={isOwner} />;
}
