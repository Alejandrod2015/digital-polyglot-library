export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getActiveMobileSession } from "@/lib/mobileSession";
import { getLanguageAvailability } from "@/lib/languageAvailability";

/**
 * Returns the full Studio language catalog so the mobile language switcher
 * mirrors the Planning page. A language is `comingSoon` when there is no
 * active Journey record for it yet; the user can see it as a future option
 * but cannot pick it as a target language.
 *
 * La regla vive en `@/lib/languageAvailability` desde que la web tambien la
 * necesita: su selector del onboarding pintaba seis idiomas sin mirar si
 * alguno existia.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const session = await getActiveMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const languages = await getLanguageAvailability();
  return NextResponse.json({ languages });
}
