/**
 * Comprueba /go/app contra un host real con los tres dispositivos. Existe
 * porque el reparto depende del User-Agent, y eso no se ve mirando el codigo.
 *
 *   npx tsx scripts/_checkGoApp.ts https://digitalpolyglot.com
 */
const base = process.argv[2] ?? "http://localhost:3000";

const AGENTS: Array<{ label: string; ua: string }> = [
  {
    label: "escritorio",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
  },
  {
    label: "iPhone",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  },
  {
    label: "Android",
    ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
  },
];

async function main() {
  for (const a of AGENTS) {
    const res = await fetch(`${base}/go/app`, { headers: { "user-agent": a.ua }, redirect: "follow" });
    const body = res.headers.get("content-type")?.includes("text/html") ? await res.text() : "";
    const deep = body.match(/digitalpolyglot:\/\/[^"]*/)?.[0];
    const store = body.match(/https:\/\/(?:apps\.apple\.com|testflight\.apple\.com|play\.google\.com)[^"]*/)?.[0];
    console.log(
      `${a.label.padEnd(11)} ${res.status} ${res.url}` +
        (deep ? `\n            abre: ${deep}` : "") +
        (store ? `\n            si no: ${store}` : ""),
    );
  }
}

main();
