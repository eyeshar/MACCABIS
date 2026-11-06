import "server-only";
import type { GrupoNum } from "@/components/numeros/Numeros";
import { cargarDefecto } from "@/lib/convocatoria/defecto";
import { resumenConvocatorias } from "@/lib/convocatoria/resumen";
import { cargarEventos, cargarJugadores, cargarPistas } from "@/lib/eventos/datos";
import type { EventoFila } from "@/lib/eventos/dominio";
import { gruposEvento, type RespuestaPersona } from "@/lib/numeros/respuestas";
import { NOMBRE_EQUIPO } from "@/lib/web";
import type { clienteSesion } from "@/lib/supabase";

type Cliente = Awaited<ReturnType<typeof clienteSesion>>;

/** Franja «GESTIÓN» de cada tarjeta de la Semana (D189), solo gestores: van · dudan · no van (con nombres y motivos,
 *  pulsables, norma 13) y, en los partidos, cuántos convocados tiene ese equipo en la convocatoria del domingo. Sale de la
 *  regla única de siempre (gruposEvento, D177): la misma cuenta que el Panel y Respuestas. */
export type CuentaGestion = { grupos: GrupoNum[]; convocados: number | null; convocatoria: "aprobada" | "borrador" | null };

export async function cuentasDeLaSemana(sb: Cliente, desde: string, hasta: string): Promise<{ eventos: EventoFila[]; cuentas: Map<string, CuentaGestion>; pistas: Awaited<ReturnType<typeof cargarPistas>> }> {
  const [todos, jugadores, pistas] = await Promise.all([cargarEventos(sb, { conPlanes: true }), cargarJugadores(sb), cargarPistas(sb)]);
  const eventos = todos.filter((e) => e.fecha >= desde && e.fecha <= hasta);
  const ids = eventos.map((e) => e.id);
  const fechasLiga = [...new Set(eventos.filter((e) => e.tipo === "liga").map((e) => e.fecha))];
  const [{ data: rs }, defecto, conv] = await Promise.all([
    ids.length ? sb.from("respuestas").select("evento_id, person_id, respuesta, motivo, detalle").in("evento_id", ids) : Promise.resolve({ data: [] }),
    cargarDefecto(sb, ids),
    resumenConvocatorias(sb, fechasLiga),
  ]);
  const filas = (rs ?? []) as (RespuestaPersona & { evento_id: string })[];
  const cuentas = new Map<string, CuentaGestion>();
  for (const e of eventos) {
    const grupos = gruposEvento(e, jugadores, filas.filter((r) => r.evento_id === e.id), true, defecto);
    const c = e.tipo === "liga" ? conv.find((x) => x.fecha === e.fecha) : null;
    const eq = e.equipo === "MdA" ? NOMBRE_EQUIPO.MDA : e.equipo === "MdL" ? NOMBRE_EQUIPO.MDL : null;
    cuentas.set(e.id, {
      grupos: grupos.filter((g) => g.k !== "sin").concat(grupos.filter((g) => g.k === "sin")),
      convocados: c && eq ? (c.equipos[eq] ?? []).length : null,
      convocatoria: c?.estado ?? null,
    });
  }
  return { eventos, cuentas, pistas };
}
