// Aviso de RIESGO por equipo (D173, Iván 02/11/2026): solo gestores, recalculado con cada cambio de la convocatoria o de la
// dificultad (cambiar la dificultad NO rehace la propuesta). PURO, sin imports (node lo carga tal cual en las pruebas).
// Nunca sale en un aviso ni mensaje a jugadores; al push de la propuesta del martes solo llega «N aviso(s) de riesgo», sin niveles.
//
//   - Nivel (solo con dos partidos de dificultad distinta, regla 3.1): el equipo del rival más difícil debe llevar MÁS nivel
//     medio que el otro. Igual o menos: riesgo ALTO. Más, pero por menos de `margenNivel` (un cuarto de letra: A = 5 … E = 1):
//     riesgo MEDIO. Con rivales parejos no hay riesgo de nivel (se equilibra, regla 3.2).
//   - Proyección (también con un solo partido): por debajo de la anotación mínima (45, regla 3.3), ALTO; a menos de
//     `margenProyeccion` puntos por encima (45–49), MEDIO («justa»).
// Los umbrales se ajustan aquí (RIESGO); D173 explica por qué estos.

export const RIESGO = { margenNivel: 0.25, margenProyeccion: 5, anotacionMinima: 45 };

type Eq = "MdA" | "MdL";
type Dif = "alta" | "media" | "baja";
const VALOR: Record<Dif, number> = { alta: 3, media: 2, baja: 1 };

export type Riesgo = { equipo: Eq; gravedad: "alto" | "medio"; motivo: "nivel" | "proyeccion"; texto: string };

export function riesgos(
  partidos: { equipo: Eq; dificultad: Dif }[],
  nivelMedio: Partial<Record<Eq, number | null>>,
  proyeccion: Partial<Record<Eq, { puntos: number } | null>>,
  conConvocados: Partial<Record<Eq, number>> = {},
  umbral = RIESGO,
): Riesgo[] {
  const out: Riesgo[] = [];
  if (partidos.length === 2 && VALOR[partidos[0].dificultad] !== VALOR[partidos[1].dificultad]) {
    const [dificil, otro] = [...partidos].sort((a, b) => VALOR[b.dificultad] - VALOR[a.dificultad]);
    const a = nivelMedio[dificil.equipo], b = nivelMedio[otro.equipo];
    if (a != null && b != null && (conConvocados[dificil.equipo] ?? 1) > 0 && (conConvocados[otro.equipo] ?? 1) > 0) {
      if (a <= b) out.push({ equipo: dificil.equipo, gravedad: "alto", motivo: "nivel", texto: `Riesgo alto: el ${dificil.equipo} (rival más difícil) lleva igual o menos nivel medio que el ${otro.equipo}.` });
      else if (a - b < umbral.margenNivel) out.push({ equipo: dificil.equipo, gravedad: "medio", motivo: "nivel", texto: `Riesgo medio: el ${dificil.equipo} (rival más difícil) lleva más nivel medio que el ${otro.equipo}, pero por poco.` });
    }
  }
  for (const p of partidos) {
    const pr = proyeccion[p.equipo];
    if (!pr || (conConvocados[p.equipo] ?? 1) === 0) continue;
    if (pr.puntos < umbral.anotacionMinima) out.push({ equipo: p.equipo, gravedad: "alto", motivo: "proyeccion", texto: `Riesgo alto: proyección por debajo de la anotación mínima (${pr.puntos} de ${umbral.anotacionMinima}).` });
    else if (pr.puntos < umbral.anotacionMinima + umbral.margenProyeccion) out.push({ equipo: p.equipo, gravedad: "medio", motivo: "proyeccion", texto: `Riesgo medio: proyección justa (${pr.puntos}, la mínima es ${umbral.anotacionMinima}).` });
  }
  return out;
}

/** Para el push de la propuesta del martes: solo cuántos avisos de riesgo ALTO hay, sin niveles ni cifras. */
export const textoRiesgoPush = (rs: Riesgo[]) => {
  const n = rs.filter((r) => r.gravedad === "alto").length;
  return n ? `${n} aviso${n === 1 ? "" : "s"} de riesgo` : null;
};
