/**
 * leer_hoja.js
 *
 * Lee una hoja de estadística de la app Afición FBM (estadisticaPartido_*.xlsx) y devuelve
 * SÓLO el bloque de nuestro equipo. La hoja trae también a los jugadores rivales con nombre
 * completo: no se leen ni se guardan (del rival sólo se lee el total de puntos).
 *
 * El nombre del fichero NO es fiable: desde la jornada 1 de 2026/27 la FBM lo llama
 * "estadisticaPartido_<fechaDeDescarga>.xlsx" (con sufijos " 1", "_1", " (1)" si se descarga dos
 * veces). Equipo, rival y local/visitante salen del CONTENIDO (cabecera "Estadísticas - X vs Y -
 * ..."); el nombre sólo aporta la jornada en los ficheros antiguos de 2025/26 (…_21_mda.xlsx).
 *
 * Columnas del bloque (fila de cabecera "Num. | Nombre | MIN | PTS | 2P A/I | % | 3P A/I | % |
 * TL A/I | % | DEF | OF | Tot. | AST | REC | PER | TC | TR | FC | FR | VAL | +/-"). La liga sólo
 * registra puntos, tiros, faltas cometidas, valoración y +/-: el resto viene siempre a cero y
 * se descarta.
 */
const path = require('path');
const { limpia, normEquipo } = require('./util');

/** "estadisticaPartido_21_mda.xlsx" -> { jornada: 21, playoff: false, equipo: 'MDA' } */
function datosDelNombre(fichero) {
  const m = path.basename(fichero).match(/_(PO)?(\d{1,2})_(mda|mdl)\b/i);
  if (!m) return null;
  return { jornada: +m[2], playoff: !!m[1], equipo: m[3].toUpperCase() };
}

const aSeg = v => {
  const s = limpia(v);
  if (!s || s === '-') return 0;
  if (s.includes(':')) { const [mm, ss] = s.split(':'); const r = (+mm) * 60 + (+ss); return isFinite(r) ? r : 0; }
  const n = parseFloat(s); return isFinite(n) ? Math.trunc(n) * 60 : 0;
};
const ai = v => { const s = limpia(v); if (!s.includes('/')) return [0, 0]; const [a, i] = s.split('/').map(x => parseInt(x, 10)); return isFinite(a) && isFinite(i) ? [a, i] : [0, 0]; };
const ent = v => { const s = limpia(v); const n = parseInt(s, 10); if (isFinite(n) && String(n) === s.replace(/^\+/, '')) return n; const f = parseFloat(s); return isFinite(f) ? Math.trunc(f) : 0; };

/**
 * @param fichero  ruta del XLSX
 * @param equipo   'MDA' | 'MDL' (si no se pasa, se deduce del nombre del fichero)
 */
function leerHoja(fichero, equipo) {
  const X = require('xlsx');
  const wb = X.readFile(fichero);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const filas = X.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  const meta = datosDelNombre(fichero) || {};

  let titulo = '';
  for (const f of filas.slice(0, 8)) for (const c of f) if (c && String(c).includes('vs')) titulo = limpia(c);
  const t = titulo.match(/Estadísticas - (.+?) vs (.+?) -/);
  const local = t ? limpia(t[1]) : null, visitante = t ? limpia(t[2]) : null;
  // El equipo sale del título ("MDA vs RIVAL"); el nombre del fichero sólo es el último recurso.
  const eq = (equipo || ['MDA', 'MDL'].find(x => [local, visitante].some(n => normEquipo(n) === x)) || meta.equipo || '').toUpperCase();

  const ini = filas.findIndex(f => f && limpia(f[0]).toUpperCase() === eq);
  if (ini < 0) throw new Error(`${path.basename(fichero)}: no encuentro el bloque del equipo "${eq}".`);
  const jugadores = [];
  let totales = null, totalesFila = -1;
  for (let j = ini + 1; j < Math.min(ini + 20, filas.length); j++) {
    const r = filas[j];
    if (!r) continue;
    const c0 = limpia(r[0]), c1 = limpia(r[1]);
    if (c1 === 'TOTALES') { totales = { pts: ent(r[3]) }; totalesFila = j; break; }
    if (c0 === '' || c0 === 'Num.' || c1 === '' || c1 === 'Nombre') continue;
    const [p2a, p2i] = ai(r[4]), [p3a, p3i] = ai(r[6]), [tla, tli] = ai(r[8]);
    jugadores.push({ num: c0, nombre: c1, sec: aSeg(r[2]), pts: ent(r[3]), p2a, p2i, p3a, p3i, tla, tli,
      fc: ent(r[18]), val: ent(r[20]), pm: ent(r[21]) });
  }
  // Total de puntos del rival: sólo la fila TOTALES de su bloque (ni nombres ni dorsales).
  const filaTot = filas.map((r, i) => [r, i]).filter(([r]) => r && limpia(r[1]) === 'TOTALES' && limpia(r[0]) === '');
  const otros = filaTot.filter(([, i]) => i !== totalesFila);
  const totalesRival = otros.length === 1 ? { pts: ent(otros[0][0][3]) } : null;
  const esLocal = local ? normEquipo(local) === eq : null;
  return { fichero: path.basename(fichero), ...meta, equipo: eq, titulo, local, visitante, esLocal, jugadores, totales, totalesRival };
}

module.exports = { leerHoja, datosDelNombre };

if (require.main === module) {
  for (const f of process.argv.slice(2)) console.log(JSON.stringify(leerHoja(f), null, 1));
}
