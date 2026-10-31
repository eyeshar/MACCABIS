import equipJson from "@/data/equipaciones.json";
import { avisoPartido, equipoPorNombre, lineaConvocatoria, proximoPartido, type Aviso, type Equipaciones, type Partido } from "@/data/avisosEquipacion";

// Avisos de choque de equipacion (D79). El calculo vive en data/avisos_equipacion.js (el mismo que usa la web publica);
// aqui solo se enganchan los datos y se ofrecen las funciones a las pantallas. Los colores salen del fichero del repo
// (data/equipaciones_2026-27.json); los partidos, de la tabla de eventos (D151): quien llama pasa los de la fuente
// (`partidosCalendario(await cargarFuente())`). Este modulo no lee ningun calendario por su cuenta.
export type { Aviso, Partido };
export { lineaConvocatoria };

const equip = equipJson as unknown as Equipaciones;

export const hoyMadrid = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

/** Aviso de un partido (null si descansa o sin rival). */
export const avisoDe = (p: Partido | null) => avisoPartido(equip, p);

/** Proximo partido del equipo desde hoy, ya con su aviso. `partidos`: los del calendario (tabla de eventos). */
export function proximoConAviso(equipo: "MDA" | "MDL", partidos: Partido[], hoy = hoyMadrid()) {
  const partido = proximoPartido({ partidos }, hoy, equipo);
  return partido ? { partido, aviso: avisoPartido(equip, partido) } : null;
}

/** Aviso del proximo partido de `equipo` contra `rival` (para Scouting). `partidos`: los del calendario (tabla de eventos). */
export function avisoContra(equipo: "MDA" | "MDL", rival: string, partidos: Partido[], hoy = hoyMadrid()) {
  const partido = partidos
    .filter((p) => p.equipo === equipo && !p.descansa && p.fecha && p.fecha >= hoy && p.rival && equipoPorNombre(equip, p.rival) === equipoPorNombre(equip, rival))
    .sort((a, b) => (a.fecha! < b.fecha! ? -1 : 1))[0];
  return partido ? avisoPartido(equip, partido) : null;
}

/** Nombre "bonito" de un rival del calendario (que viene en mayusculas, con comillas...). */
export const nombreRival = (nombre: string | null | undefined) => (nombre ? equipoPorNombre(equip, nombre)?.nombre ?? nombre : "");

/** Colores de un equipo por su nombre (camiseta y pantalon de la 1.ª equipacion), con el color CSS de la camiseta. */
export function coloresDe(nombre: string) {
  const e = equipoPorNombre(equip, nombre);
  return e ? { camiseta: e.camiseta, pantalon: e.pantalon, css: equip.paleta[e.camiseta] ?? "#999", cssPantalon: equip.paleta[e.pantalon] ?? "#999" } : null;
}

/** Linea de equipacion de la convocatoria (D160): WhatsApp, aviso push, ficha del evento y Scouting. Siempre que haya
 *  rival ("Jugamos de negro (ellos de rojo). Llevad la amarilla por si acaso."); null si descansa. */
export const lineaEquipacion = (p: Partido | null) => lineaConvocatoria(equip, p);
