"use server";

import { revalidatePath } from "next/cache";
import { exigirGestor } from "@/lib/sesion";
import { cargarContexto } from "@/lib/convocatoria/datos";
import { entradaDe } from "@/lib/convocatoria/vista";
import { avisarConvocados } from "@/lib/convocatoria/avisos";
import { EQUIPOS, NIVELES, POSICIONES, proponer, vacia, type Convocatoria, type Dificultad, type Equipo } from "@/lib/convocatoria/motor";

// Acciones de la convocatoria (D107). Todo con la sesion del gestor: la base (is_gestor) decide. Las convocatorias se
// escriben SOLO con las funciones de la base (convocatoria_guardar / _aprobar / _marcar), que apuntan cada cambio.

export type R = { ok: true; texto?: string } | { ok: false; error: string };
export type Accion = "mover" | "doblar" | "quitar" | "anadir" | "posicion";
export type Motivo = "rotacion" | "rival" | "lesion" | "equilibrar" | "pedido" | "otro";
const MOTIVOS: Motivo[] = ["rotacion", "rival", "lesion", "equilibrar", "pedido", "otro"];
const ACCIONES: Accion[] = ["mover", "doblar", "quitar", "anadir", "posicion"];
const DIFICULTADES: Dificultad[] = ["alta", "media", "baja"];

const ERRORES: Record<string, string> = {
  solo_gestores: "Solo los gestores.",
  cambio_a_mano_con_motivo: "Elige un motivo para guardar el cambio.",
  sin_convocatoria: "Primero elige «Usar propuesta» o «Empezar en blanco».",
  sin_aprobar: "La convocatoria aún no está aprobada.",
  equipos_no_validos: "Esa convocatoria no es válida.",
};
const error = (m: string) => ERRORES[Object.keys(ERRORES).find((k) => m.includes(k)) ?? ""] ?? `No se pudo guardar: ${m}`;
const refrescar = () => { revalidatePath("/gestion/convocatoria", "layout"); revalidatePath("/gestion"); revalidatePath("/mi-zona", "layout"); };

/** Limpia lo que llega del navegador: solo los equipos que juegan, sin repetidos, posiciones validas. */
function limpiar(conv: Convocatoria, juegan: Equipo[], plantilla: Set<string>): Convocatoria {
  const out: Convocatoria = {};
  for (const e of EQUIPOS) {
    if (!juegan.includes(e)) continue;
    const vistos = new Set<string>();
    out[e] = (conv[e] ?? []).filter((c) => plantilla.has(c.person_id) && !vistos.has(c.person_id) && vistos.add(c.person_id))
      .map((c) => (c.posicion && POSICIONES.includes(c.posicion) ? { person_id: c.person_id, posicion: c.posicion } : { person_id: c.person_id }));
  }
  return out;
}

async function contexto(fecha: string) {
  const s = await exigirGestor();
  const ctx = await cargarContexto(s.supabase, fecha);
  if (!ctx || ctx.fecha !== fecha) throw new Error("Ese domingo no tiene partidos de liga.");
  if (ctx.sinMigracion) throw new Error("Falta aplicar la migración de la convocatoria en esta base: aún no se puede guardar.");
  return { ...s, ctx };
}

/** Avisa «Estás convocado» si ya esta aprobada (solo con el interruptor encendido; si no, queda en espera). */
async function avisar(sb: Awaited<ReturnType<typeof exigirGestor>>["supabase"], fecha: string) {
  const ctx = await cargarContexto(sb, fecha);
  const c = ctx?.convocatoria;
  if (!ctx || !c || c.estado !== "aprobada") return null;
  // Si el envio falla (servicio de avisos caido, claves mal puestas…), la convocatoria sigue aprobada y el aviso queda en
  // espera para «Enviar ahora»: nunca se pierde una aprobacion por un aviso.
  const r = await avisarConvocados(fecha, c.equipos, c.aviso_base, ctx.partidos)
    .catch((e: Error) => ({ estado: "en_espera" as const, avisados: 0, motivo: `error: ${e.message}` }));
  await sb.rpc("convocatoria_marcar", { p_fecha: fecha, p_que: r.estado === "enviado" ? "aviso_enviado" : "aviso_en_espera" });
  return r;
}

/** «Usar propuesta», «Empezar en blanco (a mano)» y «Recalcular propuesta». */
export async function empezar(fecha: string, modo: "propuesta" | "blanco" | "recalcular"): Promise<R> {
  try {
    const { supabase, ctx } = await contexto(fecha);
    const juegan = ctx.partidos.map((p) => p.equipo);
    const conv = modo === "blanco" ? vacia(juegan) : proponer(entradaDe(ctx)).convocatoria;
    const dificultad = Object.fromEntries(ctx.partidos.map((p) => [p.equipo, { valor: p.dificultad.valor, propuesta: p.dificultad.propuesta, porque: p.dificultad.porque }]));
    const { error: e } = await supabase.rpc("convocatoria_guardar", {
      p_fecha: fecha, p_jornada: ctx.jornada, p_equipos: conv, p_dificultad: dificultad, p_accion: modo,
      p_detalle: modo === "blanco" ? {} : { avisos: proponer(entradaDe(ctx)).avisos.length },
    });
    if (e) return { ok: false, error: error(e.message) };
    if (ctx.convocatoria?.estado === "aprobada") await avisar(supabase, fecha);
    refrescar();
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/** Un cambio a mano (pasar al otro equipo, doblar, quitar, añadir o cambiar la posicion del partido), con su motivo. */
export async function guardarCambio(fecha: string, conv: Convocatoria, cambio: { accion: Accion; person_id: string; equipo: Equipo | null; motivo: Motivo; nota?: string | null }): Promise<R> {
  if (!ACCIONES.includes(cambio.accion)) return { ok: false, error: "Cambio no válido." };
  if (!MOTIVOS.includes(cambio.motivo)) return { ok: false, error: ERRORES.cambio_a_mano_con_motivo };
  try {
    const { supabase, ctx } = await contexto(fecha);
    if (!ctx.convocatoria?.origen) return { ok: false, error: ERRORES.sin_convocatoria };
    const juegan = ctx.partidos.map((p) => p.equipo);
    const limpia = limpiar(conv, juegan, new Set(ctx.jugadores.map((j) => j.person_id)));
    // Doblar a la misma hora no se puede (regla 1.4): se bloquea tambien aqui, no solo en la pantalla.
    const mismaHora = ctx.partidos.length === 2 && ctx.partidos[0].inicio && ctx.partidos[0].inicio === ctx.partidos[1].inicio;
    if (mismaHora && (limpia.MdA ?? []).some((c) => (limpia.MdL ?? []).some((x) => x.person_id === c.person_id))) {
      return { ok: false, error: "Los dos partidos empiezan a la misma hora: nadie puede doblar (regla 1.4)." };
    }
    const { error: e } = await supabase.rpc("convocatoria_guardar", {
      p_fecha: fecha, p_jornada: ctx.jornada, p_equipos: limpia, p_dificultad: null, p_accion: cambio.accion,
      p_person: cambio.person_id, p_equipo: cambio.equipo, p_motivo: cambio.motivo, p_nota: cambio.nota?.trim() || null,
    });
    if (e) return { ok: false, error: error(e.message) };
    if (ctx.convocatoria.estado === "aprobada") await avisar(supabase, fecha);
    refrescar();
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/** Ivan corrige la dificultad de un rival (la propuesta y su porque se guardan al lado). */
export async function cambiarDificultad(fecha: string, equipo: Equipo, valor: Dificultad): Promise<R> {
  if (!DIFICULTADES.includes(valor) || !EQUIPOS.includes(equipo)) return { ok: false, error: "Dificultad no válida." };
  try {
    const { supabase, ctx } = await contexto(fecha);
    const p = ctx.partidos.find((x) => x.equipo === equipo);
    if (!p) return { ok: false, error: `El ${equipo} no juega ese domingo.` };
    const dificultad = { ...(ctx.convocatoria?.dificultad ?? {}), [equipo]: { valor, propuesta: p.dificultad.propuesta, porque: p.dificultad.porque } };
    const { error: e } = await supabase.rpc("convocatoria_guardar", {
      p_fecha: fecha, p_jornada: ctx.jornada, p_equipos: null, p_dificultad: dificultad, p_accion: "dificultad", p_equipo: equipo,
      p_detalle: { antes: p.dificultad.valor, despues: valor },
    });
    if (e) return { ok: false, error: error(e.message) };
    refrescar();
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/** «Aprobar convocatoria»: aprobada, WhatsApp y SportEasy pendientes y el aviso de la web (o «en espera»). */
export async function aprobar(fecha: string): Promise<R> {
  try {
    const { supabase } = await contexto(fecha);
    const { error: e } = await supabase.rpc("convocatoria_aprobar", { p_fecha: fecha });
    if (e) return { ok: false, error: error(e.message) };
    const r = await avisar(supabase, fecha);
    refrescar();
    return { ok: true, texto: r?.estado === "enviado" ? `Aviso «Estás convocado» a ${r.avisados}.` : "Aviso de la web en espera (interruptor apagado)." };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/** WhatsApp copiado al grupo, o SportEasy copiado por Claude. */
export async function marcar(fecha: string, que: "whatsapp" | "sporteasy"): Promise<R> {
  const { supabase } = await exigirGestor();
  const { error: e } = await supabase.rpc("convocatoria_marcar", { p_fecha: fecha, p_que: que });
  if (e) return { ok: false, error: error(e.message) };
  refrescar();
  return { ok: true };
}

/** «Enviar ahora» el aviso de la web que quedo en espera (cuando el interruptor ya esta encendido). */
export async function avisarAhora(fecha: string): Promise<R> {
  const { supabase } = await exigirGestor();
  const r = await avisar(supabase, fecha);
  refrescar();
  if (!r) return { ok: false, error: ERRORES.sin_aprobar };
  return r.estado === "enviado" ? { ok: true, texto: `Aviso a ${r.avisados}.` } : { ok: false, error: "El interruptor de respuestas en la web está apagado: el aviso sigue en espera." };
}

// ---------------------------------------------------------------- datos privados por jugador (solo gestores, D39)
export type CamposPrivados = {
  posicion: string | null; base_reserva: boolean; nivel: string | null; dobla: boolean;
  regla: "fijo" | "comodin" | null; regla_equipo: Equipo | null; sancionado_hasta_jornada: number | null; nota: string | null;
};

export async function guardarPrivado(personId: string, c: CamposPrivados): Promise<R> {
  const { supabase, nombre } = await exigirGestor();
  if (c.posicion && !POSICIONES.includes(c.posicion as never)) return { ok: false, error: "Posición no válida." };
  if (c.nivel && !NIVELES.includes(c.nivel as never)) return { ok: false, error: "Nivel no válido (A–E)." };
  if (c.regla === "fijo" && !c.regla_equipo) return { ok: false, error: "«Fijo» necesita el equipo." };
  const fila = {
    person_id: personId, posicion: c.posicion || null, base_reserva: !!c.base_reserva, nivel: c.nivel || null, dobla: !!c.dobla,
    regla: c.regla || null, regla_equipo: c.regla === "fijo" ? c.regla_equipo : null,
    sancionado_hasta_jornada: c.sancionado_hasta_jornada && c.sancionado_hasta_jornada > 0 ? Math.floor(c.sancionado_hasta_jornada) : null,
    nota: c.nota?.trim() || null, cambiado_en: new Date().toISOString(), cambiado_por_nombre: nombre,
  };
  const { error: e } = await supabase.from("jugadores_privado").upsert(fila, { onConflict: "person_id" });
  if (e) return { ok: false, error: `No se pudo guardar: ${e.message}` };
  refrescar();
  return { ok: true };
}

