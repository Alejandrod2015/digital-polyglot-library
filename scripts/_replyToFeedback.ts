// Responde a UN reporte de feedback, con el mismo camino que el boton Reply de
// Studio (src/app/api/studio/beta/feedback/reply/route.ts): correo personal sin
// marca, y la fila queda sellada con repliedAt / replySubject / replyText.
//
// Existe porque el boton vive detras de la sesion de admin del Studio y desde
// un chat no hay sesion. Mismo destinatario (el del reporte, nunca libre),
// mismo texto verbatim, y no toca el estado de la fila.
//
//   npx tsx scripts/_replyToFeedback.ts <feedbackId> <fichero-con-el-texto> "<asunto>"
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { readFileSync } from "node:fs";
import { Resend } from "resend";
// El cliente generado vive en el checkout principal (gitignored); se importa
// por ruta absoluta para no dejar nada sin seguir dentro de src/ aqui.
import { PrismaClient } from "/Users/alejandrodelcarpio/digital-polyglot-library/src/generated/prisma/index.js";
import { buildPersonalEmail } from "../src/lib/emails/personal";

const prisma = new PrismaClient();

(async () => {
  const [id, ruta, asunto] = process.argv.slice(2);
  if (!id || !ruta || !asunto) {
    console.error("uso: _replyToFeedback.ts <feedbackId> <fichero> \"<asunto>\"");
    process.exit(1);
  }
  const texto = readFileSync(ruta, "utf8").trim();
  const fila = await prisma.betaFeedback.findUnique({
    where: { id },
    include: { signup: { select: { firstName: true } } },
  });
  if (!fila) throw new Error("no existe ese reporte");

  const to = fila.email.trim().toLowerCase();
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("falta RESEND_API_KEY o EMAIL_FROM");

  // El builder recibe parrafos, no un bloque: uno por linea en blanco, como
  // hace la ruta del boton Reply.
  const parrafos = texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const correo = buildPersonalEmail({
    firstName: fila.signup?.firstName ?? null,
    subject: asunto,
    paragraphs: parrafos,
  });

  console.log(`a: ${to}`);
  console.log(`asunto: ${asunto}`);
  console.log(texto);

  const enviado = await new Resend(apiKey).emails.send({
    from,
    to,
    subject: asunto,
    html: correo.html,
    text: correo.text,
  });
  if (enviado.error) throw new Error(JSON.stringify(enviado.error));

  await prisma.betaFeedback.update({
    where: { id },
    data: {
      repliedAt: new Date(),
      replySubject: asunto,
      replyText: texto,
      replyProviderId: enviado.data?.id ?? null,
    },
  });
  console.log(`\nenviado, id de Resend ${enviado.data?.id}`);
  await prisma.$disconnect();
})();
