/**
 * consolidar_fichas.js
 *
 * Lee las hojas de inscripción de docs/Fichas y genera data/fichas_inscripcion.json
 * con SOLO temporada, equipo y nombres. DNI, fecha de nacimiento, teléfono y email
 * se descartan en la extracción: los PDF no se versionan (ver .gitignore y D17).
 *
 * Dos formatos de hoja:
 *   NUEVO (JDM 42+):   "Deportista APELLIDOS, NOMBRE 12345678A ..."
 *   ANTIGUO (JDM -41): "Apellido1 Apellido2 DNI\tNombre M\t12345678A ..."
 * Cuatro hojas son escaneos sin capa de texto y están transcritas a mano en
 * docs/fichas_transcritas.json (leídas visualmente, ver INFORME_FICHAS.md).
 *
 * MAPEO DE TEMPORADA
 *   - "N JUEGOS DEPORTIVOS MUNICIPALES" -> temporada (N+1979)/(N+1980). 34 JDM = 2013/14.
 *   - "TORNEOS MUNICIPALES AAAA" -> copa jugada AL FINAL de la temporada, así que
 *     pertenece a la temporada que TERMINA en AAAA: año de matriz = AAAA-1.
 *     Torneos 2017 -> 2016/17, Torneos 2018 -> 2017/18, Torneos 2019 -> 2018/19.
 *     Liga y torneo del mismo periodo son UNA temporada: sus plantillas se suman.
 *     Dejaron de jugarse hacia 2018/19; no hay torneos posteriores.
 *
 * FORMATO 2026/27 EN ADELANTE (47 JDM+)
 *   Sólo cuentan las filas "Deportista": los "Delegado/a" no son jugadores. Se guarda
 *   además el grupo (dato del equipo). La fecha de alta se lee pero NO se publica (D17). El person_id sólo se asigna si el nombre casa
 *   EXACTAMENTE con el registro o con un alias ya confirmado; si no, queda null con
 *   match "pendiente_de_ivan" (nunca parecido de nombre). Las hojas antiguas siguen
 *   con sus reglas de siempre para no alterar ningún dato histórico.
 *
 * PROTECCIÓN DE LAS FUENTES
 *   Antes de escribir se compara con el data/fichas_inscripcion.json anterior. Si falta
 *   el PDF de una hoja registrada, o el fichero con ese nombre ya no es la misma hoja
 *   (otro año, equipo o competición: señal de que se sobrescribió), el script FALLA y
 *   no escribe nada. Las hojas cuyo PDF se perdió de verdad se congelan en
 *   docs/fichas_sin_pdf.json (decisión de Iván) y salen con sin_pdf:true.
 *
 * USO:  node scripts/consolidar_fichas.js
 * Requiere los PDF en docs/Fichas. Si no está la carpeta, no toca nada y avisa.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { slug } = require('./parse_diccionario.js');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'docs', 'Fichas');
const DATA = path.join(ROOT, 'data');

const anioDeJDM = n => n + 1979;      // 34 JDM = temporada 2013/14
const anioDeTorneo = n => n - 1;      // el torneo cierra la temporada que termina ese año
const limpia = s => String(s).replace(/\s+/g, ' ').trim();

/**
 * Nombres de hoja que Iván ha confirmado que son una persona concreta, pese a que el
 * parecido automático no basta (difieren en un apellido o en el orden).
 */
const ALIAS_FICHA = {
  'hennessey-klein-patrick': 'klein-patrick-hennesey',   // mismo Patrick Klein, apellidos invertidos
  'abel-espinosa-fernando': 'espinola-fernando-abel',    // confirmado por Iván
  'castro-moya-henry': 'castro-moya-henry-luis',
  // las hojas antiguas traen las dos erratas de nombre corregidas el 04/08/2026
  'castro-mayo-henry-luis': 'castro-moya-henry-luis',
  'castro-mayo-henry': 'castro-moya-henry-luis',
  'mar-calvo-borja': 'martin-calvo-borja',               // "Mar Calvo" era la errata
};

// El texto de algunos PDF viene mal codificado (UTF-8 leído como latin-1): "RodrÃ-guez".
function repararMojibake(s) {
  return s.replace(/Ã-/g, 'í').replace(/Ã­/g, 'í').replace(/Ã±/g, 'ñ').replace(/Ã©/g, 'é')
    .replace(/Ã¡/g, 'á').replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú').replace(/Ã‘/g, 'Ñ');
}

function equipoDe(t) {
  if (/MACCABI DE LEVANTAR|Equipo:\s*MdL|Equipo:\s*MDL|^\s*MDL\s*$/im.test(t)) return 'MdL';
  if (/MACCABI DE ACOSTAR|Equipo:\s*MdA|Equipo:\s*MDA|^\s*MDA\s*$/im.test(t)) return 'MdA';
  return null;
}

const JDM_FORMATO_NUEVO = 47;   // 2026/27

// "DE CARVALHO RODRIGUES, JULIO CESAR" -> "de Carvalho Rodrigues, Julio Cesar"
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
const titulo = s => s.toLowerCase().split(' ').map(w => PARTICULAS.has(w) ? w
  : w.split('-').map(x => x.charAt(0).toUpperCase() + x.slice(1)).join('-')).join(' ');

/** Hoja del 47 JDM en adelante: sólo filas "Deportista", más el grupo. */
function parseNuevo(t) {
  const grupo = (t.match(/Grupo:\s*(.+?)\s+Distrito:/) || [])[1] || null;
  const personas = [], vistos = new Set();
  const re = /^Deportista\s+([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ'.\- ]+,\s*[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ'.\- ]*?)\s+[0-9XYZ][0-9]{6,8}[A-Za-z]\s/gm;
  let m;
  while ((m = re.exec(t))) {
    const [ap, no] = limpia(m[1]).split(/\s*,\s*/);
    const nombre = titulo(ap) + ', ' + titulo(no);
    if (vistos.has(nombre.toUpperCase())) continue;
    vistos.add(nombre.toUpperCase());
    personas.push(nombre);
  }
  return { grupo, personas };
}

function parse(txt) {
  const t = repararMojibake(String(txt).replace(/\r/g, ''));
  const jdm = t.match(/Competici[oó]n:\s*(\d+)\s*JUEGOS/i) || t.match(/(\d+)\s+JUEGOS DEPORTIVOS MUNICIPALES/i);
  if (jdm && +jdm[1] >= JDM_FORMATO_NUEVO) {
    const n = parseNuevo(t);
    return { jdm: +jdm[1], torneo: null, anio: String(anioDeJDM(+jdm[1])), equipo: equipoDe(t),
      nombres: n.personas, grupo: n.grupo, nuevo: true };
  }
  const tor = t.match(/TORNEOS MUNICIPALES(?:\s*-\s*MARCA)?\s+(20\d{2})/i);
  const filas = [];
  const reNuevo = /(Deportista|Delegado\/a|Entrenador\/a)\s+([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ'.\- ]+,\s*[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ'.\- ]*?)\s+(?=[0-9XYZ][0-9]{6,8}[A-Za-z]|[0-9]{2}\/[0-9]{2}\/[0-9]{4})/g;
  let m;
  while ((m = reNuevo.exec(t))) filas.push(limpia(m[2]));
  if (!filas.length) {
    const reViejo = /([A-Za-zÁÉÍÓÚÑÜáéíóúñü'’\-\.]+(?:[ \t]+[A-Za-zÁÉÍÓÚÑÜáéíóúñü'’\-\.]+){0,4}?)[ \t]+(DNI|NIE|PASAPORTE|PASAPORT)[ \t]*\n?\t?([\s\S]{1,60}?)\s+M\s*(?:M\s*)?\t/g;
    while ((m = reViejo.exec(t))) {
      const ap = limpia(m[1]).replace(/^(Nombre|Apellido1|Apellido2)\s+/i, '');
      const no = limpia(m[3]);
      if (!ap || !no || /^(T\.?|Documento|Sello|Categor)/i.test(ap)) continue;
      filas.push(`${ap}, ${no}`);
    }
  }
  const vistos = new Set();
  const nombres = filas.filter(n => { const k = n.toUpperCase(); if (vistos.has(k)) return false; vistos.add(k); return true; });
  const anio = jdm ? String(anioDeJDM(+jdm[1])) : (tor ? String(anioDeTorneo(+tor[1])) : null);
  return { jdm: jdm ? +jdm[1] : null, torneo: tor ? +tor[1] : null, anio, equipo: equipoDe(t), nombres };
}

// ---- identidades conocidas: diccionario de nombres + matriz de historia
function cargarIdentidades() {
  const dicc = JSON.parse(fs.readFileSync(path.join(DATA, 'diccionario_nombres.json'), 'utf8'));
  const hist = JSON.parse(fs.readFileSync(path.join(DATA, 'historia_club.json'), 'utf8'));
  const ids = new Set();
  dicc.personas.forEach(p => ids.add(p.person_id));
  hist.personas.forEach(p => ids.add(p.person_id));
  return ids;
}

const toks = s => new Set(String(s).split('-').filter(t => t.length > 2));

function resolver(nombre, ids) {
  const s0 = slug(nombre);
  const s = ALIAS_FICHA[s0] || s0;
  if (ids.has(s)) return { id: s, modo: ALIAS_FICHA[s0] ? 'alias' : 'exacto' };
  const A = toks(s);
  const cands = [];
  for (const id of ids) {
    const B = toks(id);
    let inter = 0; A.forEach(t => { if (B.has(t)) inter++; });
    const score = inter / Math.min(A.size, B.size);
    if (score >= 0.75 && inter >= 2) cands.push({ id, score });
  }
  cands.sort((a, b) => b.score - a.score);
  if (cands.length === 1 || (cands.length > 1 && cands[0].score > cands[1].score)) return { id: cands[0].id, modo: 'parcial', score: cands[0].score };
  if (cands.length > 1) return { id: null, modo: 'ambiguo', candidatos: cands.slice(0, 3).map(c => c.id) };
  return { id: null, modo: 'sin_identificar' };
}

/**
 * Comprueba que cada hoja del JSON anterior sigue teniendo su PDF y que ese PDF sigue
 * siendo la misma hoja. Devuelve la lista de errores (vacía si todo está bien).
 */
function verificarFuentes(anterior, leidos, congeladas) {
  if (!anterior) return [];
  const esCongelada = r => congeladas.some(c => c.fichero === r.fichero && c.anio === r.anio &&
    c.equipo === r.equipo && (c.torneo || null) === (r.torneo || null));
  const registradas = [];
  for (const f of anterior.fichas || []) for (const h of f.hojas || [])
    registradas.push({ fichero: h.fichero, anio: f.anio, equipo: f.equipo, torneo: h.torneo || null, conTorneo: true });
  for (const d of anterior.descartadas || [])
    registradas.push({ fichero: d.fichero, anio: d.anio, equipo: d.equipo, conTorneo: false });
  const errores = [];
  for (const r of registradas) {
    if (esCongelada(r)) continue;
    const p = leidos.get(r.fichero);           // nombre exacto, tal como lo lista la carpeta
    const hoja = r.anio + ' ' + r.equipo + (r.torneo ? ' (Torneos ' + r.torneo + ')' : '');
    if (!p) { errores.push('Falta el PDF "' + r.fichero + '" de la hoja ' + hoja + '.'); continue; }
    if (p.anio !== r.anio || p.equipo !== r.equipo || (r.conTorneo && (p.torneo || null) !== r.torneo))
      errores.push('"' + r.fichero + '" ya no es la hoja ' + hoja + ': ahora es ' + p.anio + ' ' + p.equipo +
        (p.torneo ? ' (Torneos ' + p.torneo + ')' : '') + '. ¿Se ha sobrescrito?');
  }
  return errores;
}

async function main() {
  if (!fs.existsSync(DIR)) { console.log('No existe docs/Fichas: no se regenera nada.'); return; }
  const { PDFParse } = require('pdf-parse');
  const { ALIAS } = require('./build_personas.js');
  const transcritas = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'fichas_transcritas.json'), 'utf8'));
  const congeladas = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'fichas_sin_pdf.json'), 'utf8')).hojas;
  const salidaPath = path.join(DATA, 'fichas_inscripcion.json');
  const anterior = fs.existsSync(salidaPath) ? JSON.parse(fs.readFileSync(salidaPath, 'utf8')) : null;
  const ids = cargarIdentidades();

  const files = fs.readdirSync(DIR).filter(f => /\.pdf$/i.test(f));
  // las congeladas entran en el mismo orden alfabético que si su PDF existiera
  const entradas = [...files.map(f => ({ f })), ...congeladas.map(c => ({ f: c.fichero, congelada: c }))]
    .sort((a, b) => (a.f < b.f ? -1 : a.f > b.f ? 1 : 0));
  const seen = new Map(), leidos = new Map(), fichas = [];
  for (const { f, congelada } of entradas) {
    if (congelada) {
      const c = congelada;
      fichas.push({ fichero: c.fichero, jdm: c.jdm, torneo: c.torneo, anio: c.anio, equipo: c.equipo,
        nombres: c.nombres, metodo: c.metodo, sin_pdf: true });
      continue;
    }
    const buf = fs.readFileSync(path.join(DIR, f));
    const h = crypto.createHash('md5').update(buf).digest('hex');
    if (seen.has(h)) { leidos.set(f, leidos.get(seen.get(h))); continue; }   // mismo PDF con otro nombre
    seen.set(h, f);
    if (transcritas[f]) { const v = transcritas[f]; leidos.set(f, v); fichas.push({ fichero: f, ...v, metodo: 'vision' }); continue; }
    const r = await new PDFParse({ data: buf }).getText();
    const p = parse(r.text || '');
    leidos.set(f, p);
    if (!p.nombres.length || !p.anio || !p.equipo) { fichas.push({ fichero: f, ...p, metodo: 'texto', ilegible: true }); continue; }
    fichas.push({ fichero: f, ...p, metodo: 'texto' });
  }

  const errores = verificarFuentes(anterior, leidos, congeladas);
  if (errores.length) {
    console.error('\nERROR: las fuentes de docs/Fichas no cuadran con data/fichas_inscripcion.json.');
    errores.forEach(e => console.error('  X ' + e));
    console.error('\nNo se ha escrito nada. Recupera el PDF (con otro nombre si hace falta) o, si es');
    console.error('irrecuperable y Iván lo decide, congela la hoja en docs/fichas_sin_pdf.json.');
    process.exit(1);
  }

  // "La hoja con más jugadores manda" se aplica al comparar VERSIONES de la misma hoja,
  // es decir mismo año + equipo + competición (liga o torneo).
  const mejor = new Map(), descartadas = [], ilegibles = [];
  for (const f of fichas) {
    if (f.ilegible) { ilegibles.push(f); continue; }
    const k = f.anio + '_' + f.equipo + '_' + (f.torneo ? 'torneo' : 'liga');
    const prev = mejor.get(k);
    if (!prev || f.nombres.length > prev.nombres.length) { if (prev) descartadas.push(prev); mejor.set(k, f); }
    else descartadas.push(f);
  }

  // Liga y torneo del mismo periodo son UNA SOLA temporada: las plantillas se SUMAN.
  const porTemporada = new Map();
  for (const f of mejor.values()) {
    const k = f.anio + '_' + f.equipo;
    const g = porTemporada.get(k) || { anio: f.anio, equipo: f.equipo, hojas: [], nombres: [] };
    const hoja = { fichero: f.fichero, jdm: f.jdm || null, torneo: f.torneo || null, metodo: f.metodo, n: f.nombres.length };
    if (f.sin_pdf) hoja.sin_pdf = true;
    g.hojas.push(hoja);
    if (f.nuevo) { g.nuevo = true; g.grupo = f.grupo; }
    for (const n of f.nombres) if (!g.nombres.some(x => x.toUpperCase() === n.toUpperCase())) g.nombres.push(n);
    porTemporada.set(k, g);
  }
  mejor.clear();
  for (const [k, g] of porTemporada) mejor.set(k, g);

  const sinId = [];
  for (const f of mejor.values()) {
    f.personas = f.nombres.map(n => {
      if (f.nuevo) {
        // 2026/27+: sólo casamiento exacto o alias ya confirmado; nunca parecido de nombre
        const s0 = slug(n), s = ALIAS[s0] || s0;
        const o = { nombre: n, person_id: ids.has(s) ? s : null };
        if (o.person_id && s !== s0) o.match = 'alias';
        if (!o.person_id) { o.match = 'pendiente_de_ivan'; sinId.push({ ficha: f.hojas[0].fichero, anio: f.anio, equipo: f.equipo, nombre: n, modo: o.match }); }
        return o;
      }
      const r = resolver(n, ids);
      const o = { nombre: n, person_id: r.id };
      if (r.modo !== 'exacto') o.match = r.modo;
      if (!r.id) sinId.push({ ficha: f.fichero, anio: f.anio, equipo: f.equipo, nombre: n, modo: r.modo, candidatos: r.candidatos });
      return o;
    });
  }

  const salida = {
    _meta: {
      descripcion: 'Hojas de inscripción oficiales. Límite inferior fiable de pertenencia: quien aparece en la hoja de un año, estuvo ese año.',
      fuente: 'PDFs en docs/Fichas (NO versionados: contienen DNI, fecha de nacimiento, teléfono y email). Aquí sólo año, equipo y nombre.',
      generado_por: 'scripts/consolidar_fichas.js',
      reglas: [
        'JDM N = temporada (N+1979)/(N+1980): 34 JDM = 2013/14.',
        'TORNEOS MUNICIPALES AAAA = copa del final de temporada: pertenece a la temporada que TERMINA en AAAA (año de matriz AAAA-1). Liga y torneo del mismo periodo son una sola temporada y sus plantillas se suman.',
        'Cuando hay varias hojas del mismo año y equipo vale SIEMPRE la que más jugadores tiene.',
        'match:"parcial" o "alias" = el nombre de la hoja no es idéntico al del registro pero se ha confirmado que es la misma persona.',
        'person_id:null = nombre que no casa con nadie conocido; NO se inventa identidad.',
        'Desde 2026/27 (47 JDM): sólo filas "Deportista" (los "Delegado/a" no son jugadores), con el grupo. La fecha de alta NO se publica (D17: de las hojas sólo sale temporada, equipo y nombre). person_id sólo cuando el nombre casa EXACTAMENTE con el registro (o con un alias_id ya confirmado); el resto queda null con match "pendiente_de_ivan".',
        'sin_pdf:true = hoja cuyo PDF se perdió y es irrecuperable; sus nombres vienen de docs/fichas_sin_pdf.json (congelada). Si falta el PDF de cualquier otra hoja registrada, el script falla y no escribe nada.',
      ],
    },
    fichas: [...mejor.values()].sort((a, b) => a.anio.localeCompare(b.anio) || a.equipo.localeCompare(b.equipo))
      .map(f => f.nuevo
        ? { anio: f.anio, equipo: f.equipo, temporada: f.anio + '/' + String((+f.anio + 1) % 100).padStart(2, '0'), grupo: f.grupo, hojas: f.hojas, n: f.nombres.length, personas: f.personas }
        : { anio: f.anio, equipo: f.equipo, hojas: f.hojas, n: f.nombres.length, personas: f.personas }),
    descartadas: descartadas.map(f => ({ anio: f.anio, equipo: f.equipo, fichero: f.fichero, n: f.nombres.length, motivo: 'otra hoja del mismo año y equipo tiene más jugadores' })),
    ilegibles: ilegibles.map(f => ({ fichero: f.fichero, motivo: 'no se pudo extraer temporada, equipo o jugadores' })),
    sin_identificar: sinId,
  };
  fs.writeFileSync(salidaPath, JSON.stringify(salida, null, 1) + '\n', 'utf8');

  console.log('=== HOJAS USADAS (una por año y equipo, la de más jugadores) ===');
  salida.fichas.forEach(f => console.log('  ' + f.anio + ' ' + f.equipo.padEnd(4) + String(f.n).padStart(3) + ' pers  ' +
    f.hojas.map(h => (h.torneo ? 'torneo ' + h.torneo : h.jdm + ' JDM') + ' (' + h.n + (h.metodo === 'vision' ? ', visión' : '') + (h.sin_pdf ? ', SIN PDF: congelada' : '') + ')').join(' + ')));
  console.log('\ndescartadas: ' + salida.descartadas.length + ' | ilegibles: ' + salida.ilegibles.length);
  console.log('\n=== SIN IDENTIFICAR ===');
  if (!sinId.length) console.log('  ninguno');
  sinId.forEach(p => console.log('  ' + p.anio + ' ' + p.equipo + '  "' + p.nombre + '"  [' + p.modo + ']' + (p.candidatos ? ' cand: ' + p.candidatos.join(', ') : '')));
}

main();
