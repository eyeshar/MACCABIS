// Tipos de la pantalla de convocatoria (D107) y la entrada del motor a partir de ellos. PURO: lo usan el servidor
// (datos.ts) y los componentes de cliente de Gestion.
import type { Convocatoria, Dificultad, Entrada, Equipo, JugadorEntrada, Nivel, Posicion } from "./motor";
import type { PartidoMensaje } from "./mensajes";
import type { DatosProyeccion } from "./proyeccion";

export type FilaPrivada = {
  person_id: string; posicion: Posicion | null; base_reserva: boolean; nivel: Nivel | null; dobla: boolean;
  regla: "fijo" | "comodin" | null; regla_equipo: Equipo | null; sancionado_hasta_jornada: number | null; nota: string | null;
  cambiado_en?: string; cambiado_por_nombre?: string | null;
  /** D146: disponibilidad por defecto (solo gestores). */
  no_suele_entrenar?: boolean; nunca_partidos?: boolean;
  /** Notas de referencia de la hoja de Ivan (D108): solo se muestran en «Datos de los jugadores». */
  nota_ataque?: Nivel | null; nota_defensa?: Nivel | null; nota_total?: Nivel | null; minutos?: number | null; pts_min?: number | null;
};
export type FilaConvocatoria = {
  id: string; fecha: string; jornada: number | null; estado: "borrador" | "aprobada"; origen: "propuesta" | "blanco" | null;
  equipos: Convocatoria; dificultad: Partial<Record<Equipo, { valor: Dificultad; propuesta?: Dificultad; porque?: string }>>;
  cambiado_en: string; cambiado_por_nombre: string | null; aprobada_en: string | null; aprobada_por_nombre: string | null;
  whatsapp_estado: "pendiente" | "al_dia"; whatsapp_en: string | null; whatsapp_base: Convocatoria | null;
  aviso_estado: "sin_preparar" | "en_espera" | "enviado"; aviso_en: string | null; aviso_base: Convocatoria | null;
};
export type Cambio = { id: string; en: string; por_nombre: string; accion: string; person_id: string | null; equipo: Equipo | null; motivo: string | null; nota: string | null };

export type PartidoVista = PartidoMensaje & {
  evento_id: string; jornada: number | null;
  aviso: { hay: boolean; tipo: string | null; etiqueta: string | null; texto: string | null } | null;
  dificultad: { valor: Dificultad; propuesta: Dificultad; porque: string; manual: boolean };
};
export type JugadorVista = JugadorEntrada & {
  /** Invitado a algun partido del domingo segun su ficha (D105), y a cuales. */
  invitado: boolean;
  invitadoA: Equipo[];
  /** Por que dijo «no voy» (solo gestores, D82). */
  motivoNo: Partial<Record<Equipo, string | null>>;
  sancionHasta: number | null;
};
export type Contexto = {
  fecha: string; jornada: number | null; partidos: PartidoVista[]; jugadores: JugadorVista[];
  convocatoria: FilaConvocatoria | null; cambios: Cambio[];
  contadores: { van: number; sin: number; no: number; dudan: number; invitados: number };
  /** D141: hora limite de las dudas de este domingo (ISO) y si aun no ha llegado. Antes, el motor propone con los «va» y las
   *  dudas salen aparte como «posibles»; la propuesta definitiva se hace despues del limite. null = no hay partidos. */
  limiteDudas: string | null; dudasAbiertas: boolean;
  eventoRespuestas: string | null; encendido: boolean;
  /** Cuantas respuestas hay de este domingo (para avisar si no hay ninguna con el interruptor apagado). */
  respuestasDelDomingo: number;
  /** Proyeccion de anotacion (D124): solo gestores. */
  proyeccion: DatosProyeccion;
  /** La migracion de la convocatoria aun no esta aplicada en esta base: se ve la propuesta, no se guarda nada. */
  sinMigracion: boolean;
  sinDatosPrivados: number;
  /** Proximos domingos con partido (para cambiar de jornada). */
  domingos: { fecha: string; jornada: number | null }[];
};

/** La entrada del motor para este domingo. */
export const entradaDe = (ctx: Pick<Contexto, "partidos" | "jugadores">): Entrada => ({
  partidos: ctx.partidos.map((p) => ({ evento_id: p.evento_id, equipo: p.equipo, inicio: p.inicio, dificultad: p.dificultad.valor })),
  jugadores: ctx.jugadores.map(({ invitado: _i, invitadoA: _a, motivoNo: _m, sancionHasta: _s, ...j }) => j),
});

// ---------------------------------------------------------------- modo rapido (D125): arrastrar o «Mover a…»
export type Zona = Equipo | "sin";

/** Mover a uno o a varios a un equipo o a «Disponibles sin convocar». Mover es exclusivo: quien va a un equipo sale del
 *  otro (para doblar, «Cambiar»); a «sin convocar», sale del equipo de donde viene (o de los dos si no se sabe). */
export function moverRapido(conv: Convocatoria, ids: string[], desde: Zona | null, destino: Zona, juegan: Equipo[]): { conv: Convocatoria; accion: "mover" | "anadir" | "quitar" } {
  const out: Convocatoria = Object.fromEntries(juegan.map((e) => [e, [...(conv[e] ?? [])]]));
  const en = (e: Equipo, id: string) => (out[e] ?? []).some((c) => c.person_id === id);
  if (destino === "sin") {
    for (const e of juegan) if (desde === null || desde === "sin" || desde === e) out[e] = (out[e] ?? []).filter((c) => !ids.includes(c.person_id));
    return { conv: out, accion: "quitar" };
  }
  const estaban = ids.some((id) => juegan.some((e) => en(e, id)));
  for (const e of juegan) if (e !== destino) out[e] = (out[e] ?? []).filter((c) => !ids.includes(c.person_id));
  out[destino] = [...(out[destino] ?? []), ...ids.filter((id) => !en(destino, id)).map((person_id) => ({ person_id }))];
  return { conv: out, accion: estaban ? "mover" : "anadir" };
}

/** ¿Se puede soltar a estos en esa zona? Sin ficha del equipo, no (la zona se marca como no valida, regla 1.5). Quien dijo
 *  «no voy» a ese partido se puede soltar, con aviso. */
export function validarDestino(ids: string[], destino: Zona, jugadores: Pick<JugadorVista, "person_id" | "nombre" | "ficha" | "respuesta">[]) {
  if (destino === "sin") return { valido: true, motivo: null as string | null, avisos: [] as string[] };
  const de = (id: string) => jugadores.find((j) => j.person_id === id);
  const sinFicha = ids.filter((id) => !de(id)?.ficha[destino]);
  const noVan = ids.filter((id) => de(id)?.respuesta[destino] === "no");
  return {
    valido: sinFicha.length === 0,
    motivo: sinFicha.length ? `Sin ficha del ${destino}: ${sinFicha.map((id) => de(id)?.nombre ?? id).join(", ")}` : null,
    avisos: noVan.map((id) => `${de(id)?.nombre ?? id} dijo «no voy» a este partido.`),
  };
}
