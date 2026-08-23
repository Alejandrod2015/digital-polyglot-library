// Prueba del aviso de "historia a medias" contra UNA cuenta real.
// Lee el usuario en el Clerk que le pasen por entorno, enseña sus dispositivos
// con el token ENMASCARADO y manda el aviso con el texto de verdad.
// No deja sello, así que se puede repetir.
import { createClerkClient } from "@clerk/backend";
import { prisma } from "../src/lib/prisma";
import { sendApnsPush } from "../src/lib/apnsPush";
import { resumeCopy, sendResumeTest, RESUME_NOTIFICATION_KEY } from "../src/lib/resumeStoryPush";

const EMAIL = process.argv[2] ?? "delcarpio321@gmail.com";
const SEND = process.argv.includes("--send");
// `--force` salta la comprobacion de opt-in. Solo para probar en el telefono
// propio: el cron NUNCA hace esto, ahi un interruptor apagado descarta al
// usuario y punto.
const FORCE = process.argv.includes("--force");

async function main() {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  const list = await clerk.users.getUserList({ emailAddress: [EMAIL], limit: 5 });
  if (list.data.length === 0) {
    console.log("No hay usuario con ese correo en este Clerk.");
    return;
  }
  for (const user of list.data) {
    const priv = (user.privateMetadata as Record<string, unknown>) ?? {};
    const pub = (user.publicMetadata as Record<string, unknown>) ?? {};
    const tokens = Array.isArray(priv.mobilePushTokens) ? (priv.mobilePushTokens as Array<Record<string, unknown>>) : [];
    console.log(`\nuserId: ${user.id}`);
    console.log("prefs:", JSON.stringify(pub.notificationPrefs ?? "(sin prefs, valen los defaults)"));
    console.log("dispositivos:", tokens.length);
    for (const t of tokens) {
      const raw = typeof t.token === "string" ? t.token : "";
      console.log(`   provider=${String(t.provider)} platform=${String(t.platform ?? "?")} token=...${raw.slice(-6)}`);
    }
    if (!SEND) continue;
    if (!FORCE) {
      const result = await sendResumeTest({ userId: user.id });
      console.log("envio:", JSON.stringify(result, null, 2));
      continue;
    }

    // Misma historia y mismo texto que elegiria el cron, pero enviando a mano
    // a los tokens de iOS de esta cuenta.
    const entry = await prisma.continueListeningEntry.findFirst({
      where: { userId: user.id },
      orderBy: { lastPlayedAt: "desc" },
      select: { storySlug: true, progressSec: true, audioDurationSec: true },
    });
    const story = await prisma.journeyStory.findFirst({
      where: entry ? { slug: entry.storySlug, status: "published" } : { status: "published", slug: { not: null } },
      select: { slug: true, title: true, journeyId: true, journey: { select: { language: true } } },
    });
    if (!story) {
      console.log("sin historia de journey que anunciar");
      continue;
    }
    const duration = entry?.audioDurationSec ?? 0;
    const progress = entry?.progressSec ?? 0;
    const minutesLeft = duration > progress ? (duration - progress) / 60 : 4;
    const copy = resumeCopy({ storyTitle: story.title, minutesLeft });
    const apnsTokens = tokens
      .filter((t) => t.provider === "apns" && typeof t.token === "string")
      .map((t) => (t.token as string).trim());
    console.log("historia:", story.slug, "| texto:", JSON.stringify(copy));
    const language = story.journey?.language ?? null;
    const results = await sendApnsPush(apnsTokens, {
      title: copy.title,
      body: copy.body,
      data: {
        notificationType: RESUME_NOTIFICATION_KEY,
        trigger: "resume_story",
        journeyId: story.journeyId,
        language: language ? language.charAt(0).toUpperCase() + language.slice(1).toLowerCase() : undefined,
        storySlug: story.slug,
        test: true,
      },
    });
    for (const r of results) {
      console.log(`   token ...${r.token.slice(-6)} => ${r.ok ? "OK" : "FALLO"} ${r.status} ${r.reason ?? ""}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
