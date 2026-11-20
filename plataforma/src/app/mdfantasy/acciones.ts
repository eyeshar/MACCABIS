"use server";

import { revalidatePath } from "next/cache";
import { exigirGestor, exigirSesion } from "@/lib/sesion";
import { clienteServicio, configuradoEnvio, encolar, enviarPendientes } from "@/lib/avisos/servidor";
import { horaDeEnvio } from "@/lib/avisos/horario";
import { millones } from "@/lib/fantasy/reglas";

// MdFantasy (D196): cada accion va con la sesion de quien la hace; la base decide (funciones fantasy_*, que comprueban el
// interruptor, el horario, la caja y las copias). Aqui solo se traduce el error y se refresca.
export type R = { ok: true; aviso?: string } | { ok: false; error: string };

const ERR: Record<string, string> = {
  fantasy_apagado: "MdFantasy está apagado.", sin_ficha: "Tu cuenta no tiene ficha de jugador.", sin_equipo: "Antes tienes que crear tu equipo.",
  ya_tiene_equipo: "Ya tienes equipo.", sin_mercado: "El mercado aún no tiene jugadores: hace falta una jornada con estadísticas.",
  sin_copias: "No quedan copias libres para hacerte una plantilla. Díselo a un gestor.", sin_jornada: "No queda ninguna jornada por jugar.",
  cerrado: "Cerrado desde el primer partido del domingo hasta que se publiquen las estadísticas.",
  gestor_bloqueado: "Los gestores no pueden operar desde que existe el borrador de la convocatoria hasta que se publica.",
  clausulas_cerradas: "Los clausulazos se cierran el sábado a las 20:00.", jugador_no_valido: "Ese jugador no está en el mercado.",
  copia_propia: "No puedes tener tu propia copia.", ya_lo_tienes: "Ya lo tienes en la plantilla.", plantilla_llena: "Tienes la plantilla llena: vende antes a alguien.",
  sin_copias_libres: "No quedan copias libres de ese jugador.", sin_caja: "No te llega la caja.", no_lo_tienes: "No lo tienes en la plantilla.",
  hay_copias_libres: "Quedan copias libres: fíchalo sin clausulazo.", dueno_no_valido: "Ese mánager no tiene esa copia.",
  copia_ya_robada: "Esa copia ya se ha robado esta jornada: no se puede volver a robar.", clausulazo_gastado: "Ya has hecho tu clausulazo de esta jornada.",
  demasiados: "Has alineado a demasiados.", repetidos: "Hay un jugador repetido.", capitan_no_alineado: "El capitán tiene que estar alineado.",
  vice_no_valido: "El vicecapitán tiene que estar alineado y no ser el capitán.", capitan_repetido: "Ese fue tu capitán la jornada pasada: elige a otro.",
  pronostico_no_valido: "Elige gana o pierde.", equipo_no_juega: "Ese equipo no juega esta jornada.",
  solo_gestores: "Solo los gestores.", modo_no_valido: "Ese modo no existe.", parametros_no_validos: "Hay un parámetro que no vale.", alias_no_valido: "Hay un alias que apunta a alguien que no existe.",
};
const texto = (m: string) => ERR[Object.keys(ERR).find((k) => m.includes(k)) ?? ""] ?? `No se pudo: ${m}`;
const refrescar = () => revalidatePath("/mdfantasy", "layout");

async function llamar(f: string, args: Record<string, unknown> = {}): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const { supabase } = await exigirSesion();
  const { data, error } = await supabase.rpc(f, args);
  if (error) return { ok: false, error: texto(error.message) };
  refrescar();
  return { ok: true, data };
}

export async function crearEquipo(): Promise<R> {
  const r = await llamar("fantasy_alta");
  return r.ok ? { ok: true, aviso: "Equipo creado. Te ha tocado una plantilla al azar: revisa tu alineación." } : r;
}

export async function fichar(jugador: string): Promise<R> {
  const r = await llamar("fantasy_fichar", { p_jugador: jugador });
  return r.ok ? { ok: true, aviso: `Fichado por ${millones(Number((r.data as { precio: number }).precio))}.` } : r;
}

export async function vender(jugador: string): Promise<R> {
  const r = await llamar("fantasy_vender", { p_jugador: jugador });
  return r.ok ? { ok: true, aviso: `Vendido por ${millones(Number((r.data as { precio: number }).precio))}.` } : r;
}

/** Clausulazo: ademas, aviso inmediato al afectado (de 22:30 a 08:00 espera a las 08:00, D155). Si el envio no esta
 *  configurado o falla, el clausulazo vale igual: el afectado lo ve en sus movimientos. */
export async function clausulazo(jugador: string, dueno: string): Promise<R> {
  const r = await llamar("fantasy_clausulazo", { p_jugador: jugador, p_dueno: dueno });
  if (!r.ok) return r;
  const d = r.data as { precio: number; jugador: string; comprador: string };
  try {
    if (configuradoEnvio()) {
      const sb = clienteServicio();
      const ahora = new Date();
      await encolar(sb, [{ titulo: "MdFantasy: te han hecho un clausulazo", cuerpo: `${d.comprador} se lleva a ${d.jugador}. Cobras ${millones(Number(d.precio))}.`, clave: `fantasy-clausulazo:${jugador}:${dueno}:${ahora.getTime()}`, tipo: "cambio", person_id: dueno, eventos: [], url: "/mdfantasy?tab=mercado", programado_para: horaDeEnvio(ahora, null) }]);
      await enviarPendientes(sb, ahora);
    }
  } catch (e) { console.error("mdfantasy: no se pudo avisar del clausulazo", e); }
  return { ok: true, aviso: `Clausulazo hecho por ${millones(Number(d.precio))}.` };
}

export async function alinear(titulares: string[], capitan: string | null, vice: string | null): Promise<R> {
  const r = await llamar("fantasy_alinear", { p_titulares: titulares, p_capitan: capitan, p_vice: vice });
  return r.ok ? { ok: true, aviso: "Alineación guardada." } : r;
}

export async function apostar(equipo: string, pronostico: string): Promise<R> {
  const r = await llamar("fantasy_apostar", { p_equipo: equipo, p_pronostico: pronostico });
  return r.ok ? { ok: true } : r;
}

export async function guardarAjustes(modo: string | null, cambiados: Record<string, number> | null, alias: Record<string, string> | null, recalcular = false): Promise<R> {
  const { supabase } = await exigirGestor();
  const { error } = await supabase.rpc("fantasy_guardar_ajustes", { p_modo: modo, p_parametros: cambiados, p_alias: alias, p_recalcular: recalcular });
  if (error) return { ok: false, error: texto(error.message) };
  refrescar();
  return { ok: true, aviso: recalcular ? "Guardado. Las jornadas se vuelven a puntuar en la próxima pasada (menos de 15 minutos)." : "Guardado." };
}

/** «Puntuar ahora» (gestores): lo mismo que hace sola la tarea de cada 15 minutos, sin esperar. Repetible. */
export async function puntuarAhora(): Promise<R> {
  await exigirGestor();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: "Este servidor no tiene la clave de servicio: se puntuará en la próxima pasada de la tarea." };
  try {
    const { tareaFantasy } = await import("@/lib/fantasy/tarea");
    const sb = clienteServicio();
    const r = await tareaFantasy(sb, new Date());
    if (configuradoEnvio()) await encolar(sb, r.filas);
    refrescar();
    return { ok: true, aviso: r.puntuadas.length ? `Puntuadas: ${r.puntuadas.join(", ")}.` : "No había nada nuevo que puntuar." };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}
