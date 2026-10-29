import "server-only";
import { createHash } from "node:crypto";
import { cargarMiZona } from "@/app/mi-zona/datos";
import avisosJson from "@/data/avisos.json";
import guiaJson from "@/data/guiaJugador.json";
import { sumarDias, hoyMadrid } from "@/lib/dias";
import { cargarFuente } from "@/lib/eventos/fuente";
import { vigentes, type AvisoFichero } from "@/lib/inicio/avisosFichero";
import { eventosTemporada, temporadaDe } from "@/lib/publico";
import { cargarMiConvocatoria, cargarMisAusencias, cargarMisEventos, cargarMisRespuestas } from "@/lib/respuestas/jugador";
import { enlaceLugar, lugarTexto, type MiEvento } from "@/lib/respuestas/dominio";
import { clienteSesion } from "@/lib/supabase";
import type { Usuario } from "@/lib/usuario";
import { construirContexto, PATRON_PROHIBIDO, type EntradaContexto, type EventoCtx, type QuienCtx } from "./contexto";

// Cargador del contexto del asistente (D142), con la sesion de quien pregunta. Lee solo lo que el contexto permite y
// lo pasa campo a campo a construirContexto (contexto.ts, lista blanca). Lo que sale de aqui va al Worker de Cloudflare.
// OJO gestores: la RLS les deja ver respuestas y ausencias de todos; por eso todo lo personal se filtra por SU person_id
// (lib/respuestas/jugador.ts) y de los demas solo se lee v_quien_va (nombre y estado; nunca motivo ni detalle).

const DIAS_VISTA = 14;
const MAX_EVENTOS = 8;

async function quienVa(ids: string[]): Promise<Map<string, QuienCtx>> {
  const m = new Map<string, QuienCtx>();
  if (!ids.length) return m;
  const sb = await clienteSesion();
  const { data } = await sb.from("v_quien_va").select("evento_id, nombre, estado").in("evento_id", ids);
  for (const id of ids) m.set(id, { va: [], duda: [], no: [], sin_responder: [] });
  for (const f of (data ?? []) as { evento_id: string; nombre: string; estado: string }[]) {
    const q = m.get(f.evento_id);
    if (!q) continue;
    (f.estado === "va" ? q.va : f.estado === "duda" ? q.duda : f.estado === "no" ? q.no : q.sin_responder).push(String(f.nombre));
  }
  for (const q of m.values()) for (const l of Object.values(q)) l.sort((a, b) => a.localeCompare(b, "es"));
  return m;
}

const deMiEvento = (e: MiEvento): EventoCtx => ({
  id: e.id, tipo: e.tipo, equipo: e.equipo, titulo: e.titulo, rival: e.rival ?? e.rival_texto ?? null, fecha: e.fecha,
  inicio: e.inicio, fin: e.fin, quedada: e.quedada, lugar: lugarTexto(e), mapa: enlaceLugar(e), cancelado: e.estado === "cancelado", oficial: e.oficial !== false,
});

export async function cargarContexto(usuario: Usuario): Promise<string> {
  const hoy = hoyMadrid();
  const limite = sumarDias(hoy, DIAS_VISTA);
  const zona = await cargarMiZona().catch(() => null);
  const equipos = zona ? (["MdA", "MdL"] as const).filter((x) => (x === "MdA" ? zona.jugador.ficha_mda : zona.jugador.ficha_mdl)) : [];

  let eventos: EventoCtx[];
  if (zona) {
    // Su agenda (v_mi_agenda): los oficiales y los planes a los que esta invitado.
    eventos = (await cargarMisEventos(hoy).catch(() => [] as MiEvento[])).filter((e) => e.fecha <= limite).slice(0, MAX_EVENTOS).map(deMiEvento);
  } else {
    // Gestor sin ficha: el calendario publico (sin respuestas).
    const pub = eventosTemporada(await cargarFuente()).filter((e) => e.fecha >= hoy && e.fecha <= limite).slice(0, MAX_EVENTOS);
    eventos = pub.map((e) => ({
      id: e.id, tipo: e.tipo === "partido" ? "liga" : "entreno", equipo: e.equipo === "MDA" ? "MdA" : e.equipo === "MDL" ? "MdL" : "ambos", titulo: e.titulo, rival: e.rival ?? null, fecha: e.fecha,
      inicio: e.inicio, fin: e.fin, quedada: null, lugar: e.pistaPorConfirmar ? "Pista por confirmar" : e.lugar || null,
      mapa: null, cancelado: false, oficial: true,
    }));
  }

  const [respuestas, ausencias, convocatorias, quien] = zona
    ? await Promise.all([cargarMisRespuestas().catch(() => []), cargarMisAusencias().catch(() => []), cargarMiConvocatoria(), quienVa(eventos.map((e) => e.id))])
    : [[], [], [], new Map<string, QuienCtx>()];
  const t = zona ? temporadaDe(zona.jugador.person_id) : null;

  const entrada: EntradaContexto = {
    hoy,
    guia: (guiaJson as { texto: string }).texto,
    yo: { nombre: zona?.jugador.nombre_visible ?? usuario.corto, equipos: [...equipos], esGestor: usuario.esGestor, tieneFicha: Boolean(zona) },
    avisos: vigentes((avisosJson as { avisos: AvisoFichero[] }).avisos, hoy, [...equipos].length ? [...equipos] : ["MdA", "MdL"]),
    eventos,
    quienVa: quien,
    respuestas: respuestas.map((r) => ({ evento_id: r.evento_id, respuesta: r.respuesta, motivo: r.motivo, detalle: r.detalle })),
    ausencias: ausencias.map((a) => ({ desde: a.desde, hasta: a.hasta, motivo: a.motivo, detalle: a.detalle })),
    convocatorias: convocatorias.map((c) => ({ fecha: c.fecha, equipos: [...c.equipos] })),
    stats: t ? { pj: t.pj, minutos: t.minutos ?? null, dorsales: t.dorsales ?? [], masMenos: t.masMenos, tot: t.tot ?? {}, entrenos: t.entrenos, partidos: t.partidos } : null,
  };
  // Red de seguridad: si algo con forma de correo, DNI o telefono se colara (p. ej. en un detalle escrito a mano), fuera.
  return construirContexto(entrada).replace(new RegExp(PATRON_PROHIBIDO.source, "gi"), "[oculto]");
}

/** Identificador del usuario para los contadores del Worker: no reversible y sin correo ni id a la vista. */
export const usuarioHash = (userId: string) => createHash("sha256").update(`maccabis-chat:${process.env.CHAT_SECRET ?? ""}:${userId}`).digest("hex").slice(0, 32);

export type RespuestaWorker =
  | { ok: true; respuesta: string; quedan: number; uso?: { modelo: string; prompt_tokens: number | null; completion_tokens: number | null; neuronas_estimadas: number | null } }
  | { ok: true; quedan: number; quedan_total: number; respuesta?: undefined }
  | { agotado: true; motivo: "usuario" | "total" | "modelo"; quedan: number; ok?: undefined };

export async function llamarWorker(cuerpo: Record<string, unknown>): Promise<RespuestaWorker> {
  const r = await fetch(process.env.CHAT_WORKER_URL!, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CHAT_SECRET}`, "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`worker ${r.status}`);
  return (await r.json()) as RespuestaWorker;
}
