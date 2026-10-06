/**
 * leer_hoja_liga.js
 *
 * Lee una hoja de estadística de la app Afición FBM con LOS DOS bloques (local y visitante),
 * para cualquier partido de la liga, juegue o no un equipo nuestro.
 *
 * PRIVACIDAD (D73): los datos por jugador de equipos que no son el nuestro son de terceros. Este
 * módulo los devuelve tal cual para que los consuma SOLO la carga privada (Supabase, con RLS para
 * gestores). Lo que se publica (data/liga_<temporada>.json) se construye en liga.js a partir de
 * los totales por equipo y nunca incluye nombres ni dorsales de jugadores.
 *
 * Columnas de cada bloque: Num. | Nombre | MIN | PTS | 2P A/I | % | 3P A/I | % | TL A/I | % | DEF | OF | Tot. |
 * AST | REC | PER | TC | TR | FC | FR | VAL | +/-. La liga sólo registra puntos, tiros (en 2P y 3P sólo
 * los acertados), faltas cometidas, valoración y +/-; el resto viene a cero.
 */
const path = require('path');
const { limpia, normEquipo } = require('./util');

const aSeg = v => {
  const s = limpia(v);
  if (!s || s === '-') return 0;
  if (s.includes(':')) { const [mm, ss] = s.split(':'); const r = (+mm) * 60 + (+ss); return isFinite(r) ? r : 0; }
  const n = parseFloat(s); return isFinite(n) ? Math.trunc(n) * 60 : 0;
};
const ai = v => { const s = limpia(v); if (!s.includes('/')) return [0, 0]; const [a, i] = s.split('/').map(x => parseInt(x, 10)); return isFinite(a) && isFinite(i) ? [a, i] : [0, 0]; };
const ent = v => { const s = limpia(v); const n = parseInt(s, 10); if (isFinite(n) && String(n) === s.replace(/^\+/, '')) return n; const f = parseFloat(s); return isFinite(f) ? Math.trunc(f) : 0; };

function filaJugador(r) {
  const [p2a, p2i] = ai(r[4]), [p3a, p3i] = ai(r[6]), [tla, tli] = ai(r[8]);
  return { sec: aSeg(r[2]), pts: ent(r[3]), p2a, p2i, p3a, p3i, tla, tli, fc: ent(r[18]), val: ent(r[20]), pm: ent(r[21]) };
}

/**
 * @returns {{fichero, titulo, etiqueta, local, visitante,
 *            equipos: [{nombre, jugadores:[{num,nombre,...}], totales:{pts,p2a,p3a,tla,tli,fc,sec}}, ...]}}
 *          equipos[0] es el local y equipos[1] el visitante (orden del título).
 */
function leerHojaLiga(fichero) {
  const X = require('xlsx');
  const wb = X.readFile(fichero);
  const filas = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
  const nombre = path.basename(fichero);

  let titulo = '';
  for (const f of filas.slice(0, 8)) for (const c of f) if (c && String(c).includes(' vs ')) titulo = limpia(c);
  const t = titulo.match(/Estadísticas - (.+?) vs (.+?) - (.*)$/);
  if (!t) throw new Error(`${nombre}: no encuentro la cabecera "Estadísticas - A vs B - ..." del partido.`);
  const local = limpia(t[1]), visitante = limpia(t[2]);
  const etiqueta = (titulo.match(/(\d{2}\/\d{2})\s*$/) || [])[1] || null;

  // Un bloque de equipo empieza en una fila con el nombre en la 1ª columna cuya siguiente fila trae "TC 2P".
  const ini = [];
  filas.forEach((r, i) => { if (r && limpia(r[0]) && filas[i + 1] && limpia(filas[i + 1][4]) === 'TC 2P') ini.push(i); });
  if (ini.length !== 2) throw new Error(`${nombre}: esperaba 2 bloques de equipo y hay ${ini.length}.`);

  const equipos = ini.map((i0, k) => {
    const nom = limpia(filas[i0][0]);
    const jugadores = [];
    let totales = null;
    const fin = k + 1 < ini.length ? ini[k + 1] : filas.length;
    for (let j = i0 + 2; j < fin; j++) {
      const r = filas[j];
      if (!r) continue;
      const c0 = limpia(r[0]), c1 = limpia(r[1]);
      if (c1 === 'TOTALES') { totales = filaJugador(r); break; }
      if (c0 === '' || c0 === 'Num.' || c1 === '' || c1 === 'Nombre') continue;
      jugadores.push({ num: c0, nombre: c1, ...filaJugador(r) });
    }
    if (!totales) throw new Error(`${nombre}: el bloque "${nom}" no tiene fila TOTALES.`);
    return { nombre: nom, jugadores, totales };
  });

  // El orden de los bloques debe ser el del título.
  const [a, b] = equipos;
  if (normEquipo(a.nombre) !== normEquipo(local) || normEquipo(b.nombre) !== normEquipo(visitante))
    throw new Error(`${nombre}: los bloques (${a.nombre} / ${b.nombre}) no coinciden con el título (${local} / ${visitante}).`);
  return { fichero: nombre, titulo, etiqueta, local, visitante, equipos };
}

/** Comprueba que la suma por jugador es igual al total del equipo. Devuelve la lista de problemas. */
function validarSumas(h) {
  const errores = [];
  for (const e of h.equipos) {
    const suma = k => e.jugadores.reduce((s, j) => s + j[k], 0);
    for (const k of ['pts', 'p2a', 'p3a', 'tla', 'tli', 'fc']) {
      if (suma(k) !== e.totales[k]) errores.push(`${h.fichero}: ${e.nombre}: la suma de ${k} por jugador (${suma(k)}) no es el total (${e.totales[k]}).`);
    }
    const calc = 2 * e.totales.p2a + 3 * e.totales.p3a + e.totales.tla;
    if (calc !== e.totales.pts) errores.push(`${h.fichero}: ${e.nombre}: 2P×2 + 3P×3 + TL (${calc}) no es el total de puntos (${e.totales.pts}).`);
    if (!e.jugadores.length) errores.push(`${h.fichero}: ${e.nombre}: el bloque no tiene jugadores.`);
  }
  return errores;
}

module.exports = { leerHojaLiga, validarSumas };

if (require.main === module) {
  for (const f of process.argv.slice(2)) {
    const h = leerHojaLiga(f);
    console.log(h.titulo, '|', h.equipos.map(e => `${e.nombre} ${e.totales.pts} (${e.jugadores.length} jug.)`).join(' - '), '|', validarSumas(h).join('; ') || 'sumas OK');
  }
}
