// Registra el clic que SALE del sitio hacia la tienda. Lo dispara
// <OutboundClickLogger /> (src/components/OutboundClickLogger.tsx) desde el
// navegador, con sendBeacon, sin tocar la navegacion.
//
// Existe porque la tienda esta en otro dominio y el salto no lo ve nadie:
// dp_page_visits_v1 termina en el post y el pedido de Shopify empieza en la
// ficha de producto. Con el clic medido se puede separar "nadie hace clic" de
// "hacen clic y no compran".
//
// Comparte el cookie de sesion `dp_sid` con /api/log/visit a proposito: es lo
// que permite cruzar, dentro de una misma sesion, que se leyo y que se pulso.

import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SESSION_COOKIE = "dp_sid";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const BOT_REGEX =
  /(bot|crawl|spider|slurp|preview|monitor|uptime|lighthouse|headless|fetch|curl|httpx|wget|python-requests|axios|nextjs|prerender)/i;

/**
 * Dominios cuyo clic de salida se guarda. Es una lista blanca, no un "todo lo
 * que no sea nuestro": el objetivo es medir el paso a la tienda, y guardar
 * cada enlace externo de cada post convertiria la tabla en un registro de
 * navegacion ajena que nadie ha pedido.
 */
const TRACKED_HOSTS = new Set([
  "shop.digitalpolyglot.com",
  "digitalpolyglots.myshopify.com",
  "5c0086-a6.myshopify.com",
]);

function asTrimmedString(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function hashIp(rawIp: string | null | undefined): string | null {
  if (!rawIp) return null;
  const salt = process.env.VISIT_IP_SALT || process.env.CLERK_SECRET_KEY || "";
  if (!salt) return null;
  return createHash("sha256").update(`${rawIp}|${salt}`).digest("hex");
}

function pickClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

function decodeHeader(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

type Body = {
  fromPath?: unknown;
  href?: unknown;
  linkIndex?: unknown;
  label?: unknown;
  deviceCategory?: unknown;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const fromPath = asTrimmedString(body.fromPath, 500);
  const href = asTrimmedString(body.href, 1000);
  if (!fromPath || !href) return NextResponse.json({ ok: true });

  // El destino se vuelve a parsear aqui, no se cree lo que diga el cliente:
  // es lo unico que impide que un POST a mano llene la tabla de basura.
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return NextResponse.json({ ok: true, skipped: "bad-url" });
  }
  if (!TRACKED_HOSTS.has(url.hostname)) {
    return NextResponse.json({ ok: true, skipped: "host" });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  if (userAgent && BOT_REGEX.test(userAgent)) {
    return NextResponse.json({ ok: true, skipped: "bot" });
  }

  const productMatch = url.pathname.match(/\/products\/([^/?#]+)/);
  const rawIndex = typeof body.linkIndex === "number" ? Math.trunc(body.linkIndex) : null;

  const existingSession = req.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = existingSession ?? randomBytes(16).toString("base64url");

  await prisma.outboundClick
    .create({
      data: {
        fromPath,
        href,
        destHost: url.hostname,
        product: productMatch ? productMatch[1].slice(0, 200) : null,
        utmCampaign: url.searchParams.get("utm_campaign")?.slice(0, 200) ?? null,
        linkIndex: rawIndex !== null && rawIndex >= 0 && rawIndex < 1000 ? rawIndex : null,
        label: asTrimmedString(body.label, 200),
        country: decodeHeader(req.headers.get("x-vercel-ip-country")),
        deviceCategory: asTrimmedString(body.deviceCategory, 40),
        userAgent,
        ipHashed: hashIp(pickClientIp(req)),
        sessionId,
      },
    })
    .catch((err) => {
      // Una analitica no puede tumbar la peticion de nadie.
      console.error("outbound-click insert failed", err);
    });

  const res = NextResponse.json({ ok: true });
  if (!existingSession) {
    res.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  }
  return res;
}
