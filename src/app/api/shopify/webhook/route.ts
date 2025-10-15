// src/app/api/shopify/webhook/route.ts

import { NextResponse } from "next/server";
import crypto from "crypto";
import { PrismaClient } from "@/generated/prisma";
import { shopifybundles } from "@/data/shopifybundles";

const prisma = new PrismaClient();

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

interface ShopifyWebhookPayload {
  email?: string;
  customer?: { email?: string };
  line_items?: Array<{ title?: string; handle?: string; sku?: string }>;
}

// --- 🔐 HMAC validation ---
function verifyShopifyHmac(rawBody: string, receivedHmac: string | null): boolean {
  if (!SHOPIFY_WEBHOOK_SECRET || !receivedHmac) return false;
  const generated = crypto
    .createHmac("sha256", SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody, "utf8")
    .digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(receivedHmac));
  } catch {
    return false;
  }
}

// --- 🧩 Helpers for payload ---
function pickEmail(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as ShopifyWebhookPayload;
  if (typeof o.email === "string") return o.email;
  if (o.customer && typeof o.customer.email === "string") return o.customer.email;
  return null;
}

function pickLineItems(obj: unknown): Array<{ sku?: string; handle?: string }> {
  if (!obj || typeof obj !== "object") return [];
  const o = obj as ShopifyWebhookPayload;
  return Array.isArray(o.line_items) ? o.line_items : [];
}

// --- 🚀 Webhook endpoint ---
export async function POST(req: Request) {
  try {
    if (!SHOPIFY_WEBHOOK_SECRET) {
      console.error("❌ Falta SHOPIFY_WEBHOOK_SECRET");
      return NextResponse.json({ error: "Missing env var" }, { status: 500 });
    }

    // 1️⃣ Leer cuerpo bruto
    const rawBody = await req.text();
    console.log("🔍 RAW BODY (primeros 500 chars):", rawBody.slice(0, 500));

    try {
      const parsed = JSON.parse(rawBody);
      console.log("🧩 LINE ITEMS:", parsed.line_items);
    } catch {
      console.log("⚠️ No se pudo parsear JSON");
    }

    const receivedHmac = req.headers.get("X-Shopify-Hmac-Sha256");
    console.log("🔑 HMAC recibido:", receivedHmac);

    // 2️⃣ Validar HMAC
    const isValid = verifyShopifyHmac(rawBody, receivedHmac);
    console.log("🧾 HMAC válido:", isValid);
    if (!isValid) {
      console.warn("🚫 Shopify HMAC invalid");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3️⃣ Parsear JSON validado
    const parsed = JSON.parse(rawBody) as unknown;
    const email = pickEmail(parsed);
    console.log("📧 Email detectado:", email);
    if (!email) {
      console.warn("🚫 No se encontró email en el payload");
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const line_items = pickLineItems(parsed);
    console.log("🛒 Line items detectados:", line_items);

    const purchasedBooks = line_items
      .flatMap(i => {
        const code = (i.sku ?? i.handle ?? "").trim();
        if (!code) return [];
        // Si el SKU corresponde a un bundle, expandimos sus libros
        if (shopifybundles[code]) return shopifybundles[code];
        return [code];
      })
      .filter(Boolean);

    console.log("📚 Libros detectados:", purchasedBooks);
    if (purchasedBooks.length === 0) {
      console.warn("🚫 No se detectaron identificadores válidos de libro");
      return NextResponse.json({ message: "No valid book identifiers found" });
    }

    // 4️⃣ Crear registro de compra (ClaimToken)
    const token = crypto.randomBytes(24).toString("base64url");
    const buyerEmail = email;
    const recipientEmail = email; // por ahora asumimos que comprador = lector

    // Delegate correcto: prisma.claimToken (según Prisma ModelName ClaimToken)
    const claim = await prisma.claimToken.create({
      data: {
        token,
        buyerEmail,
        recipientEmail,
        books: purchasedBooks,
      },
    });

    console.log("🎟️ Claim creado:", claim);

    return NextResponse.json({
      message: "Claim token created",
      token: claim.token,
      books: claim.books,
    });
  } catch (err) {
    console.error("💥 Shopify webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
