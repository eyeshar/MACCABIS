import "server-only";
import { cargarContexto } from "@/lib/convocatoria/datos";
import { entradaDe } from "@/lib/convocatoria/vista";
import { proponer, type Dificultad, type Equipo, type Nivel, type Posicion } from "@/lib/convocatoria/motor";
import { cargarEvento, cargarEventos, cargarJugadores, type Cliente } from "@/lib/eventos/datos";
import { convocadosDe } from "@/lib/eventos/dominio";
import { hoyMadrid } from "@/lib/dias";
import type { DomingoGrupos, JugadorGrupo } from "./sugerir";

// Lo que leen los grupos de entreno (D122), con la sesion del GESTOR (RLS: solo gestores). Niveles y el criterio de la
// sugerencia viven solo aqui; a un jugador solo le llega su grupo publicado (mis_grupos()).

export type Reparto = { id: string; nombre: string; tamano: number; grupos: { nombre: string; personas: string[]; explica?: string }[]; publicado: boolean; cambiado_en: string; cambiado_por_nombre: string | null };
export type DatosGrupos = {
  evento: { id: string; fecha: string; inicio: string | null; titulo: string };
  jugadores: JugadorGrupo[]; van: string[]; duda: string[]; repartos: Reparto[];
  domingo: (DomingoGrupos & { fuente: "aprobada" | "propuesta" }) | null;
};

/** El siguiente domingo con partido desde el entreno: la convocatoria aprobada o, si no, la propuesta del motor. */
async function domingoDe(sb: Cliente, desde: string): Promise<DatosGrupos["domingo"]> {
  const liga = (await cargarEventos(sb)).filter((e) => e.tipo === "liga" && e.estado === "programado" && e.fecha >= desde).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  if (!liga.length) return null;
  const ctx = await cargarContexto(sb, liga[0].fecha);
  if (!ctx) return null;
  const aprobada = ctx.convocatoria?.estado === "aprobada";
  const conv = aprobada ? ctx.convocatoria!.equipos : proponer(entradaDe(ctx)).convocatoria;
  const equipos: Partial<Record<Equipo, string[]>> = {};
  for (const e of ["MdA", "MdL"] as Equipo[]) if (conv[e]) equipos[e] = conv[e]!.map((c) => c.person_id);
  const dificultad: Partial<Record<Equipo, Dificultad>> = Object.fromEntries(ctx.partidos.map((p) => [p.equipo, p.dificultad.valor]));
  return { fecha: ctx.fecha, equipos, dificultad, fuente: aprobada ? "aprobada" : "propuesta" };
}

export async function cargarGrupos(sb: Cliente, eventoId: string): Promise<DatosGrupos | null> {
  const e = await cargarEvento(sb, eventoId);
  if (!e || e.tipo !== "entreno" || e.oficial === false) return null;
  const [jugadores, resp, priv, rep, domingo] = await Promise.all([
    cargarJugadores(sb),
    sb.from("respuestas").select("person_id, respuesta").eq("evento_id", eventoId),
    sb.from("jugadores_privado").select("person_id, posicion, base_reserva, nivel"),
    sb.from("grupos_repartos").select("id, nombre, tamano, grupos, publicado, cambiado_en, cambiado_por_nombre").eq("evento_id", eventoId).is("borrado_en", null).order("orden").order("creado_en"),
    domingoDe(sb, e.fecha),
  ]);
  const invitados = convocadosDe(e, jugadores);
  const r = new Map(((resp.data ?? []) as { person_id: string; respuesta: string }[]).map((x) => [x.person_id, x.respuesta]));
  const p = new Map(((priv.data ?? []) as { person_id: string; posicion: Posicion | null; base_reserva: boolean; nivel: Nivel | null }[]).map((x) => [x.person_id, x]));
  const lista: JugadorGrupo[] = invitados.map((j) => ({ person_id: j.person_id, nombre: j.nombre_visible, posicion: p.get(j.person_id)?.posicion ?? null, base_reserva: Boolean(p.get(j.person_id)?.base_reserva), nivel: p.get(j.person_id)?.nivel ?? null }));
  return {
    evento: { id: e.id, fecha: e.fecha, inicio: e.inicio, titulo: e.titulo ?? "Entreno" },
    jugadores: lista, van: lista.filter((j) => r.get(j.person_id) === "va").map((j) => j.person_id), duda: lista.filter((j) => r.get(j.person_id) === "duda").map((j) => j.person_id),
    repartos: (rep.data ?? []) as Reparto[], domingo,
  };
}

/** Los proximos entrenos, con cuantos repartos tiene cada uno y si hay uno publicado. */
export async function proximosEntrenos(sb: Cliente) {
  const hoy = hoyMadrid();
  const entrenos = (await cargarEventos(sb)).filter((e) => e.tipo === "entreno" && e.estado === "programado" && e.fecha >= hoy).slice(0, 6);
  const { data } = entrenos.length ? await sb.from("grupos_repartos").select("evento_id, publicado").in("evento_id", entrenos.map((e) => e.id)).is("borrado_en", null) : { data: [] };
  const rep = (data ?? []) as { evento_id: string; publicado: boolean }[];
  return entrenos.map((e) => ({ id: e.id, fecha: e.fecha, inicio: e.inicio, repartos: rep.filter((x) => x.evento_id === e.id).length, publicado: rep.some((x) => x.evento_id === e.id && x.publicado) }));
}
