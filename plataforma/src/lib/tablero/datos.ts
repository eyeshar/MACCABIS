import "server-only";
import { cargarContexto } from "@/lib/convocatoria/datos";
import { entradaDe, type Contexto } from "@/lib/convocatoria/vista";
import type { DatosProyeccion } from "@/lib/convocatoria/proyeccion";
import type { EstadoImportacion } from "@/lib/eventos/importacionAuto";
import type { Convocatoria, Entrada, Equipo, Nivel, Posicion, RespuestaPartido } from "@/lib/convocatoria/motor";
import { cargarEvento, cargarEventos, cargarJugadores, type Cliente } from "@/lib/eventos/datos";
import { convocadosDe, tituloEvento, TEXTO_MOTIVO, type Motivo } from "@/lib/eventos/dominio";
import { hoyMadrid, sumarDias } from "@/lib/dias";
import type { FilaTablero, PartidoTablero } from "./vista";
import { hrefJugador } from "@/lib/numeros/enlaces";
import { cargarAusencias, cargarDefecto } from "@/lib/convocatoria/defecto";
import { ausenciaQueCubre, efectivaEn, NOTA_POR_DEFECTO } from "@/lib/disponibilidad/porDefecto";
import { notaAusencia, sinFichaQueVan } from "@/lib/numeros/respuestas";
import type { PersonaNum } from "@/components/numeros/Numeros";

// Lo que lee el tablero (D121), con la sesion del GESTOR: la base (RLS + is_gestor) decide. Nada de esto llega nunca a
// un jugador.

export type Registro = { id: string; en: string; por: string; texto: string };
export type OpcionSelector = { valor: string; texto: string; grupo: "Domingos de partidos" | "Eventos sueltos" };

type Privado = { person_id: string; posicion: Posicion | null; base_reserva: boolean; nivel: Nivel | null };

const motivoTexto = (m: string | null) => (m ? (m === "horario" ? "Solo puede al otro partido" : TEXTO_MOTIVO[m as Motivo] ?? m) : null);

/** Opciones del selector: los domingos de partidos (de la convocatoria) y los eventos sueltos de las proximas semanas
 *  (entrenos y demas oficiales, y cada partido por separado). */
export async function opcionesSelector(sb: Cliente): Promise<OpcionSelector[]> {
  const hoy = hoyMadrid();
  const eventos = (await cargarEventos(sb)).filter((e) => e.estado === "programado" && e.fecha >= hoy && e.fecha <= sumarDias(hoy, 35));
  const domingos = [...new Map(eventos.filter((e) => e.tipo === "liga").map((e) => [e.fecha, e])).values()];
  const dia = (f: string) => new Date(`${f}T12:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
  return [
    ...domingos.map((e) => ({ valor: `domingo:${e.fecha}`, texto: `${dia(e.fecha)} · J${e.jornada ?? "?"} (los partidos del domingo)`, grupo: "Domingos de partidos" as const })),
    ...eventos.map((e) => ({ valor: `evento:${e.id}`, texto: `${dia(e.fecha)} · ${e.tipo === "liga" ? `solo ${tituloEvento(e)}` : tituloEvento(e)}`, grupo: "Eventos sueltos" as const })),
  ];
}

export type TableroDomingo = {
  vista: "domingo"; fecha: string; jornada: number | null; partidos: (PartidoTablero & { evento_id: string })[]; filas: FilaTablero[];
  conv: Convocatoria; estado: "sin" | "borrador" | "aprobada" | "cambiada"; entrada: Entrada; registro: Registro[]; encendido: boolean;
  /** Proyeccion de anotacion (D124) y estado de la importacion de SportEasy (D126). Solo gestores. */
  proyeccion: DatosProyeccion; importacion: EstadoImportacion;
};

export async function cargarTableroDomingo(sb: Cliente, fecha?: string): Promise<TableroDomingo | null> {
  const ctx: Contexto | null = await cargarContexto(sb, fecha);
  if (!ctx || ctx.sinMigracion) return null;
  const [privados, ausencias, resp] = await Promise.all([
    sb.from("jugadores_privado").select("person_id, posicion, base_reserva, nivel"),
    cargarAusencias(sb),
    sb.from("respuestas").select("evento_id, person_id, puesto_por_nombre, origen").in("evento_id", ctx.partidos.map((p) => p.evento_id)),
  ]);
  const priv = new Map(((privados.data ?? []) as Privado[]).map((p) => [p.person_id, p]));
  const puesta = new Map(((resp.data ?? []) as { person_id: string; puesto_por_nombre: string | null; origen: string }[]).filter((r) => r.origen === "gestor" && r.puesto_por_nombre).map((r) => [r.person_id, r.puesto_por_nombre]));
  const filas: FilaTablero[] = ctx.jugadores.filter((j) => j.invitado).map((j) => {
    const p = priv.get(j.person_id);
    const motivos = Object.values(j.motivoNo).filter(Boolean) as string[];
    return {
      person_id: j.person_id, href: hrefJugador(j.person_id), nombre: j.nombre, posicion: p?.posicion ?? null, base_reserva: Boolean(p?.base_reserva), nivel: p?.nivel ?? null,
      ficha: j.ficha, solo_entreno: j.solo_entreno, respuesta: j.respuesta, invitadoA: j.invitadoA,
      motivo: motivoTexto(motivos.find((m) => m !== "horario") ?? motivos[0] ?? null), ausencia: notaAusencia(ausenciaQueCubre(j.person_id, ctx.fecha, ausencias)),
      puestaPor: puesta.get(j.person_id) ?? null,
    };
  });
  const c = ctx.convocatoria;
  const estado = !c?.origen ? "sin" : c.estado === "borrador" ? "borrador" : c.aprobada_en && c.cambiado_en > c.aprobada_en && (c.whatsapp_estado === "pendiente" || c.sporteasy_estado === "pendiente") ? "cambiada" : "aprobada";
  const nombres = new Map(ctx.jugadores.map((j) => [j.person_id, j.nombre]));
  const registro = await registroDe(sb, c?.id ?? null, ctx.partidos.map((p) => p.evento_id), nombres);
  return {
    vista: "domingo", fecha: ctx.fecha, jornada: ctx.jornada,
    partidos: ctx.partidos.map((p) => ({ evento_id: p.evento_id, equipo: p.equipo, rival: p.rival ?? "rival por confirmar", inicio: p.inicio, dificultad: p.dificultad.valor })),
    filas, conv: c?.equipos ?? {}, estado, entrada: entradaDe(ctx), registro, encendido: ctx.encendido,
    proyeccion: ctx.proyeccion, importacion: ctx.importacion,
  };
}

export type TableroEvento = {
  vista: "evento"; evento: { id: string; titulo: string; fecha: string; inicio: string | null; tipo: string; equipo: string };
  filas: FilaTablero[]; registro: Registro[]; encendido: boolean;
  /** D148: quien dijo «voy» sin ficha a un entreno en una pista «solo con ficha» (no está en el tablero). */
  sinFicha?: { pista: string; personas: PersonaNum[] } | null;
};

export async function cargarTableroEvento(sb: Cliente, id: string): Promise<TableroEvento | null> {
  const e = await cargarEvento(sb, id);
  if (!e || e.oficial === false) return null;
  const [jugadores, privados, resp, enc, defecto] = await Promise.all([
    cargarJugadores(sb), sb.from("jugadores_privado").select("person_id, posicion, base_reserva, nivel"),
    sb.from("respuestas").select("person_id, respuesta, motivo, origen, puesto_por_nombre").eq("evento_id", id),
    sb.rpc("respuestas_web_encendido"), cargarDefecto(sb, [id]),
  ]);
  const priv = new Map(((privados.data ?? []) as Privado[]).map((p) => [p.person_id, p]));
  const rs = new Map(((resp.data ?? []) as { person_id: string; respuesta: RespuestaPartido; motivo: string | null; origen: string; puesto_por_nombre: string | null }[]).map((r) => [r.person_id, r]));
  // La misma regla que el Panel (`respuestaEfectiva`, D146 y D150): en un partido, un «nunca a partidos» sin responder no
  // cuenta; sin responder y con una ausencia que cubre el dia, «no»; en un entreno, quien «no suele entrenar» y no ha
  // respondido es «no va (por defecto)», salvo que se le pasara a «sin responder» para este entreno.
  const efectiva = (p: string) => efectivaEn(e, p, rs.get(p)?.respuesta ?? "sin_responder", defecto);
  const filas: FilaTablero[] = convocadosDe(e, jugadores).filter((j) => !efectiva(j.person_id).fuera).map((j) => {
    const p = priv.get(j.person_id), r = rs.get(j.person_id);
    const ef = efectiva(j.person_id);
    const aus = ausenciaQueCubre(j.person_id, e.fecha, defecto.ausencias);
    const porDefecto = ef.por === "defecto";
    const valor: RespuestaPartido = ef.respuesta;
    return {
      person_id: j.person_id, href: hrefJugador(j.person_id), nombre: j.nombre_visible, posicion: p?.posicion ?? null, base_reserva: Boolean(p?.base_reserva), nivel: p?.nivel ?? null,
      ficha: { MdA: j.ficha_mda, MdL: j.ficha_mdl }, solo_entreno: j.rol === "solo_entreno", respuesta: { evento: valor }, invitadoA: ["evento"],
      motivo: porDefecto ? NOTA_POR_DEFECTO : valor === "no" ? motivoTexto(r?.motivo ?? null) : null, ausencia: notaAusencia(aus), puestaPor: r?.origen === "gestor" ? r.puesto_por_nombre : null,
    };
  });
  const registro = await registroDe(sb, null, [id], new Map(jugadores.map((j) => [j.person_id, j.nombre_visible])));
  const sinFicha = e.solo_con_ficha_en ? { pista: e.solo_con_ficha_en, personas: sinFichaQueVan(e, jugadores, [...rs.values()]) } : null;
  return { vista: "evento", evento: { id: e.id, titulo: tituloEvento(e), fecha: e.fecha, inicio: e.inicio, tipo: e.tipo, equipo: e.equipo }, filas, registro, encendido: enc.data === true, sinFicha };
}

const TEXTO_RESP: Record<string, string> = { va: "Van", duda: "Duda", no: "No van" };
const ACCION: Record<string, string> = { anadir: "Convocar", quitar: "Quitar convocatoria", mover: "Ajuste", doblar: "Doblar", propuesta: "Usar propuesta", blanco: "Empezar en blanco", aprobar: "Aprobar", recalcular: "Recalcular" };

/** Registro de cambios (quien, a quien, cuando): la convocatoria y las respuestas puestas desde el tablero. */
async function registroDe(sb: Cliente, convId: string | null, eventos: string[], nombres: Map<string, string>): Promise<Registro[]> {
  const [conv, tab] = await Promise.all([
    convId ? sb.from("convocatoria_cambios").select("id, en, por_nombre, accion, person_id, equipo, motivo, nota, detalle").eq("convocatoria_id", convId).order("en", { ascending: false }).limit(15) : Promise.resolve({ data: [] }),
    eventos.length ? sb.from("tablero_registro").select("id, en, por_nombre, accion, personas, despues, motivo").in("evento_id", eventos).order("en", { ascending: false }).limit(15) : Promise.resolve({ data: [] }),
  ]);
  const quien = (ids: string[]) => ids.map((i) => nombres.get(i) ?? i).join(", ");
  const out: Registro[] = [
    ...((conv.data ?? []) as { id: string; en: string; por_nombre: string; accion: string; person_id: string | null; equipo: Equipo | null; nota: string | null; detalle: { personas?: string[] } }[])
      .filter((c) => !["whatsapp", "sporteasy", "aviso", "dificultad"].includes(c.accion))
      .map((c) => ({ id: c.id, en: c.en, por: c.por_nombre, texto: `${ACCION[c.accion] ?? c.accion}${c.equipo ? ` (${c.equipo})` : ""}${(c.detalle?.personas?.length || c.person_id) ? `: ${quien(c.detalle?.personas ?? [c.person_id!])}` : ""}${c.nota ? ` · ${c.nota}` : ""}` })),
    ...((tab.data ?? []) as { id: string; en: string; por_nombre: string; accion: string; personas: string[]; despues: string | null; motivo: string | null }[])
      .map((t) => ({ id: t.id, en: t.en, por: t.por_nombre, texto: t.accion === "deshacer" ? `Deshacer: ${quien(t.personas)}` : `${TEXTO_RESP[t.despues ?? ""] ?? t.despues}: ${quien(t.personas)}${t.motivo ? ` (${TEXTO_MOTIVO[t.motivo as Motivo] ?? t.motivo})` : ""}` })),
  ];
  return out.sort((a, b) => (a.en < b.en ? 1 : -1)).slice(0, 12);
}
