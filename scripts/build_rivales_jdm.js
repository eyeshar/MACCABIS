/**
 * build_rivales_jdm.js
 *
 * Construye data/rivales_jdm.json: los partidos del club según el portal de datos abiertos
 * del Ayuntamiento de Madrid (dataset 300257, "Deportes colectivos - histórico").
 * Licencia CC BY 4.0: republicable citando al Ayuntamiento de Madrid.
 *
 * FUENTE INDEPENDIENTE. No modifica ningún fichero de data/ existente. Los season_*.json
 * se leen SÓLO para validar qué código de equipo nos corresponde cada temporada.
 *
 * IDENTIFICACIÓN DEL CLUB (decisión de Iván tras la Fase 0, ver docs/SONDEO_JDM_FASE0.md)
 *   El nombre de equipo NO sirve de filtro: hay un club RIVAL llamado "MACCABI" en 2014/15,
 *   la grafía cambia cada año y hay homónimos en otros deportes. El identificador estable es
 *   el Nº EQUIPO de la hoja de inscripción, que es el Codigo_equipo del dataset.
 *     1. Criterio primario: los Nº EQUIPO extraídos de docs/Fichas.
 *     2. Respaldo, sólo si no hay ficha: candidatos por nombre validados contra el histórico
 *        propio por MARCADOR. Quedan marcados con identificado_por = "respaldo".
 *   Filtrar por distrito NO vale: los partidos de torneo pueden jugarse en otro distrito
 *   (el torneo de 2016/17 con ficha #119823 se jugó en Vicálvaro).
 *
 * FASES: los partidos de torneo/Marca SUMAN a la temporada (D19) pero van etiquetados en el
 * campo `fase` para poder distinguirlos: "liga", "torneo" o "fase_final".
 *
 * USO:  node scripts/build_rivales_jdm.js --csv <carpeta con los CSV descargados>
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const args = process.argv.slice(2);
const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const CSVDIR = argVal('--csv', path.join(ROOT, '.cache-jdm'));

/** Recurso n del dataset -> temporada (el histórico trae 10). */
const TEMPORADAS = [
  { n: 15, id: '2014-15' }, { n: 11, id: '2015-16' }, { n: 7, id: '2016-17' },
  { n: 3, id: '2017-18' }, { n: 19, id: '2018-19' }, { n: 22, id: '2020-21' },
  { n: 30, id: '2021-22' }, { n: 26, id: '2022-23' }, { n: 34, id: '2023-24' },
  { n: 38, id: '2024-25' },
];
const NO_CUBIERTAS = {
  '2013-14': 'No existe en el portal de datos abiertos.',
  '2019-20': 'No existe en el portal de datos abiertos.',
  '2025-26': 'Está en el dataset 211549 (temporada en curso), no en el histórico 300257.',
};

/**
 * Nº EQUIPO leídos de las hojas de inscripción de docs/Fichas.
 * Los de 2017-18 MdL y los escaneos se leyeron visualmente (ver INFORME_FICHAS.md).
 * 40 JDM (141805/141807) corresponde a 2019/20, que no está en el dataset.
 */
const CODIGOS_FICHA = {
  '2016-17': { MdL: ['119823', '120202'] },
  '2017-18': { MdL: ['122256', '129335'], MdA: ['122271'] },
  '2018-19': { MdL: ['132002', '138926'], MdA: ['132001', '138927'] },
  '2020-21': { MdL: ['149302'], MdA: ['149303'] },
};

// ------------------------------------------------------------------ utilidades
/** CSV con separador ';', comillas y saltos de línea dentro de campo. */
function parseCSV(txt) {
  txt = txt.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ';') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); cur = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); if (row.some(x => x !== '')) rows.push(row); }
  const head = rows.shift().map(h => h.trim());
  return rows.map(r => { const o = {}; head.forEach((h, i) => o[h] = (r[i] || '').trim()); return o; });
}

/** Los grupos de las temporadas antiguas vienen en latin-1 leído como UTF-8. */
const reparar = s => String(s || '').replace(/�/g, 'Ñ').replace(/MA�ANA/gi, 'MAÑANA');

/** Dos formatos conviven: "15/11/2014" y "2020-11-15 00:00:00.000". */
function fechaISO(f) {
  if (!f) return null;
  let m = f.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = f.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

/** Filas que no son partidos: descansos y pases de ronda. */
const esDescanso = r => /DESCANSA|PASA RONDA|\*\*/i.test(r.Equipo_local + ' ' + r.Equipo_visitante);

/** liga / torneo / fase_final, a partir de la competición y la fase del CSV. */
function claseFase(r) {
  const c = (r.Nombre_competicion || '') + ' ' + (r.Nombre_fase || '') + ' ' + (r.Nombre_grupo || '');
  if (/TORNEO|MARCA/i.test(c)) return 'torneo';
  if (/FASE FINAL|CUADRO|FINAL/i.test(c)) return 'fase_final';
  return 'liga';
}

/** Candidatos por nombre, para las temporadas sin ficha. */
const NOMBRE_CLUB = /^(mdl|mda)$|mac+abi|macabi/i;

function normRival(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

// ------------------------------------------------------------------ principal
function main() {
  if (!fs.existsSync(CSVDIR)) { console.error('No encuentro los CSV en ' + CSVDIR + '. Usa --csv <carpeta>.'); process.exit(1); }
  const partidos = [], informe = [], avisos = [];

  for (const T of TEMPORADAS) {
    const file = path.join(CSVDIR, `p${T.n}.csv`);
    if (!fs.existsSync(file)) { avisos.push(`${T.id}: falta el CSV ${path.basename(file)}`); continue; }
    const rows = parseCSV(fs.readFileSync(file, 'utf8'));
    const bc = rows.filter(r => /BALONCESTO/i.test(r.Nombre_deporte));

    // --- histórico propio, SÓLO para validar (nunca se escribe)
    const propioFile = path.join(DATA, `season_${T.id}.json`);
    const propio = fs.existsSync(propioFile) ? JSON.parse(fs.readFileSync(propioFile, 'utf8')) : null;
    const marcadoresPropios = new Set((propio ? propio.partidos : []).map(p => `${p.pf}-${p.pc}`));

    // --- códigos: primero los de ficha; si no hay, candidatos por nombre validados
    const deFicha = CODIGOS_FICHA[T.id] || {};
    const equipos = {};       // MdL / MdA -> { codigos:[], via:'ficha'|'respaldo' }
    for (const [eq, cods] of Object.entries(deFicha)) equipos[eq] = { codigos: cods.slice(), via: 'ficha' };

    // Candidatos por nombre. Se restringen al distrito del club: hay muchos homónimos
    // "Maccabi de Levantar" en otros distritos que no tienen nada que ver con nosotros.
    // Los códigos de ficha se aceptan estén donde estén (un torneo puede jugarse fuera).
    const candidatos = new Map();
    bc.forEach(r => [[r.Equipo_local, r.Codigo_equipo1], [r.Equipo_visitante, r.Codigo_equipo2]].forEach(([e, c]) => {
      if (!NOMBRE_CLUB.test((e || '').trim())) return;
      if (!/MORATALAZ/i.test(r.Distrito || '')) return;
      if (!candidatos.has(c)) candidatos.set(c, { nombre: e.trim(), filas: [] });
      candidatos.get(c).filas.push(r);
    }));

    for (const [cod, cand] of candidatos) {
      if (Object.values(equipos).some(v => v.codigos.includes(cod))) continue;   // ya viene de ficha
      // validación por marcador contra el histórico propio
      let aciertos = 0;
      for (const r of cand.filas) {
        if (esDescanso(r)) continue;
        const local = r.Codigo_equipo1 === cod;
        const pf = +(local ? r.Resultado1 : r.Resultado2), pc = +(local ? r.Resultado2 : r.Resultado1);
        if (marcadoresPropios.has(`${pf}-${pc}`)) aciertos++;
      }
      const jugados = cand.filas.filter(r => !esDescanso(r)).length;
      const ratio = jugados ? aciertos / jugados : 0;
      const esMdA = /acosta|acorda|dacosta|^mda$/i.test(cand.nombre);
      const eq = esMdA ? 'MdA' : 'MdL';
      // El histórico propio sólo tiene partido a partido del MdL: el MdA de las temporadas
      // antiguas venía agregado. Validar el MdA por marcador lo descartaría siempre, así que
      // se acepta por nombre inequívoco dentro del distrito del club, y queda marcado.
      if (esMdA && /^(mda|maccabi de acosta|macabi dacosta|maccabi de acorda)/i.test(cand.nombre)) {
        if (!equipos[eq]) equipos[eq] = { codigos: [], via: 'nombre_en_distrito' };
        equipos[eq].codigos.push(cod);
        informe.push(`${T.id} MdA: #${cod} "${cand.nombre}" aceptado por nombre inequívoco en Moratalaz (el histórico propio no trae partido a partido del MdA, así que no se puede validar por marcador).`);
      } else if (propio && ratio >= 0.5) {
        if (!equipos[eq]) equipos[eq] = { codigos: [], via: 'respaldo' };
        equipos[eq].codigos.push(cod);
        informe.push(`${T.id} ${eq}: #${cod} "${cand.nombre}" aceptado por respaldo (${aciertos}/${jugados} marcadores coinciden con el histórico propio).`);
      } else if (!propio) {
        if (!equipos[eq]) equipos[eq] = { codigos: [], via: 'respaldo_sin_validar' };
        equipos[eq].codigos.push(cod);
        avisos.push(`${T.id} ${eq}: #${cod} "${cand.nombre}" aceptado SÓLO por nombre; no hay season_${T.id}.json con el que validarlo.`);
      } else {
        avisos.push(`${T.id}: #${cod} "${cand.nombre}" DESCARTADO (${aciertos}/${jugados} marcadores coinciden; no es del club).`);
      }
    }

    // --- extraer los partidos de los códigos aceptados
    for (const [eq, info] of Object.entries(equipos)) {
      for (const cod of info.codigos) {
        const suyos = bc.filter(r => r.Codigo_equipo1 === cod || r.Codigo_equipo2 === cod);
        if (!suyos.length) { avisos.push(`${T.id} ${eq}: el código de ficha #${cod} no tiene partidos en el CSV.`); continue; }
        for (const r of suyos) {
          if (esDescanso(r)) continue;
          const local = r.Codigo_equipo1 === cod;
          partidos.push({
            temporada: T.id,
            equipo: eq,
            codigo_equipo: cod,
            identificado_por: info.via,
            fase: claseFase(r),
            competicion: r.Nombre_competicion || null,
            nombre_fase: reparar(r.Nombre_fase) || null,
            grupo: reparar(r.Nombre_grupo) || null,
            jornada: r.Jornada || null,
            fecha: fechaISO(r.Fecha),
            hora: r.Hora || null,
            local,
            rival: (local ? r.Equipo_visitante : r.Equipo_local) || null,
            codigo_rival: local ? r.Codigo_equipo2 : r.Codigo_equipo1,
            pf: r.Resultado1 === '' ? null : +(local ? r.Resultado1 : r.Resultado2),
            pc: r.Resultado2 === '' ? null : +(local ? r.Resultado2 : r.Resultado1),
            sede: r.Campo || null,
            distrito: r.Distrito || null,
          });
        }
      }
    }
  }

  partidos.sort((a, b) => a.temporada.localeCompare(b.temporada) || a.equipo.localeCompare(b.equipo)
    || String(a.fecha).localeCompare(String(b.fecha)) || (+a.jornada || 0) - (+b.jornada || 0));

  const salida = {
    _meta: {
      descripcion: 'Partidos del club según el portal de datos abiertos del Ayuntamiento de Madrid. Fuente INDEPENDIENTE del histórico propio: no se ha cruzado con season_*.json ni con la matriz.',
      fuente: 'Ayuntamiento de Madrid, dataset 300257 "Deportes colectivos - histórico" (datos.madrid.es).',
      licencia: 'CC BY 4.0 — republicable citando al Ayuntamiento de Madrid.',
      generado_por: 'scripts/build_rivales_jdm.js',
      identificacion: 'Por Nº EQUIPO de la hoja de inscripción (= Codigo_equipo del dataset). El nombre no se usa como filtro. Cuando no hay ficha, se valida el candidato contra el histórico propio por marcador y queda marcado como identificado_por="respaldo".',
      fases: 'Los partidos de torneo/Marca suman a la temporada (D19) pero van etiquetados en `fase`: liga, torneo o fase_final.',
      no_cubiertas: NO_CUBIERTAS,
      nota_rivales: 'El nombre del rival se guarda TAL CUAL viene en la fuente, sin normalizar ni fusionar variantes.',
    },
    partidos,
  };
  fs.writeFileSync(path.join(DATA, 'rivales_jdm.json'), JSON.stringify(salida, null, 1) + '\n', 'utf8');

  // ------------------------------------------------------------------ resumen
  console.log('=== PARTIDOS POR TEMPORADA Y EQUIPO ===');
  const porT = {};
  partidos.forEach(p => { const k = p.temporada + ' ' + p.equipo; (porT[k] = porT[k] || { n: 0, fases: {}, via: p.identificado_por }); porT[k].n++; porT[k].fases[p.fase] = (porT[k].fases[p.fase] || 0) + 1; });
  Object.entries(porT).sort().forEach(([k, v]) => console.log('  ' + k.padEnd(14) + String(v.n).padStart(3) + ' partidos  [' + Object.entries(v.fases).map(([f, n]) => f + ':' + n).join(', ') + ']  vía ' + v.via));
  console.log('\n  TOTAL: ' + partidos.length + ' partidos');
  if (informe.length) { console.log('\n=== IDENTIFICADOS POR RESPALDO ==='); informe.forEach(x => console.log('  ' + x)); }
  if (avisos.length) { console.log('\n=== AVISOS ==='); avisos.forEach(x => console.log('  ! ' + x)); }
  return { partidos, informe, avisos };
}

if (require.main === module) main();
module.exports = { main, parseCSV };
