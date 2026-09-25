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
 *     "Entrenamiento"; amistosos, torneos y "partido entre nosotros" no. PENDIENTE de probar con
 *     un export que ya traiga partidos de liga de 2026/27.
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

/** Export directo de SportEasy (uno o varios bilan_presence_*.xlsx). */
function leerSportEasy(ficheros, avisos, ignorar = []) {
  const cuenta = { part: {}, entr: {} };
  const vistos = new Set();                          // un mismo evento puede venir en dos exports
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
        if (!id) continue;                           // miembros de SportEasy que no son del club
        if (ignorar.includes(id)) continue;
        for (let c = 1; c < r.length; c++) {
          const tipo = limpia(tipos[c]), fecha = limpia(fechas[c]);
          if (!fecha || !/\d{2}\/\d{2}\/\d{2}/.test(fecha)) continue;
          const clase = tipo === 'Partido' ? 'part' : tipo === 'Entrenamiento' ? 'entr' : null;
          if (!clase) continue;
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
  const part = {}, entr = {};
  for (const [id, o] of Object.entries(cuenta.part)) part[id] = { ...partidos(o), sin_excusa: o.sin_excusa };
  for (const [id, o] of Object.entries(cuenta.entr)) entr[id] = { ...entrenos(o), sin_excusa: o.sin_excusa };
  return { part, entr };
}

/**
 * @param cfg  { formato: 'compuesto', fichero } | { formato: 'sporteasy', ficheros: [...] }
 * @param base carpeta de la temporada
 */
function leerAsistencia(cfg, base, avisos, temporada) {
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
    return leerSportEasy(ficheros, avisos, (MAPA.ignorar || {})[temporada] || []);
  }
  throw new Error('Formato de asistencia desconocido: ' + cfg.formato);
}

module.exports = { leerAsistencia };
