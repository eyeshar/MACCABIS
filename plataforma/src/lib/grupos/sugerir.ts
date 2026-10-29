// Grupos de entreno (D122, D143, D147): la sugerencia, PURA y determinista (la usan la pantalla de Gestion y las pruebas).
// Entrada: SOLO los que dicen «Voy» (los «Duda» van aparte). El tamaño es aproximado: grupos = N / tamaño redondeado,
// sin pasar de suelo(N / 5) (ningun grupo por debajo del quinteto si se puede) y como minimo 1; los que sobran, de uno
// en uno como sextos o septimos (17 de 5 o de 6 → 6, 6, 5). Nivel global A=5 … E=1; sin nivel cuenta como C (3).
// D147 (corrige D143): la ESTRUCTURA manda sobre el nivel. Prioridades, en este orden:
//   1) cada grupo con su quinteto: 1 base (puro o de reserva), 2 exteriores (escoltas y aleros) y 2 interiores (pivots
//      y ala-pivots); en grupos de menos de 5, 1 base, 1 exterior y 1 interior. Si falta, en este orden: base de reserva;
//      un base sobrante hace de exterior; un comodin (sin posicion) rellena; un interior hace de exterior o un exterior
//      de interior (con aviso); si aun asi falta, el grupo va sin base o incompleto (con aviso);
//   2) los que pasan de 5 («uno más»), repartidos por lineas: no dos sextos de la misma linea en un grupo si se puede;
//   3) jugadores A repartidos (diferencia maxima 1) y nivel medio por grupo lo mas parejo posible;
//   4) opcional y el ultimo: si hay convocatoria del siguiente partido, juntar a los que juegan juntos (mas parejas de
//      compañeros del mismo equipo en el mismo grupo), solo entre repartos que empatan en 1-2 (y en los A) y cuya
//      diferencia de nivel medio queda como mucho 0,2 por encima de la mejor. Sin convocatoria no se aplica y el
//      resultado es el mismo que sin el criterio.
// Metodo: un reparto voraz y repartos de partida pseudoaleatorios con semilla fija; cada uno se mejora con
// intercambios entre grupos mientras mejore la puntuacion. Las combinaciones distintas que empatan en todas las
// prioridades son las «otras sugerencias» (en orden fijo: mismos datos, mismo resultado).
import { LINEA_DE, type Linea, type Nivel, type Posicion } from "../convocatoria/motor.ts";

export type JugadorGrupo = { person_id: string; nombre: string; posicion: Posicion | null; base_reserva: boolean; nivel: Nivel | null };
/** Equipos de cada jugador en la convocatoria del siguiente partido (aprobada o propuesta por el motor). */
export type Juntos = Record<string, string[]>;
export type EntradaGrupos = { van: JugadorGrupo[]; tamano: number; variante?: number; juntos?: Juntos | null };
export type Grupo = { nombre: string; personas: string[] };
export type Sugerencia = { grupos: Grupo[]; variante: number; variantes: number };
export type LineaGrupo = Linea | "comodin";
export type Papel = Linea;
export type DatosJugador = Pick<JugadorGrupo, "person_id" | "posicion" | "base_reserva" | "nivel">;

const VALOR: Record<Nivel, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 };
const PARTIDAS = 160;
/** Margen del criterio 4: la diferencia de nivel medio puede subir como mucho esto sobre la mejor. */
export const MARGEN_JUNTOS = 0.2;
export const valorNivel = (j: Pick<JugadorGrupo, "nivel">) => (j.nivel ? VALOR[j.nivel] : 3);
export const lineaGrupo = (j: Pick<JugadorGrupo, "posicion" | "base_reserva">): LineaGrupo =>
  j.base_reserva || j.posicion === "base" ? "base" : j.posicion ? LINEA_DE[j.posicion] : "comodin";

/** Clase para la estructura: base Puro, base de Reserva, eXterior, Interior o Comodin (sin posicion). */
type Clase = "P" | "R" | "X" | "I" | "C";
const clase = (j: Pick<JugadorGrupo, "posicion" | "base_reserva">): Clase =>
  j.posicion === "base" ? "P" : j.base_reserva ? "R" : !j.posicion ? "C" : LINEA_DE[j.posicion] === "interior" ? "I" : "X";
/** La linea en la que juega si no hace de otra cosa; un base de reserva que no hace de base es exterior. */
const natural: Record<Clase, Papel | null> = { P: "base", R: "exterior", X: "exterior", I: "interior", C: null };

/** Tamaños de los grupos (D147): redondo(N / tamaño) grupos, sin pasar de suelo(N / 5) y como minimo 1; lo mas
 *  iguales posible, los mayores primero (17 de 5 → 6, 6, 5; 22 de 6 → 6, 6, 5, 5; 12 de 5 → 6, 6). */
export function tamanos(n: number, tamano: number): number[] {
  if (n <= 0) return [];
  const k = Math.max(1, Math.min(Math.round(n / tamano), Math.floor(n / 5)));
  return Array.from({ length: k }, (_, i) => Math.floor(n / k) + (i < n % k ? 1 : 0));
}

/** Lo que pide la estructura segun el tamaño del grupo: el quinteto (1, 2, 2) desde 5; por debajo, 1, 1 y 1. */
export function necesidades(n: number): Record<Papel, number> {
  if (n >= 5) return { base: 1, exterior: 2, interior: 2 };
  return { base: n >= 1 ? 1 : 0, exterior: n >= 2 ? 1 : 0, interior: n >= 3 ? 1 : 0 };
}

/** Un hueco de la estructura que no cubre alguien de su linea: «por» es quien lo cubre (null = nadie). */
export type Falta = { papel: Papel; por: "base" | "exterior" | "interior" | "comodin" | null };
export type Estructura = {
  papel: Map<string, Papel>; cuenta: Record<Papel, number>; extras: Record<Papel, number>; faltas: Falta[];
  /** Bases puros que hacen de exterior: vale sin aviso, pero mejor un exterior si lo hay. */
  suaves: number;
};

/** Papel de cada jugador en su grupo (determinista: por nivel y despues por id). */
export function estructuraGrupo(js: DatosJugador[]): Estructura {
  const orden = [...js].sort((a, b) => valorNivel(b) - valorNivel(a) || a.person_id.localeCompare(b.person_id));
  const por: Record<Clase, DatosJugador[]> = { P: [], R: [], X: [], I: [], C: [] };
  for (const j of orden) por[clase(j)].push(j);
  const necesita = necesidades(js.length);
  const papel = new Map<string, Papel>();
  const faltas: Falta[] = [];
  const toma = (c: Clase, n: number, p: Papel) => { const t = por[c].splice(0, Math.max(0, n)); for (const j of t) papel.set(j.person_id, p); return t.length; };
  // 1 base: puro, de reserva o, si no hay, un comodin (sigue siendo «sin base»).
  if (necesita.base && !toma("P", 1, "base") && !toma("R", 1, "base")) faltas.push({ papel: "base", por: toma("C", 1, "base") ? "comodin" : null });
  // Exteriores e interiores de su linea; un base de reserva que no hace de base ya es exterior.
  let e = toma("X", necesita.exterior, "exterior");
  e += toma("R", necesita.exterior - e, "exterior");
  let i = toma("I", necesita.interior, "interior");
  // Un base sobrante hace de exterior (sin aviso); despues, los comodines rellenan.
  const suaves = toma("P", necesita.exterior - e, "exterior");
  e += suaves;
  e += toma("C", necesita.exterior - e, "exterior");
  i += toma("C", necesita.interior - i, "interior");
  // Fuera de su linea, con aviso: un interior de exterior; un exterior (o un base) de interior.
  for (; e < necesita.exterior && por.I.length; e++) { toma("I", 1, "exterior"); faltas.push({ papel: "exterior", por: "interior" }); }
  for (; i < necesita.interior; i++) {
    const c = (["X", "R", "P"] as Clase[]).find((x) => por[x].length);
    if (!c) break;
    toma(c, 1, "interior"); faltas.push({ papel: "interior", por: c === "P" ? "base" : "exterior" });
  }
  for (; e < necesita.exterior; e++) faltas.push({ papel: "exterior", por: null });
  for (; i < necesita.interior; i++) faltas.push({ papel: "interior", por: null });
  // Los que sobran («uno más») juegan en su linea; un comodin, en la que menos tenga el grupo.
  const cuenta: Record<Papel, number> = { base: 0, exterior: 0, interior: 0 };
  for (const p of papel.values()) cuenta[p]++;
  const extras: Record<Papel, number> = { base: 0, exterior: 0, interior: 0 };
  for (const c of ["P", "R", "X", "I", "C"] as Clase[]) for (const j of por[c]) {
    const p = natural[c] ?? (cuenta.interior < cuenta.exterior ? "interior" : "exterior");
    papel.set(j.person_id, p); cuenta[p]++; extras[p]++;
  }
  return { papel, cuenta, extras, faltas, suaves };
}

/** Cuantos del grupo juegan juntos el siguiente partido (los mas en un mismo equipo; 0 si no llegan a 2). */
export function juntosEnGrupo(ids: string[], juntos: Juntos | null | undefined): number {
  if (!juntos) return 0;
  const n = new Map<string, number>();
  for (const id of ids) for (const eq of juntos[id] ?? []) n.set(eq, (n.get(eq) ?? 0) + 1);
  const m = Math.max(0, ...n.values());
  return m >= 2 ? m : 0;
}

/** Parejas del grupo que juegan juntas el siguiente partido (lo que mide el criterio 4: juntar, no solo repartir). */
export function parejasJuntas(ids: string[], juntos: Juntos | null | undefined): number {
  if (!juntos) return 0;
  let n = 0;
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) if ((juntos[ids[a]] ?? []).some((eq) => (juntos[ids[b]] ?? []).includes(eq))) n++;
  return n;
}

const redondo = (x: number) => Math.round(x * 1e6) / 1e6;
const media = (g: Pick<JugadorGrupo, "nivel">[]) => (g.length ? redondo(g.reduce((s, j) => s + valorNivel(j), 0) / g.length) : 0);
const exceso = (xs: number[]) => (xs.length ? Math.max(0, Math.max(...xs) - Math.min(...xs) - 1) : 0);

/** Las cifras de un reparto: estructura (sin base, otras faltas, bases puros de exterior, «uno más» repetidos de una
 *  linea en un grupo y reparto de cada linea entre grupos), nivel (exceso de A, diferencia de nivel medio), juntos y la
 *  varianza del nivel medio (solo ordena entre combinaciones igual de buenas). */
type Partes = { estructura: number[]; nivel: number[]; rango: number; juntos: number; varianza: number };
function partes(gs: JugadorGrupo[][], juntos: Juntos | null): Partes {
  const es = gs.map(estructuraGrupo);
  const sinBase = es.reduce((s, e) => s + e.faltas.filter((f) => f.papel === "base").length, 0);
  const otras = es.reduce((s, e) => s + e.faltas.filter((f) => f.papel !== "base").length, 0);
  const suaves = es.reduce((s, e) => s + e.suaves, 0);
  const grandes = es.filter((_, k) => gs[k].length >= 5);
  const repetidos = grandes.reduce((s, e) => s + Object.values(e.extras).reduce((t, x) => t + Math.max(0, x - 1), 0), 0);
  const reparto = (["base", "exterior", "interior"] as Papel[]).reduce((s, p) => s + exceso(grandes.map((e) => e.extras[p])), 0);
  const M = gs.map(media);
  const rango = redondo(Math.max(...M) - Math.min(...M));
  const m = M.reduce((s, x) => s + x, 0) / M.length;
  return {
    estructura: [sinBase, otras, suaves, repetidos, reparto],
    nivel: [exceso(gs.map((g) => g.filter((j) => j.nivel === "A").length)), rango],
    rango, juntos: juntos ? gs.reduce((s, g) => s + parejasJuntas(g.map((j) => j.person_id), juntos), 0) : 0,
    varianza: redondo(M.reduce((s, x) => s + (x - m) ** 2, 0)),
  };
}
/** Puntuacion (menor es mejor, en orden). Sin el criterio 4: estructura, nivel y varianza. Con el: la diferencia de
 *  nivel medio por encima del techo (la mejor + 0,2) cuenta antes que los juntos y, dentro del techo, mandan los juntos. */
const puntuacion = (x: Partes, techo: number | null): number[] =>
  techo === null ? [...x.estructura, ...x.nivel, x.varianza] : [...x.estructura, x.nivel[0], Math.max(0, redondo(x.rango - techo)), -x.juntos, x.rango, x.varianza];
const compara = (a: number[], b: number[], n = a.length) => { for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; };

/** Reparto voraz de partida: bases, exteriores, interiores y comodines, cada linea de mas a menos nivel; cada jugador
 *  al grupo con hueco que menos tenga de su linea y, a igualdad, menos nivel acumulado. */
function voraz(js: JugadorGrupo[], tam: number[]): JugadorGrupo[][] {
  const gs: JugadorGrupo[][] = tam.map(() => []);
  const orden: Clase[] = ["P", "R", "X", "I", "C"];
  const lista = [...js].sort((a, b) => orden.indexOf(clase(a)) - orden.indexOf(clase(b)) || valorNivel(b) - valorNivel(a) || a.person_id.localeCompare(b.person_id));
  const suma = (g: JugadorGrupo[]) => g.reduce((s, j) => s + valorNivel(j), 0);
  for (const j of lista) {
    const l = lineaGrupo(j);
    const de = (g: JugadorGrupo[]) => g.filter((x) => lineaGrupo(x) === l).length;
    let mejor = -1;
    for (let i = 0; i < gs.length; i++) {
      if (gs[i].length >= tam[i]) continue;
      if (mejor < 0) { mejor = i; continue; }
      if ((de(gs[i]) - de(gs[mejor]) || suma(gs[i]) - suma(gs[mejor])) < 0) mejor = i;
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
function mejorar(gs: JugadorGrupo[][], juntos: Juntos | null, techo: number | null): { gs: JugadorGrupo[][]; x: Partes; p: number[] } {
  let x = partes(gs, juntos), p = puntuacion(x, techo);
  const igual = (a: JugadorGrupo, b: JugadorGrupo) => clase(a) === clase(b) && valorNivel(a) === valorNivel(b)
    && (!juntos || (juntos[a.person_id] ?? []).join() === (juntos[b.person_id] ?? []).join());
  for (let vueltas = 0; vueltas < 200; vueltas++) {
    let cambio = false;
    for (let a = 0; a < gs.length; a++) for (let b = a + 1; b < gs.length; b++) {
      for (let i = 0; i < gs[a].length; i++) for (let k = 0; k < gs[b].length; k++) {
        const u = gs[a][i], v = gs[b][k];
        if (igual(u, v)) continue;
        gs[a][i] = v; gs[b][k] = u;
        const y = partes(gs, juntos), q = puntuacion(y, techo);
        if (compara(q, p) < 0) { x = y; p = q; cambio = true; } else { gs[a][i] = u; gs[b][k] = v; }
      }
    }
    if (!cambio) break;
  }
  return { gs, x, p };
}

/** Orden fijo de un reparto: cada grupo por person_id; los grupos, los mayores primero y despues por su primer id. */
function canonico(gs: JugadorGrupo[][]): string[][] {
  return gs.map((g) => g.map((j) => j.person_id).sort()).sort((a, b) => b.length - a.length || (a.join() < b.join() ? -1 : 1));
}

type Visto = { g: string[][]; x: Partes; p: number[] };
function buscar(js: JugadorGrupo[], tam: number[], juntos: Juntos | null, techo: number | null, semillas: JugadorGrupo[][][] = []): [string, Visto][] {
  const vistos = new Map<string, Visto>();
  const partida = [...semillas, voraz(js, tam), ...Array.from({ length: PARTIDAS }, (_, s) => alAzar(js, tam, s + 1))];
  for (const inicio of partida) {
    const { gs, x, p } = mejorar(inicio.map((g) => [...g]), juntos, techo);
    const g = canonico(gs);
    const clave = g.map((y) => y.join(",")).join("|");
    if (!vistos.has(clave)) vistos.set(clave, { g, x, p });
  }
  return [...vistos.entries()].sort(([ca, a], [cb, b]) => compara(a.p, b.p) || (ca < cb ? -1 : 1));
}

export function sugerirGrupos(e: EntradaGrupos): Sugerencia {
  // La pantalla y la base van de 3 a 6 por grupo; la funcion admite hasta 8 (las pruebas miran grupos de 7).
  const tamano = Math.min(8, Math.max(3, Math.round(e.tamano || 5)));
  const js = [...e.van].sort((a, b) => a.person_id.localeCompare(b.person_id));
  const tam = tamanos(js.length, tamano);
  if (!tam.length) return { grupos: [], variante: 0, variantes: 0 };
  let todos = buscar(js, tam, null, null);
  // Sin el criterio 4, las mejores empatan en estructura y nivel (la varianza, la ultima cifra, solo ordena).
  let n = puntuacion(todos[0][1].x, null).length - 1;
  // Criterio 4 (opcional): solo si al menos dos de los que van juegan juntos el siguiente partido.
  const juntos = e.juntos && juntosEnGrupo(js.map((j) => j.person_id), e.juntos) >= 2 ? e.juntos : null;
  if (juntos) {
    const mejor = todos[0][1].x;
    const techo = redondo(mejor.rango + MARGEN_JUNTOS);
    const por = new Map(js.map((j) => [j.person_id, j]));
    const semillas = todos.slice(0, 20).map(([, v]) => v.g.map((g) => g.map((id) => por.get(id)!)));
    // Solo valen los que empatan con la mejor en estructura y en los A, y quedan dentro del margen de nivel.
    const validos = buscar(js, tam, juntos, techo, semillas)
      .filter(([, v]) => compara(v.x.estructura, mejor.estructura) === 0 && v.x.nivel[0] === mejor.nivel[0] && v.x.rango <= techo + 1e-9);
    if (validos.length) { todos = validos; n = puntuacion(todos[0][1].x, techo).length - 1; }
  }
  const p0 = todos[0][1].p;
  const mejores = todos.filter(([, x]) => compara(x.p, p0, n) === 0);
  const variante = ((Math.trunc(e.variante ?? 0) % mejores.length) + mejores.length) % mejores.length;
  return { grupos: mejores[variante][1].g.map((personas, i) => ({ nombre: `Grupo ${i + 1}`, personas })), variante, variantes: mejores.length };
}

const TEXTO_PAPEL: Record<Papel, [string, string]> = { base: ["base", "bases"], exterior: ["exterior", "exteriores"], interior: ["interior", "interiores"] };
const nombrePapel = (p: Papel, n: number) => TEXTO_PAPEL[p][n === 1 ? 0 : 1];

/** Lo que falla de la estructura de un grupo, en corto: «sin base», «un interior hace de exterior», «falta un interior». */
export function faltasCortas(f: Falta[]): string[] {
  const out: string[] = [];
  if (f.some((x) => x.papel === "base")) out.push("sin base");
  for (const papel of ["exterior", "interior"] as Papel[]) {
    const fs = f.filter((x) => x.papel === papel);
    for (const de of ["interior", "exterior", "base"] as const) {
      const n = fs.filter((x) => x.por === de).length;
      if (n) out.push(`${n === 1 ? "un" : n} ${nombrePapel(de, n)} ${n === 1 ? "hace" : "hacen"} de ${papel}`);
    }
    const vacios = fs.filter((x) => !x.por).length;
    if (vacios) out.push(`${vacios === 1 ? "falta un" : `faltan ${vacios}`} ${nombrePapel(papel, vacios)}`);
  }
  return out;
}

/** Resumen de un grupo para Gestion (nunca para la plantilla): «1 base · 2 ext · 3 int · nivel medio 3,5», con lo que
 *  falla de la estructura y, si hay convocatoria del siguiente partido, cuantos juegan juntos (solo como dato). */
export function resumenGrupo(js: DatosJugador[], siguiente?: { juntos: Juntos; dia: string } | null): { texto: string; cumple: boolean } {
  if (!js.length) return { texto: "", cumple: true };
  const e = estructuraGrupo(js);
  const m = js.reduce((s, j) => s + valorNivel(j), 0) / js.length;
  // Un comodin que hace de base no cuenta como base (el grupo sigue «sin base»).
  const bases = e.cuenta.base - e.faltas.filter((f) => f.papel === "base" && f.por === "comodin").length;
  const trozos = [`${bases} ${bases === 1 ? "base" : "bases"}`, `${e.cuenta.exterior} ext`, `${e.cuenta.interior} int`, `nivel medio ${m.toFixed(1).replace(".", ",")}`];
  const f = faltasCortas(e.faltas);
  if (f.length) trozos.push(`no cumple: ${f.join(", ")}`);
  const n = siguiente ? juntosEnGrupo(js.map((j) => j.person_id), siguiente.juntos) : 0;
  if (n && siguiente) trozos.push(`${n} de ${js.length} juegan juntos el ${siguiente.dia}`);
  return { texto: trozos.join(" · "), cumple: !f.length };
}

/** La etiqueta de la tarjeta cuando su papel en el grupo no coincide con su posicion («hace de base»); si no, null. */
export function etiquetaPapel(j: Pick<JugadorGrupo, "posicion" | "base_reserva">, papel: Papel | undefined): string | null {
  if (!papel) return null;
  return natural[clase(j)] === papel ? null : `hace de ${papel}`;
}

/** Avisos de estructura del reparto, claros y concretos («Grupo 2 sin base: no hay bases suficientes»). Solo Gestion.
 *  Si en otro grupo sobra alguien de esa linea (por ejemplo, tras mover a mano), se dice donde. */
export function avisosEstructura(grupos: { nombre: string; js: DatosJugador[] }[]): string[] {
  const es = grupos.map((g) => (g.js.length ? estructuraGrupo(g.js) : null));
  const sobraEn = (papel: Papel, menos: number) => {
    const k = es.findIndex((e, i) => i !== menos && !!e && (papel === "base"
      ? grupos[i].js.filter((j) => ["P", "R"].includes(clase(j))).length > 1
      : e.extras[papel] > 0));
    return k >= 0 ? grupos[k].nombre : null;
  };
  const out: string[] = [];
  es.forEach((e, i) => {
    if (!e) return;
    const g = grupos[i].nombre;
    const motivo = (papel: Papel) => { const otro = sobraEn(papel, i); return otro ? `en ${otro} sobra uno` : `no hay ${nombrePapel(papel, 2)} suficientes`; };
    const base = e.faltas.find((f) => f.papel === "base");
    if (base) out.push(`${g} sin base${base.por === "comodin" ? " (hace de base uno sin posición)" : ""}: ${motivo("base")}.`);
    for (const papel of ["exterior", "interior"] as Papel[]) {
      const fs = e.faltas.filter((f) => f.papel === papel);
      if (fs.length) out.push(`${g}: ${faltasCortas(fs).join(", ")}: ${motivo(papel)}.`);
    }
  });
  return out;
}

/** Mensaje de WhatsApp con los grupos: solo nombres (nunca niveles ni el criterio). */
export function mensajeGrupos(titulo: string, grupos: { nombre: string; personas: string[] }[], nombreDe: (id: string) => string) {
  return [`${titulo}:`, ...grupos.filter((g) => g.personas.length).map((g) => `${g.nombre}: ${g.personas.map(nombreDe).join(", ")}`)].join("\n");
}
