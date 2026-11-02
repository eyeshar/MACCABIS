#!/usr/bin/env node
/**
 * asistencia_eventos.js — la asistencia EVENTO A EVENTO (D170): una fila por persona y evento, con fecha, ámbito, equipo
 * y estado. Sale del export completo de SportEasy (2018/19–2025/26 y 2026/27 hasta el 23/10/2026, D161); desde el
 * 24/10/2026 la pantalla suma las respuestas de la plataforma en vivo (no se guardan: cambian a diario).
 *
 * Reutiliza de asistencia_historica.js (D166) la identidad (id de perfil de SportEasy -> persona), los vínculos de Iván y
 * los descartes. Qué cuenta (igual que D166, salvo los torneos): entrenos y partidos de campeonato (liga, 2.ª fase y
 * play-off) jugados y no cancelados. Los «torneo-…» que SportEasy marca como campeonato (Torneo Marca, 2018/19) NO
 * cuentan: no son liga, 2.ª fase ni play-off.
 *
 *   - Estado: presente = fue; ausente con excusa = con_excusa; sin excusa o sin responder = sin_excusa; lesionado =
 *     lesion. La API no trae «no convocado»: quien no estaba convocado no sale (y por tanto no cuenta, como se quiere).
 *   - Equipo: de la categoría del evento (`temporada-mda`, `temporada-mdl-2afase`…). El play-off no lo dice: se toma del
 *     partido de ese día en data/rivales_jdm.json o en data/season_<t>.json («(PO)»). Los entrenos no tienen equipo (son comunes).
 *   - Dos perfiles de la misma persona en un evento: una fila, con el mejor estado.
 *   - Perfiles sin casar: en 2018/19–2024/25 son «personas históricas» (`sporteasy-<id>`, D166); en 2025/26 y 2026/27 se
 *     ignoran, como hace el proceso de las jornadas.
 *
 * Todo lo que escribe va a privado/ (fuera de git). Por consola solo salen recuentos, nunca nombres.
 */
const fs = require('fs');
const path = require('path');
const H = require('./asistencia_historica.js');

const RAIZ = path.resolve(__dirname, '..', '..');
const TEMPORADAS = [...H.TEMPORADAS, '2025-26', '2026-27'];
/** Último día que sale del export en 2026/27; desde el siguiente manda la plataforma (D161). */
const HASTA_SPORTEASY = '2026-10-23';
/** Desde esta temporada el export trae el detalle bueno de lesiones; antes, los porcentajes son aproximados. */
const PRIMERA_PRECISA = '2025-26';
const ESTADOS = ['fue', 'con_excusa', 'sin_excusa', 'no_convocado', 'lesion'];
const DE_ESTADO = { fueron: 'fue', excusa: 'con_excusa', sin_excusa: 'sin_excusa', lesion: 'lesion' };
const PRIORIDAD = { fue: 5, con_excusa: 4, lesion: 3, no_convocado: 2, sin_excusa: 1 };

const slugT = (clave) => { const m = clave.match(/^temporada_(\d{4})-(\d{4})$/); return m ? `${m[1]}-${m[2].slice(2)}` : null; };

/** Clase del evento (entrenos / partidos) o null si no cuenta. Los torneos que son «campeonato» para SportEasy, no. */
function clase(lista, jugaron = 0) {
  // 2026/27: un evento «cancelado» al que asistió gente (SportEasy lo marcó después: el entreno del 30/09/2026) sí cuenta,
  // como lo contó el export de la jornada (D161). En las temporadas anteriores, los cancelados no cuentan (D166).
  if (!lista || (lista.is_cancelled && !jugaron) || !lista.is_past) return null;
  const tipo = lista.category?.type;
  if (tipo === 'training') return 'entrenos';
  if (tipo === 'championship_match' && !/^torneo/i.test(lista.category?.slug_name ?? '')) return 'partidos';
  return null;
}

/** MdA / MdL de un partido por la categoría; null si no lo dice (play-off). */
function equipoDeCategoria(slug) {
  const s = String(slug ?? '').toLowerCase();
  if (/(^|-)mda(-|$)/.test(s)) return 'MdA';
  if (/(^|-)mdl(-|$)/.test(s)) return 'MdL';
  return null;
}

/** Fecha local (Madrid) del evento: los 10 primeros caracteres de `start_at` («2025-10-12T09:00:00+02:00»). */
const fechaDe = (lista) => String(lista.start_at ?? '').slice(0, 10);

/** Play-off: el equipo no viene en la categoría. Se toma del partido de ese día en data/rivales_jdm.json (temporada, fecha
 *  y equipo, si es uno solo) o, si no, del «(PO)» de data/season_<t>.json. Devuelve Map(fecha -> 'MdA'|'MdL'). */
function equiposPlayoff(t, raiz = RAIZ) {
  const out = new Map();
  const leer = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
  const equipo = (e) => (/^MD[AL]$/i.test(e ?? '') ? (e.toUpperCase() === 'MDA' ? 'MdA' : 'MdL') : null);
  const por = new Map();
  const jdm = leer(path.join(raiz, 'data', 'rivales_jdm.json'));
  for (const r of Array.isArray(jdm) ? jdm : jdm?.partidos ?? jdm?.rivales ?? []) {
    if (r.temporada !== t || !r.fecha || !equipo(r.equipo)) continue;
    por.set(r.fecha, new Set([...(por.get(r.fecha) ?? []), equipo(r.equipo)]));
  }
  for (const [fecha, eq] of por) if (eq.size === 1) out.set(fecha, [...eq][0]);
  for (const p of leer(path.join(raiz, 'data', `season_${t}.json`))?.partidos ?? []) {
    if (/\(PO\)/i.test(p.rival ?? '') && p.fecha && equipo(p.equipo) && !out.has(p.fecha)) out.set(p.fecha, equipo(p.equipo));
  }
  return out;
}

/**
 * Lee el export: { temporada: { perfiles: Map(id -> { nombre, apariciones }), filas: [{ id, evento, fecha, clase, equipo,
 * titulo, estado }], sinEquipo } }. `estado` ya con los nombres de esta tabla. Aplica el corte de 2026/27.
 */
function leerEventos(exp, { raiz = RAIZ } = {}) {
  const out = {};
  for (const clave of Object.keys(exp)) {
    const t = slugT(clave);
    if (!t || !TEMPORADAS.includes(t)) continue;
    const perfiles = new Map(); const filas = []; let sinEquipo = 0;
    const po = equiposPlayoff(t, raiz);
    for (const e of exp[clave].eventos || []) {
      const jugaron = (e.detalle?.attendees || []).filter((g) => g.slug_name === 'played').reduce((a, g) => a + (g.results?.length || 0), 0);
      const c = clase(e.lista, t === '2026-27' ? jugaron : 0);
      if (!c) continue;
      const fecha = fechaDe(e.lista);
      if (t === '2026-27' && fecha > HASTA_SPORTEASY) continue;
      let equipo = null;
      if (c === 'partidos') {
        equipo = equipoDeCategoria(e.lista.category?.slug_name) ?? po.get(fecha) ?? null;
        if (!equipo) sinEquipo++;
      }
      for (const g of e.detalle?.attendees || []) for (const r of g.results || []) {
        const id = r.profile?.id; if (id == null) continue;
        const p = perfiles.get(id) || { nombre: H.nombreSE(r.profile), apariciones: 0 };
        p.apariciones++; perfiles.set(id, p);
        filas.push({ id, evento: e.lista.id, fecha, clase: c, equipo, titulo: e.lista.name ?? null, estado: DE_ESTADO[H.estado(r)] });
      }
    }
    out[t] = { perfiles, filas, sinEquipo };
  }
  return out;
}

/**
 * Filas de la tabla asistencia_eventos: una por persona y evento. `resolucion` es la de H.resolver; `ignorar` es el de
 * nombres_sporteasy.json ({ temporada: [person_id] }: sin ficha, entrenador, fuera de la plantilla). Devuelve
 * { filas, solapes, ignorados }.
 */
function construir(temporadas, resolucion, displayDe, ignorar = {}) {
  const filas = []; let solapes = 0; let ignorados = 0;
  for (const [t, { filas: fs_, perfiles }] of Object.entries(temporadas)) {
    const moderna = t >= PRIMERA_PRECISA;
    const por = new Map();
    for (const f of fs_) {
      const r = resolucion.get(f.id);
      if (r?.como === 'descartado') continue;
      const nombreSE = perfiles.get(f.id).nombre;
      if (!r?.person_id && moderna) { ignorados++; continue; }
      const pid = r?.person_id || H.PREFIJO + f.id;
      if ((ignorar[t] ?? []).includes(pid)) { ignorados++; continue; }
      const k = `${pid}|${f.evento}`;
      const prev = por.get(k);
      if (prev) { solapes++; if (PRIORIDAD[f.estado] > PRIORIDAD[prev.estado]) prev.estado = f.estado; continue; }
      por.set(k, {
        person_id: pid, nombre: displayDe(pid) || nombreSE, temporada: t, evento_ref: `se-${f.evento}`, fecha: f.fecha,
        ambito: f.clase, equipo: f.equipo, titulo: f.titulo, estado: f.estado, motivo: null, origen: 'sporteasy',
      });
    }
    filas.push(...por.values());
  }
  filas.sort((a, b) => a.temporada.localeCompare(b.temporada) || a.fecha.localeCompare(b.fecha) || a.evento_ref.localeCompare(b.evento_ref, 'en', { numeric: true }) || a.person_id.localeCompare(b.person_id));
  return { filas, solapes, ignorados };
}

/**
 * Un perfil sin casar cuyo nombre de SportEasy es el de una entrada del diccionario salvo mayúsculas y tildes («Enyel Santos
 * artiles» / «Enyel Santos Artiles») es esa persona: SportEasy escribe el nombre distinto según el export. Solo si la
 * entrada es única; el resto sigue como estaba.
 */
function casarSinMayusculas(temporadas, resolucion, diccionario) {
  const por = new Map();
  for (const [nombre, pid] of diccionario) { const k = H.norm(nombre); por.set(k, por.has(k) && por.get(k) !== pid ? null : pid); }
  for (const { perfiles } of Object.values(temporadas)) for (const [id, p] of perfiles) {
    if (resolucion.get(id)?.person_id || resolucion.get(id)?.como === 'descartado') continue;
    const pid = por.get(H.norm(p.nombre));
    if (pid) resolucion.set(id, { person_id: pid, como: 'nombre sin mayúsculas ni tildes' });
  }
}

/** Todo el cálculo sin escribir: { filas, solapes, ignorados, sinEquipo, resolucion, temporadas }. */
function calcular(entradas, { raiz = RAIZ } = {}) {
  const temporadas = leerEventos(entradas.exp, { raiz });
  const r = H.resolver({ temporadas, ...entradas });
  casarSinMayusculas(temporadas, r.resolucion, entradas.sporteasyPorNombre);
  const display = new Map(entradas.personas.map((p) => [p.person_id, p.display]));
  const c = construir(temporadas, r.resolucion, (pid) => display.get(pid), entradas.ignorar ?? {});
  return { ...c, sinEquipo: Object.fromEntries(Object.entries(temporadas).map(([t, x]) => [t, x.sinEquipo])), resolucion: r.resolucion, temporadas };
}

/** Entradas de H.cargarEntradas() más las personas que se ignoran por temporada. */
function cargarEntradas() {
  const e = H.cargarEntradas();
  const n = JSON.parse(fs.readFileSync(path.join(RAIZ, 'scripts/estadisticas/nombres_sporteasy.json'), 'utf8'));
  return { ...e, ignorar: n.ignorar ?? {} };
}

/** Recuento por temporada, persona y ámbito (la forma de asistencia_motivos), sacado de las filas. */
function agregar(filas) {
  const m = new Map();
  for (const f of filas) {
    const k = `${f.temporada}|${f.person_id}|${f.ambito}`;
    const a = m.get(k) || { temporada: f.temporada, person_id: f.person_id, ambito: f.ambito, fueron: 0, con_excusa: 0, sin_excusa: 0, no_convocado: 0, lesion: 0, total: 0 };
    a[f.estado === 'fue' ? 'fueron' : f.estado]++; a.total++;
    m.set(k, a);
  }
  return m;
}

/**
 * Cuadre de las filas por evento contra los totales de asistencia_motivos (`resumen`: temporada, person_id, ambito, fueron,
 * con_excusa|excusa, sin_excusa, no_convocado|no_conv, lesion, total). «No convocado» y «lesión» se excluyen del cálculo
 * (D170), así que lo que se compara es lo que cuenta: fueron, con excusa y sin excusa (la lesión va como dato). Una fila
 * (de cualquiera de los dos lados) con solo no convocados o lesiones no tiene nada que contar y no se echa en falta.
 * Devuelve { porTemporada: { t: { eventos, resumen, iguales, distintas, soloEventos, soloResumen } }, detalle: [...] }.
 */
function cuadrar(filas, resumen) {
  const ev = agregar(filas);
  const re = new Map();
  for (const r of resumen) {
    re.set(`${r.temporada}|${r.person_id}|${r.ambito}`, {
      fueron: r.fueron, con_excusa: r.con_excusa ?? r.excusa, sin_excusa: r.sin_excusa, no_convocado: r.no_convocado ?? r.no_conv, lesion: r.lesion, total: r.total,
    });
  }
  const contable = (x) => x.fueron + x.con_excusa + x.sin_excusa;
  const porTemporada = {}; const detalle = [];
  const T = (t) => porTemporada[t] ||= { eventos: sumaVacia(), resumen: sumaVacia(), iguales: 0, distintas: 0, soloEventos: 0, soloResumen: 0 };
  for (const k of new Set([...ev.keys(), ...re.keys()])) {
    let a = ev.get(k); let b = re.get(k);
    if (a && !contable(a)) a = undefined;
    if (b && !contable(b)) b = undefined;
    if (!a && !b) continue;
    const [t] = k.split('|');
    const x = T(t);
    if (a) sumar(x.eventos, { ...a, total: contable(a) });
    if (b) sumar(x.resumen, { ...b, total: contable(b) });
    if (a && !b) { x.soloEventos++; detalle.push({ k, tipo: 'solo en los eventos', eventos: a }); continue; }
    if (!a && b) { x.soloResumen++; detalle.push({ k, tipo: 'solo en el resumen', resumen: b }); continue; }
    const igual = a.fueron === b.fueron && a.con_excusa === b.con_excusa && a.sin_excusa === b.sin_excusa;
    if (igual) x.iguales++; else { x.distintas++; detalle.push({ k, tipo: 'distinta', eventos: a, resumen: b }); }
  }
  return { porTemporada, detalle };
}
const sumaVacia = () => ({ fueron: 0, con_excusa: 0, sin_excusa: 0, lesion: 0, total: 0 });
const sumar = (acc, x) => { for (const c of Object.keys(acc)) acc[c] += x[c]; };

if (require.main === module) {
  const c = calcular(cargarEntradas());
  const porT = {};
  for (const f of c.filas) { const x = porT[f.temporada] ||= { eventos: new Set(), filas: 0, personas: new Set() }; x.eventos.add(f.evento_ref); x.filas++; x.personas.add(f.person_id); }
  for (const [t, x] of Object.entries(porT)) console.log(`${t}: ${x.eventos.size} eventos, ${x.personas.size} personas, ${x.filas} filas${c.sinEquipo[t] ? `, ${c.sinEquipo[t]} partidos sin equipo` : ''}`);
  console.log(`Total ${c.filas.length} filas · ${c.solapes} repetidas fusionadas · ${c.ignorados} apariciones ignoradas (sin casar o ignoradas)`);
}

module.exports = { TEMPORADAS, HASTA_SPORTEASY, PRIMERA_PRECISA, ESTADOS, PRIORIDAD, clase, equipoDeCategoria, equiposPlayoff, leerEventos, construir, calcular, cargarEntradas, agregar, cuadrar };
