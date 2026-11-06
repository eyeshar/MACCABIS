import "server-only";
import ligaJson from "@/data/liga.json";
import seasonJson from "@/data/estadisticas/season_2026-27.json";
import seasonAnteriorJson from "@/data/estadisticas/season_2025-26.json";
import equipJson from "@/data/equipaciones.json";
import historialRivalesJson from "@/data/historialRivales.json";
import { clave, equipoPorNombre, type Equipaciones } from "@/data/avisosEquipacion";
import { hoyMadrid, sumarDias } from "@/lib/dias";
import { limiteDudas } from "@/lib/avisos/horario";
import { avisoDeEvento, cargarEventos, cargarPistas, type Cliente } from "@/lib/eventos/datos";
import { limpiarRival, pistaEfectiva, quedadaPorDefecto, hhmm, type EventoFila, type Pista } from "@/lib/eventos/dominio";
import { nombreRival } from "@/lib/equipacion";
import { quienResponde } from "@/lib/respuestas/dominio";
import { ausenciaQueCubre, respuestaEfectiva } from "@/lib/disponibilidad/porDefecto";
import { cargarAusencias } from "./defecto";
import { calibrar, correccionSesgo, estadisticasGrupo, historiales, resumenCalibracion, tasasPorLetra, TEMPORADA_PROYECCION, type DatosProyeccion, type DificultadRival, type HistorialRival, type LigaJson, type Letra, type SeasonJson } from "./proyeccion";
import { domingosFueraDe, proponerDificultad, type DatosPrivados, type Equipo, type RespuestaPartido } from "./motor";
import type { Cambio, Contexto, FilaConvocatoria, FilaPrivada, JugadorVista, PartidoVista } from "./vista";
import { desempateEncendido, registroNoConvocados, type DomingoReg, type JugadorReg, type RegistroJugador, type RespuestaReg } from "./noConvocados";

// Lectura de todo lo que necesita la convocatoria de un domingo (D107), con la sesion del GESTOR: la base (RLS +
// is_gestor) decide quien lee. Los datos privados (jugadores_privado) solo los devuelve la base a los gestores.
// D173: la tarea de avisos (rol de servicio, `servicio: true`) lee lo mismo con su hora (`ahora`); los datos privados le
// llegan por convocatoria_privados_tarea() (desde D146 no lee jugadores_privado) y nunca salen en un aviso.

const NOMBRE_GRUPO: Record<Equipo, "G1" | "G2"> = { MdA: "G1", MdL: "G2" };
type Liga = { grupos: Record<string, { jornadas_cargadas: number[]; clasificacion: { pos: number; equipo: string; pj: number; dif: number }[] }> };
type Season = { partidos: { pn: number; equipo: string; fecha: string }[]; players: { person_id?: string; conv: number; games: { pn: number; eq: string; played?: boolean }[] }[] };

/** Partidos convocado, domingos doblados y fechas en que fue convocado en la temporada, de las hojas de estadistica
 *  (public: sin datos privados). */
export function estadisticasTemporada() {
  const s = seasonJson as unknown as Season;
  const fechaDe = new Map(s.partidos.map((p) => [`${p.pn}-${p.equipo}`, p.fecha]));
  const out = new Map<string, { convocados: number; doblajes: number; fechas: Set<string> }>();
  for (const p of s.players) {
    if (!p.person_id) continue;
    const porFecha = new Map<string, Set<string>>();
    for (const g of p.games ?? []) {
      const f = fechaDe.get(`${g.pn}-${g.eq}`);
      if (f) porFecha.set(f, new Set([...(porFecha.get(f) ?? []), g.eq]));
    }
    out.set(p.person_id, { convocados: p.conv ?? 0, doblajes: [...porFecha.values()].filter((x) => x.size === 2).length, fechas: new Set(porFecha.keys()) });
  }
  return out;
}

/** Dificultad propuesta de un partido con la clasificacion de la liga en curso. */
export function dificultadPropuesta(equipo: Equipo, rival: string | null) {
  const liga = ligaJson as unknown as Liga;
  const g = liga.grupos[NOMBRE_GRUPO[equipo]];
  const fila = g && rival ? g.clasificacion.find((c) => clave(c.equipo) === clave(rival)) ?? null : null;
  return proponerDificultad(fila, g?.clasificacion.length ?? 0, NOMBRE_GRUPO[equipo], g ? Math.max(0, ...g.jornadas_cargadas) || null : null);
}

/** Nombres de equipo comparables entre la liga, el calendario y las hojas («Mejorada 2012 C.B..» = «Mejorada 2012»). */
const claveEquipo = (n: string) => clave(equipoPorNombre(equipJson as unknown as Equipaciones, n)?.nombre ?? n);

/** Historial de un rival en temporadas anteriores (D133), por su nombre comparable (data/historial_rivales_2026-27.json). */
export function historialRival(rival: string | null): HistorialRival | null {
  if (!rival) return null;
  const k = claveEquipo(rival);
  const r = (historialRivalesJson as { rivales: { nombre: string; temporada: string | null; factor: number | null; pj: number }[] }).rivales.find((x) => claveEquipo(x.nombre) === k);
  return r?.temporada && r.factor ? { temporada: r.temporada, factor: r.factor, pj: r.pj } : null;
}

/** Datos de la proyeccion de anotacion (D124, D133): historial de cada jugador (temporada actual y anterior), su letra de
 *  Ataque (privada), la tasa de cada letra, el rival de cada partido del domingo (con su historial), la calibracion con lo
 *  ya jugado (con la dificultad que se marco en cada convocatoria aprobada) y la correccion de sesgo que sale de ella. */
export function datosProyeccion(jugadores: { person_id: string; nombre: string }[], letras: Map<string, Letra | null>, partidos: { equipo: Equipo; rival: string | null; jornada: number | null }[],
  dificultades: Map<string, Partial<Record<Equipo, DificultadRival>>> = new Map()): DatosProyeccion {
  const actual = seasonJson as unknown as SeasonJson, anterior = seasonAnteriorJson as unknown as SeasonJson, liga = ligaJson as unknown as LigaJson;
  const hist = historiales(actual, anterior);
  const ids = jugadores.map((j) => j.person_id);
  const tasas = tasasPorLetra(ids.map((id) => ({ letra: letras.get(id) ?? null, hist: hist(id) })));
  const nombre = new Map(jugadores.map((j) => [j.person_id, j.nombre]));
  const puntos = calibrar({ actual, anterior, liga, clave: claveEquipo, letra: (id) => letras.get(id) ?? null, nombre: (id) => nombre.get(id) ?? id, plantilla: ids,
    dificultad: (fecha, eq) => dificultades.get(fecha)?.[eq.toUpperCase() === "MDA" ? "MdA" : "MdL"] ?? null, historial: historialRival });
  const r = resumenCalibracion(puntos);
  return {
    hist: Object.fromEntries(ids.map((id) => [id, hist(id)])),
    letras: Object.fromEntries(ids.map((id) => [id, letras.get(id) ?? null])),
    tasas: { tasas: tasas.tasas, media: tasas.media },
    partidos: Object.fromEntries(partidos.map((p) => {
      const est = estadisticasGrupo(liga, NOMBRE_GRUPO[p.equipo], claveEquipo, p.jornada ?? undefined);
      return [p.equipo, { rival: est.rival(p.rival), grupo: est.grupo, jornadas: est.jornadas, historial: historialRival(p.rival) }];
    })),
    calibracion: r ? { ...r, puntos } : null,
    correccion: correccionSesgo(puntos),
    temporada: TEMPORADA_PROYECCION,
  };
}

// ---------------------------------------------------------------- registro de no convocados (regla 4.3), solo gestores
type FilaRespuestaReg = { evento_id: string; person_id: string; respuesta: string; cambiado_en: string | null; origen: string | null };
type Aprobada = { fecha: string; equipos: Record<string, { person_id: string }[]> };

/** Los domingos ya jugados con su cierre (martes 12:00, D173) y quién entró: la convocatoria aprobada y las hojas de
 *  estadística de ese día (si no hay ninguna de las dos, null: ese domingo no cuenta). */
function domingosRegistro(pasados: EventoFila[], aprobadas: Aprobada[], stats: ReturnType<typeof estadisticasTemporada>): DomingoReg[] {
  const enHojas = new Map<string, Set<string>>();
  for (const [pid, s] of stats) for (const f of s.fechas) enHojas.set(f, new Set([...(enHojas.get(f) ?? []), pid]));
  const porFecha = new Map<string, EventoFila[]>();
  for (const e of pasados) porFecha.set(e.fecha, [...(porFecha.get(e.fecha) ?? []), e]);
  return [...porFecha.entries()].map(([fecha, es]) => {
    const conv = aprobadas.find((c) => c.fecha === fecha);
    const deConv = conv ? Object.values(conv.equipos ?? {}).flat().map((x) => x.person_id) : null;
    const deHojas = enHojas.has(fecha) ? [...enHojas.get(fecha)!] : null;
    const primero = [...es].sort((a, b) => ((a.inicio ?? "") < (b.inicio ?? "") ? -1 : 1))[0];
    return {
      fecha, jornada: primero.jornada,
      cierre: limiteDudas({ tipo: "liga", fecha, inicio: primero.inicio, oficial: true }).toISOString(),
      convocados: deConv || deHojas ? [...new Set([...(deConv ?? []), ...(deHojas ?? [])])] : null,
      fuente: deConv && deHojas ? "convocatoria y hojas" : deConv ? "convocatoria" : deHojas ? "hojas" : null,
    };
  });
}
function respuestasRegistro(filas: FilaRespuestaReg[], eventos: Map<string, EventoFila>): RespuestaReg[] {
  return filas.flatMap((r) => {
    const e = eventos.get(r.evento_id);
    return e && (e.equipo === "MdA" || e.equipo === "MdL") ? [{ fecha: e.fecha, equipo: e.equipo, person_id: r.person_id, respuesta: r.respuesta, cambiado_en: r.cambiado_en, origen: r.origen }] : [];
  });
}
function jugadorRegistro(j: { person_id: string; ficha_mda: boolean; ficha_mdl: boolean; rol: string }, p: FilaPrivada | undefined): JugadorReg {
  return { person_id: j.person_id, ficha: { MdA: j.ficha_mda, MdL: j.ficha_mdl }, soloEntreno: j.rol === "solo_entreno" || !!p?.nunca_partidos, sancionadoHasta: p?.sancionado_hasta_jornada ?? null };
}

export type FilaRegistro = { person_id: string; nombre: string; fichas: string; reg: RegistroJugador };
/** Gestión › No convocados: el registro de toda la plantilla activa con los domingos de liga ya jugados (antes de hoy). Con
 *  la sesión del GESTOR: la base solo devuelve respuestas, convocatorias y datos privados a los gestores (RLS). */
export async function cargarRegistro(sb: Cliente): Promise<{ filas: FilaRegistro[]; domingos: DomingoReg[]; desempate: boolean }> {
  const hoy = hoyMadrid();
  const eventos = await cargarEventos(sb);
  const pasados = eventos.filter((e) => e.tipo === "liga" && e.estado === "programado" && (e.equipo === "MdA" || e.equipo === "MdL") && e.fecha < hoy);
  const [jug, resp, priv, conv] = await Promise.all([
    sb.from("jugadores").select("person_id, nombre_visible, ficha_mda, ficha_mdl, activo, rol").order("nombre_visible"),
    pasados.length ? sb.from("respuestas").select("evento_id, person_id, respuesta, cambiado_en, origen").in("evento_id", pasados.map((e) => e.id)).eq("respuesta", "va") : Promise.resolve({ data: [], error: null }),
    sb.from("jugadores_privado").select("person_id, nunca_partidos, sancionado_hasta_jornada"),
    sb.from("convocatorias").select("fecha, equipos").eq("estado", "aprobada").lt("fecha", hoy),
  ]);
  if (jug.error) throw new Error(`jugadores: ${jug.error.message}`);
  if (resp.error) throw new Error(`respuestas: ${resp.error.message}`);
  const privados = new Map((((faltaTabla(priv.error) ? [] : priv.data) ?? []) as FilaPrivada[]).map((p) => [p.person_id, p]));
  const activos = ((jug.data ?? []) as { person_id: string; nombre_visible: string; ficha_mda: boolean; ficha_mdl: boolean; activo: boolean; rol: string }[]).filter((j) => j.activo && j.rol !== "entrenador");
  const domingos = domingosRegistro(pasados, (faltaTabla(conv.error) ? [] : conv.data ?? []) as Aprobada[], estadisticasTemporada());
  const reg = registroNoConvocados(domingos, respuestasRegistro((resp.data ?? []) as FilaRespuestaReg[], new Map(pasados.map((e) => [e.id, e]))),
    activos.map((j) => jugadorRegistro(j, privados.get(j.person_id) as FilaPrivada | undefined)));
  const filas = activos.map((j) => ({ person_id: j.person_id, nombre: j.nombre_visible, fichas: [j.ficha_mda && "MdA", j.ficha_mdl && "MdL"].filter(Boolean).join(" + ") || "sin ficha", reg: reg.get(j.person_id)! }));
  return { filas, domingos: [...domingos].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)), desempate: desempateEncendido(process.env.CONVOCATORIA_DESEMPATE_NO_CONVOCADOS) };
}

const faltaTabla = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/.test(e.message ?? ""));

export function sitioDe(e: EventoFila, pistas: Pista[]) {
  const pe = pistaEfectiva(e, pistas);
  if (pe.porConfirmar || !pe.pista) return { sitio: "pista por confirmar", direccion: null };
  return { sitio: `${pe.pista.nombre_corto ?? pe.pista.nombre}${e.numero_pista ? `, pista ${e.numero_pista}` : ""}`, direccion: pe.pista.direccion };
}

export type OpcionesContexto = {
  servicio?: boolean; ahora?: Date;
  /** Datos privados ya leídos (el simulacro en solo lectura contra el real los trae por su conexión). */
  privados?: FilaPrivada[];
};

export async function cargarContexto(sb: Cliente, fechaPedida?: string, opciones: OpcionesContexto = {}): Promise<Contexto | null> {
  const ahora = opciones.ahora ?? new Date();
  const hoy = opciones.ahora ? ahora.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) : hoyMadrid();
  const [eventos, pistas] = await Promise.all([cargarEventos(sb), cargarPistas(sb)]);
  const liga = eventos.filter((e) => e.tipo === "liga" && e.estado === "programado" && (e.equipo === "MdA" || e.equipo === "MdL"));
  const domingos = [...new Map(liga.filter((e) => e.fecha >= hoy).map((e) => [e.fecha, { fecha: e.fecha, jornada: e.jornada }])).values()].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const fecha = fechaPedida && liga.some((e) => e.fecha === fechaPedida) ? fechaPedida : domingos[0]?.fecha;
  if (!fecha) return null;
  const delDia = liga.filter((e) => e.fecha === fecha).sort((a, b) => ((a.inicio ?? "") < (b.inicio ?? "") ? -1 : 1));
  const jornada = delDia[0]?.jornada ?? null;
  const ids = delDia.map((e) => e.id);
  const entrenos = eventos.filter((e) => e.tipo === "entreno" && e.estado === "programado" && e.fecha >= sumarDias(fecha, -28) && e.fecha < fecha && e.fecha <= hoy).map((e) => e.id);
  // Domingos ya jugados (regla 4.2, D109): para saber quien estuvo disponible y se quedo fuera.
  const pasados = liga.filter((e) => e.fecha < fecha && e.fecha < hoy);

  const [jug, resp, respEnt, priv, conv, respPas, convPas, ausencias] = await Promise.all([
    sb.from("jugadores").select("person_id, nombre_visible, ficha_mda, ficha_mdl, entrena, activo, rol").order("nombre_visible"),
    sb.from("respuestas").select("evento_id, person_id, respuesta, motivo, cambiado_en").in("evento_id", ids),
    entrenos.length ? sb.from("respuestas").select("person_id").in("evento_id", entrenos).eq("respuesta", "va") : Promise.resolve({ data: [], error: null }),
    opciones.privados ? Promise.resolve({ data: opciones.privados, error: null })
      : opciones.servicio ? sb.rpc("convocatoria_privados_tarea")
      : sb.from("jugadores_privado").select("person_id, posicion, base_reserva, nivel, dobla, regla, regla_equipo, sancionado_hasta_jornada, nota, nota_ataque, no_suele_entrenar, nunca_partidos, reserva"),
    // «*»: así vale antes y después de la migración de D173 (automatica_en), también en la vista previa contra el real.
    sb.from("convocatorias").select("*").eq("fecha", fecha).maybeSingle(),
    // Con la hora y el origen: el registro de no convocados (regla 4.3) solo suma los «voy» dados a tiempo.
    pasados.length ? sb.from("respuestas").select("evento_id, person_id, respuesta, cambiado_en, origen").in("evento_id", pasados.map((e) => e.id)).eq("respuesta", "va") : Promise.resolve({ data: [], error: null }),
    // Todas las aprobadas: las anteriores para el historial de domingos y la dificultad marcada para la proyeccion (D133).
    sb.from("convocatorias").select("fecha, equipos, dificultad").eq("estado", "aprobada"),
    cargarAusencias(sb),
  ]);
  if (jug.error) throw new Error(`jugadores: ${jug.error.message}`);
  if (resp.error) throw new Error(`respuestas: ${resp.error.message}`);
  const sinMigracion = faltaTabla(priv.error) || faltaTabla(conv.error);
  if (!sinMigracion && priv.error) throw new Error(`datos privados: ${priv.error.message}`);
  if (!sinMigracion && conv.error) throw new Error(`convocatoria: ${conv.error.message}`);
  const fila = (sinMigracion ? null : (conv.data as FilaConvocatoria | null)) ?? null;
  let cambios: Cambio[] = [];
  if (fila) {
    const { data } = await sb.from("convocatoria_cambios").select("id, en, por_nombre, por_user_id, accion, person_id, equipo, motivo, nota").eq("convocatoria_id", fila.id).order("en", { ascending: false }).limit(100);
    // Las marcas antiguas de la copia a SportEasy (accion «sporteasy», antes de D153) no se muestran.
    cambios = ((data ?? []) as Cambio[]).filter((c) => c.accion !== "sporteasy");
  }

  const privados = new Map(((sinMigracion ? [] : priv.data) ?? [] as FilaPrivada[]).map((p: FilaPrivada) => [p.person_id, p]));
  const stats = estadisticasTemporada();
  const entrenosDe = new Map<string, number>();
  for (const r of (respEnt.data ?? []) as { person_id: string }[]) entrenosDe.set(r.person_id, (entrenosDe.get(r.person_id) ?? 0) + 1);
  // Historial de domingos: disponible = dijo «voy» a algun partido de liga de ese domingo con un equipo del que tiene
  // ficha; convocado = sale en las hojas de estadistica de ese domingo o en su convocatoria aprobada.
  const eventoPasado = new Map(pasados.map((e) => [e.id, e]));
  const disponibleEl = new Map<string, Set<string>>(); // fecha -> person_id|equipo
  for (const r of (respPas.data ?? []) as { evento_id: string; person_id: string }[]) {
    const e = eventoPasado.get(r.evento_id);
    if (e) disponibleEl.set(e.fecha, new Set([...(disponibleEl.get(e.fecha) ?? []), `${r.person_id}|${e.equipo}`]));
  }
  const convocadoEl = new Map<string, Set<string>>(); // fecha -> person_id
  const aprobadas = (sinMigracion ? [] : convPas.data ?? []) as { fecha: string; equipos: Record<string, { person_id: string }[]>; dificultad: Partial<Record<Equipo, { valor: DificultadRival }>> | null }[];
  for (const c of aprobadas.filter((x) => x.fecha < fecha))
    convocadoEl.set(c.fecha, new Set(Object.values(c.equipos ?? {}).flat().map((x) => x.person_id)));
  const dificultades = new Map(aprobadas.map((c) => [c.fecha, Object.fromEntries(Object.entries(c.dificultad ?? {}).map(([eq, d]) => [eq, d?.valor]).filter(([, v]) => !!v)) as Partial<Record<Equipo, DificultadRival>>]));
  const fechasPasadas = [...new Set(pasados.map((e) => e.fecha))].sort().reverse();
  const domingosFuera = (j: { person_id: string; ficha_mda: boolean; ficha_mdl: boolean }) => domingosFueraDe(fechasPasadas.map((f) => ({
    disponible: [...(disponibleEl.get(f) ?? [])].some((k) => k === `${j.person_id}|MdA` ? j.ficha_mda : k === `${j.person_id}|MdL` ? j.ficha_mdl : false),
    convocado: !!stats.get(j.person_id)?.fechas.has(f) || !!convocadoEl.get(f)?.has(j.person_id),
  })));

  // Registro de no convocados (regla 4.3, solo gestores): de los mismos domingos ya jugados, respuestas y convocatorias.
  const activosReg = ((jug.data ?? []) as { person_id: string; ficha_mda: boolean; ficha_mdl: boolean; activo: boolean; rol: string }[]).filter((j) => j.activo && j.rol !== "entrenador");
  const registro = registroNoConvocados(
    domingosRegistro(pasados, aprobadas.filter((x) => x.fecha < fecha), stats),
    respuestasRegistro((respPas.data ?? []) as FilaRespuestaReg[], eventoPasado),
    activosReg.map((j) => jugadorRegistro(j, privados.get(j.person_id) as FilaPrivada | undefined)),
  );

  const partidos: PartidoVista[] = delDia.map((e) => {
    const eq = e.equipo as Equipo;
    const prop = dificultadPropuesta(eq, e.rival);
    const guardada = fila?.dificultad?.[eq];
    const aviso = avisoDeEvento(e);
    const inicio = hhmm(e.inicio);
    return {
      evento_id: e.id, jornada: e.jornada, equipo: eq, rival: nombreRival(limpiarRival(e.rival)) || limpiarRival(e.rival), es_local: e.es_local, inicio,
      encuentro: hhmm(e.quedada) ?? quedadaPorDefecto(inicio), ...sitioDe(e, pistas),
      lineaEquipacion: aviso?.convocatoria ?? null,
      aviso: aviso ? { hay: aviso.hay, tipo: aviso.tipo, etiqueta: aviso.etiqueta, texto: aviso.texto } : null,
      dificultad: { valor: guardada?.valor ?? prop.dificultad, propuesta: prop.dificultad, porque: prop.porque, manual: !!guardada && guardada.valor !== prop.dificultad },
    };
  });

  const respDe = new Map<string, { respuesta: RespuestaPartido; motivo: string | null; cambiado_en: string | null }>();
  for (const r of (resp.data ?? []) as { evento_id: string; person_id: string; respuesta: RespuestaPartido; motivo: string | null; cambiado_en: string | null }[]) respDe.set(`${r.evento_id}|${r.person_id}`, r);
  // D173: la ultima propuesta (automatica o «Usar propuesta» / «Recalcular»): quien dice «voy» despues sale como «Respondió
  // después de la propuesta», con «Rehacer propuesta». No entra solo.
  const ultimaPropuesta = cambios.filter((c) => c.accion === "propuesta" || c.accion === "recalcular").map((c) => c.en).sort().at(-1) ?? null;
  const activos = ((jug.data ?? []) as { person_id: string; nombre_visible: string; ficha_mda: boolean; ficha_mdl: boolean; entrena: boolean; activo: boolean; rol: "jugador" | "solo_entreno" | "entrenador" }[])
    .filter((j) => j.activo && j.rol !== "entrenador");
  // La regla unica (`respuestaEfectiva`, D146 y D150): un «nunca a partidos» sin responder no es invitado; sin responder y
  // con una ausencia que cubre el domingo, «no» (con el motivo de la ausencia, solo para gestores).
  const efectiva = (e: EventoFila, j: (typeof activos)[number], p: FilaPrivada | undefined) =>
    respuestaEfectiva(e, p, respDe.get(`${e.id}|${j.person_id}`)?.respuesta ?? "sin_responder", { ausencia: ausenciaQueCubre(j.person_id, fecha, ausencias) });
  const invitadoA = (j: (typeof activos)[number], p: FilaPrivada | undefined) => delDia
    .filter((e) => quienResponde(e, j) && !efectiva(e, j, p).fuera)
    .map((e) => e.equipo as Equipo);
  const jugadores: JugadorVista[] = activos.map((j) => {
    const p = privados.get(j.person_id) as FilaPrivada | undefined;
    const privado: DatosPrivados | null = p
      ? { posicion: p.posicion, base_reserva: p.base_reserva, nivel: p.nivel, dobla: p.dobla, regla: p.regla === "fijo" && p.regla_equipo ? { tipo: "fijo", equipo: p.regla_equipo } : p.regla === "comodin" ? { tipo: "comodin" } : null, nunca_partidos: !!p.nunca_partidos, reserva: !!p.reserva }
      : null;
    const respuesta: Partial<Record<Equipo, RespuestaPartido>> = {};
    const motivoNo: Partial<Record<Equipo, string | null>> = {};
    for (const e of delDia) {
      const r = respDe.get(`${e.id}|${j.person_id}`);
      const ef = efectiva(e, j, p);
      respuesta[e.equipo as Equipo] = ef.respuesta;
      if (ef.respuesta === "no") motivoNo[e.equipo as Equipo] = r?.motivo ?? ef.ausencia?.motivo ?? null;
    }
    const st = stats.get(j.person_id);
    const tarde = !!ultimaPropuesta && delDia.some((e) => respuesta[e.equipo as Equipo] === "va" && (respDe.get(`${e.id}|${j.person_id}`)?.cambiado_en ?? "") > ultimaPropuesta);
    return {
      person_id: j.person_id, nombre: j.nombre_visible, ficha: { MdA: j.ficha_mda, MdL: j.ficha_mdl }, solo_entreno: j.rol === "solo_entreno",
      respuesta, privado, sancionado: !!(p?.sancionado_hasta_jornada && jornada != null && p.sancionado_hasta_jornada >= jornada),
      convocados: st?.convocados ?? 0, doblajes: st?.doblajes ?? 0, entrenos4: entrenosDe.get(j.person_id) ?? 0, domingosFuera: domingosFuera(j),
      rachaFuera: registro.get(j.person_id)?.racha ?? 0,
      fuera: { racha: registro.get(j.person_id)?.racha ?? 0, total: registro.get(j.person_id)?.total ?? 0, soloEntreno: !!registro.get(j.person_id)?.soloEntreno },
      // D146: un «nunca a partidos» sin responder no cuenta como invitado (ni en «sin responder» ni en los contadores).
      invitado: invitadoA(j, p).length > 0, invitadoA: invitadoA(j, p),
      motivoNo, sancionHasta: p?.sancionado_hasta_jornada ?? null, respondioTarde: tarde,
    };
  });

  // D141: el limite de las dudas es el del primer partido del domingo (los dos comparten martes).
  const limiteDe = delDia.length ? new Date(Math.min(...delDia.map((e) => limiteDudas({ tipo: e.tipo, fecha: e.fecha, inicio: e.inicio, oficial: true }).getTime()))) : null;

  // Contadores del domingo (los invitados a algun partido): van a alguno / sin responder (o duda) / no van a ninguno.
  const inv = jugadores.filter((j) => j.invitado);
  const valores = (j: JugadorVista) => j.invitadoA.map((e) => j.respuesta[e] ?? "sin_responder");
  const contadores = { van: 0, sin: 0, no: 0, dudan: 0, invitados: inv.length };
  for (const j of inv) {
    const v = valores(j);
    if (v.includes("va")) contadores.van++;
    else if (v.length && v.every((x) => x === "no")) contadores.no++;
    else { contadores.sin++; if (v.includes("duda")) contadores.dudan++; }
  }

  return {
    fecha, jornada, partidos, jugadores, convocatoria: fila, cambios, contadores,
    limiteDudas: limiteDe?.toISOString() ?? null, dudasAbiertas: limiteDe ? ahora.getTime() < limiteDe.getTime() : false,
    ultimaPropuesta,
    eventoRespuestas: delDia[0]?.id ?? null, sinMigracion,
    desempateNoConvocados: desempateEncendido(process.env.CONVOCATORIA_DESEMPATE_NO_CONVOCADOS),
    proyeccion: datosProyeccion(jugadores.map((j) => ({ person_id: j.person_id, nombre: j.nombre })), new Map(jugadores.map((j) => [j.person_id, ((privados.get(j.person_id) as FilaPrivada | undefined)?.nota_ataque ?? null) as Letra | null])),
      delDia.map((e) => ({ equipo: e.equipo as Equipo, rival: e.rival, jornada: e.jornada })), dificultades),
    sinDatosPrivados: jugadores.filter((j) => j.invitado && (!j.privado || !j.privado.posicion || !j.privado.nivel)).length,
    domingos: domingos.slice(0, 6),
  };
}

