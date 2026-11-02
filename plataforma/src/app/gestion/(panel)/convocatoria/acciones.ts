"use server";

import { revalidatePath } from "next/cache";
import { exigirGestor } from "@/lib/sesion";
import { cargarContexto } from "@/lib/convocatoria/datos";
import { entradaDe } from "@/lib/convocatoria/vista";
import { enviarAvisoConvocatoria } from "@/lib/convocatoria/salidas";
import { reenviarFallidos } from "@/lib/convocatoria/avisos";
import { mensajeConvocatoria, textoAvisados } from "@/lib/convocatoria/mensajes";
import { avisosDelFichero } from "@/lib/inicio/avisos";
import { diferencias, EQUIPOS, NIVELES, POSICIONES, proponer, sugerirRecambio, vacia, type Convocatoria, type Dificultad, type Equipo } from "@/lib/convocatoria/motor";

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
const refrescar = () => { revalidatePath("/gestion/convocatoria", "layout"); revalidatePath("/gestion"); revalidatePath("/inicio"); };

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

/** El resultado de un envío, en llano: «Avisados 14 de 16 (los otros 2 no tienen avisos). Sale a las 08:00…». */
function textoEnvio(r: NonNullable<Awaited<ReturnType<typeof enviarAvisoConvocatoria>>>) {
  if (r.estado !== "enviado") return "El envío de avisos no está configurado en este servidor.";
  const n = r.destinatarios.length;
  if (!n) return "No había nadie a quien avisar: la convocatoria no ha cambiado desde el último aviso.";
  const cuando = r.programado ? ` Sale a las ${r.programado.toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" })} (horas de silencio).` : "";
  return `${textoAvisados(r.conAvisos.length, n)}.${cuando}`;
}

/** «Aprobar y avisar» (D173): aprueba y ENVÍA ya el aviso a cada jugador según su caso (convocado, convocado con un equipo
 *  pudiendo ir a los dos, o «esta vez no entras»). Ya no hay «Enviar ahora» aparte (D127). Un fallo al enviar nunca deshace
 *  la aprobación: la salida dice qué pasó y deja «Reenviar». */
export async function aprobarYAvisar(fecha: string): Promise<R> {
  try {
    const { supabase } = await contexto(fecha);
    const { error: e } = await supabase.rpc("convocatoria_aprobar", { p_fecha: fecha });
    if (e) return { ok: false, error: error(e.message) };
    const r = await enviarAvisoConvocatoria(supabase, fecha).catch((x: Error) => ({ fallo: x.message }));
    refrescar();
    if (r && "fallo" in r) return { ok: true, texto: `Aprobada, pero el aviso no salió: ${r.fallo}` };
    return { ok: true, texto: r ? `Aprobada. ${textoEnvio(r)}` : "Aprobada." };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/** Ya aprobada y cambiada después (D173): avisa a quien entra, cambia de equipo o sale («Avisar del cambio»). */
export async function avisarAhora(fecha: string): Promise<R> {
  const { supabase } = await exigirGestor();
  const r = await enviarAvisoConvocatoria(supabase, fecha);
  refrescar();
  if (!r) return { ok: false, error: ERRORES.sin_aprobar };
  if (r.estado !== "enviado") return { ok: false, error: textoEnvio(r) };
  return { ok: true, texto: textoEnvio(r) };
}

/** «Reenviar» (D173): solo los avisos de esta convocatoria que fallaron. */
export async function reenviar(fecha: string): Promise<R> {
  const { supabase } = await exigirGestor();
  const { data } = await supabase.from("convocatorias").select("equipos, aviso_base, estado").eq("fecha", fecha).maybeSingle();
  if (!data || data.estado !== "aprobada") return { ok: false, error: ERRORES.sin_aprobar };
  const r = await reenviarFallidos(fecha, (data.aviso_base ?? data.equipos) as Convocatoria);
  refrescar();
  return { ok: true, texto: r.reenviados ? `Reenviados ${r.reenviados}.` : "No había avisos fallidos." };
}

/** Al copiar el WhatsApp (D173: sin «Ya lo he pegado» ni estados): se apunta lo copiado, para que el siguiente mensaje empiece
 *  por lo que ha cambiado desde entonces. */
export async function copiado(fecha: string): Promise<R> {
  const { supabase } = await exigirGestor();
  const { error: e } = await supabase.rpc("convocatoria_marcar", { p_fecha: fecha, p_que: "whatsapp" });
  if (e) return { ok: false, error: error(e.message) };
  refrescar();
  return { ok: true };
}

/** Hoja de recambio (D173): sale `sale` del `equipo` y entra `entra` (o nadie). Se guarda con su motivo, se avisa a quien
 *  entra y a quien sale (respecto a lo ya avisado) y se devuelve el WhatsApp del cambio para copiar. */
export async function aplicarRecambio(fecha: string, sale: string, equipo: Equipo, entra: string | null): Promise<R & { whatsapp?: string }> {
  if (!EQUIPOS.includes(equipo)) return { ok: false, error: "Equipo no válido." };
  try {
    const { supabase, ctx } = await contexto(fecha);
    const c = ctx.convocatoria;
    if (!c || c.estado !== "aprobada") return { ok: false, error: ERRORES.sin_aprobar };
    if (!(c.equipos[equipo] ?? []).some((x) => x.person_id === sale)) return { ok: false, error: "Ese jugador ya no está en ese equipo (alguien lo ha cambiado antes): vuelve a la convocatoria." };
    const r = sugerirRecambio(entradaDe(ctx), c.equipos, sale, equipo);
    const cand = entra ? r.candidatos.find((x) => x.person_id === entra) : null;
    if (entra && (!cand || !cand.valido)) return { ok: false, error: "Ese recambio no puede entrar (misma hora, sin ficha o ya convocado)." };
    const nombre = (id: string) => ctx.jugadores.find((j) => j.person_id === id)?.nombre ?? id;
    const final: Convocatoria = { ...r.sinEl, [equipo]: [...(r.sinEl[equipo] ?? []), ...(entra ? [{ person_id: entra }] : [])] };
    const nota = `recambio: sale ${nombre(sale)}${entra ? `, entra ${nombre(entra)}` : ", sin recambio"}`;
    const g1 = await supabase.rpc("convocatoria_guardar", { p_fecha: fecha, p_jornada: ctx.jornada, p_equipos: r.sinEl, p_dificultad: null, p_accion: "quitar", p_person: sale, p_equipo: equipo, p_motivo: "otro", p_nota: nota, p_detalle: { origen: "recambio" } });
    if (g1.error) return { ok: false, error: error(g1.error.message) };
    if (entra) {
      const g2 = await supabase.rpc("convocatoria_guardar", { p_fecha: fecha, p_jornada: ctx.jornada, p_equipos: final, p_dificultad: null, p_accion: cand?.tipo === "dobla" ? "doblar" : "anadir", p_person: entra, p_equipo: equipo, p_motivo: "otro", p_nota: nota, p_detalle: { origen: "recambio" } });
      if (g2.error) return { ok: false, error: error(g2.error.message) };
    }
    const env = await enviarAvisoConvocatoria(supabase, fecha);
    const cambios = diferencias(c.aviso_base ?? c.equipos, final, nombre);
    const whatsapp = mensajeConvocatoria(fecha, ctx.jornada, ctx.partidos, final, nombre, cambios, avisosDelFichero(fecha, ctx.partidos.map((p) => p.equipo)));
    refrescar();
    return { ok: true, texto: `Guardado: ${nota}. ${env ? textoEnvio(env) : ""}`.trim(), whatsapp };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/** Modo rapido (D125): mover a uno o a varios (arrastrar o «Mover a…»), sin preguntar, con el motivo «ajuste manual».
 *  Valida contra la base: nadie entra en un equipo del que no tiene ficha (regla 1.5) ni dobla a la misma hora (1.4). */
export async function ajusteRapido(fecha: string, conv: Convocatoria, cambio: { accion: "mover" | "anadir" | "quitar"; personas: string[]; equipo: Equipo | null }): Promise<R> {
  if (!["mover", "anadir", "quitar"].includes(cambio.accion) || !cambio.personas.length) return { ok: false, error: "Cambio no válido." };
  try {
    const { supabase, ctx } = await contexto(fecha);
    if (!ctx.convocatoria?.origen) return { ok: false, error: ERRORES.sin_convocatoria };
    const juegan = ctx.partidos.map((p) => p.equipo);
    const limpia = limpiar(conv, juegan, new Set(ctx.jugadores.map((j) => j.person_id)));
    const antes = ctx.convocatoria.equipos;
    const nombreDe = (id: string) => ctx.jugadores.find((j) => j.person_id === id)?.nombre ?? id;
    for (const e of juegan) {
      const nuevos = (limpia[e] ?? []).filter((c) => !(antes[e] ?? []).some((x) => x.person_id === c.person_id));
      const sinFicha = nuevos.filter((c) => !ctx.jugadores.find((j) => j.person_id === c.person_id)?.ficha[e]);
      if (sinFicha.length) return { ok: false, error: `Sin ficha del ${e}: ${sinFicha.map((c) => nombreDe(c.person_id)).join(", ")} (regla 1.5).` };
    }
    const mismaHora = ctx.partidos.length === 2 && ctx.partidos[0].inicio && ctx.partidos[0].inicio === ctx.partidos[1].inicio;
    if (mismaHora && (limpia.MdA ?? []).some((c) => (limpia.MdL ?? []).some((x) => x.person_id === c.person_id))) {
      return { ok: false, error: "Los dos partidos empiezan a la misma hora: nadie puede doblar (regla 1.4)." };
    }
    const { error: e } = await supabase.rpc("convocatoria_guardar", {
      p_fecha: fecha, p_jornada: ctx.jornada, p_equipos: limpia, p_dificultad: null, p_accion: cambio.accion,
      p_person: cambio.personas.length === 1 ? cambio.personas[0] : null, p_equipo: cambio.equipo, p_motivo: "otro",
      p_nota: "ajuste manual", p_detalle: { personas: cambio.personas, origen: "rapido" },
    });
    if (e) return { ok: false, error: error(e.message) };
    refrescar();
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/** «Deshacer» el ultimo movimiento rapido: deja lo que habia (queda en el historial). */
export async function deshacerRapido(fecha: string, equipos: Convocatoria): Promise<R> {
  try {
    const { supabase, ctx } = await contexto(fecha);
    const limpia = limpiar(equipos, ctx.partidos.map((p) => p.equipo), new Set(ctx.jugadores.map((j) => j.person_id)));
    const { error: e } = await supabase.rpc("convocatoria_guardar", {
      p_fecha: fecha, p_jornada: ctx.jornada, p_equipos: limpia, p_dificultad: null, p_accion: "mover", p_motivo: "otro",
      p_nota: "deshacer el último movimiento", p_detalle: { origen: "rapido", deshacer: true },
    });
    if (e) return { ok: false, error: error(e.message) };
    refrescar();
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

// ---------------------------------------------------------------- datos privados por jugador (solo gestores, D39)
export type CamposPrivados = {
  posicion: string | null; base_reserva: boolean; nivel: string | null; dobla: boolean;
  regla: "fijo" | "comodin" | null; regla_equipo: Equipo | null; sancionado_hasta_jornada: number | null; nota: string | null;
  /** D146: disponibilidad por defecto (marcas privadas). */
  no_suele_entrenar: boolean; nunca_partidos: boolean;
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
    nota: c.nota?.trim() || null, no_suele_entrenar: !!c.no_suele_entrenar, nunca_partidos: !!c.nunca_partidos,
    cambiado_en: new Date().toISOString(), cambiado_por_nombre: nombre,
  };
  const { error: e } = await supabase.from("jugadores_privado").upsert(fila, { onConflict: "person_id" });
  if (e) return { ok: false, error: `No se pudo guardar: ${e.message}` };
  refrescar();
  return { ok: true };
}

