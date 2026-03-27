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

export function getGooglePlayPremiumProductIds() {
  return [
    GOOGLE_PLAY_PREMIUM_MONTHLY_PRODUCT_ID,
    GOOGLE_PLAY_PREMIUM_ANNUAL_PRODUCT_ID,
  ].filter(Boolean);
}
