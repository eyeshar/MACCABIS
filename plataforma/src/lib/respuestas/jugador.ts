import "server-only";
import { cache } from "react";
import { clienteSesion, configurado } from "@/lib/supabase";
import type { MiAusencia, MiEvento, MiRespuesta } from "./dominio";

// Lo que lee el jugador con SU sesion (D99): sus eventos (v_mis_eventos), sus respuestas y ausencias (RLS: solo las
// suyas) y los nombres de "quien va" de sus eventos (v_quien_va: nombre y estado, nada mas). La base decide.

const COLS = "id, tipo, equipo, titulo, jornada, rival, es_local, fecha, inicio, fin, quedada, notas, estado, cambio_visible, cambio_visible_en, pista_nombre, pista_nombre_corto, pista_direccion, numero_pista, pista_por_confirmar, pista_motivo";

/** ¿Esta encendido «respuestas en la web»? (sin configurar o sin sesion: no) */
export const respuestasWebEncendido = cache(async () => {
  if (!configurado()) return false;
  const sb = await clienteSesion();
  const { data } = await sb.rpc("respuestas_web_encendido");
  return data === true;
});

export const cargarMisEventos = cache(async (desde: string): Promise<MiEvento[]> => {
  const sb = await clienteSesion();
  const { data, error } = await sb.from("v_mis_eventos").select(COLS).gte("fecha", desde).eq("temporada", "2026-27").order("fecha").order("inicio", { nullsFirst: false });
  if (error) throw new Error(`v_mis_eventos: ${error.message}`);
  return (data ?? []) as MiEvento[];
});

export async function cargarMiEvento(id: string): Promise<MiEvento | null> {
  const sb = await clienteSesion();
  const { data } = await sb.from("v_mis_eventos").select(COLS).eq("id", id).maybeSingle();
  return (data as MiEvento | null) ?? null;
}

export async function cargarMisEventosDelDia(fecha: string): Promise<MiEvento[]> {
  const sb = await clienteSesion();
  const { data } = await sb.from("v_mis_eventos").select(COLS).eq("fecha", fecha).order("inicio");
  return (data ?? []) as MiEvento[];
}

export const cargarMisRespuestas = cache(async (): Promise<MiRespuesta[]> => {
  const sb = await clienteSesion();
  const { data, error } = await sb.from("respuestas").select("evento_id, respuesta, motivo, detalle, ausencia_id, origen, puesto_por_nombre");
  if (error) throw new Error(`respuestas: ${error.message}`);
  return (data ?? []) as MiRespuesta[];
});

export const cargarMisAusencias = cache(async (): Promise<MiAusencia[]> => {
  const sb = await clienteSesion();
  const { data, error } = await sb.from("ausencias_periodo").select("id, desde, hasta, motivo, detalle, borrada_en, origen").is("borrada_en", null).order("desde");
  if (error) throw new Error(`ausencias: ${error.message}`);
  return (data ?? []) as MiAusencia[];
});

export type QuienVa = { va: string[]; duda: string[]; no: string[]; sin_responder: number };

export async function cargarQuienVa(eventoIds: string[]): Promise<Map<string, QuienVa>> {
  const sb = await clienteSesion();
  const { data } = await sb.from("v_quien_va").select("evento_id, nombre, estado").in("evento_id", eventoIds);
  const m = new Map<string, QuienVa>();
  for (const id of eventoIds) m.set(id, { va: [], duda: [], no: [], sin_responder: 0 });
  for (const f of (data ?? []) as { evento_id: string; nombre: string; estado: string }[]) {
    const q = m.get(f.evento_id)!;
    if (f.estado === "va") q.va.push(f.nombre);
    else if (f.estado === "duda") q.duda.push(f.nombre);
    else if (f.estado === "no") q.no.push(f.nombre);
    else q.sin_responder++;
  }
  for (const q of m.values()) for (const l of [q.va, q.duda, q.no]) l.sort((a, b) => a.localeCompare(b, "es"));
  return m;
}
