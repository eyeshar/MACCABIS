// Importador (paso 2, pista E, D94): lee texto pegado y lo compara con lo que hay. Funciones PURAS (sin datos ni
// efectos): la pagina lee de Supabase, llama aqui y solo escribe lo que el gestor acepta. Nada se aplica solo.
//
//  - Calendario del Ayuntamiento: "grupo;jornada;local;visitante;fecha;hora;pista" (G1 = MdA, G2 = MdL;
//    "X descansa" = jornada de descanso). Se compara con los eventos de liga y solo se ensenan los CAMBIOS.
//  - Respuestas de SportEasy: "evento;jugador;respuesta;motivo;detalle" y "jugador;desde;hasta;motivo".
//    Un nombre que no esta en el diccionario NUNCA se empareja por parecido: bloquea esa linea.
import type { EventoFila, Motivo, Respuesta } from "./dominio";

// ---------------------------------------------------------------- utilidades
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
/** "2", "Pista 2", "Moratalaz - Pista 2" -> 2; vacio -> null; ilegible -> undefined. */
export function leerPista(t: string): number | null | undefined {
  const s = t.trim();
  if (!s) return null;
  const r = s.match(/(\d{1,2})\s*$/);
  return r ? +r[1] : undefined;
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
    const jornada = Number(c[1]);
    if (!Number.isInteger(jornada) || jornada < 1) { salida.push(error("La jornada debe ser un número (1, 2, 3…).")); continue; }
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
    if (pista === undefined) { salida.push(error("La pista debe llevar su número (Pista 2).")); continue; }
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
const TEXTO_CAMPO: Record<CampoCambio, string> = { fecha: "Fecha", hora: "Hora", pista: "Pista", local: "Local / visitante", rival: "Rival" };
const fdma = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;
const h5 = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : null);

export function compararCalendario(lineas: LineaCalendario[], eventos: EventoLiga[], descansos: Descanso[]): ComparacionCalendario {
  const liga = eventos.filter((e) => e.tipo === "liga" && e.estado === "programado" && (e.equipo === "MdA" || e.equipo === "MdL"));
  const cambios: CambioCalendario[] = [], senales: Senal[] = [];
  const errores = lineas.filter((l): l is Extract<LineaCalendario, { tipo: "error" }> => l.tipo === "error");
  let iguales = 0;
  const vistos = new Set<string>(); // "MdA-4": jornadas de nuestro equipo que el bloque menciona
  const jornadasDelGrupo = new Set<string>(); // "MdA-4": jornadas de las que el bloque trae alguna linea (suya o ajena)
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
      if (e.es_local !== l.esLocal) { pon("local", e.es_local ? "local" : "visitante", l.esLocal ? "local" : "visitante", l.esLocal); hay = true; }
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
    if (jornadasDelGrupo.has(k) && !vistos.has(k)) {
      senales.push({ tipo: "desaparecido", equipo: e.equipo as "MdA" | "MdL", jornada: e.jornada!, texto: `J${e.jornada} ${e.equipo}: el partido contra ${e.rival} (${fdma(e.fecha)}) YA NO figura en lo pegado. No se borra solo.` });
    }
  }
  const nuestras = lineas.filter((l) => l.tipo === "partido" || l.tipo === "descanso").length;
  return { lineas: lineas.length, errores, ajenas: lineas.filter((l) => l.tipo === "ajena").length, nuestras, iguales, cambios, senales };
}

// ================================================================ RESPUESTAS Y AUSENCIAS
const RESPUESTAS: Record<string, Respuesta> = {
  va: "va", voy: "va", si: "va", presente: "va", "a tiempo": "va", tarde: "va",
  duda: "duda", dudo: "duda", quizas: "duda", "tal vez": "duda", "?": "duda",
  no: "no", "no voy": "no", "no va": "no", ausente: "no",
  "sin responder": "sin_responder", "sin respuesta": "sin_responder", pendiente: "sin_responder", "": "sin_responder",
};
const MOTIVOS_ALIAS: Record<string, Motivo> = {
  lesion: "lesion", lesionado: "lesion", trabajo: "trabajo", laboral: "trabajo", viaje: "viaje", vacaciones: "viaje",
  familia: "familia", familiar: "familia", otro: "otro", otros: "otro", otra: "otro",
};

export type Diccionario = Map<string, string>; // nombre normalizado -> person_id
export const crearDiccionario = (filas: { nombre_sporteasy: string; person_id: string }[]): Diccionario => new Map(filas.map((f) => [normalizar(f.nombre_sporteasy), f.person_id]));

export type LineaRespuesta =
  | { n: number; crudo: string; tipo: "respuesta"; estado: "valida"; evento: Pick<EventoFila, "id" | "clave" | "fecha">; person_id: string; nombre: string; respuesta: Respuesta; motivo: Motivo | null; detalle: string | null }
  | { n: number; crudo: string; tipo: "ausencia"; estado: "valida"; person_id: string; nombre: string; desde: string; hasta: string; motivo: Motivo }
  | { n: number; crudo: string; tipo: "respuesta" | "ausencia"; estado: "bloqueada"; nombre: string; motivoBloqueo: string }
  | { n: number; crudo: string; tipo: "error"; estado: "error"; error: string };

type EventoRef = Pick<EventoFila, "id" | "clave" | "fecha" | "tipo" | "equipo" | "estado">;

/** Busca el evento al que se refiere "clave", "2026-10-14 entreno", "18/10/2026 MdA", "entreno 14/10/2026"... */
export function buscarEvento(texto: string, eventos: EventoRef[]): { evento?: EventoRef; error?: string } {
  const t = texto.trim();
  const porClave = eventos.find((e) => e.clave.toLowerCase() === t.toLowerCase());
  if (porClave) return { evento: porClave };
  const trozos = t.split(/\s+/);
  const fechaTxt = trozos.find((x) => leerFecha(x));
  if (!fechaTxt) return { error: `No sé a qué evento te refieres («${t}»). Usa su fecha (14/10/2026) y, si hace falta, «entreno», «MdA» o «MdL».` };
  const fecha = leerFecha(fechaTxt)!;
  const resto = trozos.filter((x) => x !== fechaTxt).map(normalizar).filter(Boolean);
  let c = eventos.filter((e) => e.fecha === fecha && e.estado === "programado");
  if (resto.includes("entreno") || resto.includes("entrenamiento")) c = c.filter((e) => e.tipo === "entreno");
  if (resto.includes("mda")) c = c.filter((e) => e.equipo === "MdA");
  if (resto.includes("mdl")) c = c.filter((e) => e.equipo === "MdL");
  if (c.length === 1) return { evento: c[0] };
  if (!c.length) return { error: `No hay ningún evento el ${fdma(fecha)}${resto.length ? ` que cumpla «${resto.join(" ")}»` : ""}.` };
  return { error: `Hay ${c.length} eventos el ${fdma(fecha)}: añade «entreno», «MdA» o «MdL».` };
}

export function leerRespuestas(texto: string, diccionario: Diccionario, eventos: EventoRef[], personas: { person_id: string; nombre: string }[]): LineaRespuesta[] {
  const nombrePersona = new Map(personas.map((p) => [p.person_id, p.nombre]));
  const quien = (txt: string): { person_id?: string; nombre: string } => {
    const k = normalizar(txt);
    const id = diccionario.get(k) ?? (personas.find((p) => p.person_id === txt.trim()) ? txt.trim() : undefined);
    return { person_id: id, nombre: id ? nombrePersona.get(id) ?? id : txt.trim() };
  };
  const salida: LineaRespuesta[] = [];
  for (const { n, crudo } of lineasDe(texto)) {
    const c = campos(crudo);
    if (/^(evento|jugador)$/i.test(c[0])) continue; // cabecera
    const error = (e: string): LineaRespuesta => ({ n, crudo, tipo: "error", estado: "error", error: e });
    const esAusencia = c.length >= 3 && !!leerFecha(c[1]) && !!leerFecha(c[2]);
    if (esAusencia) {
      const desde = leerFecha(c[1])!, hasta = leerFecha(c[2])!;
      if (hasta < desde) { salida.push(error("«Hasta» es anterior a «desde».")); continue; }
      const motivo = MOTIVOS_ALIAS[normalizar(c[3] ?? "")];
      if (!motivo) { salida.push(error(`Motivo no válido («${c[3] ?? ""}»): lesión, trabajo, viaje, familia u otro.`)); continue; }
      const q = quien(c[0]);
      if (!q.person_id) { salida.push({ n, crudo, tipo: "ausencia", estado: "bloqueada", nombre: q.nombre, motivoBloqueo: "Nombre desconocido: asígnalo a mano una vez." }); continue; }
      salida.push({ n, crudo, tipo: "ausencia", estado: "valida", person_id: q.person_id, nombre: q.nombre, desde, hasta, motivo });
      continue;
    }
    if (c.length < 3) { salida.push(error("Faltan campos: evento;jugador;respuesta;motivo;detalle.")); continue; }
    const respuesta = RESPUESTAS[normalizar(c[2])];
    if (!respuesta) { salida.push(error(`Respuesta no válida («${c[2]}»): va, duda, no o sin responder.`)); continue; }
    let motivo: Motivo | null = null;
    if (c[3]) {
      motivo = MOTIVOS_ALIAS[normalizar(c[3])] ?? null;
      if (!motivo) { salida.push(error(`Motivo no válido («${c[3]}»): lesión, trabajo, viaje, familia u otro.`)); continue; }
    }
    const { evento, error: eEvento } = buscarEvento(c[0], eventos);
    if (!evento) { salida.push(error(eEvento!)); continue; }
    const q = quien(c[1]);
    if (!q.person_id) { salida.push({ n, crudo, tipo: "respuesta", estado: "bloqueada", nombre: q.nombre, motivoBloqueo: "Nombre desconocido: asígnalo a mano una vez." }); continue; }
    salida.push({ n, crudo, tipo: "respuesta", estado: "valida", evento: { id: evento.id, clave: evento.clave, fecha: evento.fecha }, person_id: q.person_id, nombre: q.nombre, respuesta, motivo, detalle: c.slice(4).join(";").trim() || null });
  }
  return salida;
}

export const nombresBloqueados = (lineas: LineaRespuesta[]) => [...new Set(lineas.filter((l) => l.estado === "bloqueada").map((l) => (l as { nombre: string }).nombre))];
