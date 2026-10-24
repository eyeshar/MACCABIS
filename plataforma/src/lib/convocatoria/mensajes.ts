// Textos de salida de la convocatoria (D107): el mensaje de WhatsApp (formato de D98: hora, encuentro, pista y
// direccion), la copia a SportEasy y el aviso «Estás convocado». Funciones PURAS. Nunca llevan niveles, posiciones,
// reglas personales ni motivos: solo el nombre visible de cada convocado.

import type { Convocatoria, Equipo } from "./motor";

export type PartidoMensaje = {
  equipo: Equipo; rival: string | null; es_local: boolean | null; inicio: string | null; encuentro: string | null;
  /** "CDM Moratalaz, pista 2" o "pista por confirmar" */
  sitio: string; direccion: string | null;
  /** "Llevad la equipación amarilla…" (rutina C) o null si no hay choque */
  lineaEquipacion: string | null;
};

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const ddmm = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
export const diaTexto = (f: string) => `${DIAS[new Date(`${f}T12:00:00Z`).getUTCDay()]} ${ddmm(f)}`;
const limpiar = (r: string | null) => (r ? r.replace(/([.,;:!?])\1+/g, "$1").replace(/\s+/g, " ").trim() : "rival por confirmar");
export const cruce = (p: Pick<PartidoMensaje, "equipo" | "rival" | "es_local">) => (p.es_local === false ? `${limpiar(p.rival)} – ${p.equipo}` : `${p.equipo} – ${limpiar(p.rival)}`);
const nombres = (ids: string[], nombre: (id: string) => string) => ids.map(nombre).sort((a, b) => a.localeCompare(b, "es"));

/** Mensaje de WhatsApp para el grupo. Con `cambios` (tras aprobar), empieza diciendo qué ha cambiado. */
export function mensajeConvocatoria(fecha: string, jornada: number | null, partidos: PartidoMensaje[], conv: Convocatoria, nombre: (id: string) => string, cambios: string[] = []) {
  const j = jornada ? ` (J${jornada})` : "";
  const lineas: string[] = [];
  if (cambios.length) lineas.push(`Cambio en la convocatoria del ${diaTexto(fecha)}${j}: ${cambios.join("; ")}.`, "");
  else lineas.push(`Convocatoria del ${diaTexto(fecha)}${j}`, "");
  for (const p of partidos) {
    const ids = (conv[p.equipo] ?? []).map((c) => c.person_id);
    const hora = p.inicio ? `${p.inicio}${p.encuentro ? ` (encuentro ${p.encuentro})` : ""}` : "hora por confirmar";
    const sitio = p.sitio === "pista por confirmar" ? "pista por confirmar" : `en ${p.sitio}${p.direccion ? ` — ${p.direccion.replace(/\.$/, "")}` : ""}`;
    lineas.push(`${p.equipo} · ${cruce(p)} (${p.es_local === false ? "visitante" : "local"})`);
    lineas.push(`${hora} ${sitio}.`);
    lineas.push(p.lineaEquipacion ?? "Equipación habitual (negra).");
    lineas.push(ids.length ? `Convocados (${ids.length}): ${nombres(ids, nombre).join(", ")}.` : "Convocados: por confirmar.");
    lineas.push("");
  }
  lineas.push("Recordad: el dorsal es obligatorio.");
  return lineas.join("\n");
}

/** Lo que Claude copia a SportEasy (D104: evento con «Selección manual» y SIN notificación). */
export function textoSportEasy(fecha: string, jornada: number | null, partidos: PartidoMensaje[], conv: Convocatoria, nombre: (id: string) => string, cambios: string[] = []) {
  const lineas = partidos.map((p) => {
    const ids = (conv[p.equipo] ?? []).map((c) => c.person_id);
    return `${p.equipo} · J${jornada ?? "?"} ${cruce(p)} (${ddmm(fecha)}${p.inicio ? `, ${p.inicio}` : ""}): ${ids.length ? nombres(ids, nombre).join(", ") : "nadie"} (${ids.length}).`;
  });
  if (cambios.length) lineas.unshift(`Cambios desde la última copia: ${cambios.join("; ")}.`);
  lineas.push("En SportEasy: «Modificar los participantes implicados», seleccionar solo estos, y «Enviar una notificación» apagado (D104).");
  return lineas.join("\n");
}

/** Aviso al móvil «Estás convocado» (pantalla de bloqueo: sin niveles ni motivos). */
export function textoEstasConvocado(fecha: string, partidos: PartidoMensaje[], equipos: Equipo[]) {
  const suyos = partidos.filter((p) => equipos.includes(p.equipo));
  const detalle = suyos.map((p) => `${p.equipo} a las ${p.inicio ?? "?"}${p.encuentro ? ` (encuentro ${p.encuentro})` : ""}`).join(" y ");
  return { titulo: `Estás convocado · ${diaTexto(fecha)}`, cuerpo: `${detalle}. El dorsal es obligatorio.` };
}
