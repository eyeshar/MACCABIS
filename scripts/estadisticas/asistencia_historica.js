#!/usr/bin/env node
/**
 * asistencia_historica.js — asistencia de 2018/19 a 2024/25 desde el export completo de SportEasy (D166).
 *
 * Identidad = id de perfil de SportEasy (`profile.id` de `detalle.attendees`), estable entre temporadas; el nombre no
 * une temporadas. Cada perfil se resuelve así:
 *   1. diccionario_sporteasy (copia del real en privado/) y nombres_sporteasy.json: nombre exacto -> person_id;
 *   2. nombre completo igual al de una persona del diccionario del histórico (data/diccionario_nombres.json, las de las
 *      temporadas con estadísticas), ignorando tildes y mayúsculas, si es única;
 *   3. vínculos aceptados por Iván (privado/sporteasy/vinculos_historico.json: { "<id de perfil>": "<person_id>" });
 *      los perfiles que Iván descarta (privado/sporteasy/descartes_historico.json: [ "<id de perfil>" ], p. ej. un
 *      «Jugador Generico» de relleno) no cuentan en ninguna temporada;
 *   4. el resto, persona histórica `sporteasy-<id>` con el nombre de SportEasy (sin cuenta ni acceso: solo existe como
 *      filas de asistencia_motivos, que solo leen los gestores).
 * Para los del punto 4 se PROPONE pareja (no se aplica) temporada a temporada, solo contra las personas que estaban en el
 * club esa temporada (data/historia_club.json, con o sin estadísticas): nombre + primer apellido, o mote registrado esa
 * temporada (data/diccionario_nombres.json) + primer apellido, sin tildes ni mayúsculas, y con UN solo candidato.
 *
 * Cuentan los entrenos y los partidos de campeonato (liga, 2.ª fase y play-off) jugados y no cancelados; amistosos,
 * torneos, «entre nosotros» y «Evento», no. Estado: presente = fueron; ausente con excusa = excusa; sin excusa o sin
 * responder = sin_excusa; lesionado = lesion. La API no trae «no convocado» (quien no estaba convocado no sale).
 *
 *   node scripts/estadisticas/asistencia_historica.js            escribe privado/asistencia/asistencia_<t>.json y
 *                                                                 privado/sporteasy/propuestas_para_ivan.md
 *   node scripts/estadisticas/asistencia_historica.js --dry      solo cuenta
 *
 * Todo lo que escribe va a privado/ (fuera de git). Por consola solo salen recuentos, nunca nombres.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');
const TEMPORADAS = ['2018-19', '2019-20', '2020-21', '2021-22', '2022-23', '2023-24', '2024-25'];
const PREFIJO = 'sporteasy-';

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim();
const limpia = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do', 'dos']);
const sinParticulas = (s) => norm(s).split(' ').filter((w) => w && !PARTICULAS.has(w));

/** «2018-2019» -> «2018-19». */
const slugTemporada = (clave) => { const m = clave.match(/^temporada_(\d{4})-(\d{4})$/); return m ? `${m[1]}-${m[2].slice(2)}` : null; };
/** Año de la Historia («2018») de una temporada («2018-19»). */
const anioDe = (t) => t.slice(0, 4);

const nombreSE = (perfil) => limpia(`${perfil.first_name ?? ''} ${perfil.last_name ?? ''}`) || limpia(perfil.full_name);

/** Clase de un evento que cuenta, o null. */
function claseEvento(lista) {
  if (!lista || lista.is_cancelled || !lista.is_past) return null;
  const t = lista.category?.type;
  return t === 'training' ? 'entrenos' : t === 'championship_match' ? 'partidos' : null;
}

/** Estado de una fila de attendees. */
function estado(r) {
  if (r.group?.slug_name === 'played') return 'fueron';
  const p = r.presence?.slug_name;
  if (p === 'excused') return 'excusa';
  if (p === 'injured') return 'lesion';
  return 'sin_excusa';
}
const PRIORIDAD = { fueron: 4, excusa: 3, lesion: 2, sin_excusa: 1 };

/**
 * Lee las temporadas del export: { temporada: { perfiles: Map(id -> { nombre, apariciones }), filas: [{ id, evento,
 * clase, estado }] } }.
 */
function leerExport(exp) {
  const out = {};
  for (const clave of Object.keys(exp)) {
    const t = slugTemporada(clave);
    if (!t || !TEMPORADAS.includes(t)) continue;
    const perfiles = new Map(); const filas = [];
    for (const e of exp[clave].eventos || []) {
      const clase = claseEvento(e.lista);
      if (!clase) continue;
      for (const g of e.detalle?.attendees || []) for (const r of g.results || []) {
        const id = r.profile?.id; if (id == null) continue;
        const p = perfiles.get(id) || { nombre: nombreSE(r.profile), apariciones: 0 };
        p.apariciones++; perfiles.set(id, p);
        filas.push({ id, evento: e.lista.id, clase, estado: estado(r) });
      }
    }
    out[t] = { perfiles, filas };
  }
  return out;
}

/** Nombre de pila y apellidos de una persona del club («Suárez Cobos, Alejandro»). */
function partesPersona(p) {
  const [ap, nom] = String(p.formal || '').split(',').map((s) => s.trim());
  return nom ? { nombre: nom, apellidos: ap } : { nombre: p.display || '', apellidos: '' };
}

/**
 * Candidatos de una temporada para un nombre de SportEasy: personas del club de esa temporada cuyo nombre de pila (o un
 * mote suyo registrado esa temporada) y primer apellido coinciden, sin tildes ni mayúsculas.
 */
function candidatos(nombreSportEasy, personasTemporada, motes) {
  const w = sinParticulas(nombreSportEasy);
  if (w.length < 2) return [];
  const out = new Set();
  for (const p of personasTemporada) {
    const { nombre, apellidos } = partesPersona(p);
    const ap = sinParticulas(apellidos);
    if (!ap.length) continue;
    const pilas = [sinParticulas(nombre), ...(motes.get(p.person_id) || []).map(sinParticulas)].filter((x) => x.length);
    for (const pila of pilas) {
      // nombre (una o varias palabras) seguido del primer apellido
      const n = pila.length;
      if (w.length > n && pila.every((x, i) => x === w[i]) && w[n] === ap[0]) { out.add(p.person_id); break; }
      // solo la primera palabra del nombre compuesto («Juan Carlos» -> «Juan»)
      if (n > 1 && w[0] === pila[0] && w[1] === ap[0]) { out.add(p.person_id); break; }
    }
  }
  return [...out];
}

const unico = (lista) => (lista.length === 1 ? lista[0] : null);

/** Motes registrados por temporada: Map(person_id -> [mote]) (incluye la variante «-MdA»). */
function motesDeTemporada(dicc, t) {
  const m = new Map();
  for (const k of [t, `${t}-MdA`]) for (const [mote, v] of Object.entries(dicc.resolucion_por_temporada?.[k] || {})) {
    if (!v?.person_id) continue;
    m.set(v.person_id, [...(m.get(v.person_id) || []), mote]);
  }
  return m;
}

/**
 * Resuelve cada perfil. Devuelve { resolucion: Map(id -> { person_id, como }), propuestas: [...], sinPropuesta: [...] }.
 */
function resolver({ temporadas, historia, dicc, sporteasyPorNombre, vinculos, descartes = [] }) {
  const porNombre = new Map();
  for (const p of dicc.personas) { const k = norm(p.display); porNombre.set(k, porNombre.has(k) ? null : p.person_id); }
  const perfiles = new Map(); // id -> { nombre, porTemporada: { t: apariciones } }
  for (const [t, { perfiles: ps }] of Object.entries(temporadas)) for (const [id, x] of ps) {
    const p = perfiles.get(id) || { nombres: new Set(), porTemporada: {} };
    p.nombres.add(x.nombre); p.porTemporada[t] = x.apariciones; perfiles.set(id, p);
  }
  const resolucion = new Map();
  for (const [id, p] of perfiles) {
    const nombres = [...p.nombres];
    const dic = nombres.map((n) => sporteasyPorNombre.get(limpia(n))).find(Boolean);
    const exacto = nombres.map((n) => porNombre.get(norm(n))).find(Boolean);
    if (descartes.includes(String(id))) resolucion.set(id, { person_id: null, como: 'descartado' });
    else if (dic) resolucion.set(id, { person_id: dic, como: 'diccionario_sporteasy' });
    else if (exacto) resolucion.set(id, { person_id: exacto, como: 'nombre exacto' });
    else if (vinculos[id]) resolucion.set(id, { person_id: vinculos[id], como: 'vínculo aceptado' });
  }
  const propuestas = []; const sinPropuesta = [];
  for (const [id, p] of perfiles) {
    if (resolucion.has(id)) continue;
    const nombre = [...p.nombres][0];
    const porT = {};
    for (const t of Object.keys(p.porTemporada)) {
      const club = historia.filter((h) => h.temporadas_jugadas.includes(anioDe(t)));
      porT[t] = candidatos(nombre, club, motesDeTemporada(dicc, t));
    }
    const unicos = Object.entries(porT).filter(([, c]) => c.length === 1);
    const ambiguas = Object.entries(porT).filter(([, c]) => c.length > 1).map(([t]) => t);
    const elegidos = [...new Set(unicos.map(([, c]) => c[0]))];
    const total = Object.values(p.porTemporada).reduce((a, b) => a + b, 0);
    const fila = { id, nombre, porTemporada: p.porTemporada, total };
    if (elegidos.length === 1) {
      propuestas.push({ ...fila, person_id: elegidos[0], coinciden: unicos.map(([t]) => t), ambiguas,
        sinCandidato: Object.entries(porT).filter(([, c]) => !c.length).map(([t]) => t) });
    } else {
      sinPropuesta.push({ ...fila, motivo: elegidos.length > 1 ? `candidatos distintos según la temporada (${elegidos.join(', ')})`
        : ambiguas.length ? `más de un candidato (${ambiguas.join(', ')})` : 'ningún candidato en sus temporadas',
        // pista, no propuesta: casaría con una sola persona del club, pero de otra temporada
        fuera: elegidos.length ? null : unico(candidatos(nombre, historia, new Map())) });
    }
  }
  return { resolucion, propuestas, sinPropuesta };
}

/**
 * Cuenta una temporada. Si dos perfiles van a la misma persona y coinciden en un evento, ese evento cuenta una vez
 * (con el mejor estado). Devuelve { jugadores: [{ person_id, display, partidos, entrenos }], solapes }.
 */
function contar({ filas, perfiles }, resolucion, displayDe) {
  const porEvento = new Map(); let solapes = 0;
  for (const f of filas) {
    if (resolucion.get(f.id)?.como === 'descartado') continue;
    const pid = resolucion.get(f.id)?.person_id || PREFIJO + f.id;
    const k = `${pid}|${f.evento}`;
    const prev = porEvento.get(k);
    if (prev) { solapes++; if (PRIORIDAD[f.estado] > PRIORIDAD[prev.estado]) prev.estado = f.estado; continue; }
    porEvento.set(k, { pid, id: f.id, clase: f.clase, estado: f.estado });
  }
  const jug = new Map();
  for (const x of porEvento.values()) {
    const j = jug.get(x.pid) || { person_id: x.pid, display: displayDe(x.pid) || perfiles.get(x.id).nombre };
    const d = j[x.clase] || (j[x.clase] = { fueron: 0, excusa: 0, sin_excusa: 0, no_conv: 0, lesion: 0, total: 0 });
    d[x.estado]++; d.total++;
    jug.set(x.pid, j);
  }
  return { jugadores: [...jug.values()].sort((a, b) => a.display.localeCompare(b.display, 'es')), solapes };
}

const etq = (t) => t.replace('-', '/');
const ap = (n) => `${n} ${n === 1 ? 'aparición' : 'apariciones'}`;

function informe({ propuestas, sinPropuesta }, displayDe) {
  const l = [];
  l.push('# Asistencia histórica de SportEasy: propuestas para Iván — PRIVADO (no subir)', '');
  l.push('Una línea por id de perfil de SportEasy. Marca **OK** o **NO** al principio de cada línea y devuélvelo.');
  l.push('Pareja propuesta: nombre + primer apellido (o mote registrado + primer apellido) que apunta a UNA sola persona del');
  l.push('club en esa temporada (Historia, con o sin estadísticas), sin tildes ni mayúsculas.', '');
  l.push(`## Con propuesta (${propuestas.length})`, '');
  for (const p of propuestas.sort((a, b) => b.total - a.total)) {
    const conf = p.coinciden.length > 1 ? ` · **${p.coinciden.length} temporadas**` : '';
    const extra = [p.ambiguas.length ? `ambigua en ${p.ambiguas.map(etq).join(', ')}` : '',
      p.sinCandidato.length ? `sin candidato en ${p.sinCandidato.map(etq).join(', ')}` : ''].filter(Boolean).join('; ');
    l.push(`- [ ] \`${p.id}\` «${p.nombre}» → **${displayDe(p.person_id)}** (\`${p.person_id}\`) · coinciden ${p.coinciden.map(etq).join(', ')}${conf} · ${ap(p.total)}${extra ? ` (${extra})` : ''}`);
  }
  l.push('', `## Sin propuesta (${sinPropuesta.length}): se quedan como persona histórica`, '');
  l.push('Si alguno es una persona del club, escribe al final de su línea su person_id entre comillas invertidas y paréntesis,');
  l.push('(`apellido-apellido-nombre`), y márcala OK. La «pista» es alguien del club con ese nombre y apellido, pero que según');
  l.push('la Historia no estaba en el club en esas temporadas: no se propone sola.', '');
  for (const p of sinPropuesta.sort((a, b) => b.total - a.total)) {
    const pista = p.fuera ? ` · pista: **${displayDe(p.fuera)}** (\`${p.fuera}\`), no figura en el club esas temporadas` : '';
    l.push(`- [ ] \`${p.id}\` «${p.nombre}» · ${Object.keys(p.porTemporada).map(etq).join(', ')} · ${ap(p.total)} · ${p.motivo}${pista}`);
  }
  l.push('');
  return l.join('\n');
}

/**
 * Propuestas aceptadas en el .md devuelto por Iván: { "<id de perfil>": "<person_id>" }. Cuenta como aceptada la línea
 * que lleva «OK» (o la casilla marcada «[x]») antes del id, y no lleva «NO».
 */
function leerAceptadas(md) {
  const out = {};
  for (const linea of md.split(/\r?\n/)) {
    const m = linea.match(/^(.*?)`(\d+)`.*\(`([a-z0-9-]+)`\)/);
    if (!m) continue;
    const marca = m[1];
    if (/\bNO\b/i.test(marca)) continue;
    if (/\bOK\b/i.test(marca) || /\[[xX]\]/.test(marca)) out[m[2]] = m[3];
  }
  return out;
}

/**
 * Decisiones del .md revisado por Iván. Por cada línea con un id de perfil entre comillas invertidas:
 *   - «NO» antes del id: descartar el perfil (no es una persona);
 *   - «OK» (o «[x]») antes del id: vincular. La persona es el person_id entre (`…`) de la línea o, si no lo hay, el nombre
 *     tras «→», que tiene que ser EXACTAMENTE el nombre completo (display) de una sola persona del club.
 * Lo que no se resuelve así va a `sinResolver`: no se adivina.
 */
function leerDecisiones(md, personas) {
  const porDisplay = new Map();
  for (const p of personas) porDisplay.set(p.display, porDisplay.has(p.display) ? null : p.person_id);
  const existe = new Set(personas.map((p) => p.person_id));
  const vincular = {}; const descartar = []; const sinResolver = [];
  for (const linea of md.split(/\r?\n/)) {
    const m = linea.match(/^(.*?)`(\d+)`(.*)$/);
    if (!m) continue;
    const [, marca, id, resto] = m;
    if (/\bNO\b/.test(marca)) { descartar.push(id); continue; }
    if (!/\bOK\b/i.test(marca) && !/\[[xX]\]/.test(marca)) continue;
    const pid = resto.match(/\(`([a-z0-9-]+)`\)/)?.[1];
    const nombre = resto.match(/→\s*\**([^(*]+?)\**\s*(?:\(|$)/)?.[1]?.trim();
    const elegido = pid ?? (nombre ? porDisplay.get(nombre) : undefined);
    if (elegido && existe.has(elegido)) vincular[id] = elegido;
    else sinResolver.push({ id, nombre: nombre ?? null, motivo: pid ? `el person_id ${pid} no existe` : 'no hay exactamente una persona con ese nombre completo' });
  }
  return { vincular, descartar, sinResolver };
}

/** Escribe los JSON de privado/asistencia/ y, si no se pide lo contrario, las propuestas (que pisan el .md de Iván). */
function escribir(c, { propuestas = true } = {}) {
  for (const [t, { jugadores }] of Object.entries(c.porTemporada)) {
    const f = path.join(RAIZ, 'privado/asistencia', `asistencia_${t}.json`);
    fs.writeFileSync(f, JSON.stringify({ _fuente: 'SportEasy, export completo 2026-11-01 (D166); generado por scripts/estadisticas/asistencia_historica.js', temporada: t, jugadores }, null, 1));
  }
  if (propuestas) fs.writeFileSync(path.join(RAIZ, 'privado/sporteasy/propuestas_para_ivan.md'), informe(c, c.displayDe));
}

const F_VINCULOS = path.join(RAIZ, 'privado/sporteasy/vinculos_historico.json');
const F_DESCARTES = path.join(RAIZ, 'privado/sporteasy/descartes_historico.json');

function cargarEntradas() {
  const leer = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, f), 'utf8'));
  const exp = leer('privado/sporteasy/sporteasy_maccabis_completo_2026-11-01.json');
  const personas = leer('data/personas.json').personas;
  const historia = leer('data/historia_club.json').personas;
  const dicc = leer('data/diccionario_nombres.json');
  const sporteasyPorNombre = new Map();
  for (const [n, pid] of Object.entries(leer('scripts/estadisticas/nombres_sporteasy.json').nombres)) sporteasyPorNombre.set(limpia(n), pid);
  const fDic = path.join(RAIZ, 'privado/sporteasy/diccionario_sporteasy_2026-10-31.json');
  if (fDic.length && fs.existsSync(fDic)) for (const x of JSON.parse(fs.readFileSync(fDic, 'utf8'))) sporteasyPorNombre.set(limpia(x.nombre_sporteasy), x.person_id);
  const vinculos = fs.existsSync(F_VINCULOS) ? JSON.parse(fs.readFileSync(F_VINCULOS, 'utf8')) : {};
  const descartes = fs.existsSync(F_DESCARTES) ? JSON.parse(fs.readFileSync(F_DESCARTES, 'utf8')).map(String) : [];
  return { exp, personas, historia, dicc, sporteasyPorNombre, vinculos, descartes };
}

/** Todo el cálculo, sin escribir: { porTemporada: { t: { jugadores, solapes } }, ...resolver() }. */
function calcular(e) {
  const temporadas = leerExport(e.exp);
  const r = resolver({ temporadas, ...e });
  const display = new Map(e.personas.map((p) => [p.person_id, p.display]));
  const displayDe = (pid) => display.get(pid);
  const porTemporada = {};
  for (const t of TEMPORADAS) if (temporadas[t]) porTemporada[t] = contar(temporadas[t], r.resolucion, displayDe);
  return { ...r, porTemporada, temporadas, displayDe };
}

if (require.main === module) {
  const dry = process.argv.includes('--dry');
  const c = calcular(cargarEntradas());
  const casados = [...c.resolucion.values()].filter((x) => x.como !== 'descartado');
  console.log(`Perfiles: ${casados.length + c.propuestas.length + c.sinPropuesta.length} · casados ${casados.length} `
    + `(diccionario ${casados.filter((x) => x.como === 'diccionario_sporteasy').length}, nombre exacto ${casados.filter((x) => x.como === 'nombre exacto').length}, `
    + `vínculo ${casados.filter((x) => x.como === 'vínculo aceptado').length}) · sin casar ${c.propuestas.length + c.sinPropuesta.length} `
    + `(con propuesta ${c.propuestas.length}, sin propuesta ${c.sinPropuesta.length})`);
  for (const [t, { jugadores, solapes }] of Object.entries(c.porTemporada)) {
    const hist = jugadores.filter((j) => j.person_id.startsWith(PREFIJO)).length;
    const filas = jugadores.reduce((a, j) => a + (j.partidos ? 1 : 0) + (j.entrenos ? 1 : 0), 0);
    console.log(`${t}: ${jugadores.length} personas (${hist} históricas), ${filas} filas${solapes ? `, ${solapes} apariciones repetidas fusionadas` : ''}`);
  }
  if (!dry) {
    escribir(c);
    console.log('Escrito en privado/asistencia/ y privado/sporteasy/propuestas_para_ivan.md');
  }
}

module.exports = { TEMPORADAS, PREFIJO, F_VINCULOS, F_DESCARTES, leerDecisiones, norm, claseEvento, estado, leerExport, candidatos, motesDeTemporada, resolver, contar,
  informe, calcular, cargarEntradas, escribir, leerAceptadas };
