/**
 * calendario_abierto.js
 *
 * Lee el CSV de partidos del portal de datos abiertos del Ayuntamiento de Madrid (datasets
 * 211549 "temporada en curso" y 300257 "histórico", mismo formato, CC BY 4.0) y devuelve los
 * partidos de nuestros equipos, identificados SIEMPRE por Codigo_equipo, nunca por nombre
 * (hay homónimos: ver D26).
 *
 * Sólo lee un fichero local: la descarga es aparte (ver scripts/calendario/).
 */
const fs = require('fs');
const { limpia } = require('./util');

/** Los CSV antiguos vienen en latin-1 y los nuevos en UTF-8 con BOM: se decide por fichero. */
function leerTexto(fichero) {
  const buf = fs.readFileSync(fichero);
  const utf8 = buf.toString('utf8');
  return (utf8.includes('�') ? buf.toString('latin1') : utf8).replace(/^﻿/, '');
}

/** CSV con ';' y comillas dobles. */
function parseCsv(texto) {
  const filas = [];
  let fila = [], campo = '', comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (comillas) {
      if (ch === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else comillas = false; }
      else campo += ch;
    } else if (ch === '"' && campo === '') comillas = true;   // como Python: sólo al empezar el campo
    else if (ch === ';') { fila.push(campo); campo = ''; }
    else if (ch === '\n') { fila.push(campo.replace(/\r$/, '')); filas.push(fila); fila = []; campo = ''; }
    else campo += ch;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const cab = filas.shift().map(c => c.trim());
  return filas.filter(f => f.length > 1).map(f => Object.fromEntries(cab.map((c, i) => [c, f[i] === undefined ? '' : f[i]])));
}

const fechaIso = f => {
  const s = String(f);
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
};

/**
 * @param fichero  CSV de partidos
 * @param codigos  { '<Codigo_equipo>': 'MDA' | 'MDL' }
 * @returns lista de partidos del club, ordenada por fecha y equipo
 */
function partidosDelClub(fichero, codigos) {
  const filas = parseCsv(leerTexto(fichero));
  const out = [];
  for (const r of filas) {
    const c1 = limpia(r.Codigo_equipo1), c2 = limpia(r.Codigo_equipo2);
    const nuestro = codigos[c1] ? 1 : codigos[c2] ? 2 : 0;
    if (!nuestro) continue;
    const equipo = codigos[nuestro === 1 ? c1 : c2];
    const rivalCod = nuestro === 1 ? c2 : c1;
    const descansa = /DESCANSA/i.test(r.Equipo_local + ' ' + r.Equipo_visitante) || !rivalCod || rivalCod === '0';
    const r1 = r.Resultado1 === '' ? null : +r.Resultado1, r2 = r.Resultado2 === '' ? null : +r.Resultado2;
    out.push({
      equipo,
      codigo_equipo: nuestro === 1 ? c1 : c2,
      fase: limpia(r.Nombre_fase),
      grupo: limpia(r.Nombre_grupo),
      jornada: r.Jornada === '' ? null : +r.Jornada,
      fecha: fechaIso(r.Fecha),
      hora: limpia(r.Hora).slice(0, 5) || null,
      local: nuestro === 1,
      descansa,
      rival: descansa ? null : limpia(nuestro === 1 ? r.Equipo_visitante : r.Equipo_local),
      rival_codigo: descansa ? null : rivalCod,
      campo: limpia(r.Campo) || null,
      estado: limpia(r.Estado) || null,
      pf: r1 === null ? null : (nuestro === 1 ? r1 : r2),
      pc: r2 === null ? null : (nuestro === 1 ? r2 : r1),
    });
  }
  return out.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || a.equipo.localeCompare(b.equipo));
}

module.exports = { partidosDelClub, parseCsv, leerTexto };
