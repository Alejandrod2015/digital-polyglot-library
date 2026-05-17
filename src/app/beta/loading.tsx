// /beta is a static landing. Skip the webapp-style loading fallback at
// src/app/loading.tsx so client-side navigation here doesn't flash a
// skeleton that doesn't match the page.
export default function BetaLoading() {
  return null;
}
