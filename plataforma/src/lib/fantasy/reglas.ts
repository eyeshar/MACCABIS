// MdFantasy (D196): parametros del juego. Un solo sitio; los gestores los cambian en /mdfantasy/ajustes
// (fantasy_config.parametros en la base guarda SOLO lo que se ha cambiado; lo demas sale de aqui).
// La copia de la base para las operaciones de mercado es _fantasy_param(clave) (migracion 20261121100000): una prueba
// compara los dos lados (pruebas:fantasy-rls).

export type Parametros = {
  // Rendimiento (por partido)
  puntoPorPunto: number;       // puntos de fantasy por punto anotado
  masMenosDivisor: number;     // el +/- relativo se divide entre esto (2 = la mitad)
  masMenosTope: number;        // tope del +/- relativo, en positivo y en negativo
  bonusDoblete: number;        // dos partidos el mismo domingo: media + esto
  /** Interruptor (0 = apagado, 1 = encendido): si no respondio el mismo en la web antes del plazo y luego juega, su
   *  rendimiento de esa jornada cuenta la mitad (hacia arriba). De salida, APAGADO. */
  mitadSinRespuesta: number;
  // Compromiso (por evento al que esta invitado)
  respuestaRapida: number;     // responde el mismo en `horasRapida` desde el aviso
  respuestaATiempo: number;    // responde el mismo antes del plazo
  sinRespuesta: number;        // no responde
  horasRapida: number;         // horas (sin contar el silencio de 22:30 a 08:00)
  entrenoAsistido: number;     // entreno al que fue de verdad
  planton: number;             // dijo voy y no fue
  topeCompromiso: number;      // tope semanal: lo mas que suma el compromiso de un jugador en una jornada (solo por arriba)
  // Manager
  plantilla: number;           // jugadores en propiedad
  alineados: number;           // los que puntuan cada domingo
  porraAcierto: number;        // por cada partido acertado
  // Mercado (millones)
  valorMinimo: number;
  jornadasValor: number;       // el valor es la media de las ultimas N jornadas con datos
  clausula: number;            // multiplicador del clausulazo
  margenCopias: number;        // copias libres de sobra (0.15 = 15 %)
  margenInicio: number;        // la plantilla inicial vale lo mismo para todos, con este margen
  cajaInicial: number;
  ingresoFijo: number;         // ingreso por jornada
  ingresoPorPunto: number;     // mas esto por cada punto del manager
};

/** Valores de salida. Caja e ingresos, fijados con la simulacion de 2026-27 (docs/MDFANTASY.md). */
export const PARAMETROS: Parametros = {
  puntoPorPunto: 1, masMenosDivisor: 2, masMenosTope: 5, bonusDoblete: 3,
  respuestaRapida: 2, respuestaATiempo: 1, sinRespuesta: -2, horasRapida: 24, entrenoAsistido: 2, planton: -5, topeCompromiso: 6,
  plantilla: 7, alineados: 5, porraAcierto: 3,
  valorMinimo: 4, jornadasValor: 4, clausula: 1.5, margenCopias: 0.15, margenInicio: 0.1,
  cajaInicial: 11, ingresoFijo: 1.5, ingresoPorPunto: 0.04,
  mitadSinRespuesta: 0,
};

export const CLAVES = Object.keys(PARAMETROS) as (keyof Parametros)[];

export type GrupoAjuste = "Rendimiento" | "Compromiso" | "Mánager" | "Mercado";

/** Texto y limites de cada parametro para la pantalla de ajustes. */
export const AJUSTES: Record<keyof Parametros, { texto: string; grupo: GrupoAjuste; min: number; max: number; paso: number; interruptor?: boolean }> = {
  puntoPorPunto: { texto: "Puntos por punto anotado", grupo: "Rendimiento", min: 0, max: 5, paso: 0.5 },
  masMenosDivisor: { texto: "El +/- relativo se divide entre", grupo: "Rendimiento", min: 1, max: 10, paso: 0.5 },
  masMenosTope: { texto: "Tope del +/- relativo (±)", grupo: "Rendimiento", min: 0, max: 20, paso: 1 },
  bonusDoblete: { texto: "Extra por jugar dos partidos el mismo domingo", grupo: "Rendimiento", min: 0, max: 10, paso: 1 },
  respuestaRapida: { texto: "Responder rápido", grupo: "Compromiso", min: 0, max: 10, paso: 1 },
  respuestaATiempo: { texto: "Responder antes del plazo", grupo: "Compromiso", min: 0, max: 10, paso: 1 },
  sinRespuesta: { texto: "No responder", grupo: "Compromiso", min: -10, max: 0, paso: 1 },
  horasRapida: { texto: "Horas para que cuente como rápido", grupo: "Compromiso", min: 1, max: 72, paso: 1 },
  entrenoAsistido: { texto: "Entreno al que fue de verdad", grupo: "Compromiso", min: 0, max: 10, paso: 1 },
  planton: { texto: "Plantón (dijo «voy» y no fue)", grupo: "Compromiso", min: -20, max: 0, paso: 1 },
  topeCompromiso: { texto: "Tope semanal de compromiso (por jugador y jornada)", grupo: "Compromiso", min: 0, max: 30, paso: 1 },
  plantilla: { texto: "Jugadores en la plantilla", grupo: "Mánager", min: 5, max: 12, paso: 1 },
  alineados: { texto: "Jugadores alineados", grupo: "Mánager", min: 1, max: 7, paso: 1 },
  porraAcierto: { texto: "Puntos por acierto de la porra", grupo: "Mánager", min: 0, max: 10, paso: 1 },
  valorMinimo: { texto: "Valor mínimo de un jugador (M)", grupo: "Mercado", min: 1, max: 20, paso: 0.5 },
  jornadasValor: { texto: "Jornadas que cuentan para el valor", grupo: "Mercado", min: 1, max: 10, paso: 1 },
  clausula: { texto: "Multiplicador del clausulazo", grupo: "Mercado", min: 1, max: 3, paso: 0.1 },
  margenCopias: { texto: "Copias libres de sobra (0,15 = 15 %)", grupo: "Mercado", min: 0, max: 1, paso: 0.05 },
  margenInicio: { texto: "Margen de valor de la plantilla inicial (0,1 = ±10 %)", grupo: "Mercado", min: 0, max: 0.5, paso: 0.05 },
  cajaInicial: { texto: "Caja inicial (M)", grupo: "Mercado", min: 0, max: 100, paso: 0.5 },
  ingresoFijo: { texto: "Ingreso fijo por jornada (M)", grupo: "Mercado", min: 0, max: 20, paso: 0.5 },
  ingresoPorPunto: { texto: "Ingreso por punto del mánager (M)", grupo: "Mercado", min: 0, max: 1, paso: 0.01 },
  mitadSinRespuesta: { texto: "Rendimiento a la mitad si no contestó a tiempo", grupo: "Rendimiento", min: 0, max: 1, paso: 1, interruptor: true },
};

/** Los parametros vigentes: los de salida mas lo que hayan cambiado los gestores (solo claves y numeros validos). */
export function parametros(cambiados: unknown): Parametros {
  const p = { ...PARAMETROS };
  if (cambiados && typeof cambiados === "object") {
    const c = cambiados as Record<string, unknown>;
    for (const k of CLAVES) {
      const v = Number(c[k]);
      const a = AJUSTES[k];
      if (c[k] != null && Number.isFinite(v) && v >= a.min && v <= a.max) p[k] = v;
    }
  }
  if (p.alineados > p.plantilla) p.alineados = p.plantilla;
  return p;
}

export const redondeo1 = (n: number) => Math.round(n * 10) / 10;
/** Redondeo simetrico al entero (el .5 se aleja de cero, tambien en negativo). */
export const redondeo = (n: number) => Math.sign(n) * Math.round(Math.abs(n));
/** Millones con un decimal, a la española: «12,5 M». */
export const millones = (n: number) => `${redondeo1(n).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M`;
