#!/usr/bin/env node
/**
 * activar_redirecciones.js — último paso de la migración de GitHub Pages a la web nueva (pista M, D91-D93).
 *
 *   node scripts/activar_redirecciones.js              enseña qué cambiaría (no escribe nada)
 *   node scripts/activar_redirecciones.js --aplicar    lo aplica
 *
 * Hace dos cosas, y solo estas dos:
 *   1. data/redireccion_web.js: ESTA_ACTIVA = true. Cada pestaña de GitHub Pages salta a su página nueva
 *      (maccabis.vercel.app/liga, /plantilla, /jugador/<id>, /historia...).
 *   2. index.html: quita la barra «← Volver a Maccabis» (CSS, marcado y script), que ya no tiene sentido porque nadie llega
 *      a ver esa web.
 *
 * Es reversible con UN solo commit: se hace `git commit` de estos dos ficheros y, si hay que volver atrás,
 * `git revert <ese commit>` deja GitHub Pages exactamente como estaba (con su barra y sin redirigir).
 *
 * Opciones: --raiz <carpeta> aplica sobre otra copia del repositorio (lo usa la prueba plataforma/pruebas/activar_redirecciones.mjs).
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const i = args.indexOf('--raiz');
const RAIZ = i >= 0 ? path.resolve(args[i + 1]) : path.resolve(__dirname, '..');
const aplicar = args.includes('--aplicar');

const fRedir = path.join(RAIZ, 'data', 'redireccion_web.js');
const fIndex = path.join(RAIZ, 'index.html');
let redir = fs.readFileSync(fRedir, 'utf8');
let html = fs.readFileSync(fIndex, 'utf8');

const yaActiva = /var ESTA_ACTIVA = true;/.test(redir);
const ini = (s, marca) => { const k = s.indexOf(marca); if (k < 0) throw new Error(`No encuentro «${marca}» en index.html: ¿ya se retiró la barra?`); return k; };

let nuevoRedir = redir.replace('var ESTA_ACTIVA = false;', 'var ESTA_ACTIVA = true;');
let nuevoHtml = html;
if (html.includes('class="mcb"')) {
  // CSS de la barra: desde su comentario hasta justo antes de </style>
  const c0 = ini(nuevoHtml, '/* ===== Barra de vuelta a Maccabis');
  const c1 = nuevoHtml.indexOf('</style>', c0);
  nuevoHtml = nuevoHtml.slice(0, c0) + nuevoHtml.slice(c1);
  // marcado y script de la barra: desde <div class="mcb" ...> hasta el </script> que lo cierra
  const m0 = ini(nuevoHtml, '<div class="mcb" id="mcb">');
  const s0 = nuevoHtml.indexOf('<script>', m0);
  const m1 = nuevoHtml.indexOf('</script>', s0) + '</script>'.length;
  nuevoHtml = nuevoHtml.slice(0, m0) + nuevoHtml.slice(m1).replace(/^\r?\n/, '');
}

console.log(yaActiva ? 'Las redirecciones ya estaban activas.' : 'ESTA_ACTIVA: false -> true');
console.log(html === nuevoHtml ? 'La barra de GitHub Pages ya estaba retirada.' : `Barra de GitHub Pages: se quitan ${html.length - nuevoHtml.length} caracteres de index.html`);
if (!aplicar) { console.log('\n(No se ha escrito nada. Añade --aplicar para aplicarlo.)'); process.exit(0); }
fs.writeFileSync(fRedir, nuevoRedir);
fs.writeFileSync(fIndex, nuevoHtml);
console.log('\nAplicado. Revisa con `git diff --stat`, haz UN commit y, si hay que deshacerlo: `git revert <commit>`.');
