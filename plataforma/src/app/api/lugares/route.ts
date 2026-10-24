import { NextResponse, type NextRequest } from "next/server";
import { sesionActual } from "@/lib/sesion";
import { deNominatim, type FilaNominatim, type Lugar } from "@/lib/ubicacion";

// Buscador del campo «Dónde» (D119): sugerencias de OpenStreetMap (Nominatim) pedidas DESDE EL SERVIDOR, con cache y
// respetando su politica de uso (como mucho una peticion por segundo, identificando la web en el User-Agent). Coste
// cero: sin Google Places ni claves de pago. Solo con sesion (no es un buscador abierto). LUGARES_URL permite a las
// pruebas usar un servicio simulado (nunca se llama a OpenStreetMap en las pruebas).
export const dynamic = "force-dynamic";

const BASE = () => (process.env.LUGARES_URL || "https://nominatim.openstreetmap.org").replace(/\/$/, "");
const AGENTE = "Maccabis/1.0 (https://maccabis.vercel.app; club de baloncesto)";
const CACHE = new Map<string, { en: number; lugares: Lugar[] }>();
const VIDA_MS = 24 * 3600 * 1000;
let ultima = 0;
let cola: Promise<void> = Promise.resolve();

/** Una peticion por segundo como mucho (politica de Nominatim), en orden. */
function turno() {
  const mio = cola.then(async () => {
    const espera = ultima + 1100 - Date.now();
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    ultima = Date.now();
  });
  cola = mio.catch(() => {});
  return mio;
}

export async function GET(req: NextRequest) {
  const { user } = await sesionActual();
  if (!user) return NextResponse.json({ error: "sin_sesion" }, { status: 401 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (q.length < 3) return NextResponse.json({ lugares: [] });
  const clave = q.toLowerCase();
  const guardado = CACHE.get(clave);
  if (guardado && Date.now() - guardado.en < VIDA_MS) return NextResponse.json({ lugares: guardado.lugares, cache: true });
  await turno();
  const url = `${BASE()}/search?${new URLSearchParams({
    q, format: "jsonv2", addressdetails: "1", limit: "6", countrycodes: "es", "accept-language": "es",
    // Preferencia por Madrid (sin excluir lo de fuera).
    viewbox: "-3.95,40.60,-3.45,40.25", bounded: "0",
  })}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": AGENTE, Referer: "https://maccabis.vercel.app" }, signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!r.ok) return NextResponse.json({ lugares: [], error: "servicio" }, { status: 502 });
    const filas = (await r.json()) as FilaNominatim[];
    const lugares = filas.map(deNominatim).filter((l) => l.lat != null && l.lng != null);
    if (CACHE.size > 500) CACHE.delete(CACHE.keys().next().value!);
    CACHE.set(clave, { en: Date.now(), lugares });
    return NextResponse.json({ lugares });
  } catch {
    return NextResponse.json({ lugares: [], error: "servicio" }, { status: 502 });
  }
}
