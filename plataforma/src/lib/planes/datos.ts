import "server-only";
import { clienteSesion } from "@/lib/supabase";
import { esGestorActual } from "@/lib/sesion";
import { cargarMiEvento, cargarQuienVa, type QuienVa } from "@/lib/respuestas/jugador";
import type { MiEvento } from "@/lib/respuestas/dominio";

// Lectura de un plan no oficial (D118). El jugador lo lee de SU agenda (v_mi_agenda: solo si esta invitado); un gestor
// lo lee siempre (RLS de gestores sobre eventos), aunque no este invitado (p. ej. un plan solo para el MdL).

const COLS = "id, tipo, equipo, titulo, jornada, rival, rival_texto, es_local, fecha, inicio, fin, quedada, notas, estado, cambio_visible, cambio_visible_en, oficial, creado_por, plazas, recordar_un_dia_antes, pista_id, numero_pista, ubicacion_nombre, ubicacion_direccion, ubicacion_lat, ubicacion_lng, ubicacion_enlace, secuencia, actualizado_en, borrado_en";

type Fila = Omit<MiEvento, "pista_nombre" | "pista_nombre_corto" | "pista_direccion" | "pista_por_confirmar" | "pista_motivo" | "organizador" | "es_mio" | "lugar_nombre" | "lugar_direccion" | "lugar_lat" | "lugar_lng" | "lugar_enlace"> & {
  pista_id: string | null; ubicacion_nombre: string | null; ubicacion_direccion: string | null; ubicacion_lat: number | null; ubicacion_lng: number | null; ubicacion_enlace: string | null; borrado_en: string | null;
};

export type PlanVista = { evento: MiEvento; invitado: boolean; esGestor: boolean; borrado: boolean };

export async function cargarPlan(id: string): Promise<PlanVista | null> {
  const [propio, esGestor] = await Promise.all([cargarMiEvento(id), esGestorActual()]);
  if (propio) return { evento: propio, invitado: true, esGestor, borrado: false };
  if (!esGestor) return null;
  const sb = await clienteSesion();
  const { data } = await sb.from("eventos").select(COLS).eq("id", id).maybeSingle();
  const f = data as Fila | null;
  if (!f) return null;
  const [{ data: pista }, { data: org }] = await Promise.all([
    f.pista_id ? sb.from("pistas").select("nombre, nombre_corto, direccion, lat, lng").eq("id", f.pista_id).maybeSingle() : Promise.resolve({ data: null }),
    f.creado_por ? sb.from("jugadores").select("nombre_visible").eq("person_id", f.creado_por).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const p = pista as { nombre: string; nombre_corto: string | null; direccion: string | null; lat: number | null; lng: number | null } | null;
  const evento: MiEvento = {
    ...f, organizador: (org as { nombre_visible: string } | null)?.nombre_visible ?? null, es_mio: false,
    pista_nombre: p?.nombre ?? null, pista_nombre_corto: p?.nombre_corto ?? null, pista_direccion: p?.direccion ?? null,
    pista_por_confirmar: !p && !f.ubicacion_nombre && f.ubicacion_lat == null && !f.ubicacion_enlace, pista_motivo: null,
    lugar_nombre: p ? p.nombre_corto ?? p.nombre : f.ubicacion_nombre, lugar_direccion: p?.direccion ?? f.ubicacion_direccion,
    lugar_lat: p?.lat ?? f.ubicacion_lat, lugar_lng: p?.lng ?? f.ubicacion_lng, lugar_enlace: p ? null : f.ubicacion_enlace,
  };
  return { evento, invitado: false, esGestor, borrado: Boolean(f.borrado_en) };
}

/** «Quién va» de un plan: los invitados lo leen de v_quien_va (nombres y estado, nada mas); un gestor no invitado, de
 *  las respuestas y los jugadores (RLS de gestores). */
export async function quienVaPlan(v: PlanVista): Promise<QuienVa> {
  if (v.invitado) return (await cargarQuienVa([v.evento.id])).get(v.evento.id)!;
  const sb = await clienteSesion();
  const [{ data: js }, { data: rs }] = await Promise.all([
    sb.from("jugadores").select("person_id, nombre_visible, ficha_mda, ficha_mdl, entrena, activo, rol"),
    sb.from("respuestas").select("person_id, respuesta").eq("evento_id", v.evento.id),
  ]);
  const { quienResponde } = await import("@/lib/respuestas/dominio");
  const resp = new Map(((rs ?? []) as { person_id: string; respuesta: string }[]).map((r) => [r.person_id, r.respuesta]));
  const q: QuienVa = { va: [], duda: [], no: [], sin_responder: [] };
  for (const j of (js ?? []) as { person_id: string; nombre_visible: string; ficha_mda: boolean; ficha_mdl: boolean; entrena: boolean; activo: boolean; rol: "jugador" | "solo_entreno" | "entrenador" }[]) {
    if (!quienResponde(v.evento, j)) continue;
    const r = resp.get(j.person_id) ?? "sin_responder";
    if (r === "va") q.va.push(j.nombre_visible); else if (r === "duda") q.duda.push(j.nombre_visible); else if (r === "no") q.no.push(j.nombre_visible); else q.sin_responder.push(j.nombre_visible);
  }
  for (const l of [q.va, q.duda, q.no, q.sin_responder]) l.sort((a, b) => a.localeCompare(b, "es"));
  return q;
}
