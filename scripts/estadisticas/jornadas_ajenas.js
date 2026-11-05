/**
 * jornadas_ajenas.js — jornada de las hojas de los grupos AJENOS (G3-G6, D183, D184, D186).
 *
 * La hoja de la app no trae jornada y esos grupos no tienen calendario propio. La jornada se apunta:
 *  - al DESCARGAR (rutina A): una línea por hoja en el registro de descargas de la carpeta de Drive,
 *    `jornadas_hojas.csv` (`archivo;grupo;jornada;local;visitante`; `archivo` puede ir vacío: entonces cuenta el partido);
 *  - y queda en `data/jornadas_grupos_ajenos_<temporada>.json` (revisable y PÚBLICO: solo emparejamientos, que son el
 *    calendario oficial; nunca marcadores ni datos por jugador, D186). `npm run jornada` añade ahí cada hoja nueva y
 *    `liga.js` (y con él `db:liga`) lee de ahí la jornada de las copias que se llaman `liga_J--_…`.
 * MACCABIS_JORNADAS_AJENAS: otro fichero de datos (solo para las pruebas).
 */
const fs = require('fs');
const path = require('path');
const { normEquipo } = require('./util');

const ROOT = path.resolve(__dirname, '..', '..');
const MANIFIESTO = 'jornadas_hojas.csv';

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
    if (!grupo || !grupos[grupo]) errores.push(`${MANIFIESTO}, línea ${linea}: grupo desconocido «${c[col('grupo')]}».`);
    else if (!Number.isInteger(jornada) || jornada < 1) errores.push(`${MANIFIESTO}, línea ${linea}: jornada «${c[col('jornada')]}» no es un número.`);
    else if (!e.local || !e.visitante) errores.push(`${MANIFIESTO}, línea ${linea}: faltan el local o el visitante.`);
    else entradas.push(e);
  });
  return { entradas, errores };
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

module.exports = { MANIFIESTO, fichero, leer, buscar, porHoja, claveGrupo, leerManifiesto, enManifiesto, anotar };
