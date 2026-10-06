#!/usr/bin/env node
/**
 * test_privacidad.js — ningún fichero público lleva motivos de ausencia (D82).
 *
 *   npm run test:privacidad
 *
 * Falla si data/*.json o plataforma/src/data/*.json vuelven a llevar con excusa, sin excusa, no convocado,
 * lesión o los porcentajes que salen de ellos; si la proyección pública deja pasar algo más que fueron/total/pct;
 * o si la pestaña Asistencia de index.html vuelve a pintar esas columnas.
 */
const fs = require('fs');
const path = require('path');
const { publica, detalle, buscarMotivos, comprobarPublicos, CLAVES_PRIVADAS, DIR_PRIVADO } = require('./asistencia_privacidad');

const ROOT = path.resolve(__dirname, '..', '..');
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

console.log('== Proyección pública');
const p = publica({ excusa: 7, no_conv: 7, fueron: 25, lesion: 1, total: 40, pct_disp: 0.8, pct_jug: 0.625, pct_nosel: 0.175 });
ok(JSON.stringify(Object.keys(p)) === '["fueron","total","pct"]' && p.fueron === 25 && p.total === 40 && p.pct === 0.625, 'partidos: solo fueron, total y pct (fueron/total)', JSON.stringify(p));
const e = publica({ excusa: 6, fueron: 28, no_conv: 0, lesion: 3, pct: 0.82 });
ok(e.total === 37 && e.pct === 28 / 37 && !('excusa' in e), 'entrenos sin total: total = suma de estados; el % no deja deducir las excusas', JSON.stringify(e));
ok(publica(null) === null && detalle(null) === null, 'sin datos: null');
const d = detalle({ excusa: 1, sin_excusa: 2, no_conv: 3, lesion: 4, fueron: 5 });
ok(d.total === 15 && d.lesion === 4, 'el detalle privado conserva los motivos y el total');

console.log('\n== Detector');
ok(buscarMotivos({ players: [{ asist_part: { fueron: 1, excusa: 2 } }] }).join() === '.players[0].asist_part.excusa', 'detecta un motivo y dice dónde');
ok(CLAVES_PRIVADAS.every(k => buscarMotivos({ x: { [k]: 0 } }).length === 1), `detecta todas las claves privadas (${CLAVES_PRIVADAS.join(', ')})`);
ok(buscarMotivos({ players: [{ asist_part: p, asist_entr: e }] }).length === 0, 'la proyección pública pasa limpia');

console.log('\n== Ficheros públicos del repositorio');
const malos = comprobarPublicos();
ok(malos.length === 0, 'ningún JSON de data/ ni de plataforma/src/data/ lleva motivos de ausencia', malos.map(m => `${m.fichero}: ${m.rutas.slice(0, 2).join(', ')}`).join(' | '));
for (const t of ['2025-26', '2026-27']) {
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', `season_${t}.json`), 'utf8'));
  const con = s.players.filter(x => x.asist_part || x.asist_entr);
  ok(con.length > 0 && con.every(x => [x.asist_part, x.asist_entr].every(a => !a || (Number.isInteger(a.fueron) && Number.isInteger(a.total)))), `${t}: la asistencia pública sigue ahí (fueron y total) para ${con.length} jugadores`);
}
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const bloque = html.slice(html.indexOf('// ===== ASISTENCIA ====='), html.indexOf('// ===== UI SEGUN'));
ok(bloque.length > 100 && !/excusa|Lesión|No conv|No sel|pct_disp|pct_nosel|pct_jug/.test(bloque), 'index.html: la pestaña Asistencia no pinta motivos');
ok(!fs.existsSync(path.join(ROOT, 'docs', 'dashboard-maccabis-25-26-v1.html')), 'el panel antiguo 25/26 con la asistencia embebida ya no está en el repositorio');

console.log('\n== Detalle privado (fuera de git)');
const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
ok(/^privado\/$/m.test(gi), 'privado/ está en .gitignore');
if (fs.existsSync(DIR_PRIVADO)) {
  for (const f of fs.readdirSync(DIR_PRIVADO).filter(x => x.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(DIR_PRIVADO, f), 'utf8'));
    ok(j.jugadores.length > 0 && j.jugadores.every(x => !x.partidos || 'excusa' in x.partidos), `${f}: ${j.jugadores.length} jugadores con el detalle de motivos`);
  }
} else console.log('  (no hay privado/asistencia/ en este equipo: se omite)');

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
