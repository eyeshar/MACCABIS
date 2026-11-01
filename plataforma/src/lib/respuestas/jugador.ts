import "server-only";
import { cache } from "react";
import { clienteSesion, configurado } from "@/lib/supabase";
import { cargarMiZona } from "@/app/mi-zona/datos";
import type { MiAusencia, MiDomingo, MiEvento, MiRespuesta } from "./dominio";
import { porDefectoMio, type MiDefecto } from "@/lib/disponibilidad/porDefecto";

// Lo que lee el jugador con SU sesion (D99): sus eventos (v_mis_eventos), sus respuestas y ausencias (RLS: solo las
// suyas) y los nombres de "quien va" de sus eventos (v_quien_va: nombre y estado, nada mas). La base decide.

// Su agenda (D117-D119): v_mi_agenda trae los oficiales y los planes no oficiales a los que esta invitado, con el sitio
// efectivo (pista o ubicacion libre) y quien organiza un plan. Nada de nadie mas.
const COLS = "id, tipo, equipo, titulo, jornada, rival, rival_texto, es_local, fecha, inicio, fin, quedada, notas, estado, cambio_visible, cambio_visible_en, pista_nombre, pista_nombre_corto, pista_direccion, numero_pista, pista_por_confirmar, pista_motivo, oficial, creado_por, organizador, es_mio, plazas, recordar_un_dia_antes, lugar_nombre, lugar_direccion, lugar_lat, lugar_lng, lugar_enlace, secuencia, actualizado_en";
const VISTA = "v_mi_agenda";

/** ¿Esta encendido «respuestas en la web»? (sin configurar o sin sesion: no) */
export const respuestasWebEncendido = cache(async () => {
  if (!configurado()) return false;
  const sb = await clienteSesion();
  const { data } = await sb.rpc("respuestas_web_encendido");
  return data === true;
});

export const cargarMisEventos = cache(async (desde: string): Promise<MiEvento[]> => {
  const sb = await clienteSesion();
  const { data, error } = await sb.from(VISTA).select(COLS).gte("fecha", desde).eq("temporada", "2026-27").order("fecha").order("inicio", { nullsFirst: false });
  if (error) throw new Error(`${VISTA}: ${error.message}`);
  return (data ?? []) as MiEvento[];
});

export async function cargarMiEvento(id: string): Promise<MiEvento | null> {
  const sb = await clienteSesion();
  const { data } = await sb.from(VISTA).select(COLS).eq("id", id).maybeSingle();
  return (data as MiEvento | null) ?? null;
}

export async function cargarMisEventosDelDia(fecha: string): Promise<MiEvento[]> {
  const sb = await clienteSesion();
  const { data } = await sb.from(VISTA).select(COLS).eq("fecha", fecha).order("inicio");
  return (data ?? []) as MiEvento[];
}

/** Grupos de entreno publicados (D122): en cada entreno, el nombre de SU grupo y sus compañeros. Nada mas. */
export const cargarMisGrupos = cache(async (): Promise<{ evento_id: string; grupo: string; companeros: string[] }[]> => {
  if (!configurado()) return [];
  const sb = await clienteSesion();
  const { data, error } = await sb.rpc("mis_grupos");
  if (error) return [];
  return (data ?? []) as { evento_id: string; grupo: string; companeros: string[] }[];
});

/** Lo que un gestor le ha dejado al organizador de un plan (D118), sin ver aun. */
export const cargarAvisosPersonales = cache(async (): Promise<{ id: string; texto: string; url: string; creado_en: string }[]> => {
  if (!configurado()) return [];
  const sb = await clienteSesion();
  const { data, error } = await sb.from("avisos_personales").select("id, texto, url, creado_en").is("visto_en", null).order("creado_en", { ascending: false }).limit(5);
  if (error) return [];
  return (data ?? []) as { id: string; texto: string; url: string; creado_en: string }[];
});

// SIEMPRE filtradas por SU person_id: a un jugador la RLS ya le da solo las suyas, pero a un GESTOR le da las de todos,
// y sin el filtro su inicio y su agenda tomaban la respuesta de otro jugador al mismo partido (fallo de la J3, 25/10).
const miPersonId = cache(async () => (await cargarMiZona())?.jugador.person_id ?? null);

export const cargarMisRespuestas = cache(async (): Promise<MiRespuesta[]> => {
  const yo = await miPersonId();
  if (!yo) return [];
  const sb = await clienteSesion();
  const { data, error } = await sb.from("respuestas").select("evento_id, respuesta, motivo, detalle, ausencia_id, origen, puesto_por_nombre").eq("person_id", yo);
  if (error) throw new Error(`respuestas: ${error.message}`);
  return (data ?? []) as MiRespuesta[];
});

export const cargarMisAusencias = cache(async (): Promise<MiAusencia[]> => {
  const yo = await miPersonId();
  if (!yo) return [];
  const sb = await clienteSesion();
  const { data, error } = await sb.from("ausencias_periodo").select("id, desde, hasta, motivo, detalle, borrada_en, origen").eq("person_id", yo).is("borrada_en", null).order("desde");
  if (error) throw new Error(`ausencias: ${error.message}`);
  return (data ?? []) as MiAusencia[];
});

/** D152: su «no suele entrenar» y los entrenos en que un gestor se lo quito (`mi_disponibilidad_defecto`: solo lo suyo).
 *  Si la funcion aun no esta en la base, null (todo sigue como antes: «sin responder»). */
export const cargarMiDefecto = cache(async (): Promise<MiDefecto | null> => {
  if (!configurado()) return null;
  const sb = await clienteSesion();
  const { data, error } = await sb.rpc("mi_disponibilidad_defecto");
  if (error || !data) return null;
  const d = data as { no_suele_entrenar?: boolean; quitados?: string[] };
  return { no_suele_entrenar: !!d.no_suele_entrenar, quitados: d.quitados ?? [] };
});

/** D152: los entrenos (de `eventos`) que a el le salen como «No vas (puesto por defecto)». Vacio con las respuestas en
 *  la web apagadas: entonces no hay «Sí voy». */
export async function misEntrenosPorDefecto(eventos: MiEvento[], respuestas: MiRespuesta[], ausencias: MiAusencia[], encendido: boolean): Promise<Set<string>> {
  if (!encendido) return new Set();
  const mio = await cargarMiDefecto();
  if (!mio?.no_suele_entrenar) return new Set();
  return new Set(eventos.filter((e) => e.estado === "programado"
    && porDefectoMio(e, respuestas.find((r) => r.evento_id === e.id)?.respuesta ?? "sin_responder", mio, ausencias)).map((e) => e.id));
}

/** Su respuesta unica a un domingo (D103), si la hay y sigue vigente. */
export async function cargarMiDomingo(fecha: string): Promise<MiDomingo | null> {
  const yo = await miPersonId();
  if (!yo) return null;
  const sb = await clienteSesion();
  const { data } = await sb.from("respuestas_domingo").select("fecha, opcion, solo_evento, vigente").eq("person_id", yo).eq("fecha", fecha).eq("vigente", true).maybeSingle();
  return (data as MiDomingo | null) ?? null;
}

/** D141: tambien los NOMBRES de quien no ha contestado. Nunca motivos ni detalles: la vista no los da. */
export type QuienVa = { va: string[]; duda: string[]; no: string[]; sin_responder: string[] };

export async function cargarQuienVa(eventoIds: string[]): Promise<Map<string, QuienVa>> {
  const sb = await clienteSesion();
  const { data } = await sb.from("v_quien_va").select("evento_id, nombre, estado").in("evento_id", eventoIds);
  const m = new Map<string, QuienVa>();
  for (const id of eventoIds) m.set(id, { va: [], duda: [], no: [], sin_responder: [] });
  for (const f of (data ?? []) as { evento_id: string; nombre: string; estado: string }[]) {
    const q = m.get(f.evento_id)!;
    if (f.estado === "va") q.va.push(f.nombre);
    else if (f.estado === "duda") q.duda.push(f.nombre);
    else if (f.estado === "no") q.no.push(f.nombre);
    else q.sin_responder.push(f.nombre);
  }
  for (const q of m.values()) for (const l of [q.va, q.duda, q.no, q.sin_responder]) l.sort((a, b) => a.localeCompare(b, "es"));
  return m;
}

/** Sus convocatorias APROBADAS de hoy en adelante (D107): fecha y en qué equipos está él (vacío si no está). Nada más:
 *  ni niveles, ni posiciones, ni a quién más se convoca. Sin la migración aplicada, lista vacía. */
export const cargarMiConvocatoria = cache(async (): Promise<{ fecha: string; equipos: ("MdA" | "MdL")[] }[]> => {
  if (!configurado()) return [];
  const sb = await clienteSesion();
  const { data, error } = await sb.rpc("mi_convocatoria");
  if (error) return [];
  return (data ?? []) as { fecha: string; equipos: ("MdA" | "MdL")[] }[];
});

/** Los convocados de un domingo con la convocatoria APROBADA (D128): solo el nombre visible de cada uno, por equipo y en
 *  orden alfabetico (lo mismo que se manda por WhatsApp). Sin aprobar, null. Nada mas de nadie: lo decide la base. */
export async function cargarConvocadosDomingo(fecha: string): Promise<Partial<Record<"MdA" | "MdL", string[]>> | null> {
  if (!configurado()) return null;
  const sb = await clienteSesion();
  const { data, error } = await sb.rpc("convocados_del_domingo", { p_fecha: fecha });
  if (error) return null;
  return (data as Partial<Record<"MdA" | "MdL", string[]>> | null) ?? null;
}

