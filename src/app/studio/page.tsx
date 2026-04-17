import { redirect } from "next/navigation";
import { requireStudioUser } from "@/lib/requireStudioUser";

export default async function StudioPage() {
  await requireStudioUser("/studio");
  redirect("/studio/journey-manager");
}
