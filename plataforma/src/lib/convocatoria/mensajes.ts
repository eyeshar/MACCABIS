// Textos de salida de la convocatoria (D107): el mensaje de WhatsApp (formato de D98: hora, encuentro, pista y
// direccion), la copia a SportEasy y el aviso «Estás convocado». Funciones PURAS. Nunca llevan niveles, posiciones,
// reglas personales ni motivos: solo el nombre visible de cada convocado.

import type { Convocatoria, Equipo } from "./motor";

export type PartidoMensaje = {
  equipo: Equipo; rival: string | null; es_local: boolean | null; inicio: string | null; encuentro: string | null;
  /** "CDM Moratalaz, pista 2" o "pista por confirmar" */
  sitio: string; direccion: string | null;
  /** Línea de equipación (D160: lineaConvocatoria de data/avisos_equipacion.js, siempre que haya rival), o null */
  lineaEquipacion: string | null;
};

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const ddmm = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
export const diaTexto = (f: string) => `${DIAS[new Date(`${f}T12:00:00Z`).getUTCDay()]} ${ddmm(f)}`;
const limpiar = (r: string | null) => (r ? r.replace(/([.,;:!?])\1+/g, "$1").replace(/\s+/g, " ").trim() : "rival por confirmar");
export const cruce = (p: Pick<PartidoMensaje, "equipo" | "rival" | "es_local">) => (p.es_local === false ? `${limpiar(p.rival)} – ${p.equipo}` : `${p.equipo} – ${limpiar(p.rival)}`);
const nombres = (ids: string[], nombre: (id: string) => string) => ids.map(nombre).sort((a, b) => a.localeCompare(b, "es"));

/** Aviso de data/avisos.json vigente ese domingo (lo filtra quien llama, con avisosDelFichero). */
export type AvisoMensaje = { texto: string; para: "todos" | Equipo };

/** Mensaje de WhatsApp para el grupo. Con `cambios` (tras aprobar), empieza diciendo qué ha cambiado. Con `avisos`, una
 *  línea por aviso al final (con el equipo delante si no es para todos), sin los del dorsal, que ya van en el recordatorio. */
export function mensajeConvocatoria(fecha: string, jornada: number | null, partidos: PartidoMensaje[], conv: Convocatoria, nombre: (id: string) => string, cambios: string[] = [], avisos: AvisoMensaje[] = []) {
  const j = jornada ? ` (J${jornada})` : "";
  const lineas: string[] = [];
  if (cambios.length) lineas.push(`Cambio en la convocatoria del ${diaTexto(fecha)}${j}: ${cambios.join("; ")}.`, "");
  else lineas.push(`Convocatoria del ${diaTexto(fecha)}${j}`, "");
  for (const p of partidos) {
    const ids = (conv[p.equipo] ?? []).map((c) => c.person_id);
    const hora = p.inicio ? `${p.inicio}${p.encuentro ? ` (encuentro ${p.encuentro})` : ""}` : "hora por confirmar";
    const sitio = p.sitio === "pista por confirmar" ? "pista por confirmar" : `en ${p.sitio}${p.direccion ? ` — ${p.direccion.replace(/\.$/, "")}` : ""}`;
    lineas.push(`${p.equipo} · ${cruce(p)}`);
    lineas.push(`${hora} ${sitio}.`);
    lineas.push(p.lineaEquipacion ?? "Equipación habitual (negra).");
    lineas.push(ids.length ? `Convocados (${ids.length}): ${nombres(ids, nombre).join(", ")}.` : "Convocados: por confirmar.");
    lineas.push("");
  }
  const juegan = partidos.map((p) => p.equipo);
  for (const a of avisos) {
    if (/dorsal/i.test(a.texto) || (a.para !== "todos" && !juegan.includes(a.para))) continue;
    lineas.push(a.para === "todos" ? a.texto : `${a.para}: ${a.texto}`);
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

/** Firma corta y estable de una convocatoria (para la clave unica del aviso: mismo estado = misma clave, nada doble). */
export function firmaConvocatoria(conv: Convocatoria) {
  const t = (["MdA", "MdL"] as Equipo[]).map((e) => `${e}:${(conv[e] ?? []).map((c) => c.person_id).sort().join(",")}`).join("|");
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const detallePartidos = (suyos: PartidoMensaje[]) => suyos.map((p) => `${p.equipo} a las ${p.inicio ?? "?"}${p.encuentro ? ` (quedada ${p.encuentro})` : ""}`).join(" y ");
const FIN_EQUIPACION = / ?Llevad la \S+ por si acaso\.$/;
/** Equipación de la jornada para el aviso al móvil (D160). Un partido: su línea tal cual. Dos (dobla): cada línea con su
 *  equipo delante y «Llevad la amarilla por si acaso.» una sola vez, al final. */
function lineasJornada(suyos: PartidoMensaje[]) {
  const con = suyos.filter((p) => p.lineaEquipacion).map((p) => ({ equipo: p.equipo, l: /[.!?]$/.test(p.lineaEquipacion!) ? p.lineaEquipacion! : `${p.lineaEquipacion}.` }));
  if (con.length <= 1) return con[0]?.l ?? "";
  const fin = con.map((x) => x.l.match(FIN_EQUIPACION)?.[0].trim()).find(Boolean);
  return [...con.map((x) => `${x.equipo}: ${x.l.replace(FIN_EQUIPACION, "")}`), ...(fin ? [fin] : [])].join(" ");
}

/** Aviso al móvil «Estás convocado» (D127; pantalla de bloqueo: sin niveles ni motivos). Con la línea de equipación de
 *  la jornada (D160), la misma del WhatsApp. */
export function textoEstasConvocado(fecha: string, partidos: PartidoMensaje[], equipos: Equipo[]) {
  const suyos = partidos.filter((p) => equipos.includes(p.equipo));
  const extra = lineasJornada(suyos);
  return { titulo: `Estás convocado · ${diaTexto(fecha)}`, cuerpo: `${detallePartidos(suyos)}.${extra ? ` ${extra}` : ""}` };
}

/** Tras un cambio de la convocatoria ya avisada: a quien entra, cambia de equipo o sale. */
export function textoCambioConvocatoria(fecha: string, partidos: PartidoMensaje[], equipos: Equipo[]) {
  const titulo = `Cambio en la convocatoria · ${diaTexto(fecha)}`;
  if (!equipos.length) return { titulo, cuerpo: "Ya no estás convocado este domingo." };
  const suyos = partidos.filter((p) => equipos.includes(p.equipo));
  const extra = lineasJornada(suyos);
  return { titulo, cuerpo: `Estás convocado: ${detallePartidos(suyos)}.${extra ? ` ${extra}` : ""}` };
}

/** A quien hay que avisar respecto a lo ya avisado (`base`): sin base, a todos los convocados; con base, a quien entra,
 *  cambia de equipo o sale (con sus equipos de ahora; vacio = sale). */
export function destinatariosAviso(conv: Convocatoria, base: Convocatoria | null) {
  const equiposDe = (c: Convocatoria | null) => {
    const m = new Map<string, Equipo[]>();
    for (const e of ["MdA", "MdL"] as Equipo[]) for (const x of c?.[e] ?? []) m.set(x.person_id, [...(m.get(x.person_id) ?? []), e]);
    return m;
  };
  const ahora = equiposDe(conv), antes = equiposDe(base);
  if (!base) return { cambio: false, personas: [...ahora.entries()].map(([person_id, equipos]) => ({ person_id, equipos })) };
  const ids = [...new Set([...ahora.keys(), ...antes.keys()])];
  return {
    cambio: true,
    personas: ids.filter((id) => (ahora.get(id) ?? []).join() !== (antes.get(id) ?? []).join()).map((person_id) => ({ person_id, equipos: ahora.get(person_id) ?? [] })),
  };
}

/** «(los otros 3 no tienen avisos activados)» / «(el otro no tiene avisos activados)» */
export const sinAvisosTexto = (n: number) => (n === 1 ? "el otro no tiene avisos activados" : `los otros ${n} no tienen avisos activados`);
