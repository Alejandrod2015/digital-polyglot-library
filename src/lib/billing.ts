import type { BillingEntitlement, BillingSource, BillingStatus } from "@/generated/prisma";
import type { Plan } from "@domain/access";
import {
  STRIPE_PREMIUM_ANNUAL_PRICE_ID,
  STRIPE_PREMIUM_MONTHLY_PRICE_ID,
} from "@domain/billingCatalog";

export const STRIPE_PRICE_PLAN_MAP = {
  price_1SI5WW6ytrKVzptQW7CBTx2G: "premium",
  price_1SI5Wv6ytrKVzptQkzfg7emI: "polyglot",
  [STRIPE_PREMIUM_MONTHLY_PRICE_ID]: "premium",
  [STRIPE_PREMIUM_ANNUAL_PRICE_ID]: "premium",
} as const satisfies Record<string, Exclude<Plan, "free" | "basic" | "owner" | undefined>>;

const DEFAULT_GOOGLE_PLAY_PRODUCT_PLAN_MAP = {
  premium_monthly: "premium",
  premium_annual: "premium",
  polyglot_monthly: "polyglot",
  polyglot_annual: "polyglot",
} as const satisfies Record<string, Exclude<Plan, "free" | "basic" | "owner" | undefined>>;

export type PaidPlan = "premium" | "polyglot";
export type BillingSourceName = "stripe" | "google_play";

let cachedGooglePlayProductPlanMap: Record<string, PaidPlan> | null = null;

function parseGooglePlayProductPlanMap(): Record<string, PaidPlan> {
  if (cachedGooglePlayProductPlanMap) {
    return cachedGooglePlayProductPlanMap;
  }

  const raw = process.env.GOOGLE_PLAY_PRODUCT_PLAN_MAP;
  if (!raw) {
    cachedGooglePlayProductPlanMap = { ...DEFAULT_GOOGLE_PLAY_PRODUCT_PLAN_MAP };
    return cachedGooglePlayProductPlanMap;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<string, PaidPlan> = {};
    for (const [productId, plan] of Object.entries(parsed)) {
      if ((plan === "premium" || plan === "polyglot") && productId.trim()) {
        next[productId.trim()] = plan;
      }
    }
    cachedGooglePlayProductPlanMap =
      Object.keys(next).length > 0 ? next : { ...DEFAULT_GOOGLE_PLAY_PRODUCT_PLAN_MAP };
    return cachedGooglePlayProductPlanMap;
  } catch {
    cachedGooglePlayProductPlanMap = { ...DEFAULT_GOOGLE_PLAY_PRODUCT_PLAN_MAP };
    return cachedGooglePlayProductPlanMap;
  }
}

export function getGooglePlayProductPlanMap(): Record<string, PaidPlan> {
  return parseGooglePlayProductPlanMap();
}

export function resolvePlanFromStripePriceId(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  return STRIPE_PRICE_PLAN_MAP[priceId as keyof typeof STRIPE_PRICE_PLAN_MAP] ?? null;
}

export function resolvePlanFromGooglePlayProductId(
  productId: string | null | undefined
): PaidPlan | null {
  if (!productId) return null;
  return getGooglePlayProductPlanMap()[productId] ?? null;
}

export function isActiveBillingStatus(status: BillingStatus, expiresAt?: Date | null): boolean {
  if (status === "active" || status === "trialing" || status === "in_grace_period") {
    return !expiresAt || expiresAt.getTime() > Date.now();
  }

  return false;
}

export function getEffectivePlanFromEntitlement(
  entitlement: Pick<BillingEntitlement, "plan" | "status" | "expiresAt"> | null
): Plan {
  if (!entitlement) return "free";

  if (!isActiveBillingStatus(entitlement.status, entitlement.expiresAt)) {
    return "free";
  }

  return entitlement.plan as Plan;
}

export function serializeEntitlement(entitlement: BillingEntitlement | null) {
  if (!entitlement) {
    return {
      hasEntitlement: false,
      plan: "free" as const,
      source: null,
      status: "unknown" as const,
    };
  }

  return {
    hasEntitlement: isActiveBillingStatus(entitlement.status, entitlement.expiresAt),
    plan: getEffectivePlanFromEntitlement(entitlement) ?? "free",
    source: entitlement.source,
    status: entitlement.status,
    productId: entitlement.productId,
    orderId: entitlement.orderId,
    willRenew: entitlement.willRenew,
    trialEndsAt: entitlement.trialEndsAt?.toISOString() ?? null,
    expiresAt: entitlement.expiresAt?.toISOString() ?? null,
    renewedAt: entitlement.renewedAt?.toISOString() ?? null,
    updatedAt: entitlement.updatedAt.toISOString(),
  };
}

export function getBillingManagementCopy(source: BillingSource | null | undefined): string {
  if (source === "google_play") {
    return "Your subscription is managed through Google Play on Android.";
  }

  return "Your subscription is managed through Stripe on the web.";
}

export function getPlanCatalog() {
  const productPlanMap = getGooglePlayProductPlanMap();

  return {
    stripe: {
      premiumMonthly: {
        priceId: STRIPE_PREMIUM_MONTHLY_PRICE_ID,
        plan: "premium" as const,
      },
      premiumAnnual: {
        priceId: STRIPE_PREMIUM_ANNUAL_PRICE_ID,
        plan: "premium" as const,
      },
    },
    googlePlay: Object.entries(productPlanMap).map(([productId, plan]) => ({
      productId,
      plan,
    })),
  };
}
