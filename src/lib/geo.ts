// Jurisdictions that legally require prior opt-in consent before loading
// analytics cookies: the EEA (GDPR), the UK (UK GDPR) and Switzerland
// (revFADP). Everywhere else — notably the US, which is the bulk of the
// blog's organic traffic — defaults to analytics-on with an opt-out,
// matching common practice and recovering the data the opt-in gate loses.
const CONSENT_OPT_IN_COUNTRIES = new Set([
  // EU-27
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
  // EEA (non-EU)
  "IS", "LI", "NO",
  // UK + Switzerland
  "GB", "CH",
]);

/**
 * True when the visitor's country requires explicit opt-in for analytics.
 * Unknown origin (no geo header) is treated as opt-in — the privacy-safe
 * default, so bots and unresolved IPs are not tracked without consent.
 */
export function isConsentOptInCountry(country: string | null | undefined): boolean {
  if (!country) return true;
  return CONSENT_OPT_IN_COUNTRIES.has(country.toUpperCase());
}
