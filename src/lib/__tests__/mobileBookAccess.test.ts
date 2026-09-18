import { describe, expect, it } from "vitest";
import type { BillingEntitlement } from "@/generated/prisma";
import { decideMobileBookAccess } from "@/lib/mobileBookAccess";
import { WALL_CUTOFF_MS } from "@domain/access";

const SLUG = "short-stories-in-mexican-spanish";
// Cuenta creada DESPUES del muro: sin gracia beta, decide solo el plan.
const POST_WALL = WALL_CUTOFF_MS + 24 * 60 * 60 * 1000;
const PRE_WALL = WALL_CUTOFF_MS - 24 * 60 * 60 * 1000;

function entitlement(overrides: Partial<BillingEntitlement>): BillingEntitlement {
  const now = new Date();
  return {
    id: "ent_1",
    userId: "user_1",
    plan: "premium",
    source: "app_store",
    status: "active",
    productId: null,
    externalCustomerId: null,
    externalSubscriptionId: null,
    purchaseToken: null,
    orderId: null,
    willRenew: true,
    startedAt: now,
    renewedAt: null,
    trialEndsAt: null,
    expiresAt: new Date(now.getTime() + 60_000),
    rawPayload: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as BillingEntitlement;
}

describe("decideMobileBookAccess", () => {
  it("niega a una cuenta nueva sin plan ni libros (el caso del hallazgo #2)", () => {
    expect(
      decideMobileBookAccess({
        publicMetadata: {},
        entitlement: null,
        userCreatedAtMs: POST_WALL,
        bookSlug: SLUG,
      })
    ).toBe(false);
  });

  it("niega a basic aunque tenga OTRO libro en publicMetadata.books", () => {
    expect(
      decideMobileBookAccess({
        publicMetadata: { plan: "basic", books: ["colombian-spanish-stories-for-beginners"] },
        entitlement: null,
        userCreatedAtMs: POST_WALL,
        bookSlug: SLUG,
      })
    ).toBe(false);
  });

  it("permite el libro que escribio el claim en publicMetadata.books", () => {
    expect(
      decideMobileBookAccess({
        publicMetadata: { plan: "basic", books: [SLUG] },
        entitlement: null,
        userCreatedAtMs: POST_WALL,
        bookSlug: SLUG,
      })
    ).toBe(true);
  });

  it("permite todo el catalogo con BillingEntitlement premium activo", () => {
    expect(
      decideMobileBookAccess({
        publicMetadata: {},
        entitlement: entitlement({ plan: "premium", status: "active" }),
        userCreatedAtMs: POST_WALL,
        bookSlug: SLUG,
      })
    ).toBe(true);
  });

  it("niega con un BillingEntitlement premium caducado", () => {
    expect(
      decideMobileBookAccess({
        publicMetadata: {},
        entitlement: entitlement({
          plan: "premium",
          status: "expired",
          expiresAt: new Date(Date.now() - 60_000),
        }),
        userCreatedAtMs: POST_WALL,
        bookSlug: SLUG,
      })
    ).toBe(false);
  });

  it("respeta la gracia beta: cuenta pre-muro sin plan lee como premium", () => {
    expect(
      decideMobileBookAccess({
        publicMetadata: {},
        entitlement: null,
        userCreatedAtMs: PRE_WALL,
        bookSlug: SLUG,
      })
    ).toBe(true);
  });

  it("no se deja engañar por metadata malformada", () => {
    expect(
      decideMobileBookAccess({
        publicMetadata: { plan: "premium-ish", books: SLUG },
        entitlement: null,
        userCreatedAtMs: POST_WALL,
        bookSlug: SLUG,
      })
    ).toBe(false);
  });
});
