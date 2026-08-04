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
 * USO:  node scripts/consolidar_fichas.js
 * Requiere los PDF en docs/Fichas. Si no están, no toca nada y avisa.
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

function parse(txt) {
  const t = repararMojibake(String(txt).replace(/\r/g, ''));
  const jdm = t.match(/Competici[oó]n:\s*(\d+)\s*JUEGOS/i) || t.match(/(\d+)\s+JUEGOS DEPORTIVOS MUNICIPALES/i);
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

async function main() {
  if (!fs.existsSync(DIR)) { console.log('No existe docs/Fichas: no se regenera nada.'); return; }
  const { PDFParse } = require('pdf-parse');
  const transcritas = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'fichas_transcritas.json'), 'utf8'));
  const ids = cargarIdentidades();

  const files = fs.readdirSync(DIR).filter(f => /\.pdf$/i.test(f)).sort();
  const seen = new Map(), fichas = [];
  for (const f of files) {
    const buf = fs.readFileSync(path.join(DIR, f));
    const h = crypto.createHash('md5').update(buf).digest('hex');
    if (seen.has(h)) continue;                       // mismo PDF con otro nombre
    seen.set(h, f);
    if (transcritas[f]) { const v = transcritas[f]; fichas.push({ fichero: f, ...v, metodo: 'vision' }); continue; }
    const r = await new PDFParse({ data: buf }).getText();
    const p = parse(r.text || '');
    if (!p.nombres.length || !p.anio || !p.equipo) { fichas.push({ fichero: f, ...p, metodo: 'texto', ilegible: true }); continue; }
    fichas.push({ fichero: f, ...p, metodo: 'texto' });
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
    g.hojas.push({ fichero: f.fichero, jdm: f.jdm || null, torneo: f.torneo || null, metodo: f.metodo, n: f.nombres.length });
    for (const n of f.nombres) if (!g.nombres.some(x => x.toUpperCase() === n.toUpperCase())) g.nombres.push(n);
    porTemporada.set(k, g);
  }
  mejor.clear();
  for (const [k, g] of porTemporada) mejor.set(k, g);

  const sinId = [], dudosos = [];
  for (const f of mejor.values()) {
    f.personas = f.nombres.map(n => {
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
      ],
    },
    fichas: [...mejor.values()].sort((a, b) => a.anio.localeCompare(b.anio) || a.equipo.localeCompare(b.equipo))
      .map(f => ({ anio: f.anio, equipo: f.equipo, hojas: f.hojas, n: f.nombres.length, personas: f.personas })),
    descartadas: descartadas.map(f => ({ anio: f.anio, equipo: f.equipo, fichero: f.fichero, n: f.nombres.length, motivo: 'otra hoja del mismo año y equipo tiene más jugadores' })),
    ilegibles: ilegibles.map(f => ({ fichero: f.fichero, motivo: 'no se pudo extraer temporada, equipo o jugadores' })),
    sin_identificar: sinId,
  };
  fs.writeFileSync(path.join(DATA, 'fichas_inscripcion.json'), JSON.stringify(salida, null, 1) + '\n', 'utf8');

  console.log('=== HOJAS USADAS (una por año y equipo, la de más jugadores) ===');
  salida.fichas.forEach(f => console.log('  ' + f.anio + ' ' + f.equipo.padEnd(4) + String(f.n).padStart(3) + ' pers  ' +
    f.hojas.map(h => (h.torneo ? 'torneo ' + h.torneo : h.jdm + ' JDM') + ' (' + h.n + (h.metodo === 'vision' ? ', visión' : '') + ')').join(' + ')));
  console.log('\ndescartadas: ' + salida.descartadas.length + ' | ilegibles: ' + salida.ilegibles.length);
  console.log('\n=== SIN IDENTIFICAR ===');
  if (!sinId.length) console.log('  ninguno');
  sinId.forEach(p => console.log('  ' + p.anio + ' ' + p.equipo + '  "' + p.nombre + '"  [' + p.modo + ']' + (p.candidatos ? ' cand: ' + p.candidatos.join(', ') : '')));
}

main();
