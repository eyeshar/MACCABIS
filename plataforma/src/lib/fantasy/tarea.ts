// MdFantasy (D196): la parte del fantasy en la tarea de avisos de cada 15 minutos (lib/avisos/servidor.ts).
//   1. Puntua SOLO las jornadas con las estadisticas publicadas que no estan puntuadas (o cuya hoja ha cambiado).
//      Repetible: fantasy_guardar_jornada guarda por clave, no duplica.
//   2. Avisa a los gestores de los nombres de la hoja que no casan con ninguna ficha y de los convocados que no salen en
//      la hoja («¿Falto?»).
//   3. El dia despues de un entreno, a las 9:00: «¿Falto alguien ayer?» a los gestores (una vez; vale la primera respuesta).
// Si la migracion 20261121100000 no esta aplicada (PGRST202) o el juego esta apagado, no hace nada.
import type { SupabaseClient } from "@supabase/supabase-js";
import { enMadrid, enSilencio, horaDeEnvio, madrid } from "../avisos/horario.ts";
import { cerrarJornada, type DatosCierre } from "./cierre.ts";

type Fila = { titulo: string; cuerpo: string; clave: string; tipo: "gestores" | "cambio"; person_id: string | null; user_id: string | null; eventos: string[]; url: string; programado_para: Date };
const NO_EXISTE = (e: { code?: string } | null) => e?.code === "PGRST202" || e?.code === "42883";
const dia = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;

/** Puntua lo pendiente. Devuelve las fechas puntuadas y los avisos que hay que encolar. */
export async function tareaFantasy(sb: SupabaseClient, ahora: Date): Promise<{ puntuadas: string[]; filas: Fila[] }> {
  const { data: modo, error: em } = await sb.rpc("_fantasy_modo");
  if (em) { if (NO_EXISTE(em)) return { puntuadas: [], filas: [] }; throw new Error(`fantasy modo: ${em.message}`); }
  const { data: pend, error: ep } = await sb.rpc("fantasy_pendientes");
  if (ep) throw new Error(`fantasy pendientes: ${ep.message}`);
  const filas: Fila[] = [];
  const puntuadas: string[] = [];
  let gestores: { user_id: string | null }[] | null = null;
  const aGestores = async (base: Omit<Fila, "clave" | "user_id" | "person_id" | "tipo">, clave: (u: string) => string) => {
    if (!gestores) gestores = ((await sb.from("gestores").select("user_id")).data ?? []) as { user_id: string | null }[];
    for (const g of gestores) if (g.user_id) filas.push({ ...base, tipo: "gestores", clave: clave(g.user_id), user_id: g.user_id, person_id: null });
  };

  for (const { fecha } of (pend ?? []) as { fecha: string }[]) {
    const { data, error } = await sb.rpc("fantasy_datos_jornada", { p_fecha: fecha });
    if (error) throw new Error(`fantasy datos ${fecha}: ${error.message}`);
    const d = data as DatosCierre;
    const c = cerrarJornada(d);
    const { error: eg } = await sb.rpc("fantasy_guardar_jornada", { p: c.guardar });
    if (eg) throw new Error(`fantasy guardar ${fecha}: ${eg.message}`);
    puntuadas.push(fecha);
    if (modo === "apagado") continue;
    const reciente = ahora.getTime() - madrid(fecha, "12:00").getTime() < 10 * 24 * 3600000;
    if (!reciente) continue; // las jornadas antiguas se puntuan para el valor de mercado, sin avisar a nadie
    if (c.sinCasar.length) {
      await aGestores({ titulo: `MdFantasy: ${c.sinCasar.length === 1 ? "un nombre" : `${c.sinCasar.length} nombres`} de la hoja sin casar`, cuerpo: `Jornada del ${dia(fecha)}: no sé de quién ${c.sinCasar.length === 1 ? "es" : "son"} ${c.sinCasar.join("; ")}. Dímelo en Ajustes y vuelvo a puntuar.`, eventos: [], url: "/mdfantasy/ajustes", programado_para: horaDeEnvio(ahora, null) },
        (u) => `fantasy-nombres:${fecha}:${u}`);
    }
    if (c.convocadosSinHoja.length) {
      const nombres = c.convocadosSinHoja.map((id) => d.jugadores.find((j) => j.person_id === id)?.nombre_visible ?? id);
      const evento = d.partidos[0]?.evento;
      await aGestores({ titulo: "¿Faltó alguien el domingo?", cuerpo: `${nombres.join(", ")} ${nombres.length === 1 ? "estaba convocado y no sale" : "estaban convocados y no salen"} en la hoja del ${dia(fecha)}. Si faltó sin avisar, márcalo.`, eventos: evento ? [evento] : [], url: evento ? `/evento/${evento}/asistencia` : "/mdfantasy", programado_para: horaDeEnvio(ahora, null) },
        (u) => `fantasy-hoja:${fecha}:${u}`);
    }
  }

  // «¿Falto alguien ayer?»: el dia despues del entreno, de 9:00 a 20:00, una sola vez por entreno y gestor.
  if (modo !== "apagado" && !enSilencio(ahora) && enMadrid(ahora).minutos >= 9 * 60 && enMadrid(ahora).minutos < 20 * 60) {
    const { data: ayer, error: ea } = await sb.rpc("fantasy_entrenos_de_ayer");
    if (ea) throw new Error(`fantasy entrenos de ayer: ${ea.message}`);
    for (const e of (ayer ?? []) as { evento_id: string; fecha: string }[]) {
      await aGestores({ titulo: "¿Faltó alguien ayer?", cuerpo: `Entreno del ${dia(e.fecha)}: di si vinieron todos o marca quién faltó. Si nadie dice nada antes del domingo, cuenta que vinieron todos.`, eventos: [e.evento_id], url: `/evento/${e.evento_id}/asistencia`, programado_para: ahora },
        (u) => `fantasy-falto:${e.evento_id}:${u}`);
    }
  }
  return { puntuadas, filas };
}
