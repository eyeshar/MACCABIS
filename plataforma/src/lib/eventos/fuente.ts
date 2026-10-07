import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { Evento, FuenteCalendario } from "@/lib/publico";
import type { Partido } from "@/lib/equipacion";

// Fuente PUBLICA del calendario desde la tabla de eventos (paso 2, D94): lee SOLO las vistas publicas
// (v_eventos_publicos, v_descansos_publicos, v_pista_habitual_publica) con la clave anonima: sin respuestas, sin motivos,
// sin datos personales. Si Supabase no responde o la vista viene vacia, devuelve undefined y la web usa los ficheros del
// repo (la fuente de siempre): el calendario nunca se queda en blanco.
type Fila = {
  clave: string; tipo: string; equipo: "MdA" | "MdL" | "ambos"; titulo: string | null; jornada: number | null; rival: string | null; es_local: boolean | null;
  fecha: string; inicio: string | null; fin: string | null; notas: string | null; estado: string;
  pista_nombre: string | null; numero_pista: number | null; pista_por_confirmar: boolean; pista_motivo: string | null;
};
const h = (t: string | null) => (t ? t.slice(0, 5) : null);

export function construirFuente(
  filas: Fila[], descansos: { equipo: "MdA" | "MdL"; jornada: number; fecha: string | null }[],
  habitual: { nombre: string; estado: string } | null, inicioFinHabitual?: { inicio: string; fin: string },
): FuenteCalendario {
  const partidos: (Partido & { fase?: string })[] = [];
  for (const f of filas) {
    if (f.tipo !== "liga" || f.estado === "cancelado" || (f.equipo !== "MdA" && f.equipo !== "MdL") || f.jornada == null) continue;
    partidos.push({ equipo: f.equipo === "MdA" ? "MDA" : "MDL", fase: "liga", jornada: f.jornada, fecha: f.fecha, hora: h(f.inicio), local: f.es_local, descansa: false, rival: f.rival, campo: f.numero_pista ? String(f.numero_pista) : null });
  }
  for (const d of descansos) partidos.push({ equipo: d.equipo === "MdA" ? "MDA" : "MDL", fase: "liga", jornada: d.jornada, fecha: d.fecha, hora: null, local: null, descansa: true, rival: null, campo: null });
  partidos.sort((a, b) => a.jornada - b.jornada || (a.equipo < b.equipo ? -1 : 1));
  const entrenos: Evento[] = filas.filter((f) => f.tipo === "entreno" && f.estado !== "cancelado").map((f) => ({
    id: f.clave, tipo: "entreno", fecha: f.fecha, inicio: h(f.inicio), fin: h(f.fin), titulo: f.titulo ?? "Entrenamiento",
    lugar: f.pista_por_confirmar ? "Pista por confirmar" : f.pista_nombre ?? "Pista por confirmar", pistaPorConfirmar: f.pista_por_confirmar,
    nota: [f.pista_motivo, f.notas].filter(Boolean).join(" · ") || null,
  } satisfies Evento));
  const hab = inicioFinHabitual ?? (() => {
    const cuenta = new Map<string, number>();
    for (const e of entrenos) { const k = `${e.inicio}|${e.fin}`; cuenta.set(k, (cuenta.get(k) ?? 0) + 1); }
    const [k] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["20:30|22:30"];
    const [inicio, fin] = k.split("|");
    return { inicio, fin };
  })();
  return { partidos, entrenos, habitual: habitual ? { inicio: hab.inicio, fin: hab.fin, pista: habitual.nombre, enObras: habitual.estado === "en_obras" } : null };
}

async function leer(): Promise<FuenteCalendario | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  try {
    const sb = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      // Nunca colgar una pagina ni la compilacion por una base lenta: a los 8 s se usan los ficheros del repo.
      global: { fetch: (entrada, init) => fetch(entrada, { ...init, signal: AbortSignal.timeout(8000) }) },
    });
    const [ev, de, ha] = await Promise.all([
      sb.from("v_eventos_publicos").select("*").eq("temporada", "2026-27").order("fecha"),
      sb.from("v_descansos_publicos").select("equipo, jornada, fecha").eq("temporada", "2026-27"),
      sb.from("v_pista_habitual_publica").select("nombre, estado").limit(1),
    ]);
    if (ev.error || de.error || !ev.data?.length) return null;
    const f = construirFuente(ev.data as Fila[], (de.data ?? []) as never, (ha.data?.[0] as { nombre: string; estado: string } | undefined) ?? null);
    return f.partidos.some((p) => !p.descansa) ? f : null;
  } catch {
    return null;
  }
}

// Se guarda un objeto (no null) para que "sin datos" tambien se cachee y no se repita la consulta.
const enCache = unstable_cache(async () => ({ fuente: await leer() }), ["calendario-publico-2026-27"], { revalidate: 60, tags: ["calendario"] });

/** Calendario publico leido de la tabla de eventos (cacheado 60 s). undefined = usar los ficheros del repo. */
export async function cargarFuente(): Promise<FuenteCalendario | undefined> {
  return (await enCache()).fuente ?? undefined;
}
