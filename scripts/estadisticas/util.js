/**
 * util.js — utilidades comunes del pipeline de estadísticas.
 */

/**
 * Redondeo idéntico al round() de Python 3, que es el que produjo la 25/26: redondea al
 * más cercano y, en empate EXACTO, al par (round(2.5) = 2, round(0.125, 2) = 0.12).
 * Math.round y toFixed de JavaScript desempatan hacia arriba, y eso cambiaría medias y
 * porcentajes en los empates.
 */
function pyRound(x, n = 0) {
  if (x === null || x === undefined || !isFinite(x)) return x;
  // Expansión decimal EXACTA del double (con 100 cifras cabe entera para estas magnitudes).
  const [ent, frac = ''] = Math.abs(x).toPrecision(100).split('.');
  const guardadas = BigInt(ent + frac.slice(0, n).padEnd(n, '0'));
  const resto = frac.slice(n);
  const mitad = resto.length && resto[0] === '5' && /^0*$/.test(resto.slice(1));
  const sube = mitad ? guardadas % 2n === 1n : (resto[0] || '0') >= '5';
  const k = guardadas + (sube ? 1n : 0n);
  const v = Number(k) / 10 ** n;
  return x < 0 && v !== 0 ? -v : v;
}

/** str.title() de Python: mayúscula tras cualquier carácter que no sea letra. */
function pyTitle(s) {
  let out = '', prevLetra = false;
  for (const ch of String(s)) {
    const esLetra = ch.toLowerCase() !== ch.toUpperCase();
    out += esLetra ? (prevLetra ? ch.toLowerCase() : ch.toUpperCase()) : ch;
    prevLetra = esLetra;
  }
  return out;
}

const limpia = s => (s === null || s === undefined) ? '' : String(s).replace(/\s+/g, ' ').trim();

/** Normaliza un nombre de equipo para comparar: sin tildes, mayúsculas, sin signos. */
const normEquipo = s => limpia(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();


/**
 * Nombre de equipo en formato Título ("LOS KHINKIS RUSOS" -> "Los Khinkis Rusos"). Se mantienen en mayúsculas las
 * siglas (TD, RIF) y las abreviaturas con puntos (C.B., F.T.); "de/del/la/el/y" van en minúscula salvo al empezar.
 */
const SIGLAS = new Set(['TD', 'RIF']);
const MINUSCULAS = new Set(['de', 'del', 'la', 'el', 'y']);
function nombreTitulo(s) {
  return limpia(s).replace(/\.{2,}$/, '.').split(' ').map((w, i) => {
    if (/^[\d.]+$/.test(w) || SIGLAS.has(w.toUpperCase()) || /^(\p{L}\.)+$/u.test(w)) return /^\d/.test(w) ? w : w.toUpperCase();
    const b = w.toLowerCase();
    return i > 0 && MINUSCULAS.has(b) ? b : b.charAt(0).toUpperCase() + b.slice(1);
  }).join(' ');
}

module.exports = { pyRound, pyTitle, limpia, normEquipo, nombreTitulo };
