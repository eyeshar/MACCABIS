/**
 * asistencia.js
 *
 * Asistencia a partidos y entrenamientos, desde SportEasy, por person_id.
 *
 * Dos formatos de entrada:
 *   - "compuesto": el Excel que Iván montó a mano en 2025/26 ("Asistencia MAccabis 2025 2026.xlsx")
 *     con las hojas "Asistencia a partidos" (tercer bloque = MdA + MdL sumados) y
 *     "Asistencai entrenamientos" [sic]. Es el que alimentó season_2025-26.json.
 *   - "sporteasy": el export directo de SportEasy (bilan_presence_*.xlsx: una hoja por mes, una
 *     columna por evento con su tipo en la 2ª fila). Cuentan los eventos "Partido" (liga) y
 *     "Entrenamiento", y desde la jornada 1 de 2026/27 también "Campeonato" (partido de liga);
 *     amistosos, torneos y "partido entre nosotros" no. Los "Campeonato" vienen SIN equipo: se
 *     asigna cada uno a MdA o MdL cruzando quién consta "A tiempo" con quién jugó en cada hoja
 *     de estadística; si no es inequívoco, el proceso para (ver asignarEquipos).
 *
 * Los nombres de SportEasy se traducen con nombres_sporteasy.json. Un nombre desconocido no se
 * adivina: se ignora y se avisa.
 */
const fs = require('fs');
const path = require('path');
const { limpia } = require('./util');
const MAPA = require('./nombres_sporteasy.json');

const filasDe = (wb, hoja) => require('xlsx').utils.sheet_to_json(wb.Sheets[hoja], { header: 1, raw: false, defval: '' });
const n = v => { const x = parseInt(limpia(v), 10); return isFinite(x) ? x : 0; };

function partidos(o) {
  const total = o.total;
  return { excusa: o.excusa, no_conv: o.no_conv, fueron: o.fueron, lesion: o.lesion, total,
    pct_disp: total ? (o.fueron + o.no_conv) / total : null,
    pct_jug: total ? o.fueron / total : null,
    pct_nosel: total ? o.no_conv / total : null };
}
function entrenos(o) {
  return { excusa: o.excusa, fueron: o.fueron, no_conv: o.no_conv, lesion: o.lesion,
    pct: (o.fueron + o.excusa) ? o.fueron / (o.fueron + o.excusa) : null };
}

/** Formato "compuesto" de 2025/26. */
function leerCompuesto(fichero, avisos) {
  const wb = require('xlsx').readFile(fichero);
  const part = {}, entr = {};
  const hp = wb.SheetNames.find(s => /partidos/i.test(s));
  const he = wb.SheetNames.find(s => /entrenamiento/i.test(s));
  for (const r of filasDe(wb, hp).slice(1)) {
    const nombre = limpia(r[10]);
    if (!nombre) continue;
    const id = MAPA.nombres[nombre];
    if (!id) { avisos.push(`Asistencia: "${nombre}" no está en nombres_sporteasy.json (ignorado).`); continue; }
    part[id] = partidos({ excusa: n(r[11]), no_conv: n(r[12]), fueron: n(r[13]), lesion: n(r[14]), total: n(r[15]) });
  }
  for (const r of filasDe(wb, he).slice(1)) {
    const nombre = limpia(r[0]);
    if (!nombre) continue;
    const id = MAPA.nombres[nombre];
    if (!id) { avisos.push(`Asistencia: "${nombre}" no está en nombres_sporteasy.json (ignorado).`); continue; }
    entr[id] = entrenos({ excusa: n(r[1]), fueron: n(r[2]), no_conv: n(r[3]), lesion: n(r[4]) });
  }
  return { part, entr };
}

const ESTADOS = { 'a tiempo': 'fueron', 'con excusa': 'excusa', 'sin excusa': 'sin_excusa',
  'no convocado': 'no_conv', 'lesionado': 'lesion' };

/**
 * Asigna cada evento "Campeonato" a MdA o MdL. `eventos`: [{ clave, fecha, aTiempo:Set(pid) }];
 * `jugaron`: { MDA:Set(pid), MDL:Set(pid) } (quién jugó, según las hojas). Para cada evento se
 * mide el parecido (Jaccard) entre "A tiempo" y los jugadores de cada hoja. Se asigna sólo si el
 * mejor equipo supera 0,7, dobla al otro y no hay dos eventos del mismo día para el mismo equipo.
 * Lo que no cumpla lanza un Error: decide una persona, no el script.
 */
function asignarEquipos(eventos, jugaron, avisos) {
  const jac = (a, b) => { const i = [...a].filter(x => b.has(x)).length; return i / (a.size + b.size - i || 1); };
  const res = new Map(), porDia = {};
  for (const e of eventos) {
    const sc = Object.fromEntries(Object.entries(jugaron).map(([eq, set]) => [eq, jac(e.aTiempo, set)]));
    const orden = Object.entries(sc).sort((a, b) => b[1] - a[1]);
    const [eq, mejor] = orden[0], otro = orden[1] ? orden[1][1] : 0;
    const det = Object.entries(sc).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ');
    if (mejor < 0.7 || otro > mejor / 2)
      throw new Error(`Asistencia: no puedo asignar con seguridad el "Campeonato" del ${e.fecha} a un equipo (parecido con las hojas: ${det}). Dime a cuál corresponde.`);
    const dia = porDia[e.fecha] || (porDia[e.fecha] = new Set());
    if (dia.has(eq)) throw new Error(`Asistencia: dos "Campeonato" del ${e.fecha} salen como ${eq} (${det}). Dime cuál es cuál.`);
    dia.add(eq);
    res.set(e.clave, eq);
    const lista = [...e.aTiempo].filter(x => !jugaron[eq].has(x)).map(x => `${x} consta "A tiempo" pero no jugó`);
    for (const x of jugaron[eq]) if (!e.aTiempo.has(x)) lista.push(`${x} jugó pero no consta "A tiempo"`);
    avisos.push(`Asistencia: "Campeonato" del ${e.fecha} -> ${eq} (parecido ${det})` + (lista.length ? '; discrepancias SportEasy/hoja (se corrige SportEasy): ' + lista.join('; ') : '; coincide exactamente con la hoja.'));
  }
  return res;
}

/** Export directo de SportEasy (uno o varios bilan_presence_*.xlsx). */
function leerSportEasy(ficheros, avisos, ignorar = [], jugaron = null) {
  const cuenta = { part: {}, entr: {} };
  const vistos = new Set();                          // un mismo evento puede venir en dos exports
  const camp = new Map();                            // "Campeonato": clave de evento -> { fecha, aTiempo }
  const sinMapa = new Map();                         // nombres de SportEasy sin persona, con respuestas reales
  for (const f of ficheros) {
    const wb = require('xlsx').readFile(f);
    for (const hoja of wb.SheetNames) {
      const filas = filasDe(wb, hoja);
      if (filas.length < 3) continue;
      const fechas = filas[0], tipos = filas[1];
      for (const r of filas.slice(2)) {
        const nombre = limpia(r[0]);
        if (!nombre) continue;
        const id = MAPA.nombres[nombre];
        if (id && ignorar.includes(id)) continue;
        for (let c = 1; c < r.length; c++) {
          const tipo = limpia(tipos[c]), fecha = limpia(fechas[c]);
          if (!fecha || !/\d{2}\/\d{2}\/\d{2}/.test(fecha)) continue;
          const clase = ['Partido', 'Campeonato'].includes(tipo) ? 'part' : tipo === 'Entrenamiento' ? 'entr' : null;
          if (!clase) continue;
          const estado = limpia(r[c]).toLowerCase();
          if (!id) {                                 // miembros de SportEasy que no son del club, salvo que respondan
            if (estado && estado !== 'no convocado') sinMapa.set(nombre, (sinMapa.get(nombre) || 0) + 1);
            continue;
          }
          if (tipo === 'Campeonato') {
            const ev = [hoja, c].join('|');
            const e = camp.get(ev) || camp.set(ev, { clave: ev, fecha, aTiempo: new Set() }).get(ev);
            if (estado === 'a tiempo') e.aTiempo.add(id);
            (e.estados || (e.estados = new Map())).set(id, { raw: estado, nombre });
            continue;                                // se cuenta después, corregido con la hoja (D72)
          }
          const k = [id, fecha, tipo, c].join('|');
          if (vistos.has(k)) continue;
          vistos.add(k);
          const est = ESTADOS[limpia(r[c]).toLowerCase()];
          if (!est) { if (limpia(r[c])) avisos.push(`Asistencia: estado desconocido "${limpia(r[c])}" (${nombre}, ${fecha}).`); continue; }
          const o = cuenta[clase][id] || (cuenta[clase][id] = { excusa: 0, no_conv: 0, fueron: 0, lesion: 0, sin_excusa: 0, total: 0 });
          o[est]++; o.total++;
        }
      }
    }
  }
  if (camp.size) {
    if (!jugaron) throw new Error('Asistencia: hay eventos "Campeonato" y no tengo las hojas de estadística para asignarlos a MdA o MdL.');
    const eqDe = asignarEquipos([...camp.values()], jugaron, avisos);
    // D72: en partidos de liga manda la hoja de la FBM sobre SportEasy. Quien aparece en la hoja
    // asistió; quien consta "A tiempo" y no está en la hoja, no asistió ("No convocado").
    for (const e of camp.values()) {
      const lista = jugaron[eqDe.get(e.clave)];
      for (const [id, { raw, nombre }] of e.estados || []) {
        let est = ESTADOS[raw];
        if (!est) { if (raw) avisos.push(`Asistencia: estado desconocido "${raw}" (${nombre}, ${e.fecha}).`); continue; }
        const antes = est;
        if (lista.has(id) && est !== 'fueron') est = 'fueron';
        else if (!lista.has(id) && est === 'fueron') est = 'no_conv';
        if (est !== antes) avisos.push(`Asistencia (D72, manda la hoja): ${nombre} en el ${eqDe.get(e.clave)} del ${e.fecha}: SportEasy decía "${raw}", se cuenta ${est === 'fueron' ? 'como asistente (jugó)' : 'como no asistente (no jugó)'}.`);
        const o = cuenta.part[id] || (cuenta.part[id] = { excusa: 0, no_conv: 0, fueron: 0, lesion: 0, sin_excusa: 0, total: 0 });
        o[est]++; o.total++;
      }
    }
  }
  for (const [nombre, k] of sinMapa) avisos.push(`Asistencia: "${nombre}" responde en ${k} evento(s) pero NO está en nombres_sporteasy.json: no cuenta (¿quién es?).`);
  const part = {}, entr = {};
  for (const [id, o] of Object.entries(cuenta.part)) part[id] = { ...partidos(o), sin_excusa: o.sin_excusa };
  for (const [id, o] of Object.entries(cuenta.entr)) entr[id] = { ...entrenos(o), sin_excusa: o.sin_excusa };
  return { part, entr };
}

/**
 * @param cfg  { formato: 'compuesto', fichero } | { formato: 'sporteasy', ficheros: [...] }
 * @param base carpeta de la temporada
 */
function leerAsistencia(cfg, base, avisos, temporada, jugaron = null) {
  if (!cfg) return { part: {}, entr: {} };
  if (cfg.formato === 'compuesto') return leerCompuesto(path.join(base, cfg.fichero), avisos);
  if (cfg.formato === 'sporteasy') {
    // "ultimo_de": el export más reciente de esa carpeta (cada export trae la temporada entera).
    let ficheros = (cfg.ficheros || []).map(f => path.join(base, f));
    if (cfg.ultimo_de) {
      const dir = path.join(base, cfg.ultimo_de);
      ficheros = (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter(f => /\.xlsx$/i.test(f) && !f.startsWith('~$'))
        .map(f => path.join(dir, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs).slice(0, 1);
    }
    if (!ficheros.length) { avisos.push('Asistencia: todavía no hay export de SportEasy; la temporada sale sin asistencia.'); return { part: {}, entr: {} }; }
    return leerSportEasy(ficheros, avisos, (MAPA.ignorar || {})[temporada] || [], jugaron);
  }
  throw new Error('Formato de asistencia desconocido: ' + cfg.formato);
}

module.exports = { leerAsistencia };
