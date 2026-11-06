/**
 * jornadas_ajenas.js — jornada de las hojas de los grupos AJENOS (G3-G6, D183, D184, D186).
 *
 * La hoja de la app no trae jornada y esos grupos no tienen calendario propio. La jornada se apunta:
 *  - al DESCARGAR (rutina A): una línea por hoja en el registro de descargas de la carpeta de Drive,
 *    `jornadas_hojas.csv` (`archivo;grupo;jornada;local;visitante`, y para un partido sin hoja `marcador;fecha;hora;motivo`; `archivo` puede ir vacío: entonces cuenta el partido);
 *  - y queda en `data/jornadas_grupos_ajenos_<temporada>.json` (revisable y PÚBLICO: solo emparejamientos, que son el
 *    calendario oficial; nunca marcadores ni datos por jugador, D186). `npm run jornada` añade ahí cada hoja nueva y
 *    `liga.js` (y con él `db:liga`) lee de ahí la jornada de las copias que se llaman `liga_J--_…`.
 * MACCABIS_JORNADAS_AJENAS: otro fichero de datos (solo para las pruebas).
 *
 * Partidos SIN HOJA con resultado oficial (fix/g5-rutina-s21-y-repaso): la app los lista con su marcador aunque no haya hoja
 * (le pasó a G5 J1) y una incomparecencia sale como 20-0. El marcador es privado (D184, D186):
 * nunca va a data/. Se apunta en el registro de descargas (columnas opcionales `marcador;fecha;hora;motivo`, con `archivo`
 * vacío y `motivo` «sin hoja» o «incomparecencia») y `npm run jornada` lo copia a `fuentes_fbm/<temporada>/resultados_sin_hoja.csv`
 * (fuera de git: `grupo;jornada;local;visitante;marcador;fecha;hora;motivo`), de donde lo leen liga.js y `db:liga`. En el
 * fichero de datos solo queda el hueco (emparejamiento y motivo, sin marcador). MACCABIS_SIN_HOJA: otro fichero (pruebas).
 * Columna opcional `pts_no_presentado` (solo incomparecencias): los puntos que la clasificación OFICIAL le da por ese partido
 * al que no se presentó (D74: nunca se suponen; la FBM puede contarlo como derrota normal, 1, si avisó a tiempo). Se rellena
 * al contrastar con la oficial (rutina B); vacía, su casilla sigue «pendiente de la oficial».
 */
const fs = require('fs');
const path = require('path');
const { normEquipo } = require('./util');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFIESTO = 'jornadas_hojas.csv';
const SIN_HOJA = 'resultados_sin_hoja.csv';
const CAB_SIN_HOJA = 'grupo;jornada;local;visitante;marcador;fecha;hora;motivo;pts_no_presentado';
const CAB_SIN_HOJA_8 = 'grupo;jornada;local;visitante;marcador;fecha;hora;motivo';   // la de antes, sin la última columna

const fichero = temporada => process.env.MACCABIS_JORNADAS_AJENAS || path.join(ROOT, 'data', `jornadas_grupos_ajenos_${temporada}.json`);

/** El fichero de datos ({ temporada, nota, partidos, jornadas }); vacío si no existe. */
function leer(temporada) {
  const f = fichero(temporada);
  if (!fs.existsSync(f)) return { temporada, nota: '', partidos: [], jornadas: [] };
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

const mismoPartido = (p, grupo, local, visitante) => p.grupo === grupo && normEquipo(p.local) === normEquipo(local) && normEquipo(p.visitante) === normEquipo(visitante);

/** El partido de ese grupo con ese local y ese visitante, o null. */
const buscar = (reg, grupo, local, visitante) => reg.partidos.find(p => mismoPartido(p, grupo, local, visitante)) || null;

/** Mapa nombre de la hoja (en fuentes_fbm/<temporada>/liga/) -> partido. */
const porHoja = reg => new Map(reg.partidos.filter(p => p.hoja).map(p => [p.hoja, p]));

/** Clave del grupo (G3…) a partir de «G3», «g3» o su nombre («DOM MAÑ G3»). */
function claveGrupo(texto, grupos) {
  const t = String(texto || '').trim();
  if (/^G\d+$/i.test(t)) return t.toUpperCase();
  const g = Object.values(grupos).find(x => normEquipo(x.nombre) === normEquipo(t));
  return g ? g.clave : null;
}

/**
 * El registro de descargas (rutina A). Devuelve { entradas: [{archivo, grupo, jornada, local, visitante, linea}], errores }.
 * Separador «;» o «,». La primera línea es la cabecera. Las líneas vacías y las que empiezan por «#» no cuentan.
 */
function leerManifiesto(ruta, grupos) {
  const entradas = [], errores = [];
  if (!ruta || !fs.existsSync(ruta)) return { entradas, errores };
  const lineas = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  const sep = (lineas[0] || '').includes(';') ? ';' : ',';
  const cab = (lineas[0] || '').split(sep).map(c => c.trim().toLowerCase());
  const col = k => cab.indexOf(k);
  if (['grupo', 'jornada', 'local', 'visitante'].some(k => col(k) < 0)) {
    errores.push(`${MANIFIESTO}: la cabecera debe ser «archivo;grupo;jornada;local;visitante» (es «${lineas[0] || ''}»).`);
    return { entradas, errores };
  }
  lineas.slice(1).forEach((l, i) => {
    if (!l.trim() || l.trim().startsWith('#')) return;
    const c = l.split(sep).map(x => x.trim());
    const linea = i + 2;
    const grupo = claveGrupo(c[col('grupo')], grupos);
    const jornada = +String(c[col('jornada')] || '').replace(/^J/i, '');
    const e = { archivo: col('archivo') >= 0 ? c[col('archivo')] || null : null, grupo, jornada, local: c[col('local')], visitante: c[col('visitante')], linea };
    // Columnas opcionales de un partido sin hoja (marcador y motivo; fecha y hora si se saben).
    const opc = k => (col(k) >= 0 ? c[col(k)] || '' : '');
    const sinHoja = opc('marcador') || opc('motivo') ? resultadoSinHoja({ ...e, marcador: opc('marcador'), fecha: opc('fecha'), hora: opc('hora'), motivo: opc('motivo') }) : null;
    if (!grupo || !grupos[grupo]) errores.push(`${MANIFIESTO}, línea ${linea}: grupo desconocido «${c[col('grupo')]}».`);
    else if (!Number.isInteger(jornada) || jornada < 1) errores.push(`${MANIFIESTO}, línea ${linea}: jornada «${c[col('jornada')]}» no es un número.`);
    else if (!e.local || !e.visitante) errores.push(`${MANIFIESTO}, línea ${linea}: faltan el local o el visitante.`);
    else if (sinHoja && sinHoja.error) errores.push(`${MANIFIESTO}, línea ${linea}: ${sinHoja.error}`);
    else if (sinHoja && e.archivo) errores.push(`${MANIFIESTO}, línea ${linea}: un partido sin hoja no lleva archivo.`);
    else entradas.push(sinHoja ? { ...e, sinHoja } : e);
  });
  return { entradas, errores };
}

/** «38-30» -> [38, 30]; null si no lo es. */
const leerMarcador = t => { const m = String(t || '').match(/^\s*(\d+)\s*[-–]\s*(\d+)\s*$/); return m ? [+m[1], +m[2]] : null; };
/** «03/10/2026» o «2026-10-03» -> «2026-10-03»; '' si va vacía; null si no se entiende. */
function leerFecha(t) {
  const x = String(t || '').trim();
  if (!x) return '';
  const m = x.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null;
}

/**
 * Un resultado sin hoja ({grupo, jornada, local, visitante, marcador, fecha, hora, motivo}) validado: { grupo, jornada, local,
 * visitante, pl, pv, fecha, hora, motivo: 'sin_hoja' | 'incomparecencia', no_presentado } o { error }. Una incomparecencia es
 * 20-0 (Bases 47 JDM, 2.10.1: perder por sanción = 20-0) y el que no se presenta es el del 0.
 */
function resultadoSinHoja(e) {
  const motivo = /incomparecencia/i.test(e.motivo) ? 'incomparecencia' : /sin[\s_]*hoja/i.test(e.motivo || 'sin hoja') ? 'sin_hoja' : null;
  const mk = leerMarcador(e.marcador), fecha = leerFecha(e.fecha);
  if (!motivo) return { error: `motivo «${e.motivo}»: tiene que ser «sin hoja» o «incomparecencia».` };
  if (!mk) return { error: `marcador «${e.marcador}»: tiene que ser local-visitante (p. ej. 38-30).` };
  if (fecha === null) return { error: `fecha «${e.fecha}»: tiene que ser dd/mm/aaaa.` };
  if (e.hora && !/^\d{1,2}:\d{2}$/.test(e.hora)) return { error: `hora «${e.hora}»: tiene que ser hh:mm.` };
  if (mk[0] === mk[1]) return { error: `marcador ${mk[0]}-${mk[1]}: en baloncesto no hay empates.` };
  if (motivo === 'incomparecencia' && !(Math.max(...mk) === 20 && Math.min(...mk) === 0)) return { error: `una incomparecencia es 20-0 (Bases 47 JDM, 2.10.1), no ${mk[0]}-${mk[1]}.` };
  const no_presentado = motivo === 'incomparecencia' ? (mk[0] === 0 ? e.local : e.visitante) : null;
  const ptsT = String(e.pts_no_presentado ?? '').trim();
  if (ptsT && motivo !== 'incomparecencia') return { error: `pts_no_presentado solo va en una incomparecencia.` };
  if (ptsT && !/^-?\d+$/.test(ptsT)) return { error: `pts_no_presentado «${ptsT}»: tiene que ser un número entero (los puntos de la oficial por ese partido).` };
  return { grupo: e.grupo, jornada: e.jornada, local: e.local, visitante: e.visitante, pl: mk[0], pv: mk[1], fecha: fecha || null, hora: e.hora || null, motivo, no_presentado,
    pts_no_presentado: ptsT ? +ptsT : null };
}

const ficheroSinHoja = temporada => {
  if (process.env.MACCABIS_SIN_HOJA) return process.env.MACCABIS_SIN_HOJA;
  const cfg = require('./temporadas.json')[temporada];
  return cfg ? path.join(ROOT, cfg.carpeta, SIN_HOJA) : null;
};

/** Los resultados sin hoja de fuentes_fbm/<temporada>/resultados_sin_hoja.csv (u otro fichero `f`): { entradas, errores }.
 *  Sin fichero, vacío. */
function leerSinHoja(temporada, grupos, f = ficheroSinHoja(temporada)) {
  const entradas = [], errores = [];
  if (!f || !fs.existsSync(f)) return { entradas, errores };
  const lineas = fs.readFileSync(f, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  if (![CAB_SIN_HOJA, CAB_SIN_HOJA_8].includes((lineas[0] || '').split(';').map(c => c.trim().toLowerCase()).join(';')))
    return { entradas, errores: [`${SIN_HOJA}: la cabecera debe ser «${CAB_SIN_HOJA}».`] };
  lineas.slice(1).forEach((l, i) => {
    if (!l.trim() || l.trim().startsWith('#')) return;
    const [grupoT, jornadaT, local, visitante, marcador, fecha, hora, motivo, pts_no_presentado] = l.split(';').map(x => x.trim());
    const grupo = claveGrupo(grupoT, grupos), jornada = +String(jornadaT || '').replace(/^J/i, '');
    if (!grupo || !grupos[grupo]) { errores.push(`${SIN_HOJA}, línea ${i + 2}: grupo desconocido «${grupoT}».`); return; }
    if (!Number.isInteger(jornada) || jornada < 1) { errores.push(`${SIN_HOJA}, línea ${i + 2}: jornada «${jornadaT}» no es un número.`); return; }
    if (!local || !visitante) { errores.push(`${SIN_HOJA}, línea ${i + 2}: faltan el local o el visitante.`); return; }
    const r = resultadoSinHoja({ grupo, jornada, local, visitante, marcador, fecha, hora, motivo, pts_no_presentado });
    if (r.error) errores.push(`${SIN_HOJA}, línea ${i + 2}: ${r.error}`); else entradas.push(r);
  });
  return { entradas, errores };
}

const mismoCruce = (a, b) => a.grupo === b.grupo && a.jornada === b.jornada
  && [normEquipo(a.local), normEquipo(a.visitante)].sort().join('|') === [normEquipo(b.local), normEquipo(b.visitante)].sort().join('|');

/** Añade resultados sin hoja nuevos a fuentes_fbm/<temporada>/resultados_sin_hoja.csv (los que ya están no se repiten).
 *  Devuelve { anotados, fichero, previo } (previo: el contenido de antes, o null si no existía, para deshacerlo). */
function anotarSinHoja(temporada, nuevos, grupos, f = ficheroSinHoja(temporada)) {
  const previo = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  const ya = leerSinHoja(temporada, grupos, f).entradas;
  const fecha = x => (x ? x.split('-').reverse().join('/') : '');
  const lineas = nuevos.filter(n => !ya.some(y => mismoCruce(y, n)))
    .map(n => [n.grupo, n.jornada, n.local, n.visitante, `${n.pl}-${n.pv}`, fecha(n.fecha), n.hora || '', n.motivo === 'incomparecencia' ? 'incomparecencia' : 'sin hoja', n.pts_no_presentado ?? ''].join(';'));
  if (!lineas.length) return { anotados: 0, fichero: f, previo };
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, (previo ? previo.replace(/\s*$/, '\n') : CAB_SIN_HOJA + '\n') + lineas.join('\n') + '\n', 'utf8');
  return { anotados: lineas.length, fichero: f, previo };
}

/** Pone en el fichero de datos el hueco de cada resultado sin hoja (emparejamiento y motivo, SIN marcador) si no estaba, y
 *  recalcula quién descansa en esa jornada si no lo dice ya. Devuelve cuántos ha añadido. */
function anotarHuecos(temporada, sinHoja, grupos) {
  if (!sinHoja.length) return 0;
  const reg = leer(temporada);
  let n = 0;
  for (const e of sinHoja) {
    let j = reg.jornadas.find(x => x.grupo === e.grupo && x.jornada === e.jornada);
    if (!j) reg.jornadas.push(j = { grupo: e.grupo, jornada: e.jornada, descansa: null, huecos: [] });
    if ((j.huecos || []).some(h => mismoCruce({ ...h, grupo: e.grupo, jornada: e.jornada }, e))) continue;
    (j.huecos || (j.huecos = [])).push({ local: e.local, visitante: e.visitante, motivo: e.motivo,
      nota: e.motivo === 'incomparecencia' ? `incomparecencia de ${e.no_presentado}: no genera hoja (D29)` : 'resultado oficial en la app, sin hoja de estadística', comprobado: true });
    n++;
    const g = grupos[j.grupo];
    if (g && !j.descansa) {
      const juegan = new Set([...reg.partidos.filter(p => p.grupo === j.grupo && p.jornada === j.jornada), ...j.huecos].flatMap(p => [normEquipo(p.local), normEquipo(p.visitante)]));
      const fuera = [...g.equipos.keys()].filter(k => !juegan.has(k));
      j.descansa = fuera.length === 1 ? g.equipos.get(fuera[0]).nombre.toUpperCase() : null;
    }
  }
  if (!n) return 0;
  reg.jornadas.sort((a, b) => a.grupo.localeCompare(b.grupo) || a.jornada - b.jornada);
  fs.writeFileSync(fichero(temporada), JSON.stringify(reg, null, 2) + '\n', 'utf8');
  return n;
}

/** La entrada del registro de descargas para una hoja: por el nombre del fichero o, si no lo lleva, por el partido. */
function enManifiesto(entradas, archivo, grupo, local, visitante) {
  const porNombre = entradas.find(e => e.archivo && e.archivo === archivo);
  if (porNombre) return porNombre;
  return entradas.find(e => !e.archivo && mismoPartido(e, grupo, local, visitante)) || null;
}

/**
 * Añade partidos nuevos ({grupo, jornada, local, visitante, hoja, comprobado}) al fichero de datos y recalcula quién descansa
 * en las jornadas tocadas (si queda exactamente un equipo sin partido ni hueco; si no, «descansa» queda en null).
 * `grupos`: los del contexto de liga.js (para la lista de equipos). Devuelve cuántos ha añadido.
 */
function anotar(temporada, nuevos, grupos) {
  if (!nuevos.length) return 0;
  const reg = leer(temporada);
  let n = 0;
  for (const p of nuevos) {
    if (buscar(reg, p.grupo, p.local, p.visitante)) continue;
    reg.partidos.push({ grupo: p.grupo, jornada: p.jornada, local: p.local, visitante: p.visitante, hoja: p.hoja, comprobado: !!p.comprobado });
    n++;
    if (!reg.jornadas.some(j => j.grupo === p.grupo && j.jornada === p.jornada)) reg.jornadas.push({ grupo: p.grupo, jornada: p.jornada, descansa: null, huecos: [] });
  }
  const orden = (a, b) => a.grupo.localeCompare(b.grupo) || a.jornada - b.jornada;
  reg.partidos.sort(orden);
  reg.jornadas.sort(orden);
  for (const j of reg.jornadas.filter(j => nuevos.some(p => p.grupo === j.grupo && p.jornada === j.jornada))) {
    const g = grupos[j.grupo];
    if (!g) continue;
    const juegan = new Set([...reg.partidos.filter(p => p.grupo === j.grupo && p.jornada === j.jornada), ...(j.huecos || [])]
      .flatMap(p => [normEquipo(p.local), normEquipo(p.visitante)]));
    const fuera = [...g.equipos.keys()].filter(k => !juegan.has(k));
    j.descansa = fuera.length === 1 ? g.equipos.get(fuera[0]).nombre.toUpperCase() : null;
  }
  fs.writeFileSync(fichero(temporada), JSON.stringify(reg, null, 2) + '\n', 'utf8');
  return n;
}

module.exports = { MANIFIESTO, SIN_HOJA, fichero, ficheroSinHoja, leer, buscar, porHoja, claveGrupo, leerManifiesto, enManifiesto, anotar,
  resultadoSinHoja, leerSinHoja, anotarSinHoja, anotarHuecos, mismoCruce };
