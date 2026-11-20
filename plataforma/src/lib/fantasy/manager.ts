// MdFantasy (D196): puntos de un MANAGER, valor de mercado, copias, ingresos y duelos. Logica pura.
import { type Parametros, redondeo1 } from "./reglas.ts";

export type Alineacion = { titulares: string[]; capitan: string | null; vice: string | null };
export type PuntosDe = { rendimiento: number; compromiso: number; total: number; minutos: number };

/** Suma los puntos de los alineados. El capitan dobla SOLO el rendimiento; si no tiene minutos en la hoja, hereda el
 *  vicecapitan (si los tiene). */
export function puntosManager(a: Alineacion, puntos: Map<string, PuntosDe>, aciertosPorra: number, P: Parametros) {
  const titulares = a.titulares.slice(0, P.alineados);
  const de = (id: string | null) => (id ? puntos.get(id) : undefined);
  const conMinutos = (id: string | null) => !!id && titulares.includes(id) && (de(id)?.minutos ?? 0) > 0;
  const dobla = conMinutos(a.capitan) ? a.capitan : conMinutos(a.vice) ? a.vice : null;
  const jugadores = titulares.map((id) => {
    const p = de(id) ?? { rendimiento: 0, compromiso: 0, total: 0, minutos: 0 };
    const doble = id === dobla ? p.rendimiento : 0;
    return { person_id: id, rendimiento: p.rendimiento, compromiso: p.compromiso, base: p.total, doble, total: p.total + doble };
  });
  const alineacion = jugadores.reduce((s, j) => s + j.total, 0);
  const porra = aciertosPorra * P.porraAcierto;
  return { alineacion, porra, total: alineacion + porra, dobla, jugadores };
}

/** Si la alineacion se arrastra de la jornada anterior, el capitan no puede repetir: capitan y vice se cambian. */
export function arrastrar(anterior: Alineacion, plantilla: string[]): Alineacion {
  const titulares = anterior.titulares.filter((id) => plantilla.includes(id));
  const vale = (id: string | null) => (id && titulares.includes(id) ? id : null);
  let capitan = vale(anterior.vice);
  let vice = vale(anterior.capitan);
  if (!capitan) capitan = titulares.find((id) => id !== anterior.capitan) ?? null;
  if (vice === capitan) vice = null;
  return { titulares, capitan, vice };
}

/** Valor de mercado: media de los puntos de las ultimas N jornadas con datos, con un minimo. */
export function valor(totalesRecientesPrimero: number[], P: Parametros) {
  const ult = totalesRecientesPrimero.slice(0, P.jornadasValor);
  if (!ult.length) return P.valorMinimo;
  return Math.max(P.valorMinimo, redondeo1(ult.reduce((s, x) => s + x, 0) / ult.length));
}

/** Copias de cada jugador: las justas para que todos los managers llenen la plantilla, con un poco de margen. */
export function copiasPorJugador(managers: number, elegibles: number, P: Parametros) {
  if (!elegibles) return 0;
  return Math.max(1, Math.ceil((Math.max(1, managers) * P.plantilla * (1 + P.margenCopias)) / elegibles));
}

export const ingreso = (puntos: number, P: Parametros) => redondeo1(P.ingresoFijo + P.ingresoPorPunto * Math.max(0, puntos));
export const precioClausula = (v: number, P: Parametros) => redondeo1(v * P.clausula);

/** Calendario rotatorio (todos contra todos, metodo del circulo). `ronda` empieza en 0; con impares, uno descansa. */
export function duelos(managers: string[], ronda: number): [string, string | null][] {
  const ids = [...managers].sort();
  if (ids.length < 2) return [];
  const lista: (string | null)[] = ids.length % 2 ? [...ids, null] : [...ids];
  const n = lista.length;
  const giro = ((ronda % (n - 1)) + (n - 1)) % (n - 1);
  const resto = lista.slice(1);
  const girado = [lista[0], ...resto.slice(resto.length - giro), ...resto.slice(0, resto.length - giro)];
  const pares: [string, string | null][] = [];
  for (let i = 0; i < n / 2; i++) {
    const a = girado[i], b = girado[n - 1 - i];
    if (a && b) pares.push(a < b ? [a, b] : [b, a]);
    else pares.push([(a ?? b) as string, null]);
  }
  return pares;
}
