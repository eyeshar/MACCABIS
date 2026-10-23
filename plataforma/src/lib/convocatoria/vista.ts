// Tipos de la pantalla de convocatoria (D107) y la entrada del motor a partir de ellos. PURO: lo usan el servidor
// (datos.ts) y los componentes de cliente de Gestion.
import type { Convocatoria, Dificultad, Entrada, Equipo, JugadorEntrada, Nivel, Posicion } from "./motor";
import type { PartidoMensaje } from "./mensajes";

export type FilaPrivada = {
  person_id: string; posicion: Posicion | null; base_reserva: boolean; nivel: Nivel | null; dobla: boolean;
  regla: "fijo" | "comodin" | null; regla_equipo: Equipo | null; sancionado_hasta_jornada: number | null; nota: string | null;
  cambiado_en?: string; cambiado_por_nombre?: string | null;
};
export type FilaConvocatoria = {
  id: string; fecha: string; jornada: number | null; estado: "borrador" | "aprobada"; origen: "propuesta" | "blanco" | null;
  equipos: Convocatoria; dificultad: Partial<Record<Equipo, { valor: Dificultad; propuesta?: Dificultad; porque?: string }>>;
  cambiado_en: string; cambiado_por_nombre: string | null; aprobada_en: string | null; aprobada_por_nombre: string | null;
  whatsapp_estado: "pendiente" | "al_dia"; whatsapp_en: string | null; whatsapp_base: Convocatoria | null;
  sporteasy_estado: "pendiente" | "al_dia"; sporteasy_en: string | null; sporteasy_base: Convocatoria | null;
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
  eventoRespuestas: string | null; encendido: boolean;
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
