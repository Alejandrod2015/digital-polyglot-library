import { NextResponse } from "next/server";
import crypto from "crypto";
import { shopifybundles } from "@/data/shopifybundles";

const CLERK_API_URL = process.env.CLERK_API_URL ?? "https://api.clerk.com";
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

interface ShopifyWebhookPayload {
  email?: string;
  customer?: { email?: string };
  line_items?: Array<{ title?: string; handle?: string; sku?: string }>;
}

interface ClerkUser {
  id: string;
  public_metadata?: Record<string, unknown>;
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

// --- 🧠 Clerk helpers (REST, no SDK) ---
async function getUserByEmail(email: string): Promise<ClerkUser | null> {
  const url = `${CLERK_API_URL}/v1/users?email_address=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("❌ Clerk GET users failed:", res.status, await res.text());
    return null;
  }

  const data: unknown = await res.json();
  if (Array.isArray(data)) return (data[0] as ClerkUser) ?? null;
  if (data && typeof data === "object" && Array.isArray((data as { data?: ClerkUser[] }).data)) {
    return (data as { data: ClerkUser[] }).data[0] ?? null;
  }
  return null;
}

async function patchUserMetadata(userId: string, nextPublic: Record<string, unknown>) {
  const url = `${CLERK_API_URL}/v1/users/${userId}/metadata`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ public_metadata: nextPublic }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`❌ Clerk PATCH metadata failed: ${res.status} ${body}`);
  }
}

// --- 🚀 Webhook endpoint ---
export async function POST(req: Request) {
  try {
    if (!CLERK_SECRET_KEY || !SHOPIFY_WEBHOOK_SECRET) {
      console.log("❌ Falta CLERK_SECRET_KEY o SHOPIFY_WEBHOOK_SECRET");
      return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
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

    // 4️⃣ Buscar usuario en Clerk
    const user = await getUserByEmail(email);
    console.log("👤 Usuario encontrado:", user?.id);
    if (!user) {
      console.warn(`🚫 User not found for email: ${email}`);
      return NextResponse.json({ message: "User not found" });
    }

    // 5️⃣ Fusionar libros y actualizar metadata
    const currentBooks = Array.isArray(user.public_metadata?.books)
      ? (user.public_metadata!.books as string[])
      : [];
    const updatedBooks = Array.from(new Set([...currentBooks, ...purchasedBooks]));
    console.log("✅ Libros finales del usuario:", updatedBooks);

    await patchUserMetadata(user.id, {
      ...(user.public_metadata ?? {}),
      books: updatedBooks,
    });

    console.log("🎉 Metadata actualizada en Clerk para:", email);
    return NextResponse.json({ message: "User books updated", updatedBooks });
  } catch (err) {
    console.error("💥 Shopify webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
