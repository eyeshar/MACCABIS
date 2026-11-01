// Contraste de la clasificacion calculada (la de las hojas, data/liga_2026-27.json) con la oficial de Deportes/web
// (D74, rutina B de los jueves). Funciones PURAS: la pantalla /gestion/clasificacion y la prueba las usan igual.
//
// Lineas que pega la rutina B, una por equipo y grupo (las de Deportes/web, «General por equipos de la jornada»):
//   grupo;equipo;puntos;J;G;P;TF;TC;Sanc        p. ej.  G1;MACCABI DE ACOSTAR;6;3;3;0;192;71;0
// Tambien acepta tabuladores (copiar y pegar la tabla) y una cabecera, que se ignora.

export type FilaCalculada = { equipo: string; pj: number; g: number; p: number; pf: number; pc: number; pts: number | null };
export type GrupoCalculado = { jornadas: number[]; clasificacion: FilaCalculada[] };
export type FilaOficial = { grupo: string; equipo: string; pts: number; pj: number; g: number; p: number; pf: number; pc: number; sanc: number };

export type Diferencia = { grupo: string; equipo: string; campo: string; calculada: string; oficial: string };
export type Contraste = {
  errores: string[];                 // lineas que no se entienden
  diferencias: Diferencia[];
  sinPareja: { grupo: string; equipo: string; falta: "en la oficial" | "en la calculada" }[];
  sanciones: { grupo: string; equipo: string; sanc: number }[];
  jornadaCalculada: Record<string, number>;   // ultima jornada cargada en la calculada, por grupo
  coincide: boolean;
};

const CAMPOS: [keyof FilaCalculada & keyof FilaOficial, string][] = [["pts", "puntos"], ["pj", "J"], ["g", "G"], ["p", "P"], ["pf", "TF"], ["pc", "TC"]];

/** Clave para casar nombres: minusculas, sin tildes, comillas ni puntos, espacios simples. Nuestros equipos, por su
 *  nombre largo o corto (el Ayuntamiento escribe «MACCABI DE ACOSTAR»; la calculada, «MdA»). */
export function claveEquipo(nombre: string) {
  const k = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/�/g, "n").replace(/["'“”‘’`´.]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  if (k === "maccabi de acostar" || k === "mda") return "mda";
  if (k === "maccabi de levantar" || k === "mdl") return "mdl";
  return k;
}

export function leerOficial(texto: string): { filas: FilaOficial[]; errores: string[] } {
  const filas: FilaOficial[] = [];
  const errores: string[] = [];
  for (const [i, bruta] of texto.split(/\r?\n/).entries()) {
    const linea = bruta.trim();
    if (!linea) continue;
    const c = linea.split(/;|\t/).map((x) => x.trim());
    if (i === 0 && /grupo/i.test(c[0] ?? "") && /equipo/i.test(c[1] ?? "")) continue; // cabecera
    const grupo = (c[0] ?? "").toUpperCase().replace(/^.*\b(G\d)$/, "$1");
    const nums = c.slice(2, 9).map((x) => Number(x));
    if (!/^G\d$/.test(grupo) || !c[1] || c.length < 9 || nums.some((n) => !Number.isInteger(n) || n < 0)) {
      errores.push(`Línea ${i + 1}: «${linea}» (formato: grupo;equipo;puntos;J;G;P;TF;TC;Sanc)`);
      continue;
    }
    const [pts, pj, g, p, pf, pc, sanc] = nums;
    filas.push({ grupo, equipo: c[1], pts, pj, g, p, pf, pc, sanc });
  }
  return { filas, errores };
}

/** Compara la oficial pegada con la calculada de los grupos que aparecen en lo pegado. */
export function contrastar(calculada: Record<string, GrupoCalculado>, texto: string): Contraste {
  const { filas, errores } = leerOficial(texto);
  const diferencias: Diferencia[] = [];
  const sinPareja: Contraste["sinPareja"] = [];
  const grupos = [...new Set(filas.map((f) => f.grupo))].sort();
  const jornadaCalculada: Record<string, number> = {};
  for (const grupo of grupos) {
    const calc = calculada[grupo];
    if (!calc) { errores.push(`El grupo ${grupo} no está en la clasificación calculada.`); continue; }
    jornadaCalculada[grupo] = Math.max(0, ...calc.jornadas);
    const porClave = new Map(calc.clasificacion.map((x) => [claveEquipo(x.equipo), x]));
    const vistos = new Set<string>();
    for (const o of filas.filter((f) => f.grupo === grupo)) {
      const k = claveEquipo(o.equipo);
      const x = porClave.get(k);
      if (!x) { sinPareja.push({ grupo, equipo: o.equipo, falta: "en la calculada" }); continue; }
      vistos.add(k);
      for (const [campo, texto] of CAMPOS) {
        const vc = x[campo];
        if (vc === o[campo]) continue;
        diferencias.push({ grupo, equipo: x.equipo, campo: texto, calculada: vc == null ? "pendiente de la oficial" : String(vc), oficial: String(o[campo]) });
      }
    }
    for (const x of calc.clasificacion) if (!vistos.has(claveEquipo(x.equipo))) sinPareja.push({ grupo, equipo: x.equipo, falta: "en la oficial" });
  }
  const sanciones = filas.filter((f) => f.sanc > 0).map((f) => ({ grupo: f.grupo, equipo: f.equipo, sanc: f.sanc }));
  return { errores, diferencias, sinPareja, sanciones, jornadaCalculada, coincide: filas.length > 0 && !errores.length && !diferencias.length && !sinPareja.length };
}

/** El texto que la rutina B copia en su informe a Iván. */
export function textoInforme(c: Contraste) {
  const jornadas = Object.entries(c.jornadaCalculada).map(([g, j]) => `${g} hasta la J${j}`).join(", ");
  const lineas: string[] = [];
  if (c.coincide) lineas.push(`Clasificación: la calculada (${jornadas}) COINCIDE con la oficial.`);
  else {
    const n = c.diferencias.length + c.sinPareja.length + c.errores.length;
    lineas.push(`Clasificación: DIFIERE de la oficial (${n} ${n === 1 ? "diferencia" : "diferencias"}; calculada ${jornadas || "sin datos"}).`);
    for (const d of c.diferencias) lineas.push(`- ${d.grupo} ${d.equipo}: ${d.campo} calculada ${d.calculada} · oficial ${d.oficial}`);
    for (const s of c.sinPareja) lineas.push(`- ${s.grupo} ${s.equipo}: no está ${s.falta}`);
    for (const e of c.errores) lineas.push(`- ${e}`);
  }
  for (const s of c.sanciones) lineas.push(`- Sanc ${s.sanc} en ${s.grupo} ${s.equipo}: Iván decide (no se consulta más).`);
  return lineas.join("\n");
}
