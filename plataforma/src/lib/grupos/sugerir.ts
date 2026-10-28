// Grupos de entreno (D122, D143): la sugerencia, PURA y determinista (la usan la pantalla de Gestion y las pruebas).
// Entrada: SOLO los que dicen «Voy» (los «Duda» van aparte). Grupos = techo(N / jugadores por grupo), con tamaños lo
// mas iguales posible (17 de 6 en 6 → 6, 6, 5). El equipo del domingo ya no cuenta: los grupos salen nivelados.
// Lineas: bases (puros y de reserva), exteriores (escoltas y aleros), interiores (pivots y ala-pivots); sin posicion,
// comodin. Nivel global A=5 … E=1; sin nivel cuenta como C (3). Prioridades, en este orden:
//   1) cada grupo con un base (o base de reserva) mientras haya, los sobrantes repartidos (diferencia maxima 1);
//   2) interiores parejos (diferencia maxima 1);
//   3) nivel medio por grupo lo mas parejo posible;
//   4) jugadores A repartidos (diferencia maxima 1) y, si un grupo lleva mas A, que no sea tambien el de mas bases ni
//      el de nivel medio mas alto, si hay alternativa igual de buena.
// Metodo: un primer reparto voraz (bases, interiores, exteriores y comodines, cada linea de mas a menos nivel, cada
// jugador al grupo con hueco y menos nivel acumulado) y repartos de partida pseudoaleatorios con semilla fija; cada
// uno se mejora con intercambios entre grupos mientras mejoren las prioridades. Las combinaciones distintas que empatan
// en todas las prioridades son las «otras sugerencias» (en orden fijo: mismos datos, mismo resultado).
import { LINEA_DE, type Linea, type Nivel, type Posicion } from "../convocatoria/motor.ts";

export type JugadorGrupo = { person_id: string; nombre: string; posicion: Posicion | null; base_reserva: boolean; nivel: Nivel | null };
export type EntradaGrupos = { van: JugadorGrupo[]; tamano: number; variante?: number };
export type Grupo = { nombre: string; personas: string[] };
export type Sugerencia = { grupos: Grupo[]; variante: number; variantes: number };
export type LineaGrupo = Linea | "comodin";

const VALOR: Record<Nivel, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 };
const PARTIDAS = 160;
export const valorNivel = (j: Pick<JugadorGrupo, "nivel">) => (j.nivel ? VALOR[j.nivel] : 3);
export const lineaGrupo = (j: Pick<JugadorGrupo, "posicion" | "base_reserva">): LineaGrupo =>
  j.base_reserva || j.posicion === "base" ? "base" : j.posicion ? LINEA_DE[j.posicion] : "comodin";

/** Tamaños de los grupos: techo(N / tamaño) grupos, lo mas iguales posible (los mayores primero). */
export function tamanos(n: number, tamano: number): number[] {
  if (n <= 0) return [];
  const k = Math.max(1, Math.ceil(n / tamano));
  return Array.from({ length: k }, (_, i) => Math.floor(n / k) + (i < n % k ? 1 : 0));
}

const redondo = (x: number) => Math.round(x * 1e6) / 1e6;
const media = (g: JugadorGrupo[]) => (g.length ? redondo(g.reduce((s, j) => s + valorNivel(j), 0) / g.length) : 0);
const exceso = (xs: number[]) => Math.max(0, Math.max(...xs) - Math.min(...xs) - 1);

/** Puntuacion de un reparto (menor es mejor, se compara en orden). Las 6 primeras cifras son las prioridades; la
 *  ultima (varianza del nivel medio) solo ordena entre combinaciones igual de buenas. */
function puntuar(gs: JugadorGrupo[][]): number[] {
  const cuenta = (f: (j: JugadorGrupo) => boolean) => gs.map((g) => g.filter(f).length);
  const B = cuenta((j) => lineaGrupo(j) === "base"), I = cuenta((j) => lineaGrupo(j) === "interior");
  const E = cuenta((j) => lineaGrupo(j) === "exterior"), A = cuenta((j) => j.nivel === "A");
  const M = gs.map(media);
  const rango = redondo(Math.max(...M) - Math.min(...M));
  let choque = 0;
  const masA = Math.max(...A), masB = Math.max(...B), masM = Math.max(...M);
  if (masA > Math.min(...A)) {
    for (let i = 0; i < gs.length; i++) {
      if (A[i] !== masA) continue;
      if (masB > Math.min(...B) && B[i] === masB) choque++;
      if (rango > 0 && M[i] === masM) choque++;
    }
  }
  const m = M.reduce((s, x) => s + x, 0) / M.length;
  return [exceso(B), exceso(I), rango, exceso(A), choque, exceso(E), redondo(M.reduce((s, x) => s + (x - m) ** 2, 0))];
}
const PRIORIDADES = 6;
const compara = (a: number[], b: number[], n = a.length) => { for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; };

/** Reparto voraz: bases, interiores, exteriores y comodines; cada linea de mas a menos nivel; cada jugador al grupo
 *  con hueco y menos nivel acumulado (a igualdad, el que tenga menos de su linea y despues el primero). */
function voraz(js: JugadorGrupo[], tam: number[]): JugadorGrupo[][] {
  const gs: JugadorGrupo[][] = tam.map(() => []);
  const orden: LineaGrupo[] = ["base", "interior", "exterior", "comodin"];
  const lista = [...js].sort((a, b) => orden.indexOf(lineaGrupo(a)) - orden.indexOf(lineaGrupo(b)) || valorNivel(b) - valorNivel(a) || a.person_id.localeCompare(b.person_id));
  const suma = (g: JugadorGrupo[]) => g.reduce((s, j) => s + valorNivel(j), 0);
  for (const j of lista) {
    const l = lineaGrupo(j);
    let mejor = -1;
    for (let i = 0; i < gs.length; i++) {
      if (gs[i].length >= tam[i]) continue;
      if (mejor < 0) { mejor = i; continue; }
      const d = suma(gs[i]) - suma(gs[mejor]);
      if (d < 0 || (d === 0 && gs[i].filter((x) => lineaGrupo(x) === l).length < gs[mejor].filter((x) => lineaGrupo(x) === l).length)) mejor = i;
    }
    gs[mejor].push(j);
  }
  return gs;
}

/** Generador pseudoaleatorio con semilla (mulberry32): mismas semillas, mismos repartos de partida. */
function azar(semilla: number) {
  let a = semilla >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function alAzar(js: JugadorGrupo[], tam: number[], semilla: number): JugadorGrupo[][] {
  const r = azar(semilla), x = [...js];
  for (let i = x.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [x[i], x[k]] = [x[k], x[i]]; }
  let p = 0;
  return tam.map((t) => x.slice(p, (p += t)));
}

/** Mejora con intercambios entre grupos (el primero que mejore, en orden fijo) hasta que ninguno mejore. */
function mejorar(gs: JugadorGrupo[][]): { gs: JugadorGrupo[][]; p: number[] } {
  let p = puntuar(gs);
  for (let vueltas = 0; vueltas < 200; vueltas++) {
    let cambio = false;
    for (let a = 0; a < gs.length; a++) for (let b = a + 1; b < gs.length; b++) {
      for (let i = 0; i < gs[a].length; i++) for (let k = 0; k < gs[b].length; k++) {
        const x = gs[a][i], y = gs[b][k];
        if (valorNivel(x) === valorNivel(y) && lineaGrupo(x) === lineaGrupo(y) && (x.nivel === "A") === (y.nivel === "A")) continue;
        gs[a][i] = y; gs[b][k] = x;
        const q = puntuar(gs);
        if (compara(q, p) < 0) { p = q; cambio = true; } else { gs[a][i] = x; gs[b][k] = y; }
      }
    }
    if (!cambio) break;
  }
  return { gs, p };
}

/** Orden fijo de un reparto: cada grupo por person_id; los grupos, los mayores primero y despues por su primer id. */
function canonico(gs: JugadorGrupo[][]): string[][] {
  return gs.map((g) => g.map((j) => j.person_id).sort()).sort((a, b) => b.length - a.length || (a.join() < b.join() ? -1 : 1));
}

export function sugerirGrupos(e: EntradaGrupos): Sugerencia {
  const tamano = Math.min(6, Math.max(3, Math.round(e.tamano || 5)));
  const js = [...e.van].sort((a, b) => a.person_id.localeCompare(b.person_id));
  const tam = tamanos(js.length, tamano);
  if (!tam.length) return { grupos: [], variante: 0, variantes: 0 };
  const vistos = new Map<string, { g: string[][]; p: number[] }>();
  for (let s = 0; s <= PARTIDAS; s++) {
    const { gs, p } = mejorar(s === 0 ? voraz(js, tam) : alAzar(js, tam, s));
    const g = canonico(gs);
    const clave = g.map((x) => x.join(",")).join("|");
    if (!vistos.has(clave)) vistos.set(clave, { g, p });
  }
  const todos = [...vistos.entries()].sort(([ca, a], [cb, b]) => compara(a.p, b.p) || (ca < cb ? -1 : 1));
  const mejores = todos.filter(([, x]) => compara(x.p, todos[0][1].p, PRIORIDADES) === 0);
  const variante = ((Math.trunc(e.variante ?? 0) % mejores.length) + mejores.length) % mejores.length;
  return { grupos: mejores[variante][1].g.map((personas, i) => ({ nombre: `Grupo ${i + 1}`, personas })), variante, variantes: mejores.length };
}

/** Resumen de un grupo para Gestion (nunca para la plantilla): «Nivel medio 3,5 · 3 interiores · 1 base». */
export function resumenGrupo(js: Pick<JugadorGrupo, "posicion" | "base_reserva" | "nivel">[]): string {
  if (!js.length) return "";
  const m = js.reduce((s, j) => s + valorNivel(j), 0) / js.length;
  const i = js.filter((j) => lineaGrupo(j) === "interior").length, b = js.filter((j) => lineaGrupo(j) === "base").length;
  return `Nivel medio ${m.toFixed(1).replace(".", ",")} · ${i} ${i === 1 ? "interior" : "interiores"} · ${b} ${b === 1 ? "base" : "bases"}`;
}

/** Mensaje de WhatsApp con los grupos: solo nombres (nunca niveles ni el criterio). */
export function mensajeGrupos(titulo: string, grupos: { nombre: string; personas: string[] }[], nombreDe: (id: string) => string) {
  return [`${titulo}:`, ...grupos.filter((g) => g.personas.length).map((g) => `${g.nombre}: ${g.personas.map(nombreDe).join(", ")}`)].join("\n");
}
