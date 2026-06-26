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

function readPlan(value: unknown): Plan {
  return value === "basic" || value === "premium" || value === "polyglot" || value === "free"
    ? value
    : "free";
}

export default async function MenuPage() {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in?redirect_url=/menu");
  }
  const plan = readPlan(user?.publicMetadata?.plan);
  return <MenuClient plan={plan} />;
}
