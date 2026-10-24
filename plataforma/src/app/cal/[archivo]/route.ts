import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { calendarioPersonal, type EventoPersonal } from "@/lib/calendario/icsPersonal";
import { URL_PRODUCCION } from "@/lib/indexacion";

// Calendario PERSONAL suscribible (D120): /cal/<enlace secreto>.ics. Lo piden Google Calendar, iPhone u Outlook, que no
// pueden iniciar sesion: por eso un enlace secreto por persona, solo de lectura (excepcion acotada a D68). La base
// (calendario_personal, con la clave anonima) solo devuelve algo con un enlace vigente de alguien activo, y como mucho
// 120 lecturas por hora. Fuera de los buscadores (noindex y Disallow /cal en robots.txt) y del sitemap.
export const dynamic = "force-dynamic";

const NOINDEX = { "x-robots-tag": "noindex, nofollow", "cache-control": "no-store" };
const noEncontrado = () => new Response("No encontrado", { status: 404, headers: NOINDEX });

export async function GET(req: Request, { params }: { params: Promise<{ archivo: string }> }) {
  const { archivo } = await params;
  const m = /^([A-Za-z0-9_-]{40,100})\.ics$/.exec(archivo);
  if (!m) return noEncontrado();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return noEncontrado();
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc("calendario_personal", { p_token: m[1] });
  if (error || !data) return noEncontrado();
  const d = data as { limite?: boolean; eventos?: EventoPersonal[] };
  if (d.limite) return new Response("Demasiadas peticiones", { status: 429, headers: { ...NOINDEX, "retry-after": "3600" } });
  const cuerpo = calendarioPersonal(d.eventos ?? [], URL_PRODUCCION);
  const etag = `"${crypto.createHash("sha256").update(cuerpo).digest("base64url").slice(0, 32)}"`;
  const cabeceras = {
    "content-type": "text/calendar; charset=utf-8",
    "content-disposition": 'inline; filename="maccabis.ics"',
    // Corto: las apps vuelven cada hora (iPhone, Outlook) o cuando quieren (Google).
    "cache-control": "private, max-age=900",
    etag,
    "x-robots-tag": "noindex, nofollow",
  };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: cabeceras });
  return new Response(cuerpo, { headers: cabeceras });
}
