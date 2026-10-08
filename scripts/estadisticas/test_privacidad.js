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
const { pathToFileURL } = require('url');
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

console.log('\n== Páginas públicas migradas de GitHub Pages (Liga, Plantilla, Historia)');
const PLAT = path.join(ROOT, 'plataforma');
const fuentes = ['src/app/liga', 'src/app/jugador', 'src/app/plantilla', 'src/app/historia', 'src/components/liga', 'src/lib/estadisticas'].flatMap(d => {
  const base = path.join(PLAT, d);
  const lista = f => fs.readdirSync(f, { withFileTypes: true }).flatMap(e => e.isDirectory() ? lista(path.join(f, e.name)) : [path.join(f, e.name)]);
  return fs.existsSync(base) ? lista(base) : [];
});
const pintan = fuentes.filter(f => /\.(tsx?|css)$/.test(f) && CLAVES_PRIVADAS.some(k => new RegExp(`\\b${k}\\b`).test(fs.readFileSync(f, 'utf8'))));
ok(fuentes.length > 0 && pintan.length === 0, `el código de las páginas migradas (${fuentes.length} ficheros) no maneja motivos de ausencia`, pintan.map(f => path.relative(ROOT, f)).join(', '));
const CLAVES_PERSONALES = /^(dni|nif|telefono|tel|movil|fecha_nacimiento|nacimiento|fecha_alta|nivel|email|correo|posicion|dobla|si_dobla|si_entrena)$/;
const personales = (o, r = '') => Array.isArray(o) ? o.flatMap((x, i) => personales(x, `${r}[${i}]`))
  : o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => (CLAVES_PERSONALES.test(k) ? [`${r}.${k}`] : []).concat(personales(v, `${r}.${k}`))) : [];
const dirEst = path.join(PLAT, 'src', 'data', 'estadisticas');
if (fs.existsSync(dirEst)) {
  const conPersonales = fs.readdirSync(dirEst).filter(f => f.endsWith('.json')).map(f => [f, personales(JSON.parse(fs.readFileSync(path.join(dirEst, f), 'utf8')))]).filter(([, r]) => r.length);
  ok(conPersonales.length === 0, 'las copias de estadísticas de la plataforma no llevan DNI, teléfono, correo, nivel, posición ni fechas de nacimiento', conPersonales.map(([f, r]) => `${f}: ${r.slice(0, 2)}`).join(' | '));
}

console.log('\n== Eventos, respuestas y asistencia (paso 2, D94)');
const leer = (...r) => fs.readFileSync(path.join(PLAT, ...r), 'utf8');
const sinComentarios = (t) => t.replace(/--.*$/gm, '');
const PRIVADAS = ['respuestas', 'ausencias_periodo', 'diccionario_sporteasy', 'importaciones', 'asistencia_resumen', 'asistencia_motivos'];
const publicas = ['src/lib/eventos/fuente.ts', 'src/lib/ical.ts', 'src/app/calendario.ics/route.ts', 'src/app/page.tsx', 'src/app/club/page.tsx', 'src/app/privacidad/page.tsx', 'src/components/web/CalendarioPublico.tsx'];
const lee = publicas.filter((f) => fs.existsSync(path.join(PLAT, f)) && PRIVADAS.some((t) => new RegExp('(from|rpc)\\(["\']' + t + '["\']').test(leer(f))));
ok(lee.length === 0, `el código público (${publicas.length} ficheros) no toca respuestas, ausencias, diccionario, importaciones ni asistencia`, lee.join(', '));
const fuente = leer('src/lib/eventos/fuente.ts');
ok(/v_eventos_publicos/.test(fuente) && !/\.from\("(eventos|pistas|respuestas)"\)/.test(fuente), 'la fuente pública lee solo las vistas públicas, nunca las tablas');
const mig1 = leer('supabase/migrations/20261007230000_eventos_pistas.sql');
const vista = mig1.slice(mig1.indexOf('create view public.v_eventos_publicos'), mig1.indexOf('create view public.v_descansos_publicos')).split('from public.eventos')[0];
ok(vista.length > 100 && !/sporteasy_|origen|person_id|respuesta|detalle|creado_en|actualizado_en|pista_id|e\.id\b|e\.serie/.test(vista), 'la vista pública no selecciona estado de SportEasy, origen, serie, ids, respuestas ni datos personales');
const rls = sinComentarios(['20261007230000_eventos_pistas.sql', '20261007231000_respuestas_ausencias_asistencia.sql'].map((f) => leer('supabase/migrations', f)).join('\n'));
const tablas = [...rls.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
ok(tablas.length === 8 && tablas.every((t) => new RegExp('alter table public\\.' + t + '\\s+enable row level security').test(rls)), `las ${tablas.length} tablas nuevas tienen RLS (${tablas.join(', ')})`);
ok(!/\bdrop\b|\btruncate\b|\bdelete\b/i.test(rls), 'las migraciones nuevas son solo aditivas: sin DROP, TRUNCATE ni DELETE');
ok(!/grant[^;]*\bdelete\b/i.test(rls), 'ninguna tabla nueva concede DELETE');
const nuevas = fs.readdirSync(path.join(PLAT, 'supabase', 'migrations')).filter((f) => /^2026100723.*\.sql$/.test(f) && !f.endsWith('.revertir.sql'));
ok(nuevas.length === 3 && nuevas.every((f) => fs.existsSync(path.join(PLAT, 'supabase', 'migrations', f.replace(/\.sql$/, '.revertir.sql')))), 'cada migración nueva (3) tiene su revertir.sql al lado');
ok(['eventos', 'asistencia'].every((d) => fs.existsSync(path.join(PLAT, 'src/app/gestion/(panel)', d, 'page.tsx'))) && /exigirGestor/.test(leer('src/app/gestion/(panel)/layout.tsx')), 'Eventos y Asistencia viven dentro del panel de gestión (solo gestores)');

console.log('\n== Respuestas en la web y avisos (paso 3, D99)');
const MIG3 = ['20261008100000_respuestas_web.sql', '20261008101000_avisos.sql'];
const sql3 = sinComentarios(MIG3.map((f) => leer('supabase/migrations', f)).join('\n'));
const tablas3 = [...sql3.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
ok(tablas3.length === 7 && tablas3.every((t) => new RegExp('alter table public\\.' + t + '\\s+enable row level security').test(sql3)), `las ${tablas3.length} tablas nuevas tienen RLS (${tablas3.join(', ')})`);
// Solo aditivas (D94): lo unico que se "quita" son tres relajaciones sin perdida de datos (hasta vacio y dos checks ampliados).
const drops = [...sql3.matchAll(/(?:alter|drop)[^;]*\bdrop\b[^;]*;/gi)].map((m) => m[0].replace(/\s+/g, ' '));
const permitidos = [/alter column hasta drop not null/i, /drop constraint respuestas_motivo_check/i, /drop constraint respuestas_fuente_check/i, /drop constraint ausencias_periodo_fuente_check/i];
ok(drops.every((d) => permitidos.some((p) => p.test(d))) && drops.length === 4, `solo aditivas: sin DROP de tablas ni columnas (los ${drops.length} «drop» son relajaciones sin pérdida)`, drops.join(' | '));
ok(!/\btruncate\b|\bdelete\s+from\b/i.test(sql3), 'sin TRUNCATE ni DELETE (una ausencia o una suscripción se marcan, no se borran)');
ok(!/grant[^;]*\bdelete\b/i.test(sql3), 'ninguna tabla concede DELETE');
for (const t of ['respuestas', 'ausencias_periodo']) ok(new RegExp(`add constraint ${t === 'respuestas' ? 'respuestas_motivo_check' : 'ausencias_periodo_fuente_check'}`).test(sql3), `${t}: el check se vuelve a poner (ampliado), no se queda sin él`);
ok(MIG3.every((f) => fs.existsSync(path.join(PLAT, 'supabase', 'migrations', f.replace(/\.sql$/, '.revertir.sql')))), 'cada migración del paso 3 tiene su revertir.sql');
const vistasJ = sql3.slice(sql3.indexOf('create function public._mis_eventos'), sql3.indexOf('create function public._quien_va'));
ok(!/sporteasy_|\bserie\b|person_id\s*,|\.motivo|detalle|nivel|posici/.test(vistasJ.replace(/public\._mi_person_id\(\)/g, '').replace(/pista_motivo/g, '')), 'v_mis_eventos: sin estado de SportEasy, serie, motivos, detalles, niveles ni posiciones');
const quien = sql3.slice(sql3.indexOf('create function public._quien_va'), sql3.indexOf('create view public.v_quien_va as'));
ok(/returns table \(evento_id uuid, nombre text, estado text\)/.test(quien) && !/\.motivo|\.detalle|origen|nivel|posici/.test(quien), 'v_quien_va: solo evento, nombre y estado (sin motivos, detalles, origen, niveles ni posiciones)');
const jugadorTs = ['src/lib/respuestas/jugador.ts', 'src/app/mi-zona/respuestas-acciones.ts'].map((f) => leer(f)).join('\n');
ok(!/\.from\("(eventos|jugadores|asistencia_\w+|alertas_gestores|avisos_registro)"\)/.test(jugadorTs), 'lo del jugador lee sus vistas y lo suyo; nunca tablas de eventos, plantilla, asistencia, alertas ni registro de avisos');
ok(/v_mis_eventos/.test(jugadorTs) && /v_quien_va/.test(jugadorTs), 'y usa v_mis_eventos y v_quien_va');
const textos = leer('src/lib/avisos/textos.ts').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
ok(!/motivo|lesi[oó]n|trabajo|viaje|familia|nivel|posici/i.test(textos.replace(/Sin motivos, niveles ni posiciones/g, '')), 'los textos de los avisos (pantalla de bloqueo) no llevan motivos, niveles ni posiciones');
const sw = fs.readFileSync(path.join(PLAT, 'public', 'sw.js'), 'utf8');
ok(/addEventListener\('push'/.test(sw) && /addEventListener\('notificationclick'/.test(sw) && !/addEventListener\('fetch'/.test(sw) && !/caches\./.test(sw), 'service worker: solo push y notificationclick, sin caché ni manejador de peticiones');
const repoTodo = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.') ? [] : e.isDirectory() ? repoTodo(path.join(d, e.name)) : [path.join(d, e.name)]));
const conClave = repoTodo(PLAT).filter((f) => /\.(ts|tsx|js|mjs|json|sql|md)$/.test(f)).filter((f) => /VAPID_PRIVATE_KEY\s*=\s*[A-Za-z0-9_-]{20,}|SUPABASE_SERVICE_ROLE_KEY\s*=\s*ey|AVISOS_SECRETO\s*=\s*[0-9a-f]{32,}/.test(fs.readFileSync(f, 'utf8')));
ok(conClave.length === 0, 'ninguna clave privada (VAPID, servicio, secreto de la tarea) en el repositorio', conClave.join(', '));

(async () => {
  if (fs.existsSync(path.join(PLAT, '.next', 'BUILD_ID'))) {
    const { revisar } = await import(pathToFileURL(path.join(PLAT, 'pruebas', 'privacidad_paginas.mjs')).href);
    fallos += await revisar({ log: console.log });
  } else console.log('  (no hay compilación en plataforma/.next: se omite el HTML renderizado; hazlo tras npm run build)');
  console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
  process.exit(fallos ? 1 : 0);
})();
