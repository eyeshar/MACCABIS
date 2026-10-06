/**
 * test_liga.js — comprobaciones de la liga (npm run test:liga).
 *  1. PRIVACIDAD (D73): data/liga_<temporada>.json no contiene ni un nombre de jugador de los que traen las hojas.
 *  2. Aritmética: PJ = G + P, PF/PC de la clasificación = suma de los resultados, puntos = 2G + 1P,
 *     lo que marcan unos lo reciben otros (suma PF = suma PC) y la clasificación está ordenada.
 *  3. Cada resultado del JSON coincide con los totales de su hoja.
 */
const fs = require('fs');
const path = require('path');
const { construir } = require('./liga');
const T = process.argv[2] || '2026-27';
const ROOT = path.resolve(__dirname, '..', '..');
let fallos = 0;
const ok = (c, m) => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}`); if (!c) fallos++; };

const r = construir(T);
ok(r.errores.length === 0, `la construcción no da errores (${r.errores.join(' | ')})`);
const texto = fs.readFileSync(path.join(ROOT, 'data', `liga_${T}.json`), 'utf8');
const pub = JSON.parse(texto);
ok(JSON.stringify(pub.grupos) === JSON.stringify(r.publico.grupos), 'el JSON publicado es el que se construye ahora (no está desfasado)');

const nombres = new Set(r.privado.flatMap(p => p.equipos.flatMap(e => e.jugadores.map(j => j.nombre))));
const fugas = [...nombres].filter(n => texto.toUpperCase().includes(n.toUpperCase()));
ok(nombres.size > 0 && fugas.length === 0, `ningún nombre de jugador (${nombres.size} en las hojas) aparece en el JSON público`);
ok(!/"(jugadores|dorsal|num)"/.test(texto), 'el JSON público no tiene campos por jugador');

for (const [k, g] of Object.entries(pub.grupos)) {
  ok(g.clasificacion.every(x => x.pj === x.g + x.p), `${k}: PJ = G + P en todos los equipos`);
  ok(g.clasificacion.every(x => x.pts === pub.puntuacion.victoria * x.g + pub.puntuacion.derrota * x.p), `${k}: puntos = ${pub.puntuacion.victoria}·G + ${pub.puntuacion.derrota}·P`);
  const pf = g.clasificacion.reduce((s, x) => s + x.pf, 0), pc = g.clasificacion.reduce((s, x) => s + x.pc, 0);
  ok(pf === pc && pf === g.resultados.reduce((s, x) => s + x.pl + x.pv, 0), `${k}: puntos a favor = puntos en contra = suma de resultados (${pf})`);
  ok(g.clasificacion.every((x, i, a) => i === 0 || a[i - 1].pts >= x.pts), `${k}: ordenada por puntos`);
  ok(g.clasificacion.every(x => x.dif === x.pf - x.pc), `${k}: diferencia = PF - PC`);
  for (const res of g.resultados) {
    const h = r.privado.find(p => p.grupo === k && p.jornada === res.jornada && p.local === res.local && p.visitante === res.visitante);
    ok(h && h.equipos[0].totales.pts === res.pl && h.equipos[1].totales.pts === res.pv, `${k} J${res.jornada} ${res.local} ${res.pl}-${res.pv} ${res.visitante}: coincide con los totales de su hoja`);
  }
}
ok(/pendiente de contrastar con la oficial/.test(pub.clasificacion_estado), 'la clasificación va marcada como calculada y pendiente de contrastar');
console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
