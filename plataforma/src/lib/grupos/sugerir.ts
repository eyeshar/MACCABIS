// Grupos de entreno (D121): la sugerencia, PURA y determinista (la usan la pantalla de Gestion y las pruebas).
// Base: los que dicen «Voy» al entreno. Junta a los que van a jugar juntos el siguiente domingo con partido (la
// convocatoria aprobada o, si no la hay, la propuesta del motor); dentro de cada equipo, grupos equilibrados por linea
// (base, exteriores, interiores) y por nivel. Quien no juega el domingo completa los grupos mas cortos, priorizando la
// linea que falte. Quien dobla va con el equipo cuyo partido es mas dificil o, si es igual, con el que tenga menos. Sin
// partido, un reparto equilibrado. Los grupos no cuentan para nada mas.
import { LINEA_DE, type Dificultad, type Equipo, type Linea, type Nivel, type Posicion } from "../convocatoria/motor.ts";

export type JugadorGrupo = { person_id: string; nombre: string; posicion: Posicion | null; base_reserva: boolean; nivel: Nivel | null };
export type DomingoGrupos = { fecha: string; equipos: Partial<Record<Equipo, string[]>>; dificultad: Partial<Record<Equipo, Dificultad>> };
export type EntradaGrupos = { van: JugadorGrupo[]; tamano: number; domingo: DomingoGrupos | null };
export type Grupo = { nombre: string; personas: string[]; explica: string };

const VALOR: Record<Nivel, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 };
const DIF: Record<Dificultad, number> = { alta: 3, media: 2, baja: 1 };
const ORDEN_LINEA: Record<Linea, number> = { base: 0, exterior: 1, interior: 2 };
const nivel = (j: JugadorGrupo) => VALOR[j.nivel ?? "C"];
const linea = (j: JugadorGrupo): Linea => (j.posicion ? LINEA_DE[j.posicion] : "exterior");
const haceDeBase = (j: JugadorGrupo) => linea(j) === "base" || j.base_reserva;
const dia = (f: string) => +f.slice(8, 10);

type Caja = { personas: JugadorGrupo[]; explica: string; completa: string[] };

/** Reparte una lista en `k` grupos equilibrados por linea y nivel: de mejor a peor dentro de cada linea, cada uno al
 *  grupo con menos de su linea; a igualdad, al de menos nivel acumulado y despues al mas corto. */
function repartir(js: JugadorGrupo[], k: number): JugadorGrupo[][] {
  const g: JugadorGrupo[][] = Array.from({ length: Math.max(1, k) }, () => []);
  const orden = [...js].sort((a, b) => ORDEN_LINEA[linea(a)] - ORDEN_LINEA[linea(b)] || nivel(b) - nivel(a) || a.person_id.localeCompare(b.person_id));
  const suma = (x: JugadorGrupo[]) => x.reduce((s, j) => s + nivel(j), 0);
  for (const j of orden) {
    const l = linea(j);
    let mejor = 0;
    for (let i = 1; i < g.length; i++) {
      const a = g[i], b = g[mejor];
      const la = a.filter((x) => linea(x) === l).length, lb = b.filter((x) => linea(x) === l).length;
      if (la < lb || (la === lb && (suma(a) < suma(b) || (suma(a) === suma(b) && a.length < b.length)))) mejor = i;
    }
    g[mejor].push(j);
  }
  return g;
}

/** La linea que le falta a un grupo: un base (o quien pueda hacer de base); si no, interiores (2); si no, exteriores. */
function faltaEn(g: JugadorGrupo[]): "base" | "interior" | "exterior" | null {
  if (!g.some(haceDeBase)) return "base";
  if (g.filter((j) => linea(j) === "interior").length < 2) return "interior";
  if (g.filter((j) => linea(j) === "exterior").length < 2) return "exterior";
  return null;
}

export function sugerirGrupos(e: EntradaGrupos): Grupo[] {
  const tamano = Math.min(6, Math.max(3, Math.round(e.tamano || 5)));
  const van = new Map(e.van.map((j) => [j.person_id, j]));
  const cajas: Caja[] = [];
  const usados = new Set<string>();
  const nombre = (i: number) => `Grupo ${i + 1}`;

  if (e.domingo) {
    const d = e.domingo;
    const eqs = (["MdA", "MdL"] as Equipo[]).filter((x) => (d.equipos[x] ?? []).length);
    const de = (x: Equipo) => (d.equipos[x] ?? []).filter((id) => van.has(id));
    const enLos2 = eqs.length === 2 ? de("MdA").filter((id) => de("MdL").includes(id)) : [];
    const solo: Record<Equipo, string[]> = { MdA: de("MdA").filter((id) => !enLos2.includes(id)), MdL: de("MdL").filter((id) => !enLos2.includes(id)) };
    // Quien dobla: con el partido mas dificil; si es igual, con el equipo que tenga menos (y a igualdad, el MdA).
    for (const id of enLos2) {
      const a = DIF[d.dificultad.MdA ?? "media"], l = DIF[d.dificultad.MdL ?? "media"];
      const x: Equipo = a > l ? "MdA" : l > a ? "MdL" : solo.MdA.length <= solo.MdL.length ? "MdA" : "MdL";
      solo[x].push(id);
    }
    for (const x of eqs) {
      const js = solo[x].map((id) => van.get(id)!).filter(Boolean);
      if (!js.length) continue;
      for (const g of repartir(js, Math.ceil(js.length / tamano))) {
        for (const j of g) usados.add(j.person_id);
        cajas.push({ personas: g, explica: `${x} del domingo ${dia(d.fecha)}`, completa: [] });
      }
    }
  }

  // Quien no juega el domingo: primero completa los grupos mas cortos, con la linea que les falte.
  let resto = e.van.filter((j) => !usados.has(j.person_id)).sort((a, b) => nivel(b) - nivel(a) || a.person_id.localeCompare(b.person_id));
  while (resto.length) {
    const huecos = cajas.filter((c) => c.personas.length < tamano).sort((a, b) => a.personas.length - b.personas.length);
    if (!huecos.length) break;
    const c = huecos[0];
    const falta = faltaEn(c.personas);
    const media = c.personas.length ? c.personas.reduce((s, j) => s + nivel(j), 0) / c.personas.length : 3;
    const encaja = (j: JugadorGrupo) => (falta === "base" ? haceDeBase(j) : falta ? linea(j) === falta : true);
    const candidatos = resto.filter(encaja);
    const pool = candidatos.length ? candidatos : resto;
    const elegido = [...pool].sort((a, b) => Math.abs(nivel(a) - media) - Math.abs(nivel(b) - media) || a.person_id.localeCompare(b.person_id))[0];
    c.personas.push(elegido);
    c.completa.push(falta === "base" && linea(elegido) !== "base" && elegido.base_reserva ? `${elegido.nombre}, que puede hacer de base` : elegido.nombre);
    resto = resto.filter((j) => j !== elegido);
  }
  // Los que aun quedan (o todos, sin partido): grupos equilibrados.
  if (resto.length) {
    const sin = e.domingo ? "Sin partido el domingo" : "Reparto equilibrado (sin partido el domingo)";
    for (const g of repartir(resto, Math.ceil(resto.length / tamano))) cajas.push({ personas: g, explica: sin, completa: [] });
  }
  return cajas.map((c, i) => ({
    nombre: nombre(i),
    personas: c.personas.map((j) => j.person_id),
    explica: `${c.explica}${c.completa.length ? `; completa ${c.completa.join(" y ")}` : ""}`,
  }));
}

/** Mensaje de WhatsApp con los grupos: solo nombres (nunca niveles ni el criterio). */
export function mensajeGrupos(titulo: string, grupos: { nombre: string; personas: string[] }[], nombreDe: (id: string) => string) {
  return [`${titulo}:`, ...grupos.filter((g) => g.personas.length).map((g) => `${g.nombre}: ${g.personas.map(nombreDe).join(", ")}`)].join("\n");
}
