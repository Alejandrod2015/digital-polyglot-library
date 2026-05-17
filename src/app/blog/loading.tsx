// Marketing routes are file-system backed (MDX) or static and render
// quickly. The webapp-style skeleton at src/app/loading.tsx looked out
// of place flashing on /blog and /blog/[slug] during client navigation,
// so blog routes opt out of any visible loading fallback.
export default function BlogLoading() {
  return null;
}
