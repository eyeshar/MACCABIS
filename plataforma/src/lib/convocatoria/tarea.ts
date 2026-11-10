import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encolar, type FilaAviso } from "@/lib/avisos/servidor";
import { enSilencio, horaDeEnvio, limiteDudas, lunesDe, madrid, sumarDias } from "@/lib/avisos/horario";
import type { Cliente } from "@/lib/eventos/datos";
import { cargarContexto } from "./datos";
import { faltasMinimo, ordenPartidos, proponer, revisar, roturas, sugerirRecambio, type Convocatoria, type Equipo } from "./motor";
import { firmaConvocatoria, problemasEquipo, textoBaja, textoCalendarioRompe, textoPropuestaLista, textoSinAprobar, textoVoyTardio, textoBorradorAMano } from "./mensajes";
import { entradaDe, type Contexto } from "./vista";
import { proyeccionDe } from "./proyeccion";
import { riesgos, textoRiesgoPush } from "./riesgo";

// La rutina C la hace la plataforma sola (D173), dentro de la tarea de avisos de cada 15 minutos (pg_cron -> /api/avisos/tarea):
//   - tras el cierre del martes a las 12:00, la PROPUESTA AUTOMATICA como borrador (nunca aprueba; no pisa una aprobada ni un
//     borrador tocado a mano) y un push solo a Ivan (gestores.recibe_propuesta) con lo que trae; si NO la hace porque hay un
//     borrador tocado a mano, se lo dice a Ivan (una vez) en vez de callarse (J5, 10/11/2026). Un borrador sin jugadores no
//     cuenta como tocado (migracion 20261110140000): se propone encima;
//   - martes 19:00 sin aprobar: recordatorio a Ivan; 21:00: a los tres gestores (horas de silencio de D155);
//   - con la convocatoria aprobada: la baja de un convocado («Sale Jon (MdA). Propuesta: entra Fernando M.») y el «voy»
//     tardio de alguien sin convocar, este solo si un equipo esta por debajo de un minimo (si no, queda en el registro).
// Todo idempotente: cada push lleva una clave unica en avisos_registro y la propuesta se guarda una sola vez (automatica_en).
// Sin niveles en ningun texto (D39): solo nombres, equipos y el aviso de linea («faltan interiores»).

const MARGEN = 3 * 3600 * 1000;
const URL_CONV = (fecha: string) => `/gestion/convocatoria?fecha=${fecha}`;
export const urlRecambio = (fecha: string, sale: string, equipo: Equipo) => `/gestion/convocatoria/recambio?fecha=${fecha}&sale=${encodeURIComponent(sale)}&equipo=${equipo}`;

type Gestor = { user_id: string | null; nombre: string; recibe_propuesta?: boolean };
type FilaConv = { id: string; fecha: string; estado: "borrador" | "aprobada"; origen: string | null; equipos: Convocatoria; automatica_en?: string | null; aprobada_en: string | null };
type EventoLiga = { id: string; fecha: string; inicio: string | null; tipo: string; equipo: string; estado: string; oficial?: boolean; borrado_en?: string | null };

const faltaFuncion = (e: { code?: string } | null) => !!e && ["PGRST202", "42883"].includes(e.code ?? "");

/** Domingos con partido de liga, su cierre (limiteDudas) y el inicio del primer partido. */
function domingosDe(eventos: EventoLiga[]) {
  const m = new Map<string, EventoLiga[]>();
  for (const e of eventos) if (e.tipo === "liga" && e.estado === "programado" && e.oficial !== false && !e.borrado_en && (e.equipo === "MdA" || e.equipo === "MdL")) m.set(e.fecha, [...(m.get(e.fecha) ?? []), e]);
  return [...m.entries()].map(([fecha, ps]) => ({
    fecha, partidos: ps,
    cierre: limiteDudas({ tipo: "liga", fecha, inicio: ps[0].inicio, oficial: true }),
    inicio: new Date(Math.min(...ps.map((e) => madrid(e.fecha, e.inicio ? String(e.inicio).slice(0, 5) : "00:00").getTime()))),
  }));
}

/** Recuento por equipo de una convocatoria, para los textos a gestores. */
function recuentos(ctx: Contexto, conv: Convocatoria) {
  const rev = revisar(entradaDe(ctx), conv);
  return ctx.partidos.map((p) => ({ equipo: p.equipo, recuento: rev.recuento[p.equipo]! }));
}

const aGestores = (gs: Gestor[], base: Omit<FilaAviso, "clave" | "user_id">, clave: (u: string) => string): FilaAviso[] =>
  gs.filter((g) => g.user_id).map((g) => ({ ...base, clave: clave(g.user_id!), user_id: g.user_id, person_id: null }));

/** La parte de la convocatoria de la tarea de avisos (D173). Devuelve cuantos avisos encola y que propuestas guardo. */
export async function tareaConvocatoria(sb: SupabaseClient, ahora: Date, eventos: EventoLiga[]) {
  const t = ahora.getTime();
  const proximos = domingosDe(eventos).filter((d) => d.cierre.getTime() <= t && t < d.inicio.getTime());
  if (!proximos.length) return { encolados: 0, propuestas: [] as string[], aprobadas: [] as string[] };
  const [{ data: gs, error: eg }, { data: convs, error: ec }] = await Promise.all([
    sb.from("gestores").select("*"),
    sb.from("convocatorias").select("*").in("fecha", proximos.map((d) => d.fecha)),
  ]);
  if (eg) throw new Error(`gestores: ${eg.message}`);
  if (ec) throw new Error(`convocatorias: ${ec.message}`);
  const gestores = (gs ?? []) as Gestor[];
  const responsables = gestores.filter((g) => g.recibe_propuesta);
  const filas: FilaAviso[] = [];
  const propuestas: string[] = [];
  const aprobadas: string[] = [];

  for (const d of proximos) {
    let c = ((convs ?? []) as FilaConv[]).find((x) => x.fecha === d.fecha) ?? null;
    if (c?.estado === "aprobada") {
      aprobadas.push(d.fecha);
      filas.push(...(await trasAprobar(sb, d.fecha, c, ahora, gestores)));
      continue;
    }
    // ---- propuesta automatica: una sola vez (automatica_en) y solo si la migracion de D173 esta (la columna existe)
    const sinColumna = !!c && !("automatica_en" in c);
    let aMano = false;
    if (!sinColumna && !c?.automatica_en) {
      const r = await proponerAuto(sb, d.fecha, ahora, c);
      if (r?.estado === "tocada") {
        aMano = true;
        filas.push(...aGestores(responsables, { ...textoBorradorAMano(d.fecha, r.recuentosBorrador), tipo: "gestores", eventos: d.partidos.map((e) => e.id), url: URL_CONV(d.fecha), programado_para: horaDeEnvio(ahora, d.inicio) },
          (u) => `conv-mano:${d.fecha}:${u}`));
      }
      if (r?.estado === "guardada") {
        propuestas.push(d.fecha);
        const txt = textoPropuestaLista(d.fecha, r.recuentos, r.riesgo);
        filas.push(...aGestores(responsables, { ...txt, tipo: "gestores", eventos: d.partidos.map((e) => e.id), url: URL_CONV(d.fecha), programado_para: horaDeEnvio(ahora, d.inicio) },
          (u) => `conv-auto:${d.fecha}:${u}`));
        c = { ...(c ?? { id: "", fecha: d.fecha, estado: "borrador", origen: "propuesta", equipos: r.conv, aprobada_en: null }), automatica_en: ahora.toISOString() };
      }
    }
    // ---- martes 19:00 (a Ivan) y 21:00 (a los tres) si sigue sin aprobar; nunca de 22:30 a 08:00
    const martes = sumarDias(lunesDe(d.fecha), 1);
    for (const [hora, a] of [["19:00", responsables], ["21:00", gestores]] as const) {
      const toca = madrid(martes, hora).getTime();
      if (t < toca || t >= toca + MARGEN || enSilencio(ahora)) continue;
      filas.push(...aGestores(a, { ...textoSinAprobar(d.fecha, hora === "21:00", aMano), tipo: "gestores", eventos: d.partidos.map((e) => e.id), url: URL_CONV(d.fecha), programado_para: ahora },
        (u) => `conv-pend:${hora.slice(0, 2)}:${d.fecha}:${u}`));
    }
  }
  const encolados = await encolar(sb, filas);
  return { encolados, propuestas, aprobadas };
}

/** De estos domingos, cuáles tienen la convocatoria aprobada (para no mandar el aviso genérico de la banda roja, D173). */
export async function fechasAprobadas(sb: SupabaseClient, fechas: string[]) {
  if (!fechas.length) return new Set<string>();
  const { data, error } = await sb.from("convocatorias").select("fecha").in("fecha", fechas).eq("estado", "aprobada");
  if (error) throw new Error(`convocatorias: ${error.message}`);
  return new Set(((data ?? []) as { fecha: string }[]).map((c) => c.fecha));
}

/** Propone y guarda (convocatoria_propuesta_auto: la base vuelve a comprobar que no esta aprobada ni tocada a mano). */
async function proponerAuto(sb: SupabaseClient, fecha: string, ahora: Date, actual: FilaConv | null) {
  const ctx = await cargarContexto(sb as unknown as Cliente, fecha, { servicio: true, ahora });
  if (!ctx || ctx.fecha !== fecha || ctx.sinMigracion) return null;
  const prop = proponer(entradaDe(ctx));
  const dificultad = Object.fromEntries(ctx.partidos.map((p) => [p.equipo, { valor: p.dificultad.valor, propuesta: p.dificultad.propuesta, porque: p.dificultad.porque }]));
  const { data, error } = await sb.rpc("convocatoria_propuesta_auto", {
    p_fecha: fecha, p_jornada: ctx.jornada, p_equipos: prop.convocatoria, p_dificultad: dificultad,
    p_detalle: { avisos: prop.avisos.filter((a) => a.gravedad !== "info").length },
  });
  if (error) {
    if (faltaFuncion(error)) { console.warn("convocatoria_propuesta_auto: migracion 20261103100000 sin aplicar; sin propuesta automatica"); return null; }
    throw new Error(`propuesta automatica: ${error.message}`);
  }
  return {
    estado: data as "guardada" | "aprobada" | "tocada", conv: prop.convocatoria, recuentos: recuentos(ctx, prop.convocatoria), riesgo: textoRiesgoPush(riesgosDe(ctx, prop.convocatoria)),
    // El borrador que hay (el que no se pisa), para el aviso a Iván.
    recuentosBorrador: recuentos(ctx, actual?.equipos ?? {}),
  };
}

/** Riesgo por equipo de una convocatoria (D173), como en la pantalla. */
export function riesgosDe(ctx: Contexto, conv: Convocatoria) {
  const rev = revisar(entradaDe(ctx), conv);
  const nombre = (id: string) => ctx.jugadores.find((j) => j.person_id === id)?.nombre ?? id;
  return riesgos(ctx.partidos.map((p) => ({ equipo: p.equipo, dificultad: p.dificultad.valor })),
    Object.fromEntries(ctx.partidos.map((p) => [p.equipo, rev.recuento[p.equipo]?.nivelMedio ?? null])),
    Object.fromEntries(ctx.partidos.map((p) => [p.equipo, proyeccionDe(ctx.proyeccion, p.equipo, (conv[p.equipo] ?? []).map((c) => ({ person_id: c.person_id, nombre: nombre(c.person_id) })), p.dificultad.valor)])),
    Object.fromEntries(ctx.partidos.map((p) => [p.equipo, conv[p.equipo]?.length ?? 0])));
}

/** Con la convocatoria aprobada (D173): bajas de convocados y «voy» tardios. */
async function trasAprobar(sb: SupabaseClient, fecha: string, c: FilaConv, ahora: Date, gestores: Gestor[]): Promise<FilaAviso[]> {
  const ctx = await cargarContexto(sb as unknown as Cliente, fecha, { servicio: true, ahora });
  if (!ctx || ctx.fecha !== fecha) return [];
  const entrada = entradaDe(ctx);
  const nombre = (id: string) => ctx.jugadores.find((j) => j.person_id === id)?.nombre ?? id;
  const ini = new Date(Math.min(...ctx.partidos.map((p) => madrid(fecha, p.inicio ?? "00:00").getTime())));
  const envio = horaDeEnvio(ahora, ini);
  const filas: FilaAviso[] = [];
  const ids = ctx.partidos.map((p) => p.evento_id);
  // Bajas: un convocado que ahora dice «no voy» (él, un gestor o una ausencia).
  for (const p of ctx.partidos) {
    for (const x of c.equipos[p.equipo] ?? []) {
      const j = ctx.jugadores.find((y) => y.person_id === x.person_id);
      if (!j || j.respuesta[p.equipo] !== "no") continue;
      const r = sugerirRecambio(entrada, c.equipos, x.person_id, p.equipo);
      filas.push(...aGestores(gestores, { ...textoBaja(nombre(x.person_id), p.equipo, fecha, r.sugerido ? nombre(r.sugerido) : null), tipo: "gestores", eventos: [p.evento_id], url: urlRecambio(fecha, x.person_id, p.equipo), programado_para: envio },
        (u) => `conv-baja:${fecha}:${p.equipo}:${x.person_id}:${u}`));
    }
  }
  // «Voy» tardío de alguien sin convocar: avisa SOLO si algún equipo está por debajo de un mínimo; si no, queda en el registro
  // (y en «Disponibles sin convocar») y su alerta de la banda roja se da por vista.
  const rev = revisar(entrada, c.equipos);
  const bajos = ctx.partidos.map((p) => ({ p, f: faltasMinimo(rev.recuento[p.equipo]!), pr: problemasEquipo(p.equipo, rev.recuento[p.equipo]!) })).filter((x) => x.f.alguno);
  const dentro = new Set(Object.values(c.equipos).flat().map((x) => x!.person_id));
  const tardios = ctx.jugadores.filter((j) => !dentro.has(j.person_id) && !j.sancionado && !j.privado?.nunca_partidos && ctx.partidos.some((p) => j.respuesta[p.equipo] === "va" && j.ficha[p.equipo]));
  const utiles = tardios.filter((j) => bajos.some((b) => j.respuesta[b.p.equipo] === "va" && j.ficha[b.p.equipo]));
  for (const j of utiles) {
    const suyos = bajos.filter((b) => j.respuesta[b.p.equipo] === "va" && j.ficha[b.p.equipo]);
    filas.push(...aGestores(gestores, { ...textoVoyTardio(j.nombre, fecha, suyos.map((b) => `el ${b.pr?.texto ?? b.p.equipo}`)), tipo: "gestores", eventos: ids, url: URL_CONV(fecha), programado_para: envio },
      (u) => `conv-tardio:${fecha}:${j.person_id}:${u}`));
  }
  const silenciar = tardios.filter((j) => !utiles.includes(j)).map((j) => j.person_id);
  if (silenciar.length) {
    await sb.from("alertas_gestores").update({ visto_en: ahora.toISOString(), visto_por_nombre: "automático: no afecta a la convocatoria" })
      .in("evento_id", ids).in("person_id", silenciar).eq("despues", "va").is("visto_en", null);
  }
  return filas;
}

/** Tras un cambio de calendario (Importar → «Aplicar y avisar», editar o cancelar un partido; D173): vuelve a pasar revisar()
 *  sobre las convocatorias APROBADAS de esos domingos y, si se rompe una regla (alguien dobla y ahora es a la misma hora; un
 *  equipo con convocados que ya no juega ese domingo), push a los gestores con el arreglo propuesto (la hoja de recambio).
 *  Nunca para la acción que lo llama: un fallo solo va al log. */
export async function revisarTrasCalendario(sb: SupabaseClient, fechas: string[], ahora = new Date()) {
  const hechos: string[] = [];
  try {
    const { data } = await sb.from("convocatorias").select("fecha, equipos, estado").in("fecha", [...new Set(fechas)]).eq("estado", "aprobada");
    const { data: gs } = await sb.from("gestores").select("*");
    for (const c of (data ?? []) as { fecha: string; equipos: Convocatoria }[]) {
      const ctx = await cargarContexto(sb as unknown as Cliente, c.fecha, { servicio: true, ahora });
      const nombre = (id: string) => ctx?.jugadores.find((j) => j.person_id === id)?.nombre ?? id;
      // El domingo ya no tiene partidos (se cancelaron o cambiaron de día): todos sus equipos han dejado de jugar.
      const juegan = ctx && ctx.fecha === c.fecha ? ctx.partidos.map((p) => p.equipo) : [];
      const sinPartido = (["MdA", "MdL"] as Equipo[]).filter((e) => (c.equipos[e]?.length ?? 0) > 0 && !juegan.includes(e));
      let que: string | null = null, arreglo: string | null = null, url = URL_CONV(c.fecha);
      if (sinPartido.length) {
        que = `${sinPartido.map((e) => `el ${e}`).join(" y ")} ya no juega${sinPartido.length > 1 ? "n" : ""} ese domingo y tiene${sinPartido.length > 1 ? "n" : ""} convocados`;
        arreglo = "quitar esa convocatoria y revisar la del nuevo día";
      } else if (ctx) {
        const rot = roturas(entradaDe(ctx), c.equipos);
        const doble = rot.errores.find((a) => a.regla === "1.4" && a.person_id);
        if (doble) {
          // Sale del partido con menos prioridad (el segundo de ordenPartidos, como en el aviso de revisar).
          const segundo = ordenPartidos(entradaDe(ctx).partidos)[1].equipo;
          const r = sugerirRecambio(entradaDe(ctx), c.equipos, doble.person_id!, segundo);
          que = `${nombre(doble.person_id!)} dobla y ahora los dos partidos son a la misma hora`;
          arreglo = `sale del ${segundo}${r.sugerido ? `, entra ${nombre(r.sugerido)}` : ", sin recambio"}`;
          url = urlRecambio(c.fecha, doble.person_id!, segundo);
        }
      }
      if (!que) continue;
      const t = textoCalendarioRompe(c.fecha, que, arreglo);
      await encolar(sb, aGestores((gs ?? []) as Gestor[], { ...t, tipo: "gestores", eventos: [], url, programado_para: horaDeEnvio(ahora, null) },
        (u) => `conv-cal:${c.fecha}:${firmaConvocatoria(c.equipos)}:${firmaTexto(que!)}:${u}`));
      hechos.push(c.fecha);
    }
  } catch (e) {
    console.warn(`revisar la convocatoria tras el cambio de calendario: ${(e as Error).message}`);
  }
  return hechos;
}

/** Firma corta de un texto (para la clave: el mismo problema con la misma convocatoria no se avisa dos veces). */
function firmaTexto(t: string) {
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
