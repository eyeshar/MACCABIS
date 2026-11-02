// Mide la velocidad de las paginas publicas de una URL (D175): TTFB, LCP y peso, en la primera visita (sin cache del
// navegador) y en caliente (N visitas seguidas, mediana). Solo lectura, sin sesion. Lee x-vercel-id/x-vercel-cache.
//   node scripts/medir_velocidad.mjs https://maccabis.vercel.app [--n 5] [--rutas /,/liga] [--json salida.json]
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import https from "node:https";

const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:/.test(a)) ?? "https://maccabis.vercel.app").replace(/\/$/, "");
const val = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const N = Number(val("--n", 5));
const rutas = val("--rutas", "/,/liga,/historia,/plantilla,/club").split(",");
const salida = val("--json", null);
const cabecerasExtra = val("--bypass", null) ? { "x-vercel-protection-bypass": val("--bypass"), "x-vercel-set-bypass-cookie": "true" } : undefined;
const mediana = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

// TTFB como curl (time_starttransfer): conexion nueva, desde que sale la peticion hasta la primera respuesta. El
// responseStart de Chrome sale demasiado bajo (cuenta respuestas intermedias).
const ttfbCurl = (ruta) => new Promise((ok, ko) => {
  const t0 = performance.now();
  const q = https.get(base + ruta, { agent: false, headers: cabecerasExtra }, (r) => { const t = performance.now() - t0; r.resume(); r.on("end", () => ok({ ttfb: t, h: r.headers })); });
  q.on("error", ko);
});
const browser = await chromium.launch({ channel: "chrome", headless: true });
async function visita(ruta) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, extraHTTPHeaders: cabecerasExtra });
  const p = await ctx.newPage();
  let bytes = 0, doc = null;
  p.on("response", async (r) => {
    try {
      // Lo que viaja por la red (comprimido, con cabeceras), no lo que ocupa descomprimido.
      const t = await r.request().sizes();
      bytes += t.responseBodySize + t.responseHeadersSize;
      if (r.request().resourceType() === "document" && !doc) doc = r.headers();
    } catch {}
  });
  await p.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  const tc = await ttfbCurl(ruta);
  const r = await p.goto(base + ruta, { waitUntil: "load" });
  await p.waitForTimeout(800);
  const m = await p.evaluate(() => {
    const n = performance.getEntriesByType("navigation")[0];
    return { ttfb: n.responseStart, lcp: window.__lcp, js: performance.getEntriesByType("resource").filter((e) => e.initiatorType === "script").reduce((s, e) => s + (e.encodedBodySize || 0), 0) };
  });
  await ctx.close();
  return { status: r.status(), ...m, ttfb: tc.ttfb, ttfbChrome: m.ttfb, ttfbCache: tc.h["x-vercel-cache"], kb: bytes / 1024, jsKb: m.js / 1024, vercelId: doc?.["x-vercel-id"], cache: doc?.["x-vercel-cache"], cc: doc?.["cache-control"] };
}

const res = {};
for (const ruta of rutas) {
  const primera = await visita(ruta);
  const caliente = [];
  for (let i = 0; i < N; i++) caliente.push(await visita(ruta));
  res[ruta] = { primera, calienteTtfb: mediana(caliente.map((c) => c.ttfb)), calienteLcp: mediana(caliente.map((c) => c.lcp)), kb: mediana(caliente.map((c) => c.kb)), jsKb: mediana(caliente.map((c) => c.jsKb)), cache: caliente.map((c) => c.cache).join("/"), vercelId: primera.vercelId, cc: primera.cc, status: primera.status };
  const x = res[ruta];
  console.log(`${ruta.padEnd(11)} ${x.status} 1ª: TTFB ${primera.ttfb.toFixed(0)} LCP ${primera.lcp.toFixed(0)} | caliente: TTFB ${x.calienteTtfb.toFixed(0)} LCP ${x.calienteLcp.toFixed(0)} | ${x.kb.toFixed(0)} KB (JS ${x.jsKb.toFixed(0)}) | cache ${x.cache} | ${x.vercelId}`);
}
await browser.close();
if (salida) writeFileSync(salida, JSON.stringify(res, null, 2));
