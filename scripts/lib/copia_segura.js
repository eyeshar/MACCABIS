/**
 * copia_segura.js
 *
 * Copia un fichero a una carpeta de fuentes SIN sobrescribir nunca nada. Windows no
 * distingue mayúsculas, así que "MdL.pdf" pisa a "MDL.pdf": así se perdió la hoja de
 * Torneos 2018 (25/09/2026). Si ya existe un fichero con ese nombre, sin distinguir
 * mayúsculas, se para y se avisa.
 *
 *   - Si el existente es idéntico (mismo contenido), no hace nada y lo dice.
 *   - Si es distinto, lanza un error: decide una persona, no el script.
 *
 * USO desde otro script:  const { copiaSegura } = require('./lib/copia_segura');
 * USO por consola:        node scripts/lib/copia_segura.js <origen> <carpeta-destino> [nombre]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const md5 = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');

/** Devuelve el nombre real del fichero de `dir` que coincide con `nombre` sin distinguir mayúsculas. */
function existeSinMayusculas(dir, nombre) {
  if (!fs.existsSync(dir)) return null;
  const bajo = nombre.toLowerCase();
  return fs.readdirSync(dir).find(f => f.toLowerCase() === bajo) || null;
}

function copiaSegura(origen, dirDestino, nombre = path.basename(origen)) {
  fs.mkdirSync(dirDestino, { recursive: true });
  const choca = existeSinMayusculas(dirDestino, nombre);
  if (choca) {
    const destino = path.join(dirDestino, choca);
    if (md5(destino) === md5(origen)) return { copiado: false, destino, motivo: 'ya estaba (mismo contenido)' };
    throw new Error(`Ya existe "${choca}" en ${dirDestino} y es DISTINTO de "${origen}". ` +
      'No se sobrescribe: guarda el nuevo con otro nombre o decide cuál vale.');
  }
  const destino = path.join(dirDestino, nombre);
  fs.copyFileSync(origen, destino, fs.constants.COPYFILE_EXCL);   // falla si apareciera entre medias
  return { copiado: true, destino };
}

module.exports = { copiaSegura, existeSinMayusculas };

if (require.main === module) {
  const [origen, dir, nombre] = process.argv.slice(2);
  if (!origen || !dir) { console.log('Uso: node scripts/lib/copia_segura.js <origen> <carpeta-destino> [nombre]'); process.exit(2); }
  try {
    const r = copiaSegura(origen, dir, nombre);
    console.log(r.copiado ? `Copiado a ${r.destino}` : `${r.destino}: ${r.motivo}`);
  } catch (e) { console.error('ERROR: ' + e.message); process.exit(1); }
}
