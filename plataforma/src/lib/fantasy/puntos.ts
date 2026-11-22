// MdFantasy (D196): puntos de un JUGADOR en una jornada (un domingo). Logica pura: la usan la tarea que puntua al
// publicarse las estadisticas (servidor.ts), la simulacion (scripts/fantasy/simular.mjs) y pruebas:fantasy-logica.
// Nada de aqui lee niveles ni motivos: solo la hoja del partido y el estado de las respuestas que ya ven los jugadores.
import { enSilencio } from "../avisos/horario.ts";
import { type Parametros, redondeo } from "./reglas.ts";

/** Lo que hizo un jugador en un partido (su linea de la hoja) y el partido. */
export type LineaPartido = {
  equipo: string;           // MdA | MdL
  pts: number; segundos: number; masMenos: number;
  ptsFavor: number; ptsContra: number;
  segundosEquipo: number;   // suma de los segundos de todo el equipo: la duracion real es eso entre 5
};

export type DetallePartido = { equipo: string; pts: number; masMenos: number; relativo: number; extra: number; total: number; minutos: number };

/** +/- relativo: su +/- menos el que le tocaba por el tiempo en pista (margen del equipo x segundos / duracion real). */
export function masMenosRelativo(l: LineaPartido) {
  const duracion = l.segundosEquipo > 0 ? l.segundosEquipo / 5 : 0;
  if (!duracion) return l.masMenos;
  return l.masMenos - ((l.ptsFavor - l.ptsContra) * l.segundos) / duracion;
}

export function rendimientoPartido(l: LineaPartido, P: Parametros): DetallePartido {
  const relativo = masMenosRelativo(l);
  const extra = Math.max(-P.masMenosTope, Math.min(P.masMenosTope, redondeo(relativo / P.masMenosDivisor)));
  const total = Math.max(0, l.pts * P.puntoPorPunto + extra);
  return { equipo: l.equipo, pts: l.pts, masMenos: l.masMenos, relativo: Math.round(relativo * 10) / 10, extra, total, minutos: Math.round(l.segundos / 60) };
}

/** Rendimiento de la jornada: un partido, lo suyo; dos el mismo domingo, la media de los dos mas el extra. Solo cuentan
 *  los partidos en los que tiene tiempo en la hoja. */
export function rendimiento(lineas: LineaPartido[], P: Parametros) {
  const partidos = lineas.filter((l) => l.segundos > 0).map((l) => rendimientoPartido(l, P));
  if (!partidos.length) return { total: 0, partidos, doblete: false };
  if (partidos.length === 1) return { total: partidos[0].total, partidos, doblete: false };
  const media = partidos.reduce((s, x) => s + x.total, 0) / partidos.length;
  return { total: redondeo(media + P.bonusDoblete), partidos, doblete: true };
}

/** Horas entre dos instantes sin contar el silencio (22:30–08:00, hora de Madrid). Deja de contar al pasar de `tope`. */
export function horasActivas(desde: Date, hasta: Date, tope = 1e9) {
  const PASO = 5 * 60000;
  let activas = 0;
  for (let t = desde.getTime(); t < hasta.getTime(); t += PASO) {
    if (!enSilencio(new Date(t))) activas += Math.min(PASO, hasta.getTime() - t);
    if (activas / 3600000 > tope) break;
  }
  return activas / 3600000;
}

/** Una cosa a la que habia que responder: el entreno de la semana o el domingo (uno o dos partidos, una sola respuesta). */
export type Unidad = {
  clase: "entreno" | "domingo";
  eventos: string[];
  texto: string;                  // «Entreno 18/11», «Domingo 22/11»
  plazo: Date;                    // hora limite para responder
  /** Estado que ven los jugadores: va | no | duda | sin_responder. */
  estado: string;
  /** De donde sale el estado: el mismo (jugador), un gestor, el sistema (duda cerrada), una ausencia que puso el,
   *  «no suele entrenar» por defecto, o nada. */
  origen: "jugador" | "gestor" | "sistema" | "ausencia" | "defecto" | "sin_datos" | null;
  respondidoEn: Date | null;      // cuando respondio el mismo (la primera vez, si se sabe)
  avisoEn: Date | null;           // primer aviso para responder que se le envio
  /** Asistencia real (pase de lista / «¿Falto alguien ayer?»): fue | falto | excusa | null = nadie ha dicho nada. */
  asistencia: "fue" | "falto" | "excusa" | null;
  convocado?: boolean;            // en el domingo: estaba en la convocatoria aprobada
  enHoja?: boolean;               // en el domingo: sale en la hoja de algun partido
};

export type DetalleUnidad = { clase: Unidad["clase"]; texto: string; respuesta: number; asistencia: number; como: string };

export function compromisoUnidad(u: Unidad, P: Parametros): DetalleUnidad {
  let respuesta = 0, como = "";
  if (u.origen === "jugador" && u.respondidoEn) {
    if (u.respondidoEn.getTime() > u.plazo.getTime()) como = "respondió fuera de plazo";
    else if (!u.avisoEn || u.respondidoEn.getTime() <= u.avisoEn.getTime() || horasActivas(u.avisoEn, u.respondidoEn, P.horasRapida) <= P.horasRapida) { respuesta = P.respuestaRapida; como = "respondió rápido"; }
    else { respuesta = P.respuestaATiempo; como = "respondió antes del plazo"; }
  } else if (u.origen === "ausencia") { respuesta = P.respuestaATiempo; como = "avisó de su ausencia"; }
  else if (u.origen === "gestor") como = "respondió un gestor por él";
  else if (u.origen === "sistema") como = "no confirmó su duda";
  else if (u.origen === "defecto") como = "no va por defecto";
  else if (u.origen === "sin_datos") como = "sin datos de respuestas";
  else if (u.estado === "sin_responder") { respuesta = P.sinRespuesta; como = "no respondió"; }

  let asistencia = 0;
  const dijoVoy = u.estado === "va";
  if (u.clase === "entreno") {
    if (u.asistencia === "fue" && !dijoVoy) { asistencia = P.entrenoAsistido; respuesta = 0; como = "vino sin avisar"; }
    else if (u.asistencia === "fue" || (u.asistencia === null && dijoVoy)) asistencia = P.entrenoAsistido;
    else if (u.asistencia === "falto" && dijoVoy) { asistencia = P.planton; como = `${como ? `${como}; ` : ""}no vino`; }
  } else if (u.asistencia === "falto" && dijoVoy && u.convocado && !u.enHoja) { asistencia = P.planton; como = `${como ? `${como}; ` : ""}no vino`; }
  return { clase: u.clase, texto: u.texto, respuesta, asistencia, como };
}

export type PuntosJugador = {
  rendimiento: number; compromiso: number; total: number;
  minutos: number; convocado: boolean; doblete: boolean;
  partidos: DetallePartido[]; unidades: DetalleUnidad[];
  /** Solo con el interruptor «mitadSinRespuesta» encendido: jugo sin haber contestado el mismo a tiempo y su rendimiento va a la mitad. */
  mitad?: boolean;
};

/** Total del jugador en la jornada: rendimiento + compromiso, minimo 0. Sin minutos, solo suma compromiso. */
export function puntosJugador(lineas: LineaPartido[], unidades: Unidad[], convocado: boolean, P: Parametros): PuntosJugador {
  const r = rendimiento(lineas, P);
  const det = unidades.map((u) => compromisoUnidad(u, P));
  // Tope semanal: limita solo por arriba (los negativos cuentan enteros).
  const compromiso = Math.min(P.topeCompromiso, det.reduce((s, d) => s + d.respuesta + d.asistencia, 0));
  // Interruptor (apagado de salida): jugo sin haber contestado EL MISMO en la web antes del plazo del domingo. Una respuesta
  // puesta por un gestor (o por el sistema, o una ausencia) no cuenta como suya. Sin datos de respuestas, no se aplica.
  const mitad = P.mitadSinRespuesta > 0 && r.partidos.length > 0 && !contestoATiempo(unidades);
  const rend = mitad ? Math.ceil(r.total / 2) : r.total;
  return {
    rendimiento: rend, compromiso, total: Math.max(0, rend + compromiso),
    minutos: r.partidos.reduce((s, p) => s + p.minutos, 0), convocado: convocado || r.partidos.length > 0, doblete: r.doblete,
    partidos: r.partidos, unidades: det, ...(mitad ? { mitad: true } : {}),
  };
}

/** ¿Contesto el mismo, en la web y antes del plazo, al domingo? Si no estaba invitado o el evento no tiene datos de
 *  respuestas (los anteriores a responder en la web), cuenta que si: no se le puede pedir. */
export function contestoATiempo(unidades: Unidad[]) {
  const d = unidades.find((u) => u.clase === "domingo");
  if (!d || d.origen === "sin_datos") return true;
  return d.origen === "jugador" && !!d.respondidoEn && d.respondidoEn.getTime() <= d.plazo.getTime();
}

/** Clave para casar el nombre de la hoja («MENDEZ ESCANDON, FERNANDO ANTONIO») con el oficial de la ficha. */
export const claveHoja = (n: string) => n.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Casa los nombres de la hoja con las fichas: igual; o uno empieza por el otro (un segundo nombre de mas) si solo hay
 *  un candidato; o un alias puesto a mano. Devuelve el mapa y los que no casan (se avisa a los gestores: nunca se adivina). */
export function casarNombres(nombresHoja: string[], fichas: { person_id: string; nombre_oficial: string }[], alias: Record<string, string> = {}) {
  const porClave = new Map(fichas.map((f) => [claveHoja(f.nombre_oficial), f.person_id]));
  const ids = new Set(fichas.map((f) => f.person_id));
  const aliasPorClave = new Map(Object.entries(alias).map(([k, v]) => [claveHoja(k), v]));
  const mapa = new Map<string, string>();
  const sinCasar: string[] = [];
  const aproximados: string[] = [];
  for (const nombre of [...new Set(nombresHoja)]) {
    const c = claveHoja(nombre);
    const a = aliasPorClave.get(c);
    if (a && ids.has(a)) { mapa.set(nombre, a); continue; }
    const exacto = porClave.get(c);
    if (exacto) { mapa.set(nombre, exacto); continue; }
    const cerca = [...porClave].filter(([k]) => c.startsWith(`${k} `) || k.startsWith(`${c} `));
    if (cerca.length === 1) { mapa.set(nombre, cerca[0][1]); aproximados.push(nombre); }
    else sinCasar.push(nombre);
  }
  return { mapa, sinCasar, aproximados };
}
