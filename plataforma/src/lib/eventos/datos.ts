import "server-only";
import { avisoDe } from "@/lib/equipacion";
import type { clienteSesion } from "@/lib/supabase";
import { limpiarRival, type EventoFila, type JugadorBasico, type Pista } from "./dominio";
import type { Aviso } from "@/lib/equipacion";

// Lectura de eventos, pistas y jugadores con la sesion del gestor: la base (RLS + is_gestor) decide quien lee.
export type Cliente = Awaited<ReturnType<typeof clienteSesion>>;
export const TEMPORADA = "2026-27";

const COLUMNAS_EVENTO = "id, clave, temporada, tipo, equipo, titulo, jornada, rival, es_local, fecha, inicio, fin, quedada, pista_id, numero_pista, notas, origen, serie, estado, sporteasy_estado, sporteasy_cambio, sporteasy_copiado_en, sin_recordatorios, creado_en, cambio_visible, cambio_visible_en";

export async function cargarPistas(sb: Cliente): Promise<Pista[]> {
  const { data, error } = await sb.from("pistas").select("id, slug, nombre, nombre_corto, direccion, uso, estado, es_de_serie, num_pistas, nota").order("uso").order("nombre");
  if (error) throw new Error(`pistas: ${error.message}`);
  return (data ?? []) as Pista[];
}

export async function cargarEventos(sb: Cliente): Promise<EventoFila[]> {
  const { data, error } = await sb.from("eventos").select(COLUMNAS_EVENTO).eq("temporada", TEMPORADA).order("fecha").order("inicio", { nullsFirst: false });
  if (error) throw new Error(`eventos: ${error.message}`);
  return (data ?? []) as EventoFila[];
}

export async function cargarEvento(sb: Cliente, id: string): Promise<EventoFila | null> {
  const { data, error } = await sb.from("eventos").select(COLUMNAS_EVENTO).eq("id", id).maybeSingle();
  if (error) throw new Error(`evento: ${error.message}`);
  return (data as EventoFila | null) ?? null;
}

export async function cargarJugadores(sb: Cliente): Promise<JugadorBasico[]> {
  const { data, error } = await sb.from("jugadores").select("person_id, nombre_visible, ficha_mda, ficha_mdl, entrena, activo, rol").order("nombre_visible");
  if (error) throw new Error(`jugadores: ${error.message}`);
  return (data ?? []) as JugadorBasico[];
}

/** Aviso de choque de equipacion de un partido de liga (mismo calculo que la web publica). */
export function avisoDeEvento(e: Pick<EventoFila, "tipo" | "equipo" | "jornada" | "fecha" | "inicio" | "es_local" | "rival" | "numero_pista">): Aviso | null {
  if (e.tipo !== "liga" || (e.equipo !== "MdA" && e.equipo !== "MdL") || !e.rival || e.jornada == null) return null;
  return avisoDe({
    equipo: e.equipo === "MdA" ? "MDA" : "MDL", jornada: e.jornada, fecha: e.fecha, hora: e.inicio ? e.inicio.slice(0, 5) : null,
    local: e.es_local, descansa: false, rival: limpiarRival(e.rival), campo: e.numero_pista ? String(e.numero_pista) : null,
  });
}
