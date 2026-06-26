export const STRIPE_PREMIUM_MONTHLY_PRICE_ID =
  process.env.NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY_PRICE_ID?.trim() ||
  "price_1SbP7r6ytrKVzptQaTBIuAaZ";

export const STRIPE_PREMIUM_ANNUAL_PRICE_ID =
  process.env.NEXT_PUBLIC_STRIPE_PREMIUM_ANNUAL_PRICE_ID?.trim() ||
  "price_1SbP9H6ytrKVzptQQTz9v1hd";

export const GOOGLE_PLAY_PREMIUM_MONTHLY_PRODUCT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_PLAY_PREMIUM_MONTHLY_PRODUCT_ID?.trim() ||
  "premium_monthly";

export const GOOGLE_PLAY_PREMIUM_ANNUAL_PRODUCT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_PLAY_PREMIUM_ANNUAL_PRODUCT_ID?.trim() ||
  "premium_annual";

export const APP_STORE_PREMIUM_MONTHLY_PRODUCT_ID =
  process.env.NEXT_PUBLIC_APP_STORE_PREMIUM_MONTHLY_PRODUCT_ID?.trim() ||
  "premium_monthly";

export const APP_STORE_PREMIUM_ANNUAL_PRODUCT_ID =
  process.env.NEXT_PUBLIC_APP_STORE_PREMIUM_ANNUAL_PRODUCT_ID?.trim() ||
  "premium_annual";

// Fallback display labels; used only if the live Stripe lookup fails.
// Runtime source of truth is GET /api/stripe/prices (reads the price objects
// above). Keep these roughly in sync with Stripe as a safety net.
export const STRIPE_PREMIUM_MONTHLY_PRICE_FALLBACK = "€14.99";
export const STRIPE_PREMIUM_ANNUAL_PRICE_FALLBACK = "€149";

export function getGooglePlayPremiumProductIds() {
  return [
    GOOGLE_PLAY_PREMIUM_MONTHLY_PRODUCT_ID,
    GOOGLE_PLAY_PREMIUM_ANNUAL_PRODUCT_ID,
  ].filter(Boolean);
}

export function getAppStorePremiumProductIds() {
  return [
    APP_STORE_PREMIUM_MONTHLY_PRODUCT_ID,
    APP_STORE_PREMIUM_ANNUAL_PRODUCT_ID,
  ].filter(Boolean);
}
