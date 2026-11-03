// Sin correos personales en lo que se publica del repositorio (norma 17, Iván 03/11/2026; revisión de seguridad). El
// repositorio es público: en docs/, data/ y plataforma/src/data/ (lo que está en git) solo valen correos de ejemplo
// (`*.local`, `example.com`…) y las direcciones institucionales de la lista. Comprobación estática, sin arrancar nada.
// Un FALLO dice fichero, línea y dominio, nunca la dirección (los registros de Actions son públicos).
//   npm run pruebas:sin-correos
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CARPETAS = ['docs', 'data', 'plataforma/src/data'];
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

const CORREO = /[a-z0-9._%+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})/gi;
/** Dominios de ejemplo (RFC 2606 y los de las pruebas) y extensiones de fichero (`icono@2x.png` no es un correo). */
const EJEMPLO = /(^|\.)(local|invalid|test|example|localhost)$|^example\.(com|org|net)$|\.(png|jpe?g|webp|svg|gif|js|mjs|ts|tsx|css|json|md)$/i;
/** Direcciones institucionales (no son de una persona): por dominio. */
const INSTITUCIONALES = new Set(['gesdeportiva.es']);

/** Correos que no son de ejemplo en un texto: [{ linea, dominio }]. */
export function correosPersonales(texto) {
  const fuera = [];
  texto.split('\n').forEach((l, i) => {
    for (const m of l.matchAll(CORREO)) {
      const dominio = m[1].toLowerCase();
      if (EJEMPLO.test(dominio) || INSTITUCIONALES.has(dominio) || /^no-?reply@/i.test(m[0])) continue;
      fuera.push({ linea: i + 1, dominio });
    }
  });
  return fuera;
}

console.log('== El comprobador');
ok(correosPersonales('Edwin → alguien.real@gmail.com (ficha)').length === 1, 'detecta un correo de Gmail');
ok(correosPersonales('x\n`otra.persona@empresa.es`').at(0)?.linea === 2, 'dice la línea');
ok(correosPersonales('jugador-a@pruebas.local, a@example.com, b@maccabis.invalid, noreply@github.com, soporte@gesdeportiva.es, icono@2x.png').length === 0,
  'acepta los de ejemplo, noreply, los institucionales y nombres de fichero');

console.log('\n== docs/, data/ y plataforma/src/data/');
const ficheros = execFileSync('git', ['ls-files', '-z', '--', ...CARPETAS], { cwd: REPO, encoding: 'utf8', windowsHide: true }).split('\0').filter(Boolean);
ok(ficheros.length > 0, `${ficheros.length} ficheros en git`);
let encontrados = 0;
for (const f of ficheros) {
  const buf = fs.readFileSync(path.join(REPO, f));
  if (buf.includes(0)) continue; // binarios (imágenes)
  for (const { linea, dominio } of correosPersonales(buf.toString('utf8'))) {
    encontrados++;
    ok(false, `correo que no es de ejemplo en ${f}:${linea}`, `dominio ${dominio}; descríbelo («su correo personal») o usa el person_id (norma 17)`);
  }
}
if (!encontrados) ok(true, 'ningún correo personal');

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
