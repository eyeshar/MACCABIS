import "server-only";
import type { Nivel, Posicion } from "@/lib/convocatoria/motor";
import { cargarEvento, cargarEventos, cargarJugadores, type Cliente } from "@/lib/eventos/datos";
import { convocadosDe, type Respuesta } from "@/lib/eventos/dominio";
import { hoyMadrid } from "@/lib/dias";
import { sinFichaQueVan } from "@/lib/numeros/respuestas";
import type { PersonaNum } from "@/components/numeros/Numeros";
import type { JugadorGrupo } from "./sugerir";

// Lo que leen los grupos de entreno (D122), con la sesion del GESTOR (RLS: solo gestores). Niveles y el criterio de la
// sugerencia viven solo aqui; a un jugador solo le llega su grupo publicado (mis_grupos()). La pagina NO manda posicion,
// base de reserva ni nivel en el HTML (D143: la «Vista para el equipo» no puede llevarlos ni ocultos): la pantalla los
// pide aparte con la accion datosPrivados() y los tiene solo en memoria.

export type Reparto = { id: string; nombre: string; tamano: number; grupos: { nombre: string; personas: string[] }[]; publicado: boolean; cambiado_en: string; cambiado_por_nombre: string | null };
export type JugadorVisible = { person_id: string; nombre: string };
export type Privado = Pick<JugadorGrupo, "posicion" | "base_reserva" | "nivel">;
export type DatosGrupos<J extends JugadorVisible = JugadorGrupo> = {
  evento: { id: string; fecha: string; inicio: string | null; titulo: string };
  jugadores: J[]; van: string[]; duda: string[]; repartos: Reparto[];
  /** D148: quien dijo «voy» sin ficha a un entreno en una pista «solo con ficha» (no entra en los grupos). */
  sinFicha?: { pista: string; personas: PersonaNum[] } | null;
};
/** Lo que viaja a la pagina: sin datos privados. */
export const sinPrivados = (d: DatosGrupos): DatosGrupos<JugadorVisible> => ({ ...d, jugadores: d.jugadores.map((j) => ({ person_id: j.person_id, nombre: j.nombre })) });

export async function cargarGrupos(sb: Cliente, eventoId: string): Promise<DatosGrupos | null> {
  const e = await cargarEvento(sb, eventoId);
  if (!e || e.tipo !== "entreno" || e.oficial === false) return null;
  const [jugadores, resp, priv, rep] = await Promise.all([
    cargarJugadores(sb),
    sb.from("respuestas").select("person_id, respuesta").eq("evento_id", eventoId),
    sb.from("jugadores_privado").select("person_id, posicion, base_reserva, nivel"),
    sb.from("grupos_repartos").select("id, nombre, tamano, grupos, publicado, cambiado_en, cambiado_por_nombre").eq("evento_id", eventoId).is("borrado_en", null).order("orden").order("creado_en"),
  ]);
  const invitados = convocadosDe(e, jugadores);
  const r = new Map(((resp.data ?? []) as { person_id: string; respuesta: string }[]).map((x) => [x.person_id, x.respuesta]));
  const p = new Map(((priv.data ?? []) as { person_id: string; posicion: Posicion | null; base_reserva: boolean; nivel: Nivel | null }[]).map((x) => [x.person_id, x]));
  const lista: JugadorGrupo[] = invitados.map((j) => ({ person_id: j.person_id, nombre: j.nombre_visible, posicion: p.get(j.person_id)?.posicion ?? null, base_reserva: Boolean(p.get(j.person_id)?.base_reserva), nivel: p.get(j.person_id)?.nivel ?? null }));
  return {
    evento: { id: e.id, fecha: e.fecha, inicio: e.inicio, titulo: e.titulo ?? "Entreno" },
    jugadores: lista, van: lista.filter((j) => r.get(j.person_id) === "va").map((j) => j.person_id), duda: lista.filter((j) => r.get(j.person_id) === "duda").map((j) => j.person_id),
    repartos: (rep.data ?? []) as Reparto[],
    sinFicha: e.solo_con_ficha_en ? { pista: e.solo_con_ficha_en, personas: sinFichaQueVan(e, jugadores, (resp.data ?? []) as { person_id: string; respuesta: Respuesta }[]) } : null,
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
