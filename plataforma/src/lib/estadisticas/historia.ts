// Historia del club ("El Club"), migrada de GitHub Pages: rejilla de personas × temporadas, dos modos de orden excluyentes
// (D22), tira temporal y ficha de persona. Funciones puras para poder probarlas con node. Las de index.html hasta que la
// 26/27 paso de «prevista» a «en curso» (D137): desde entonces GitHub Pages (que solo redirige) se queda como estaba.

export const ANIOS = ["2013", "2014", "2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"];
/** Temporada en curso (D137): cuenta en la rejilla y en las temporadas de cada persona, no en la media por temporada. */
export const EN_CURSO = "2026";
/** Temporadas terminadas (las que entran en la plantilla media). */
export const ANIOS_TERMINADOS = ANIOS.filter((y) => y !== EN_CURSO);
/** "2013" -> "13/14" */
export const etiquetaAnio = (y: string) => y.slice(2) + "/" + String(+y + 1).slice(2);
/** "2013" -> "2013-14" */
export const temporadaDeAnio = (y: string) => y + "-" + String(+y + 1).slice(2);
export const norm = (s: string) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Una persona del club: presencia por año (historia_club.json), identidad (personas.json) y temporadas con estadisticas. */
export type PersonaH = {
  person_id: string; display: string; formal: string; temporadas_jugadas: string[]; n_temporadas: number;
  solo_mote: boolean; es_entrenador: boolean;
  /** De paso con nombre: estuvo en el club sin llegar a debutar, solo entrenó (D166). */
  de_paso?: boolean;
  /** Temporadas con estadisticas (indice de personas.json). */
  stats: string[];
  /** A donde lleva cada una de esas temporadas: su ficha en /jugador, o (si solo hay resumen agregado del MdA) la pestaña MdA. */
  destinos: Record<string, "ficha" | "mda" | null>;
};

export const ordenBase = (a: PersonaH, b: PersonaH) => b.n_temporadas - a.n_temporadas || a.display.localeCompare(b.display);

export const TRAMOS = [
  { min: 10, tit: "Históricos · 10 temporadas o más" },
  { min: 5, tit: "Veteranos · 5 a 9 temporadas" },
  { min: 2, tit: "De varias temporadas · 2 a 4" },
  { min: 1, tit: "De una sola temporada" },
];

export type Filtros = { buscar: string; quien: "ALL" | "STATS" | "NOSTATS"; orden: "veterania" | "debut" };

export function pasaFiltro(p: PersonaH, f: Filtros) {
  if (f.buscar && !norm(p.display).includes(f.buscar) && !norm(p.formal || "").includes(f.buscar)) return false;
  if (f.quien === "STATS" && !p.stats.length) return false;
  if (f.quien === "NOSTATS" && p.stats.length) return false;
  return true;
}

/** Filas de la rejilla: jugadores (lista plana por debut, o por tramos de veteranía; los dos modos son excluyentes) y cuerpo técnico aparte. */
export function filasRejilla(P: PersonaH[], f: Filtros) {
  const jug = P.filter((p) => !p.es_entrenador && pasaFiltro(p, f));
  const tec = P.filter((p) => p.es_entrenador && pasaFiltro(p, f));
  if (f.orden === "debut") {
    // A igual debut, primero quien mas temporadas acumulo. Lista plana, sin tramos.
    jug.sort((a, b) => (a.temporadas_jugadas[0] || "9999").localeCompare(b.temporadas_jugadas[0] || "9999") || b.n_temporadas - a.n_temporadas || a.display.localeCompare(b.display));
    return { tramos: [{ tit: null as string | null, personas: jug }], tecnico: tec, nJug: jug.length };
  }
  const tramos = TRAMOS.map((t, i) => ({ tit: t.tit as string | null, personas: jug.filter((p) => p.n_temporadas >= t.min && (i === 0 || p.n_temporadas < TRAMOS[i - 1].min)) })).filter((t) => t.personas.length);
  return { tramos, tecnico: tec, nJug: jug.length };
}

export function kpisHistoria(P: PersonaH[]) {
  const jug = P.filter((p) => !p.es_entrenador && p.n_temporadas > 0); // un «solo entreno» sin temporadas no ha vestido la camiseta
  const top = jug[0];
  // La media, solo con temporadas terminadas: la en curso aún puede tener altas.
  const media = Math.round(ANIOS_TERMINADOS.reduce((a, y) => a + jug.filter((p) => p.temporadas_jugadas.includes(y)).length, 0) / ANIOS_TERMINADOS.length);
  return {
    personas: jug.length, top, media,
    // «De paso»: una sola temporada, y ya terminada (quien debuta en la en curso aún no ha pasado de largo).
    fugaces: jug.filter((p) => p.n_temporadas === 1 && !p.temporadas_jugadas.includes(EN_CURSO)).length,
    conStats: jug.filter((p) => p.stats.length > 0).length,
  };
}

/** Tira temporal: por año, jugadores, altas (no estaban el año anterior) y bajas (estaban y no siguieron). */
export function tiraTemporal(P: PersonaH[]) {
  const J = P.filter((p) => !p.es_entrenador);
  const de = (y: string) => J.filter((p) => p.temporadas_jugadas.includes(y));
  return ANIOS.map((y, i) => {
    const hoy = de(y), ayer = i ? de(ANIOS[i - 1]) : [];
    return { y, jugadores: hoy.length, altas: hoy.filter((p) => !ayer.some((q) => q.person_id === p.person_id)), bajas: ayer.filter((p) => !hoy.some((q) => q.person_id === p.person_id)) };
  });
}

/** Por que una persona no tiene estadisticas. */
export function motivoSinStats(p: PersonaH) {
  return p.n_temporadas === 1 && p.temporadas_jugadas.includes(EN_CURSO) && !p.es_entrenador ? "Primera temporada en el club (2026/27, en curso): todavía no ha jugado ningún partido."
    : p.es_entrenador ? "Es el entrenador: nunca jugó, así que no tiene estadísticas de jugador."
    : p.solo_mote ? "Jugador de paso del que sólo se conserva el mote, sin ficha ni estadísticas."
    : p.de_paso ? "Jugador de paso: entrenó con el equipo sin llegar a debutar, así que no tiene estadísticas."
    : "De las temporadas en que estuvo en el club no se conservan estadísticas suyas (años sin actas, o jugó en la ficha que no las registraba).";
}
