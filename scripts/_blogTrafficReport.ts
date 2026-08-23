// Que hace el trafico del blog: cuanto es, de donde viene, que posts se leen y
// cuantas de esas sesiones pasan a alguna otra parte del sitio.
import { prisma } from "@/lib/prisma";

const SINCE = new Date("2026-05-17T00:00:00Z");

function host(ref: string | null): string {
  if (!ref) return "(directo)";
  try {
    const h = new URL(ref).hostname.replace(/^www\./, "");
    if (h.endsWith("digitalpolyglot.com")) return "(interno)";
    return h;
  } catch { return "(ilegible)"; }
}

async function main() {
  const rows = await prisma.pageVisit.findMany({
    where: { createdAt: { gte: SINCE } },
    select: { path: true, referrer: true, sessionId: true, utmSource: true, createdAt: true },
  });

  const blog = rows.filter((r) => r.path.startsWith("/blog"));
  const blogSessions = new Set(blog.map((r) => r.sessionId).filter(Boolean) as string[]);
  const allSessions = new Set(rows.map((r) => r.sessionId).filter(Boolean) as string[]);

  // Sesiones que tocaron el blog Y ademas alguna pagina fuera del blog.
  const nonBlogBySession = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.sessionId || r.path.startsWith("/blog")) continue;
    if (!blogSessions.has(r.sessionId)) continue;
    const s = nonBlogBySession.get(r.sessionId) ?? new Set();
    s.add(r.path); nonBlogBySession.set(r.sessionId, s);
  }

  const posts = new Map<string, number>();
  for (const r of blog) {
    const slug = r.path.replace(/^\/blog\/?/, "").split("?")[0].replace(/\/$/, "");
    if (!slug) continue;
    posts.set(slug, (posts.get(slug) ?? 0) + 1);
  }

  // De donde entra la gente al blog: el referrer de su PRIMERA fila de blog.
  const firstRef = new Map<string, string>();
  for (const r of blog.sort((a, b) => +a.createdAt - +b.createdAt)) {
    if (!r.sessionId || firstRef.has(r.sessionId)) continue;
    firstRef.set(r.sessionId, host(r.referrer));
  }
  const srcs = new Map<string, number>();
  for (const h of firstRef.values()) srcs.set(h, (srcs.get(h) ?? 0) + 1);

  const dest = new Map<string, number>();
  for (const s of nonBlogBySession.values()) for (const p of s) {
    const k = p === "/" ? "/ (landing)" : "/" + p.split("/").filter(Boolean)[0];
    dest.set(k, (dest.get(k) ?? 0) + 1);
  }

  console.log(JSON.stringify({
    ventana: { desde: SINCE.toISOString(), hasta: new Date().toISOString() },
    vistas_totales: rows.length,
    vistas_de_blog: blog.length,
    sesiones_totales: allSessions.size,
    sesiones_con_blog: blogSessions.size,
    sesiones_de_blog_que_salen_del_blog: nonBlogBySession.size,
    posts_distintos_leidos: posts.size,
    top_posts: [...posts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15),
    de_donde_entran: [...srcs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
    adonde_van_despues: [...dest.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
  }, null, 1));
}
main().finally(() => process.exit(0));
