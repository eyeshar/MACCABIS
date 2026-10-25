"use server";

import { revalidatePath } from "next/cache";
import { exigirGestor } from "@/lib/sesion";
import { cargarContexto } from "@/lib/convocatoria/datos";
import { EQUIPOS, type Convocatoria, type Equipo } from "@/lib/convocatoria/motor";
import { MOTIVOS, type Motivo } from "@/lib/eventos/dominio";

// Acciones del tablero (D121). Solo gestores (la base lo vuelve a comprobar). Convocar o quitar guarda en la
// convocatoria con las funciones de siempre (convocatoria_guardar, D107: un solo motivo por grupo, «ajuste manual» por
// defecto); cambiar respuestas, con tablero_responder («puesta por <gestor>», tambien con el interruptor apagado).

export type R = { ok: true; registros?: string[]; aviso?: string } | { ok: false; error: string };
const refrescar = () => { revalidatePath("/gestion/tablero"); revalidatePath("/gestion/convocatoria", "layout"); revalidatePath("/gestion"); revalidatePath("/", "layout"); };
const ERRORES: Record<string, string> = {
  solo_gestores: "Solo los gestores.", falta_motivo: "Elige un motivo para «No van».", no_invitado: "Alguno no está invitado a ese evento.",
  evento_cerrado: "Ese evento está cancelado.", nada_que_deshacer: "No hay nada que deshacer.", sin_personas: "No hay nadie seleccionado.",
};
const error = (m: string) => ERRORES[Object.keys(ERRORES).find((k) => m.includes(k)) ?? ""] ?? `No se pudo guardar: ${m}`;

/** Convocar a un equipo o quitar la convocatoria (a uno o a un grupo). Valida contra lo que hay en la base (no contra
 *  la pantalla): «Al MdA» solo a quien va a ese partido y tiene ficha; doblar a la misma hora, nunca (regla 1.4). */
export async function cambiarConvocatoria(fecha: string, cambio: { accion: "anadir" | "quitar"; equipo: Equipo | null; personas: string[]; nota?: string | null }): Promise<R> {
  try {
    const { supabase } = await exigirGestor();
    const ctx = await cargarContexto(supabase, fecha);
    if (!ctx || ctx.fecha !== fecha) return { ok: false, error: "Ese domingo no tiene partidos de liga." };
    const juegan = ctx.partidos.map((p) => p.equipo);
    const base: Convocatoria = ctx.convocatoria?.origen ? ctx.convocatoria.equipos : Object.fromEntries(juegan.map((e) => [e, []]));
    const conv: Convocatoria = Object.fromEntries(EQUIPOS.filter((e) => juegan.includes(e)).map((e) => [e, [...(base[e] ?? [])]]));
    let afectados: string[] = [];
    if (cambio.accion === "anadir") {
      const e = cambio.equipo;
      if (!e || !juegan.includes(e)) return { ok: false, error: `El ${e ?? "equipo"} no juega ese domingo.` };
      afectados = cambio.personas.filter((id) => {
        const j = ctx.jugadores.find((x) => x.person_id === id);
        return j && j.ficha[e] && j.invitadoA.includes(e) && j.respuesta[e] === "va" && !(conv[e] ?? []).some((c) => c.person_id === id);
      });
      conv[e] = [...(conv[e] ?? []), ...afectados.map((person_id) => ({ person_id }))];
      const mismaHora = ctx.partidos.length === 2 && ctx.partidos[0].inicio && ctx.partidos[0].inicio === ctx.partidos[1].inicio;
      if (mismaHora && (conv.MdA ?? []).some((c) => (conv.MdL ?? []).some((x) => x.person_id === c.person_id))) {
        return { ok: false, error: "Los dos partidos empiezan a la misma hora: nadie puede doblar (regla 1.4)." };
      }
    } else {
      for (const e of EQUIPOS) {
        if (!conv[e] || (cambio.equipo && cambio.equipo !== e)) continue;
        const antes = conv[e]!.length;
        conv[e] = conv[e]!.filter((c) => !cambio.personas.includes(c.person_id));
        if (conv[e]!.length !== antes) afectados.push(...cambio.personas.filter((id) => (base[e] ?? []).some((c) => c.person_id === id)));
      }
      afectados = [...new Set(afectados)];
    }
    if (!afectados.length) return { ok: false, error: cambio.accion === "anadir" ? "Nadie de la selección está disponible para ese partido." : "Nadie de la selección estaba convocado." };
    // Sin convocatoria empezada: se empieza en blanco y se apunta el cambio (asi queda en el registro y se puede aprobar).
    if (!ctx.convocatoria?.origen) {
      const { error: e0 } = await supabase.rpc("convocatoria_guardar", { p_fecha: fecha, p_jornada: ctx.jornada, p_equipos: base, p_dificultad: null, p_accion: "blanco", p_detalle: { origen: "tablero" } });
      if (e0) return { ok: false, error: error(e0.message) };
    }
    const { error: e1 } = await supabase.rpc("convocatoria_guardar", {
      p_fecha: fecha, p_jornada: ctx.jornada, p_equipos: conv, p_dificultad: null, p_accion: cambio.accion,
      p_person: afectados.length === 1 ? afectados[0] : null, p_equipo: cambio.equipo, p_motivo: "otro",
      p_nota: cambio.nota?.trim() || "ajuste manual", p_detalle: { personas: afectados, origen: "tablero" },
    });
    if (e1) return { ok: false, error: error(e1.message) };
    // Una aprobada que se toca: sus salidas vuelven a pendiente; el aviso a los convocados se envia desde la salida (D127).
    refrescar();
    return { ok: true, aviso: ctx.convocatoria?.estado === "aprobada" ? "Salidas pendientes: el aviso a los convocados se envía desde la salida." : undefined };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/** «Deshacer» un cambio de convocatoria: vuelve a dejar lo que habia (queda en el registro como ajuste). */
export async function restaurarConvocatoria(fecha: string, equipos: Convocatoria): Promise<R> {
  try {
    const { supabase } = await exigirGestor();
    const ctx = await cargarContexto(supabase, fecha);
    if (!ctx || ctx.fecha !== fecha) return { ok: false, error: "Ese domingo no tiene partidos de liga." };
    const plantilla = new Set(ctx.jugadores.map((j) => j.person_id));
    const limpia: Convocatoria = Object.fromEntries(ctx.partidos.map((p) => [p.equipo, (equipos[p.equipo] ?? []).filter((c) => plantilla.has(c.person_id)).map((c) => (c.posicion ? { person_id: c.person_id, posicion: c.posicion } : { person_id: c.person_id }))]));
    const { error: e } = await supabase.rpc("convocatoria_guardar", { p_fecha: fecha, p_jornada: ctx.jornada, p_equipos: limpia, p_dificultad: null, p_accion: "mover", p_motivo: "otro", p_nota: "deshacer el último cambio del tablero", p_detalle: { origen: "tablero", deshacer: true } });
    if (e) return { ok: false, error: error(e.message) };
    refrescar();
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/** Cambiar la respuesta de varios (Van / Duda / No van) en uno o varios eventos: queda «puesta por <gestor>». «No van»
 *  pide un motivo de la lista de siempre (uno para todo el grupo). En cada evento, solo los invitados a el. */
export async function responderTablero(eventos: { id: string; personas: string[] }[], respuesta: "va" | "duda" | "no", motivo: Motivo | null): Promise<R> {
  if (respuesta === "no" && (!motivo || !MOTIVOS.includes(motivo))) return { ok: false, error: ERRORES.falta_motivo };
  try {
    const { supabase } = await exigirGestor();
    const registros: string[] = [];
    for (const e of eventos) {
      if (!e.personas.length) continue;
      const { data, error: err } = await supabase.rpc("tablero_responder", { p_evento: e.id, p_personas: e.personas, p_respuesta: respuesta, p_motivo: respuesta === "no" ? motivo : null, p_detalle: null });
      if (err) return { ok: false, error: error(err.message) };
      registros.push((data as { registro: string }).registro);
    }
    refrescar();
    return { ok: true, registros };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function deshacerRespuestas(registros: string[]): Promise<R> {
  try {
    const { supabase } = await exigirGestor();
    for (const id of registros) {
      const { error: err } = await supabase.rpc("tablero_deshacer", { p_registro: id });
      if (err) return { ok: false, error: error(err.message) };
    }
    refrescar();
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
