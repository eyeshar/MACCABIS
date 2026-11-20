// MdFantasy (D196): lo que pintan las pantallas, calculado de las tablas fantasy_*. Logica pura (pruebas:fantasy-logica).
import { arrastrar, duelos as calendarioDuelos } from "./manager.ts";
import { millones } from "./reglas.ts";

export type Manager = { person_id: string; nombre: string; alta_en: string };
export type Jugador = { person_id: string; nombre: string; valor: number; copias: number; media: number; jornadas: number; en_mercado: boolean };
export type Copia = { jugador: string; manager: string; precio: number; robada_en: string | null };
export type Movimiento = { id: string; manager: string; tipo: string; jugador: string | null; otro: string | null; importe: number; jornada: string | null; creado_en: string };
export type JornadaF = { fecha: string; puntuada_en: string | null; ronda: number | null; sin_casar: string[]; resultados: Record<string, string> };
export type AlineacionF = { manager: string; jornada: string; titulares: string[]; capitan: string | null; vice: string | null; arrastrada: boolean };
export type Porra = { manager: string; jornada: string; equipo: string; pronostico: string; acierto: boolean | null };
export type Duelo = { jornada: string; manager_a: string; manager_b: string | null; puntos_a: number | null; puntos_b: number | null };
export type DetalleJugador = {
  partidos?: { equipo: string; pts: number; masMenos: number; relativo: number; extra: number; total: number; minutos: number }[];
  unidades?: { clase: string; texto: string; respuesta: number; asistencia: number; como: string }[];
};
export type PuntoJ = { jornada: string; person_id: string; rendimiento: number; compromiso: number; total: number; minutos: number; convocado: boolean; doblete: boolean; detalle: DetalleJugador };
export type PuntoM = {
  jornada: string; manager: string; alineacion: number; porra: number; total: number; ingreso: number;
  detalle: { dobla?: string | null; capitan?: string | null; vice?: string | null; jugadores?: { person_id: string; rendimiento: number; compromiso: number; base: number; doble: number; total: number }[] };
};
export type LogroF = { manager: string; logro: string; jornada: string; texto: string };

/** La alineacion con la que un manager jugaria hoy la jornada en juego: la que ha guardado para ella o, si no ha tocado
 *  nada, la de la jornada anterior arrastrada (capitan y vice intercambiados). `mantenida` = viene de la anterior. */
export function alineacionVigente(manager: string, jornada: string | null, alineaciones: AlineacionF[], plantilla: string[]) {
  const suya = jornada ? alineaciones.find((a) => a.manager === manager && a.jornada === jornada) : undefined;
  const anterior = alineaciones.filter((a) => a.manager === manager && (!jornada || a.jornada < jornada)).at(-1);
  if (suya) return { titulares: suya.titulares, capitan: suya.capitan, vice: suya.vice, mantenida: false, vetado: anterior?.capitan ?? null };
  if (anterior) return { ...arrastrar(anterior, plantilla), mantenida: true, vetado: anterior.capitan };
  return { titulares: [] as string[], capitan: null, vice: null, mantenida: false, vetado: null };
}

export const n = (x: unknown) => Number(x ?? 0);
export const fechaCorta = (f: string) => `${Number(f.slice(8, 10))}/${Number(f.slice(5, 7))}`;
const suma = (a: number[]) => a.reduce((s, x) => s + x, 0);
export const pts = (x: number) => (Number.isInteger(x) ? String(x) : x.toLocaleString("es-ES", { maximumFractionDigits: 1 }));
export const conSigno = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${pts(Math.abs(x))}`;

/** Clasificacion de managers: total de puntos; a igualdad, la mejor jornada y despues el nombre. */
export function rankingManagers(managers: Manager[], puntos: PuntoM[], desde?: string, hasta?: string) {
  const filas = managers.map((m) => {
    const suyos = puntos.filter((p) => p.manager === m.person_id && (!desde || p.jornada >= desde) && (!hasta || p.jornada <= hasta));
    return { ...m, total: suma(suyos.map((p) => n(p.total))), jornadas: suyos.length, mejor: Math.max(0, ...suyos.map((p) => n(p.total))), porra: suma(suyos.map((p) => n(p.porra))) };
  });
  filas.sort((a, b) => b.total - a.total || b.mejor - a.mejor || a.nombre.localeCompare(b.nombre, "es"));
  return filas.map((f) => ({ ...f, puesto: filas.findIndex((x) => x.total === f.total && x.mejor === f.mejor) + 1 }));
}

/** Clasificacion de duelos: 2 por victoria, 1 por empate. */
export function rankingDuelos(managers: Manager[], duelos: Duelo[]) {
  const filas = managers.map((m) => {
    let g = 0, e = 0, p = 0;
    for (const d of duelos) {
      if (!d.manager_b || d.puntos_a == null || d.puntos_b == null) continue;
      const soyA = d.manager_a === m.person_id, soyB = d.manager_b === m.person_id;
      if (!soyA && !soyB) continue;
      const mio = n(soyA ? d.puntos_a : d.puntos_b), suyo = n(soyA ? d.puntos_b : d.puntos_a);
      if (mio > suyo) g++; else if (mio === suyo) e++; else p++;
    }
    return { ...m, g, e, p, puntos: g * 2 + e };
  });
  return filas.sort((a, b) => b.puntos - a.puntos || b.g - a.g || a.nombre.localeCompare(b.nombre, "es"));
}

/** Clasificacion de jugadores por lo que se pida: total, rendimiento o compromiso. */
export function rankingJugadores(jugadores: Jugador[], puntos: PuntoJ[], clave: "total" | "rendimiento" | "compromiso", desde?: string, hasta?: string) {
  const filas = jugadores.filter((j) => j.en_mercado).map((j) => {
    const suyos = puntos.filter((p) => p.person_id === j.person_id && (!desde || p.jornada >= desde) && (!hasta || p.jornada <= hasta));
    return { ...j, puntos: suma(suyos.map((p) => n(p[clave]))), jugadas: suyos.filter((p) => p.minutos > 0).length, jornadasCon: suyos.length };
  });
  return filas.sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre, "es"));
}

/** El quinteto ideal de una jornada: los cinco con mas puntos (el primero, de capitan: dobla su rendimiento). */
export function quintetoIdeal(puntos: PuntoJ[], jornada: string, cuantos = 5) {
  const dia = puntos.filter((p) => p.jornada === jornada).sort((a, b) => n(b.total) - n(a.total) || n(b.rendimiento) - n(a.rendimiento) || a.person_id.localeCompare(b.person_id)).slice(0, cuantos);
  const capitan = [...dia].sort((a, b) => n(b.rendimiento) - n(a.rendimiento))[0];
  return { jugadores: dia, capitan: capitan?.person_id ?? null, total: suma(dia.map((p) => n(p.total))) + n(capitan?.rendimiento) };
}

/** Rival de un manager en la jornada en juego (provisional hasta el cierre: si se apunta alguien, puede cambiar). */
export function rivalDe(manager: string, managers: Manager[], jornadas: JornadaF[]) {
  if (managers.length < 2) return null;
  const ronda = jornadas.filter((j) => j.ronda != null).length;
  const par = calendarioDuelos(managers.map((m) => m.person_id), ronda).find(([a, b]) => a === manager || b === manager);
  if (!par) return null;
  const otro = par[0] === manager ? par[1] : par[0];
  return otro ? managers.find((m) => m.person_id === otro) ?? null : null;
}

export const mesDe = (f: string) => f.slice(0, 7);
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const nombreMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`;

/** Premios de un mes (jornadas puntuadas de ese mes): mejor manager, mejor jugador y el mas comprometido. */
export function premiosDelMes(mes: string, managers: Manager[], jugadores: Jugador[], pm: PuntoM[], pj: PuntoJ[]) {
  const desde = `${mes}-01`, hasta = `${mes}-31`;
  const m = rankingManagers(managers, pm, desde, hasta)[0];
  const j = rankingJugadores(jugadores, pj, "total", desde, hasta)[0];
  const c = rankingJugadores(jugadores, pj, "compromiso", desde, hasta)[0];
  return [
    m && m.jornadas > 0 ? { premio: "Mánager del mes", person_id: m.person_id, nombre: m.nombre, puntos: m.total, manager: true } : null,
    j && j.jornadasCon > 0 ? { premio: "Jugador del mes", person_id: j.person_id, nombre: j.nombre, puntos: j.puntos, manager: false } : null,
    c && c.jornadasCon > 0 ? { premio: "El más comprometido", person_id: c.person_id, nombre: c.nombre, puntos: c.puntos, manager: false } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);
}

/** Resumen de la jornada para copiar a WhatsApp (lo envia Ivan a mano). Solo nombres y puntos. */
export function resumenWhatsapp(jornada: string, managers: Manager[], jugadores: Jugador[], pm: PuntoM[], pj: PuntoJ[], duelos: Duelo[]) {
  const nombreM = new Map(managers.map((m) => [m.person_id, m.nombre]));
  const nombreJ = new Map(jugadores.map((j) => [j.person_id, j.nombre]));
  const dia = pm.filter((p) => p.jornada === jornada).sort((a, b) => n(b.total) - n(a.total));
  const general = rankingManagers(managers, pm.filter((p) => p.jornada <= jornada));
  const ideal = quintetoIdeal(pj, jornada);
  const L = [`*MdFantasy · jornada del ${fechaCorta(jornada)}*`, ""];
  if (dia.length) {
    L.push("*La jornada*");
    dia.slice(0, 3).forEach((p, i) => L.push(`${["🥇", "🥈", "🥉"][i]} ${nombreM.get(p.manager) ?? "?"} · ${pts(n(p.total))} pts`));
    L.push(`Media: ${pts(Math.round((suma(dia.map((p) => n(p.total))) / dia.length) * 10) / 10)} pts`, "");
  }
  if (ideal.jugadores.length) L.push("*Quinteto ideal*", ideal.jugadores.map((p) => `${nombreJ.get(p.person_id) ?? "?"} (${pts(n(p.total))})`).join(", "), "");
  const dd = duelos.filter((d) => d.jornada === jornada && d.manager_b && d.puntos_a != null);
  if (dd.length) { L.push("*Duelos*"); for (const d of dd) L.push(`${nombreM.get(d.manager_a)} ${pts(n(d.puntos_a))} - ${pts(n(d.puntos_b))} ${nombreM.get(d.manager_b as string)}`); L.push(""); }
  if (general.length) { L.push("*General*"); general.slice(0, 5).forEach((m, i) => L.push(`${i + 1}. ${m.nombre} · ${pts(m.total)} pts`)); }
  return L.join("\n").trim();
}

export const TEXTO_MOVIMIENTO: Record<string, string> = { inicio: "Caja inicial", fichaje: "Ficha a", venta: "Vende a", clausulazo: "Clausulazo por", clausulado: "Le quitan a", ingreso: "Ingreso de la jornada", ajuste: "Ajuste" };

export function textoMovimiento(m: Movimiento, nombreJ: Map<string, string>, nombreM: Map<string, string>) {
  const j = m.jugador ? nombreJ.get(m.jugador) ?? "?" : "";
  if (m.tipo === "clausulazo") return `Clausulazo por ${j} a ${nombreM.get(m.otro ?? "") ?? "?"}`;
  if (m.tipo === "clausulado") return `${nombreM.get(m.otro ?? "") ?? "?"} le quita a ${j}`;
  if (m.tipo === "ingreso") return `Ingreso de la jornada${m.jornada ? ` del ${fechaCorta(m.jornada)}` : ""}`;
  return `${TEXTO_MOVIMIENTO[m.tipo] ?? m.tipo}${j ? ` ${j}` : ""}`;
}
export const importe = (x: number) => `${x >= 0 ? "+" : "−"}${millones(Math.abs(x))}`;

/** Insignias de un jugador (de sus puntos): se calculan al vuelo, no se guardan. */
export function insignias(personId: string, pj: PuntoJ[]) {
  const suyos = pj.filter((p) => p.person_id === personId);
  const out: { clave: string; texto: string; veces: number }[] = [];
  const mvp = [...new Set(pj.map((p) => p.jornada))].filter((j) => { const dia = pj.filter((p) => p.jornada === j); const max = Math.max(...dia.map((p) => n(p.total))); return max > 0 && n(dia.find((p) => p.person_id === personId)?.total) === max; }).length;
  if (mvp) out.push({ clave: "mvp", texto: "MVP de la jornada", veces: mvp });
  const dobles = suyos.filter((p) => p.doblete).length;
  if (dobles) out.push({ clave: "doblete", texto: "Doblete (dos partidos el mismo domingo)", veces: dobles });
  const veinte = suyos.filter((p) => n(p.rendimiento) >= 20).length;
  if (veinte) out.push({ clave: "20", texto: "20 o más de rendimiento", veces: veinte });
  const perfecto = suyos.filter((p) => (p.detalle.unidades ?? []).length > 0 && (p.detalle.unidades ?? []).every((u) => u.respuesta > 0 && u.asistencia >= 0)).length;
  if (perfecto) out.push({ clave: "compromiso", texto: "Compromiso perfecto", veces: perfecto });
  return out;
}

/** La convocatoria publicada de la jornada en juego: ids por equipo. null = sin publicar. */
export type Convocatoria = Partial<Record<string, string[]>> | null | undefined;
export type MarcaConvocado = { texto: string; clase: "si" | "no" };
/** La marca de cada jugador: «Convocado MdA», «Convocado MdL», «Convocado en los dos» o «No convocado». Sin publicar, null. */
export function marcaConvocado(c: Convocatoria, id: string): MarcaConvocado | null {
  if (!c) return null;
  const a = (c.MdA ?? []).includes(id), l = (c.MdL ?? []).includes(id);
  if (a && l) return { texto: "Convocado en los dos", clase: "si" };
  if (a) return { texto: "Convocado MdA", clase: "si" };
  if (l) return { texto: "Convocado MdL", clase: "si" };
  return { texto: "No convocado", clase: "no" };
}
/** La media que fija el valor de mercado: la de las ultimas N jornadas con datos del jugador. null = aun sin jornadas. */
export function mediaValor(puntosJ: { jornada: string; person_id: string; total: number }[], id: string, n: number): number | null {
  const suyas = puntosJ.filter((p) => p.person_id === id).sort((a, b) => b.jornada.localeCompare(a.jornada)).slice(0, n);
  return suyas.length ? Math.round((suyas.reduce((t, p) => t + p.total, 0) / suyas.length) * 10) / 10 : null;
}
/** «8,8 pts · media últimas 4» */
export const textoMediaValor = (m: number | null, n: number) => (m == null ? "sin jornadas" : `${pts(m)} pts · media últimas ${n}`);
