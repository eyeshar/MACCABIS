// «Partidos convocado» de cada jugador en la temporada (rotación del motor, REGLAS_CONVOCATORIA): funciones PURAS (`node`
// carga este fichero tal cual en las pruebas). Dos fuentes, sin contar dos veces:
//   - las hojas de estadística cargadas (season_2026-27.json): quien sale en la hoja de un partido estuvo convocado;
//   - las convocatorias APROBADAS de los domingos ya pasados, para los partidos que aún no tienen hoja.
// Las hojas mandan cuando existen (D72): un partido (fecha y equipo) con hoja se cuenta solo por la hoja, aunque la
// convocatoria aprobada dijera otra cosa (un recambio de última hora, alguien que no se presentó…).

export type EquipoHoja = "MDA" | "MDL";
export type HojasJugador = { convocados: number; porFecha: Map<string, Set<string>> };
export type Aprobada = { fecha: string; equipos: Record<string, { person_id: string }[] | undefined> | null };

const NORM: Record<string, EquipoHoja | undefined> = { MDA: "MDA", MDL: "MDL", MdA: "MDA", MdL: "MDL" };

/** Partidos convocado y domingos doblados por persona. `hojas`: lo de las hojas por persona; `conHoja`: los partidos con
 *  hoja («2026-11-08|MDL»); `aprobadas`: las convocatorias aprobadas de domingos YA PASADOS. */
export function partidosConvocado(hojas: Map<string, HojasJugador>, conHoja: Set<string>, aprobadas: Aprobada[]) {
  const porFecha = new Map<string, Map<string, Set<string>>>(); // persona -> fecha -> equipos
  const extra = new Map<string, number>();
  for (const [p, h] of hojas) porFecha.set(p, new Map([...h.porFecha].map(([f, s]) => [f, new Set([...s].map((e) => NORM[e] ?? e))])));
  for (const c of aprobadas) {
    for (const [eq, lista] of Object.entries(c.equipos ?? {})) {
      const e = NORM[eq];
      if (!e || conHoja.has(`${c.fecha}|${e}`)) continue;
      for (const { person_id: p } of lista ?? []) {
        const m = porFecha.get(p) ?? new Map<string, Set<string>>();
        const s = m.get(c.fecha) ?? new Set<string>();
        if (s.has(e)) continue;
        s.add(e); m.set(c.fecha, s); porFecha.set(p, m);
        extra.set(p, (extra.get(p) ?? 0) + 1);
      }
    }
  }
  const out = new Map<string, { convocados: number; doblajes: number; fechas: Set<string> }>();
  for (const [p, m] of porFecha) {
    out.set(p, { convocados: (hojas.get(p)?.convocados ?? 0) + (extra.get(p) ?? 0), doblajes: [...m.values()].filter((s) => s.size === 2).length, fechas: new Set(m.keys()) });
  }
  return out;
}
