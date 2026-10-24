// Motor de convocatoria v1 (D107, docs/REGLAS_CONVOCATORIA.md v1): funciones PURAS y deterministas, sin imports ni
// acceso a datos (misma entrada = misma salida; `node` carga este fichero tal cual en las pruebas). Dos modos:
//   - proponer(entrada): reparte a los disponibles del domingo entre los partidos y devuelve propuesta, recuento por
//     lineas, disponibles sin convocar (con su motivo) y avisos, cada uno con la regla que lo causa.
//   - revisar(entrada, convocatoria): una convocatoria ya editada a mano -> solo recuento y avisos, sin cambiarla.
// Los datos privados por jugador (posicion, base de reserva, nivel A-E, Dobla, reglas personales, sancion) llegan en
// la entrada: el motor no sabe de donde salen ni los guarda.

export type Equipo = "MdA" | "MdL";
export type Linea = "base" | "exterior" | "interior";
export type Nivel = "A" | "B" | "C" | "D" | "E";
export type Dificultad = "alta" | "media" | "baja";
export type Posicion = "base" | "escolta" | "alero" | "ala_pivot" | "pivot";
export type RespuestaPartido = "va" | "duda" | "no" | "sin_responder";
export type ReglaPersonal = { tipo: "fijo"; equipo: Equipo } | { tipo: "comodin" } | null;

export const EQUIPOS: Equipo[] = ["MdA", "MdL"];
export const LINEAS: Linea[] = ["base", "exterior", "interior"];
export const NIVELES: Nivel[] = ["A", "B", "C", "D", "E"];
export const POSICIONES: Posicion[] = ["base", "escolta", "alero", "ala_pivot", "pivot"];
export const LINEA_DE: Record<Posicion, Linea> = { base: "base", escolta: "exterior", alero: "exterior", ala_pivot: "interior", pivot: "interior" };
export const TEXTO_POSICION: Record<Posicion, string> = { base: "Base", escolta: "Escolta", alero: "Alero", ala_pivot: "Ala-pívot", pivot: "Pívot" };
export const TEXTO_LINEA: Record<Linea, string> = { base: "bases", exterior: "exteriores", interior: "interiores" };
export const TEXTO_DIFICULTAD: Record<Dificultad, string> = { alta: "Alta", media: "Media", baja: "Baja" };

/** Valores fijos de las reglas v1 (seccion 1 y 2 de REGLAS_CONVOCATORIA.md). */
export const LIMITES = {
  maximo: 10, // por equipo, por defecto
  maximoAmpliado: 12, // tope de la ficha de partido, solo con mas de 20 disponibles
  umbralAmpliar: 20, // "mas de 20 disponibles" amplia; "20 o mas" deja fuera a los "solo entreno"
  minimo: 7, // nunca menos de 7 por equipo
  ideal: { base: 2, exterior: 4, interior: 4 } as Record<Linea, number>,
  minimoLinea: { base: 2, exterior: 3, interior: 3 } as Record<Linea, number>,
  evitarInteriores: 5,
  deudaDomingos: 2, // disponible y sin convocar en sus 2 ultimos domingos disponibles: entra por rotacion (regla 4.2)
};

// ---------------------------------------------------------------- reglas (cada aviso dice cual lo causa)
export const REGLAS = {
  "0.1": "Disponibilidad: solo van quienes dicen «voy» a ese partido",
  "0.2": "Datos privados del jugador",
  "1.1": "Máximo 10 por equipo (12 con más de 20 disponibles)",
  "1.2": "Con 20 o más disponibles, los de «solo entreno» no van",
  "1.3": "Nunca menos de 7 por equipo",
  "1.4": "Doblar solo si los partidos no empiezan a la misma hora",
  "1.5": "Solo con el equipo en el que tiene ficha",
  "1.6": "Los sancionados no se convocan",
  "2.1": "Bases: ideal 2 puros; los de reserva cuentan como base",
  "2.2": "Exteriores: ideal 4; si faltan, los bases cuentan como exteriores",
  "2.3": "Interiores: ideal 4, mínimo 3, evitar 5",
  "3.1": "El partido más difícil lleva más nivel medio",
  "3.2": "Con rivales parejos, se equilibra por líneas",
  "4.1": "Prioridad: más nivel; a igual nivel, quien menos partidos lleva convocado",
  "4.2": "Rotación: 2 domingos disponible y fuera, entra por delante",
  "5.1": "Si no se llega: doblan los «Dobla»",
  "5.2": "Si no se llega: dobla un «No dobla», con aviso",
  "5.3": "Interiores: con 3 se juega (solo se dobla por debajo de 3)",
  "5.4": "Si no se llega: dos bases de reserva, con aviso",
  "6.1": "Regla personal: fijo a un equipo",
  "6.2": "Regla personal: va al equipo al que le falte un jugador",
  "6.3": "Posición cambiada solo para este partido",
} as const;
export type CodigoRegla = keyof typeof REGLAS;

export type Gravedad = "error" | "aviso" | "info";
export type Aviso = { regla: CodigoRegla; gravedad: Gravedad; texto: string; equipo?: Equipo; person_id?: string };

// ---------------------------------------------------------------- entrada
export type PartidoEntrada = { evento_id: string; equipo: Equipo; inicio: string | null; dificultad: Dificultad };
export type DatosPrivados = { posicion: Posicion | null; base_reserva: boolean; nivel: Nivel | null; dobla: boolean; regla: ReglaPersonal };
export type JugadorEntrada = {
  person_id: string;
  nombre: string;
  ficha: Record<Equipo, boolean>;
  solo_entreno: boolean;
  /** Respuesta a cada partido del domingo (la respuesta unica del domingo ya derivada por evento, D103). */
  respuesta: Partial<Record<Equipo, RespuestaPartido>>;
  /** null = no hay datos privados cargados: cuenta como exterior de nivel C y sin doblar, con aviso. */
  privado: DatosPrivados | null;
  sancionado: boolean;
  /** Partidos convocado en la temporada, sumando MdA y MdL. */
  convocados: number;
  /** Domingos de la temporada en que jugo con los dos equipos. */
  doblajes: number;
  /** Entrenos a los que fue en las 4 semanas anteriores al domingo. */
  entrenos4: number;
  /** De sus ultimos domingos en que estuvo disponible, cuantos seguidos (del mas reciente hacia atras) se quedo sin
   *  convocar. Con 2 o mas entra por rotacion (regla 4.2). Lo calcula domingosFueraDe. */
  domingosFuera: number;
};
export type Entrada = { partidos: PartidoEntrada[]; jugadores: JugadorEntrada[] };

/** Un convocado. `posicion` solo si se cambio a mano para este partido (si no, manda la de sus datos privados). */
export type Convocado = { person_id: string; posicion?: Posicion };
export type Convocatoria = Partial<Record<Equipo, Convocado[]>>;

// ---------------------------------------------------------------- salida
export type EstadoLinea = "ok" | "minimo" | "mal";
export type Recuento = {
  total: number;
  bases: { puros: number; reserva: number; texto: string; estado: EstadoLinea };
  exteriores: { n: number; texto: string; estado: EstadoLinea };
  interiores: { n: number; texto: string; estado: EstadoLinea };
  /** Nivel medio (A = 5 ... E = 1); null si nadie tiene nivel. */
  nivelMedio: number | null;
  /** Quien juega de base sin serlo (base de reserva) y que bases cuentan como exteriores. */
  basesDeReserva: string[];
  basesComoExteriores: string[];
};
export type SinConvocar = { person_id: string; motivo: string; regla: CodigoRegla };
export type Revision = {
  maximo: number;
  disponibles: number;
  mismaHora: boolean;
  recuento: Partial<Record<Equipo, Recuento>>;
  avisos: Aviso[];
  sinConvocar: SinConvocar[];
};
export type Propuesta = Revision & { convocatoria: Convocatoria };

// ---------------------------------------------------------------- utilidades
const VALOR_NIVEL: Record<Nivel, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 };
const VALOR_DIFICULTAD: Record<Dificultad, number> = { alta: 3, media: 2, baja: 1 };
export const textoNivelMedio = (v: number | null) => {
  if (v == null) return "—";
  const i = Math.min(4, Math.max(0, Math.round(5 - v)));
  const base = NIVELES[i];
  const resto = 5 - i - v; // > 0: algo por debajo de la letra; < 0: por encima
  return resto <= -0.25 ? `${base}+` : resto >= 0.25 ? `${base}-` : base;
};
const hhmm = (t: string | null) => (t ? String(t).slice(0, 5) : null);
const otro = (e: Equipo): Equipo => (e === "MdA" ? "MdL" : "MdA");
const datos = (j: JugadorEntrada): DatosPrivados => j.privado ?? { posicion: null, base_reserva: false, nivel: null, dobla: false, regla: null };
const posicionDe = (j: JugadorEntrada, c?: Convocado): Posicion | null => c?.posicion ?? datos(j).posicion;
const lineaDe = (j: JugadorEntrada, c?: Convocado): Linea => { const p = posicionDe(j, c); return p ? LINEA_DE[p] : "exterior"; };
const nivelDe = (j: JugadorEntrada) => VALOR_NIVEL[datos(j).nivel ?? "C"];
const disponibleEn = (j: JugadorEntrada, e: Equipo) => j.respuesta[e] === "va";
const porId = (a: { person_id: string }, b: { person_id: string }) => (a.person_id < b.person_id ? -1 : a.person_id > b.person_id ? 1 : 0);

export const tieneDeuda = (j: JugadorEntrada) => j.domingosFuera >= LIMITES.deudaDomingos;

/** Orden de prioridad para ir convocado (reglas 4.1 y 4.2, D109), una vez cubiertas las lineas: los «solo entreno» al
 *  final; antes quien lleva 2 domingos disponible y fuera (deuda de rotacion); despues mas nivel; a igual nivel, quien
 *  menos partidos lleva convocado; a igualdad, quien mas ha entrenado en las ultimas 4 semanas; y por ultimo el
 *  identificador (para que el orden no dependa de nada mas). */
export function compararPrioridad(a: JugadorEntrada, b: JugadorEntrada) {
  return Number(a.solo_entreno) - Number(b.solo_entreno)
    || Number(tieneDeuda(b)) - Number(tieneDeuda(a))
    || nivelDe(b) - nivelDe(a)
    || a.convocados - b.convocados
    || b.entrenos4 - a.entrenos4
    || porId(a, b);
}

/** Domingos seguidos fuera (regla 4.2): `historial` son los domingos ya jugados, del mas reciente al mas antiguo. Solo
 *  cuentan los domingos en que estuvo disponible; se para en el primero en que fue convocado. */
export function domingosFueraDe(historial: { disponible: boolean; convocado: boolean }[]) {
  let n = 0;
  for (const d of historial) {
    if (!d.disponible) continue;
    if (d.convocado) break;
    n++;
  }
  return n;
}
/** Para elegir dentro de una linea al repartir niveles: primero el nivel y despues la prioridad. */
const compararNivel = (a: JugadorEntrada, b: JugadorEntrada) => nivelDe(b) - nivelDe(a) || compararPrioridad(a, b);

/** Orden de los partidos: el mas dificil primero; si estan igualados, el MdA (pregunta 2). */
export function ordenPartidos(partidos: PartidoEntrada[]) {
  return [...partidos].sort((a, b) => VALOR_DIFICULTAD[b.dificultad] - VALOR_DIFICULTAD[a.dificultad] || (a.equipo === "MdA" ? -1 : 1));
}

/** Disponibles del domingo: dicen «voy» a algun partido que se juega y no estan sancionados. */
function contarDisponibles(entrada: Entrada) {
  const eqs = entrada.partidos.map((p) => p.equipo);
  return entrada.jugadores.filter((j) => !j.sancionado && eqs.some((e) => disponibleEn(j, e) && j.ficha[e])).length;
}
export function maximoPorEquipo(disponibles: number, nPartidos: number) {
  if (disponibles <= LIMITES.umbralAmpliar || nPartidos === 0) return LIMITES.maximo;
  return Math.min(LIMITES.maximoAmpliado, Math.max(LIMITES.maximo, Math.ceil(disponibles / nPartidos)));
}
const esMismaHora = (partidos: PartidoEntrada[]) => partidos.length === 2 && !!hhmm(partidos[0].inicio) && hhmm(partidos[0].inicio) === hhmm(partidos[1].inicio);

// ---------------------------------------------------------------- recuento por lineas
export function recuentoDe(convocados: Convocado[], jugadores: Map<string, JugadorEntrada>): Recuento {
  const filas = convocados.map((c) => ({ c, j: jugadores.get(c.person_id) })).filter((x): x is { c: Convocado; j: JugadorEntrada } => !!x.j);
  const bases = filas.filter((x) => lineaDe(x.j, x.c) === "base");
  const ext = filas.filter((x) => lineaDe(x.j, x.c) === "exterior");
  const int = filas.filter((x) => lineaDe(x.j, x.c) === "interior");
  const puros = bases.length;
  // Los de reserva (exteriores que suben el balon) completan los bases que falten hasta 2; el resto sigue de exterior.
  const reservas = ext.filter((x) => datos(x.j).base_reserva).sort((a, b) => compararNivel(a.j, b.j));
  const usados = reservas.slice(0, Math.max(0, LIMITES.ideal.base - puros));
  // Si sobran bases puros y faltan exteriores, los bases cuentan como exteriores (regla 2.2).
  const extNetos = ext.length - usados.length;
  const sobranBases = Math.max(0, puros - LIMITES.ideal.base);
  const comoExt = [...bases].sort((a, b) => compararNivel(b.j, a.j)).slice(0, Math.min(sobranBases, Math.max(0, LIMITES.ideal.exterior - extNetos)));
  const nExt = extNetos + comoExt.length;
  const nBases = puros + usados.length;
  const estadoBases: EstadoLinea = puros >= 2 ? "ok" : nBases >= 2 && puros >= 1 ? "minimo" : "mal";
  const niveles = filas.filter((x) => datos(x.j).nivel).map((x) => nivelDe(x.j));
  return {
    total: filas.length,
    bases: { puros, reserva: usados.length, texto: usados.length ? `${puros} + ${usados.length} res.` : `${puros}/${LIMITES.ideal.base}`, estado: estadoBases },
    exteriores: { n: nExt, texto: `${nExt}/${LIMITES.ideal.exterior}`, estado: nExt >= LIMITES.ideal.exterior ? "ok" : nExt >= LIMITES.minimoLinea.exterior ? "minimo" : "mal" },
    interiores: {
      n: int.length, texto: `${int.length}/${LIMITES.ideal.interior}`,
      estado: int.length === LIMITES.ideal.interior ? "ok" : int.length >= LIMITES.minimoLinea.interior ? "minimo" : "mal",
    },
    nivelMedio: niveles.length ? niveles.reduce((s, v) => s + v, 0) / niveles.length : null,
    basesDeReserva: usados.map((x) => x.j.person_id),
    basesComoExteriores: comoExt.map((x) => x.j.person_id),
  };
}

// ---------------------------------------------------------------- modo 2: revisar una convocatoria (sin cambiarla)
export function revisar(entrada: Entrada, convocatoria: Convocatoria, sinConvocarPropuesta?: SinConvocar[]): Revision {
  const jugadores = new Map(entrada.jugadores.map((j) => [j.person_id, j]));
  const partidos = ordenPartidos(entrada.partidos);
  const disponibles = contarDisponibles(entrada);
  const maximo = maximoPorEquipo(disponibles, partidos.length);
  const mismaHora = esMismaHora(partidos);
  const avisos: Aviso[] = [];
  const recuento: Partial<Record<Equipo, Recuento>> = {};
  const nombre = (id: string) => jugadores.get(id)?.nombre ?? id;
  const enEquipo = (e: Equipo) => new Set((convocatoria[e] ?? []).map((c) => c.person_id));

  // Sin disponibles y sin nadie convocado no hay nada que revisar (D108): un solo mensaje por equipo, en vez de un
  // aviso por cada regla que no se cumple con el equipo vacio.
  if (disponibles === 0 && partidos.every((p) => !(convocatoria[p.equipo]?.length))) {
    for (const p of partidos) recuento[p.equipo] = recuentoDe([], jugadores);
    return {
      maximo, disponibles, mismaHora, recuento, sinConvocar: [],
      avisos: partidos.map((p) => ({ regla: "0.1" as const, gravedad: "info" as const, equipo: p.equipo, texto: "Todavía no hay disponibles para este domingo." })),
    };
  }

  for (const p of partidos) {
    const e = p.equipo;
    const lista = convocatoria[e] ?? [];
    const r = recuentoDe(lista, jugadores);
    recuento[e] = r;
    // Tamaño
    if (r.total > LIMITES.maximoAmpliado) avisos.push({ regla: "1.1", gravedad: "error", equipo: e, texto: `${r.total} convocados: el tope de la ficha de partido es ${LIMITES.maximoAmpliado}.` });
    else if (r.total > maximo) avisos.push({ regla: "1.1", gravedad: "aviso", equipo: e, texto: `${r.total} convocados: el máximo esta jornada es ${maximo}${disponibles > LIMITES.umbralAmpliar ? "" : " (hay 20 o menos disponibles)"}.` });
    if (r.total < LIMITES.minimo) avisos.push({ regla: "1.3", gravedad: "error", equipo: e, texto: `Solo ${r.total} convocados: el mínimo es ${LIMITES.minimo}.` });
    // Lineas
    if (r.bases.puros === 0 && r.bases.reserva >= 2) avisos.push({ regla: "5.4", gravedad: "aviso", equipo: e, texto: "Sin bases puros: juegan dos bases de reserva." });
    else if (r.bases.puros + r.bases.reserva < LIMITES.ideal.base) avisos.push({ regla: "2.1", gravedad: r.bases.puros + r.bases.reserva === 0 ? "error" : "aviso", equipo: e, texto: `Solo ${r.bases.puros + r.bases.reserva} base${r.bases.puros + r.bases.reserva === 1 ? "" : "s"} (contando los de reserva): lo ideal son 2.` });
    else if (r.bases.reserva > 0) avisos.push({ regla: "2.1", gravedad: "info", equipo: e, texto: `${r.bases.reserva === 1 ? "Un base de reserva hace" : "Dos bases de reserva hacen"} de base: ${r.basesDeReserva.map(nombre).join(", ")}.` });
    if (r.interiores.n >= LIMITES.evitarInteriores) avisos.push({ regla: "2.3", gravedad: "aviso", equipo: e, texto: `${r.interiores.n} interiores: mejor no pasar de 4.` });
    else if (r.interiores.n < LIMITES.minimoLinea.interior) avisos.push({ regla: "2.3", gravedad: "aviso", equipo: e, texto: `Solo ${r.interiores.n} interior${r.interiores.n === 1 ? "" : "es"}: el mínimo es 3.` });
    else if (r.interiores.n === LIMITES.minimoLinea.interior && r.total >= LIMITES.minimo) avisos.push({ regla: "5.3", gravedad: "info", equipo: e, texto: "3 interiores (en el mínimo)." });
    if (r.basesComoExteriores.length) avisos.push({ regla: "2.2", gravedad: "info", equipo: e, texto: `Faltan exteriores: ${r.basesComoExteriores.map(nombre).join(", ")} ${r.basesComoExteriores.length === 1 ? "cuenta" : "cuentan"} como exterior.` });
    if (r.exteriores.n < LIMITES.minimoLinea.exterior) avisos.push({ regla: "2.2", gravedad: "aviso", equipo: e, texto: `Solo ${r.exteriores.n} exterior${r.exteriores.n === 1 ? "" : "es"} (contando los bases que sobran).` });

    // Por jugador
    const delOtro = enEquipo(otro(e));
    for (const c of [...lista].sort(porId)) {
      const j = jugadores.get(c.person_id);
      if (!j) { avisos.push({ regla: "0.2", gravedad: "error", equipo: e, person_id: c.person_id, texto: `${c.person_id} no está en la plantilla.` }); continue; }
      const d = datos(j);
      if (!j.ficha[e]) avisos.push({ regla: "1.5", gravedad: "error", equipo: e, person_id: j.person_id, texto: `${j.nombre} no tiene ficha del ${e}.` });
      if (j.sancionado) avisos.push({ regla: "1.6", gravedad: "error", equipo: e, person_id: j.person_id, texto: `${j.nombre} está sancionado.` });
      const resp = j.respuesta[e] ?? "sin_responder";
      if (resp !== "va") avisos.push({ regla: "0.1", gravedad: "aviso", equipo: e, person_id: j.person_id, texto: `${j.nombre} ${resp === "no" ? "dijo «no voy»" : resp === "duda" ? "tiene «duda»" : "no ha respondido"} a este partido.` });
      if (j.solo_entreno && disponibles >= LIMITES.umbralAmpliar) avisos.push({ regla: "1.2", gravedad: "aviso", equipo: e, person_id: j.person_id, texto: `${j.nombre} es «solo entreno» y hay ${disponibles} disponibles.` });
      if (d.regla?.tipo === "fijo" && d.regla.equipo !== e) avisos.push({ regla: "6.1", gravedad: "aviso", equipo: e, person_id: j.person_id, texto: `${j.nombre} es fijo del ${d.regla.equipo}.` });
      if (!j.privado || !d.posicion || !d.nivel) avisos.push({ regla: "0.2", gravedad: "aviso", equipo: e, person_id: j.person_id, texto: `Faltan datos privados de ${j.nombre} (${[!d.posicion && "posición", !d.nivel && "nivel"].filter(Boolean).join(" y ") || "todos"}): cuenta como exterior de nivel C.` });
      if (tieneDeuda(j)) avisos.push({ regla: "4.2", gravedad: "info", equipo: e, person_id: j.person_id, texto: `${j.nombre} entra por rotación (${j.domingosFuera} domingos fuera).` });
      if (c.posicion && c.posicion !== d.posicion) avisos.push({ regla: "6.3", gravedad: "info", equipo: e, person_id: j.person_id, texto: `${j.nombre} juega de ${TEXTO_POSICION[c.posicion].toLowerCase()} en este partido${d.posicion ? ` (es ${TEXTO_POSICION[d.posicion].toLowerCase()})` : ""}.` });
      // Doblar: se avisa una sola vez, en el partido del segundo equipo por orden de prioridad.
      if (delOtro.has(j.person_id) && p === partidos[1]) {
        if (mismaHora) avisos.push({ regla: "1.4", gravedad: "error", person_id: j.person_id, texto: `${j.nombre} está en los dos equipos y juegan a la misma hora.` });
        else if (!d.dobla) avisos.push({ regla: "5.2", gravedad: "aviso", person_id: j.person_id, texto: `${j.nombre} dobla y es «No dobla».` });
        else avisos.push({ regla: "5.1", gravedad: "info", person_id: j.person_id, texto: `${j.nombre} dobla.` });
      }
    }
  }
  // Un equipo que no juega este domingo no puede llevar convocados.
  for (const e of EQUIPOS) if (!partidos.some((p) => p.equipo === e) && (convocatoria[e]?.length ?? 0) > 0) avisos.push({ regla: "1.5", gravedad: "error", equipo: e, texto: `El ${e} no juega este domingo.` });

  // Nivel (seccion 3), solo con dos partidos.
  if (partidos.length === 2) {
    const [a, b] = partidos;
    const ra = recuento[a.equipo]!, rb = recuento[b.equipo]!;
    if (ra.nivelMedio != null && rb.nivelMedio != null) {
      if (VALOR_DIFICULTAD[a.dificultad] > VALOR_DIFICULTAD[b.dificultad]) {
        if (ra.nivelMedio < rb.nivelMedio) avisos.push({ regla: "3.1", gravedad: "aviso", equipo: a.equipo, texto: `El ${a.equipo} tiene el rival más difícil y menos nivel medio (${textoNivelMedio(ra.nivelMedio)} frente a ${textoNivelMedio(rb.nivelMedio)}).` });
      } else {
        for (const l of LINEAS) {
          const de = (e: Equipo) => {
            const vs = (convocatoria[e] ?? []).map((c) => ({ c, j: jugadores.get(c.person_id) })).filter((x) => x.j && lineaDe(x.j, x.c) === l).map((x) => nivelDe(x.j!));
            return vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null;
          };
          const na = de(a.equipo), nb = de(b.equipo);
          if (na != null && nb != null && Math.abs(na - nb) >= 1) avisos.push({ regla: "3.2", gravedad: "info", texto: `Rivales parejos y ${TEXTO_LINEA[l]} desequilibrados: ${a.equipo} ${textoNivelMedio(na)}, ${b.equipo} ${textoNivelMedio(nb)}.` });
        }
      }
    }
  }

  // Disponibles sin convocar: los de la propuesta traen su motivo; en una edicion a mano, «no convocado a mano».
  const dentro = new Set(EQUIPOS.flatMap((e) => (convocatoria[e] ?? []).map((c) => c.person_id)));
  const motivos = new Map((sinConvocarPropuesta ?? []).map((s) => [s.person_id, s]));
  const sinConvocar: SinConvocar[] = entrada.jugadores
    .filter((j) => !dentro.has(j.person_id) && partidos.some((p) => disponibleEn(j, p.equipo)))
    .sort(compararPrioridad)
    .map((j) => motivos.get(j.person_id) ?? motivoFuera(j, partidos, disponibles));

  const orden: Record<Gravedad, number> = { error: 0, aviso: 1, info: 2 };
  avisos.sort((x, y) => orden[x.gravedad] - orden[y.gravedad]);
  return { maximo, disponibles, mismaHora, recuento, avisos, sinConvocar };
}

/** Por que un disponible no va (cuando no lo dice la propuesta). */
function motivoFuera(j: JugadorEntrada, partidos: PartidoEntrada[], disponibles: number): SinConvocar {
  const eqs = partidos.filter((p) => disponibleEn(j, p.equipo)).map((p) => p.equipo);
  if (j.sancionado) return { person_id: j.person_id, motivo: "Sancionado", regla: "1.6" };
  if (!eqs.some((e) => j.ficha[e])) return { person_id: j.person_id, motivo: `Sin ficha del ${eqs.join(" ni del ")}`, regla: "1.5" };
  if (j.solo_entreno && disponibles >= LIMITES.umbralAmpliar) return { person_id: j.person_id, motivo: "Solo entreno (20 o más disponibles)", regla: "1.2" };
  return { person_id: j.person_id, motivo: "No convocado a mano", regla: "4.1" };
}

// ---------------------------------------------------------------- modo 1: proponer
export function proponer(entrada: Entrada): Propuesta {
  const partidos = ordenPartidos(entrada.partidos);
  const eqs = partidos.map((p) => p.equipo);
  const disponibles = contarDisponibles(entrada);
  const maximo = maximoPorEquipo(disponibles, partidos.length);
  const mismaHora = esMismaHora(partidos);
  const sinConvocar: SinConvocar[] = [];
  const conv: Record<Equipo, JugadorEntrada[]> = { MdA: [], MdL: [] };
  const fuera = (j: JugadorEntrada, motivo: string, regla: CodigoRegla) => sinConvocar.push({ person_id: j.person_id, motivo, regla });
  const jugadores = [...entrada.jugadores].sort(compararPrioridad);
  const mapa = new Map(entrada.jugadores.map((j) => [j.person_id, j]));

  // 1. Quien puede ir y a donde.
  const flexibles: JugadorEntrada[] = [];
  const comodines: JugadorEntrada[] = [];
  for (const j of jugadores) {
    const dice = eqs.filter((e) => disponibleEn(j, e));
    if (!dice.length) continue; // no esta disponible: no sale ni en «sin convocar»
    if (j.sancionado) { fuera(j, "Sancionado", "1.6"); continue; }
    const puede = dice.filter((e) => j.ficha[e]);
    if (!puede.length) { fuera(j, `Sin ficha del ${dice.join(" ni del ")}`, "1.5"); continue; }
    if (j.solo_entreno && disponibles >= LIMITES.umbralAmpliar) { fuera(j, "Solo entreno (20 o más disponibles)", "1.2"); continue; }
    const regla = datos(j).regla;
    if (regla?.tipo === "fijo") {
      if (puede.includes(regla.equipo)) conv[regla.equipo].push(j);
      else fuera(j, `Fijo del ${regla.equipo} y ese equipo ${eqs.includes(regla.equipo) ? "no lo tiene disponible" : "no juega"}`, "6.1");
      continue;
    }
    if (puede.length === 1) { conv[puede[0]].push(j); continue; }
    if (regla?.tipo === "comodin") comodines.push(j); else flexibles.push(j);
  }

  // 2. Reparto de los flexibles (dos partidos): por lineas, con los niveles alternados (seccion 3).
  if (eqs.length === 2) {
    const [P, S] = eqs; // P = el partido con prioridad (mas dificil; si igualados, MdA)
    const distintos = partidos[0].dificultad !== partidos[1].dificultad;
    const cuenta = (e: Equipo, l: Linea) => conv[e].filter((j) => lineaDe(j) === l).length;
    const lleno = (e: Equipo) => conv[e].length >= maximo;
    const elegir = (l: Linea, ronda: number, i: number): Equipo => {
      if (lleno(P) !== lleno(S)) return lleno(P) ? S : P;
      const nP = LIMITES.ideal[l] - cuenta(P, l), nS = LIMITES.ideal[l] - cuenta(S, l);
      if (nP !== nS && (nP > 0 || nS > 0)) return nP > nS ? P : S;
      if (nP <= 0 && nS <= 0 && conv[P].length !== conv[S].length) return conv[P].length < conv[S].length ? P : S;
      // Con dificultad distinta, el mas dificil elige primero en cada ronda; con dificultad igual, en serpiente.
      const primero = distintos || ronda % 2 === 0 ? P : S;
      return i % 2 === 0 ? primero : otro(primero);
    };
    const repartir = (lista: JugadorEntrada[], l: Linea) => lista.sort(compararNivel).forEach((j, i) => conv[elegir(l, Math.floor(i / 2), i)].push(j));
    repartir(flexibles.filter((j) => lineaDe(j) === "base"), "base");
    repartir(flexibles.filter((j) => lineaDe(j) === "interior"), "interior");
    // Exteriores: primero un base de reserva para cada equipo que se quede sin 2 bases puros.
    const exteriores = flexibles.filter((j) => lineaDe(j) === "exterior").sort(compararNivel);
    for (const e of eqs) {
      const faltan = Math.max(0, LIMITES.ideal.base - cuenta(e, "base") - conv[e].filter((j) => lineaDe(j) === "exterior" && datos(j).base_reserva).length);
      for (let k = 0; k < faltan && !lleno(e); k++) {
        const r = exteriores.find((j) => datos(j).base_reserva);
        if (!r) break;
        exteriores.splice(exteriores.indexOf(r), 1);
        conv[e].push(r);
      }
    }
    repartir(exteriores, "exterior");
    // Comodines: al equipo al que le falte un jugador (regla 6.2).
    for (const j of comodines) {
      const e = conv[P].length !== conv[S].length ? (conv[P].length < conv[S].length ? P : S)
        : LIMITES.ideal[lineaDe(j)] - cuenta(S, lineaDe(j)) > LIMITES.ideal[lineaDe(j)] - cuenta(P, lineaDe(j)) ? S : P;
      conv[lleno(e) ? otro(e) : e].push(j);
    }
  } else if (eqs.length === 1) {
    conv[eqs[0]].push(...flexibles, ...comodines);
  }

  // 3. Tope por equipo: sale quien tiene menos prioridad, empezando por las lineas que pasan del ideal.
  for (const e of eqs) {
    while (conv[e].length > maximo) {
      const sobrante = (l: Linea) => conv[e].filter((j) => lineaDe(j) === l).length > LIMITES.ideal[l];
      const candidatos = [...conv[e]].filter((j) => datos(j).regla?.tipo !== "fijo").sort((a, b) => compararPrioridad(b, a));
      const sale = candidatos.find((j) => sobrante(lineaDe(j))) ?? candidatos[0] ?? [...conv[e]].sort((a, b) => compararPrioridad(b, a))[0];
      conv[e].splice(conv[e].indexOf(sale), 1);
      const alOtro = eqs.find((x) => x !== e && disponibleEn(sale, x) && sale.ficha[x] && conv[x].length < maximo && datos(sale).regla?.tipo !== "fijo");
      if (alOtro) conv[alOtro].push(sale);
      else fuera(sale, `Tope de ${maximo} en el ${e}${sale.solo_entreno ? " (solo entreno: entra solo para cubrir un hueco)" : ""}`, "1.1");
    }
  }

  // 4. Solo se dobla para cubrir MINIMOS (seccion 5, D108): 7 por equipo, 2 bases contando los de reserva con al menos
  //    1 puro, y 3 interiores. Nunca para llegar al ideal (4 interiores): las excepciones las hace Ivan a mano. Primero
  //    los «Dobla»; despues un «No dobla», con aviso; y si no, dos bases de reserva. Nunca a la misma hora.
  const extra: Aviso[] = [];
  const dobladores = new Set<string>();
  if (eqs.length === 2 && !mismaHora) {
    const falta = (e: Equipo, l: Linea) => LIMITES.ideal[l] - conv[e].filter((j) => lineaDe(j) === l).length;
    const huecos: { tipo: "total" | "base" | "interior"; falta: (e: Equipo) => boolean; vale: (j: JugadorEntrada) => boolean }[] = [
      { tipo: "total", falta: (e) => conv[e].length < LIMITES.minimo, vale: () => true },
      { tipo: "base", falta: (e) => { const b = recuentoDe(conv[e].map((j) => ({ person_id: j.person_id })), mapa).bases; return b.puros === 0 || b.puros + b.reserva < LIMITES.ideal.base; }, vale: (j) => lineaDe(j) === "base" },
      { tipo: "interior", falta: (e) => conv[e].filter((j) => lineaDe(j) === "interior").length < LIMITES.minimoLinea.interior, vale: (j) => lineaDe(j) === "interior" },
    ];
    for (const h of huecos) {
      for (const e of eqs) {
        while (h.falta(e) && conv[e].length < maximo) {
          const ids = new Set(conv[e].map((j) => j.person_id));
          const candidatos = conv[otro(e)].filter((j) => !ids.has(j.person_id) && !dobladores.has(j.person_id) && disponibleEn(j, e) && j.ficha[e] && h.vale(j) && datos(j).regla?.tipo !== "fijo")
            .sort((a, b) => Number(datos(b).dobla) - Number(datos(a).dobla) || falta(e, lineaDe(b)) - falta(e, lineaDe(a)) || a.doblajes - b.doblajes || compararPrioridad(a, b));
          const j = candidatos[0];
          if (!j) break;
          conv[e].push(j);
          dobladores.add(j.person_id);
          const para = h.tipo === "total" ? `llegar a ${LIMITES.minimo}` : h.tipo === "base" ? "tener 2 bases" : `tener ${LIMITES.minimoLinea.interior} interiores`;
          extra.push(datos(j).dobla
            ? { regla: "5.1", gravedad: "info", equipo: e, person_id: j.person_id, texto: `${j.nombre} dobla para ${para} en el ${e}.` }
            : { regla: "5.2", gravedad: "aviso", equipo: e, person_id: j.person_id, texto: `${j.nombre} («No dobla») dobla para ${para} en el ${e}: no hay ningún «Dobla» que lo cubra.` });
        }
      }
    }
  }

  const convocatoria: Convocatoria = {};
  for (const e of eqs) convocatoria[e] = conv[e].map((j) => ({ person_id: j.person_id }));
  const rev = revisar(entrada, convocatoria, sinConvocar);
  // Los avisos de doblaje de la revision ya dicen quien dobla; la propuesta los sustituye por los suyos, que dicen por que.
  const avisos = [...rev.avisos.filter((a) => !((a.regla === "5.1" || a.regla === "5.2") && a.person_id && dobladores.has(a.person_id))), ...extra];
  const orden: Record<Gravedad, number> = { error: 0, aviso: 1, info: 2 };
  avisos.sort((x, y) => orden[x.gravedad] - orden[y.gravedad]);
  return { ...rev, avisos, convocatoria };
}

// ---------------------------------------------------------------- dificultad del rival (la propone la web, la corrige Ivan)
export type FilaClasificacion = { pos: number; equipo: string; pj: number; dif: number };
export const MIN_PARTIDOS_DIFICULTAD = 3;

/** Propuesta de dificultad con la clasificacion de la liga en curso: puesto y diferencia de puntos por partido.
 *  Alta: en el tercio de arriba con diferencia positiva, o +15 por partido o mas. Baja: en el tercio de abajo con
 *  diferencia negativa, o -15 por partido o menos. Media, el resto (y sin partidos jugados). */
export function proponerDificultad(fila: FilaClasificacion | null, equiposGrupo: number, grupo: string, jornada: number | null): { dificultad: Dificultad; porque: string } {
  const tras = jornada ? ` tras la J${jornada}` : "";
  if (!fila || fila.pj === 0) return { dificultad: "media", porque: `Sin partidos jugados${tras}: media por defecto` };
  // Con menos de 3 partidos la clasificacion no dice nada todavia (D108): media.
  if (fila.pj < MIN_PARTIDOS_DIFICULTAD) return { dificultad: "media", porque: `Pocos datos (${fila.pj} partido${fila.pj === 1 ? "" : "s"}${tras}): media por defecto` };
  const dpp = fila.dif / fila.pj;
  const tercio = Math.ceil(equiposGrupo / 3);
  // Guion normal (no «−»): el porque se guarda en la base y la pila local de pruebas es WIN1252 (D95).
  const signo = (n: number) => (n > 0 ? `+${Math.round(n)}` : `${Math.round(n)}`);
  const porque = `${fila.pos}.º del ${grupo}${tras} (${signo(dpp)} por partido)`;
  if (dpp >= 15 || (fila.pos <= tercio && dpp >= 0)) return { dificultad: "alta", porque };
  if (dpp <= -15 || (fila.pos > equiposGrupo - tercio && dpp <= 0)) return { dificultad: "baja", porque };
  return { dificultad: "media", porque };
}

// ---------------------------------------------------------------- utilidades para las pantallas
/** Cambios entre dos convocatorias, en lenguaje llano ("entra Jon en el MdL", "Jon pasa del MdA al MdL"). */
export function diferencias(antes: Convocatoria | null, despues: Convocatoria, nombre: (id: string) => string): string[] {
  if (!antes) return [];
  const out: string[] = [];
  const en = (c: Convocatoria, e: Equipo) => new Set((c[e] ?? []).map((x) => x.person_id));
  const a = { MdA: en(antes, "MdA"), MdL: en(antes, "MdL") }, d = { MdA: en(despues, "MdA"), MdL: en(despues, "MdL") };
  const todos = [...new Set([...a.MdA, ...a.MdL, ...d.MdA, ...d.MdL])].sort();
  for (const id of todos) {
    const antesEn = EQUIPOS.filter((e) => a[e].has(id)), ahoraEn = EQUIPOS.filter((e) => d[e].has(id));
    if (antesEn.join() === ahoraEn.join()) continue;
    const n = nombre(id);
    if (!antesEn.length) out.push(ahoraEn.length === 2 ? `entra ${n} (MdA y MdL)` : `entra ${n} en el ${ahoraEn[0]}`);
    else if (!ahoraEn.length) out.push(`sale ${n}${antesEn.length === 1 ? ` del ${antesEn[0]}` : ""}`);
    else if (antesEn.length === 1 && ahoraEn.length === 1) out.push(`${n} pasa del ${antesEn[0]} al ${ahoraEn[0]}`);
    else if (ahoraEn.length === 2) out.push(`${n} dobla (también en el ${ahoraEn.find((e) => !antesEn.includes(e))})`);
    else out.push(`${n} ya no dobla: solo en el ${ahoraEn[0]}`);
  }
  return out;
}

export const vacia = (eqs: Equipo[]): Convocatoria => Object.fromEntries(eqs.map((e) => [e, []])) as Convocatoria;
