// Importador (paso 2, pista E, D94): lee texto pegado y lo compara con lo que hay. Funciones PURAS (sin datos ni
// efectos): la pagina lee de Supabase, llama aqui y solo escribe lo que el gestor acepta. Nada se aplica solo.
//
//  - Calendario del Ayuntamiento: "grupo;jornada;local;visitante;fecha;hora;pista" (G1 = MdA, G2 = MdL;
//    "X descansa" = jornada de descanso). Se compara con los eventos de liga y solo se ensenan los CAMBIOS.
import type { EventoFila } from "./dominio";

// ---------------------------------------------------------------- utilidades
// Igual que limpiarRival de dominio.ts (aqui no se importa: este fichero se prueba suelto con node).
const limpiarRival = (r: string | null | undefined) => (r ?? "").replace(/([.,;:!?])\1+/g, "$1").replace(/\s+/g, " ").trim();
/** Minusculas, sin tildes ni signos: para comparar nombres ("MEJORADA 2012 C.B.." == "Mejorada 2012 C.B."). */
export const normalizar = (t: string | null | undefined) =>
  String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const campos = (linea: string) => (linea.includes(";") ? linea.split(";") : linea.split("\t")).map((c) => c.trim());
const lineasDe = (texto: string) => texto.split(/\r?\n/).map((crudo, i) => ({ n: i + 1, crudo })).filter((l) => l.crudo.trim() !== "");

/** "04/10/2026", "4/10/26", "2026-10-04", "04-10-2026" -> "2026-10-04" (o null si no es una fecha real). */
export function leerFecha(t: string): string | null {
  const s = t.trim();
  let a: number, m: number, d: number;
  let r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (r) { a = +r[1]; m = +r[2]; d = +r[3]; }
  else {
    r = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
    if (!r) return null;
    d = +r[1]; m = +r[2]; a = +r[3] < 100 ? 2000 + +r[3] : +r[3];
  }
  const f = new Date(Date.UTC(a, m - 1, d, 12));
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null;
  return f.toISOString().slice(0, 10);
}
/** "9:00", "09.00", "9h" -> "09:00"; vacio -> null; ilegible -> undefined. */
export function leerHora(t: string): string | null | undefined {
  const s = t.trim();
  if (!s) return null;
  const r = s.match(/^(\d{1,2})(?:[:.h](\d{2}))?\s*h?$/i);
  if (!r) return undefined;
  const h = +r[1], m = r[2] ? +r[2] : 0;
  return h > 23 || m > 59 ? undefined : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
/** "2", "Pista 2", "Moratalaz - Pista 2" -> 2; tambien como lo escribe Deportes en su web: "Baloncesto 2 Moratalaz",
 *  "Pabellón baloncesto 3 Moratalaz" -> 2, 3. Vacio -> null; ilegible (sin numero, o con varios sin «pista»/«baloncesto»
 *  delante) -> undefined. */
export function leerPista(t: string): number | null | undefined {
  const s = t.trim();
  if (!s) return null;
  const alFinal = s.match(/(?:^|\D)(\d{1,2})\s*$/);
  if (alFinal) return +alFinal[1];
  const trasNombre = normalizar(s).match(/(?:pista|baloncesto|cancha)\s*(?:n[o.º°]?\s*)?(\d{1,2})(?!\d)/);
  if (trasNombre) return +trasNombre[1];
  const numeros = s.match(/\d+/g) ?? [];
  return numeros.length === 1 && numeros[0].length <= 2 ? +numeros[0] : undefined;
}

// ================================================================ CALENDARIO
export const ALIAS_NUESTROS = {
  MdA: ["mda", "maccabi de acostar", "maccabis de acostar", "m d a"],
  MdL: ["mdl", "maccabi de levantar", "maccabis de levantar", "m d l"],
} as const;
const GRUPO_EQUIPO = { G1: "MdA", G2: "MdL" } as const;
const esNuestro = (nombre: string, equipo: "MdA" | "MdL") => (ALIAS_NUESTROS[equipo] as readonly string[]).includes(normalizar(nombre));

export type LineaCalendario =
  | { n: number; crudo: string; tipo: "partido"; equipo: "MdA" | "MdL"; grupo: "G1" | "G2"; jornada: number; esLocal: boolean; rival: string; fecha: string; hora: string | null; pista: number | null }
  | { n: number; crudo: string; tipo: "descanso"; equipo: "MdA" | "MdL"; grupo: "G1" | "G2"; jornada: number; fecha: string | null }
  | { n: number; crudo: string; tipo: "ajena"; grupo: "G1" | "G2"; jornada: number }
  | { n: number; crudo: string; tipo: "error"; error: string };

export function leerCalendario(texto: string): LineaCalendario[] {
  const salida: LineaCalendario[] = [];
  for (const { n, crudo } of lineasDe(texto)) {
    const c = campos(crudo);
    if (/^grupo$/i.test(c[0])) continue; // cabecera
    const error = (e: string): LineaCalendario => ({ n, crudo, tipo: "error", error: e });
    const g = c[0].match(/G\s*([12])\b/i);
    if (!g) { salida.push(error("El grupo debe ser G1 (MdA) o G2 (MdL).")); continue; }
    const grupo = `G${g[1]}` as "G1" | "G2";
    const equipo = GRUPO_EQUIPO[grupo];
    const jornada = /^J?\s*\d+$/i.test(c[1] ?? "") ? Number(c[1].replace(/\D/g, "")) : NaN;
    if (!Number.isInteger(jornada) || jornada < 1) { salida.push(error("La jornada debe ser un número (1 o J1).")); continue; }
    const local = c[2] ?? "", visitante = c[3] ?? "";
    // "X descansa": una jornada de descanso (en el campo de local o de visitante, o en el de fecha si falta uno).
    const desc = [local, visitante].map((t) => t.match(/^(.*?)\s+descansa\s*$/i)).find(Boolean);
    if (desc) {
      if (!esNuestro(desc[1], equipo)) { salida.push({ n, crudo, tipo: "ajena", grupo, jornada }); continue; }
      const fecha = c[4] ? leerFecha(c[4]) : null;
      if (c[4] && !fecha) { salida.push(error("La fecha no se entiende (usa 04/10/2026).")); continue; }
      salida.push({ n, crudo, tipo: "descanso", equipo, grupo, jornada, fecha });
      continue;
    }
    if (c.length < 5 || !local || !visitante) { salida.push(error("Faltan campos: grupo;jornada;local;visitante;fecha;hora;pista.")); continue; }
    const nuestroLocal = esNuestro(local, equipo), nuestroVisitante = esNuestro(visitante, equipo);
    if (!nuestroLocal && !nuestroVisitante) { salida.push({ n, crudo, tipo: "ajena", grupo, jornada }); continue; }
    const fecha = leerFecha(c[4] ?? "");
    if (!fecha) { salida.push(error("La fecha no se entiende (usa 04/10/2026).")); continue; }
    const hora = leerHora(c[5] ?? "");
    if (hora === undefined) { salida.push(error("La hora no se entiende (usa 10:15).")); continue; }
    const pista = leerPista(c[6] ?? "");
    if (pista === undefined) { salida.push(error("La pista debe llevar su número (Pista 2 o «Baloncesto 2 Moratalaz»).")); continue; }
    salida.push({ n, crudo, tipo: "partido", equipo, grupo, jornada, esLocal: nuestroLocal, rival: (nuestroLocal ? visitante : local).trim(), fecha, hora, pista });
  }
  return salida;
}

export type CampoCambio = "fecha" | "hora" | "pista" | "local" | "rival";
export type CambioCalendario = {
  /** Identificador estable de este cambio (para aceptarlo): evento + campo + valor del Ayuntamiento. */
  id: string; claveEvento: string; eventoId: string; equipo: "MdA" | "MdL"; jornada: number; partido: string;
  campo: CampoCambio; textoCampo: string; actual: string; oficial: string; valorOficial: string | number | boolean | null; linea: number;
};
export type Senal = { tipo: "nuevo" | "desaparecido" | "descanso_nuevo" | "descanso_con_partido" | "descanso_distinto"; equipo: "MdA" | "MdL"; jornada: number; texto: string; linea?: number };
export type ComparacionCalendario = {
  lineas: number; errores: Extract<LineaCalendario, { tipo: "error" }>[]; ajenas: number; nuestras: number; iguales: number;
  cambios: CambioCalendario[]; senales: Senal[];
};

type EventoLiga = Pick<EventoFila, "id" | "clave" | "tipo" | "equipo" | "jornada" | "rival" | "es_local" | "fecha" | "inicio" | "numero_pista" | "estado">;
type Descanso = { equipo: "MdA" | "MdL"; jornada: number; fecha: string | null };
const TEXTO_CAMPO: Record<CampoCambio, string> = { fecha: "Fecha", hora: "Hora", pista: "Pista", local: "Orden del cartel", rival: "Rival" };
const fdma = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;
const h5 = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : null);

export function compararCalendario(lineas: LineaCalendario[], eventos: EventoLiga[], descansos: Descanso[]): ComparacionCalendario {
  const liga = eventos.filter((e) => e.tipo === "liga" && e.estado === "programado" && (e.equipo === "MdA" || e.equipo === "MdL"));
  const cambios: CambioCalendario[] = [], senales: Senal[] = [];
  const errores = lineas.filter((l): l is Extract<LineaCalendario, { tipo: "error" }> => l.tipo === "error");
  let iguales = 0;
  const vistos = new Set<string>(); // "MdA-4": jornadas de nuestro equipo que el bloque menciona
  const jornadasDelGrupo = new Set<string>(); // "MdA-4": jornadas de las que el bloque trae alguna linea (suya o ajena)
  const equiposDelBloque = new Set<string>();
  for (const l of lineas) if (l.tipo !== "error") equiposDelBloque.add(l.tipo === "ajena" ? (l.grupo === "G1" ? "MdA" : "MdL") : l.equipo);
  for (const l of lineas) if (l.tipo !== "error") jornadasDelGrupo.add(`${l.tipo === "ajena" ? (l.grupo === "G1" ? "MdA" : "MdL") : l.equipo}-${l.jornada}`);

  for (const l of lineas) {
    if (l.tipo === "partido") {
      vistos.add(`${l.equipo}-${l.jornada}`);
      const e = liga.find((x) => x.equipo === l.equipo && x.jornada === l.jornada);
      const nombre = l.esLocal ? `${l.equipo} – ${l.rival}` : `${l.rival} – ${l.equipo}`;
      if (!e) {
        const d = descansos.find((x) => x.equipo === l.equipo && x.jornada === l.jornada);
        senales.push(d
          ? { tipo: "descanso_con_partido", equipo: l.equipo, jornada: l.jornada, linea: l.n, texto: `J${l.jornada} ${l.equipo}: aquí figuraba como descanso y el Ayuntamiento trae partido (${nombre}, ${fdma(l.fecha)}). No se crea solo.` }
          : { tipo: "nuevo", equipo: l.equipo, jornada: l.jornada, linea: l.n, texto: `J${l.jornada} ${l.equipo}: partido NUEVO que no tenemos (${nombre}, ${fdma(l.fecha)}${l.hora ? ` ${l.hora}` : ""}). No se crea solo.` });
        continue;
      }
      const pon = (campo: CampoCambio, actual: string, oficial: string, valor: CambioCalendario["valorOficial"]) => {
        cambios.push({ id: `${e.clave}|${campo}|${String(valor)}`, claveEvento: e.clave, eventoId: e.id, equipo: l.equipo, jornada: l.jornada, partido: nombre, campo, textoCampo: TEXTO_CAMPO[campo], actual, oficial, valorOficial: valor, linea: l.n });
      };
      let hay = false;
      if (e.fecha !== l.fecha) { pon("fecha", fdma(e.fecha), fdma(l.fecha), l.fecha); hay = true; }
      if (h5(e.inicio) !== l.hora) { pon("hora", h5(e.inicio) ?? "sin hora", l.hora ?? "sin hora", l.hora); hay = true; }
      if ((e.numero_pista ?? null) !== l.pista) { pon("pista", e.numero_pista ? `Pista ${e.numero_pista}` : "por confirmar", l.pista ? `Pista ${l.pista}` : "por confirmar", l.pista); hay = true; }
      // D129: local/visitante solo se usa por dentro (equipacion); al gestor se le enseña el cartel tal cual.
      if (e.es_local !== l.esLocal) { pon("local", e.es_local === false ? `${e.rival ?? l.rival} – ${l.equipo}` : `${l.equipo} – ${e.rival ?? l.rival}`, nombre, l.esLocal); hay = true; }
      if (normalizar(e.rival) !== normalizar(l.rival)) { pon("rival", e.rival ?? "—", l.rival, l.rival); hay = true; }
      if (!hay) iguales++;
    } else if (l.tipo === "descanso") {
      vistos.add(`${l.equipo}-${l.jornada}`);
      const hay = liga.find((x) => x.equipo === l.equipo && x.jornada === l.jornada);
      const d = descansos.find((x) => x.equipo === l.equipo && x.jornada === l.jornada);
      if (hay) senales.push({ tipo: "descanso_con_partido", equipo: l.equipo, jornada: l.jornada, linea: l.n, texto: `J${l.jornada} ${l.equipo}: el Ayuntamiento dice que DESCANSA y aquí hay partido (${hay.rival}, ${fdma(hay.fecha)}). No se borra solo.` });
      else if (!d) senales.push({ tipo: "descanso_nuevo", equipo: l.equipo, jornada: l.jornada, linea: l.n, texto: `J${l.jornada} ${l.equipo}: descanso NUEVO que no teníamos${l.fecha ? ` (${fdma(l.fecha)})` : ""}.` });
      else if (l.fecha && d.fecha && l.fecha !== d.fecha) senales.push({ tipo: "descanso_distinto", equipo: l.equipo, jornada: l.jornada, linea: l.n, texto: `J${l.jornada} ${l.equipo}: el descanso era el ${fdma(d.fecha)} y el Ayuntamiento lo da el ${fdma(l.fecha)}.` });
      else iguales++;
    }
  }
  // Partidos nuestros de las jornadas del bloque que el Ayuntamiento ya no trae.
  for (const e of liga) {
    const k = `${e.equipo}-${e.jornada}`;
    if (equiposDelBloque.has(e.equipo) && !vistos.has(k)) {
      senales.push({ tipo: "desaparecido", equipo: e.equipo as "MdA" | "MdL", jornada: e.jornada!, texto: `J${e.jornada} ${e.equipo}: el partido contra ${limpiarRival(e.rival)} (${fdma(e.fecha)}) no aparece en lo pegado (¿lo han quitado?). No se borra solo.` });
    }
  }
  const nuestras = lineas.filter((l) => l.tipo === "partido" || l.tipo === "descanso").length;
  return { lineas: lineas.length, errores, ajenas: lineas.filter((l) => l.tipo === "ajena").length, nuestras, iguales, cambios, senales };
}
