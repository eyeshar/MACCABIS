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
ok(/v_mi_agenda/.test(jugadorTs) && /v_quien_va/.test(jugadorTs), 'y usa v_mi_agenda (D117: su agenda con los planes) y v_quien_va');
const textos = leer('src/lib/avisos/textos.ts').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
ok(!/motivo|lesi[oó]n|trabajo|viaje|familia|nivel|posici/i.test(textos.replace(/Sin motivos, niveles ni posiciones/g, '')), 'los textos de los avisos (pantalla de bloqueo) no llevan motivos, niveles ni posiciones');
const sw = fs.readFileSync(path.join(PLAT, 'public', 'sw.js'), 'utf8');
ok(/addEventListener\('push'/.test(sw) && /addEventListener\('notificationclick'/.test(sw) && !/addEventListener\('fetch'/.test(sw) && !/caches\./.test(sw), 'service worker: solo push y notificationclick, sin caché ni manejador de peticiones');
const repoTodo = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.') ? [] : e.isDirectory() ? repoTodo(path.join(d, e.name)) : [path.join(d, e.name)]));
const conClave = repoTodo(PLAT).filter((f) => /\.(ts|tsx|js|mjs|json|sql|md)$/.test(f)).filter((f) => /VAPID_PRIVATE_KEY\s*=\s*[A-Za-z0-9_-]{20,}|SUPABASE_SERVICE_ROLE_KEY\s*=\s*ey|AVISOS_SECRETO\s*=\s*[0-9a-f]{32,}/.test(fs.readFileSync(f, 'utf8')));
ok(conClave.length === 0, 'ninguna clave privada (VAPID, servicio, secreto de la tarea) en el repositorio', conClave.join(', '));

console.log('\n== Convocatoria v1 (D107): niveles y datos privados solo en Gestión');
const MIG7 = '20261023100000_convocatoria.sql';
const sql7 = sinComentarios(leer('supabase/migrations', MIG7));
const tablas7 = [...sql7.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
ok(tablas7.length === 3 && tablas7.every((t) => new RegExp('alter table public\\.' + t + '\\s+enable row level security').test(sql7)), `las ${tablas7.length} tablas nuevas tienen RLS (${tablas7.join(', ')})`);
ok(!/\bdrop\b|\btruncate\b|\bdelete\b/i.test(sql7) && !/grant[^;]*\bdelete\b/i.test(sql7), 'migración solo aditiva: sin DROP, TRUNCATE, DELETE ni permiso de borrar');
ok(fs.existsSync(path.join(PLAT, 'supabase', 'migrations', MIG7.replace(/\.sql$/, '.revertir.sql'))), 'con su revertir.sql');
ok(tablas7.every((t) => new RegExp(`on public\\.${t} for select to authenticated using \\(public\\.is_gestor\\(\\)\\)`).test(sql7)) && !/to anon/.test(sql7), 'solo los gestores leen las tres tablas; nada para anónimos');
const miConv = sql7.slice(sql7.indexOf('create function public.mi_convocatoria'), sql7.indexOf('alter table public.jugadores_privado'));
ok(miConv.length > 100 && !/nivel|posicion|dificultad|motivo|origen|propuesta|jugadores_privado/.test(miConv) && /_mi_person_id\(\)/.test(miConv) && /estado = 'aprobada'/.test(miConv), 'mi_convocatoria (lo único del jugador): solo sus equipos de convocatorias aprobadas, sin niveles, posiciones, dificultad ni propuestas');
const TABLAS_PRIV = ['jugadores_privado', 'convocatorias', 'convocatoria_cambios'];
// El tablero (D121) y los grupos (D122) leen datos privados en su codigo de servidor (lib/tablero, lib/grupos), que solo
// usan las pantallas de Gestion.
const fuera = repoTodo(path.join(PLAT, 'src')).filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(path.join('gestion', '(panel)')) && !f.includes(path.join('lib', 'convocatoria')) && !f.includes(path.join('lib', 'tablero')) && !f.includes(path.join('lib', 'grupos')))
  .filter((f) => TABLAS_PRIV.some((t) => new RegExp('(from|rpc)\\(["\']' + t + '["\']').test(fs.readFileSync(f, 'utf8'))));
ok(fuera.length === 0, 'fuera de Gestión nadie lee datos privados, convocatorias ni cambios (Mi zona usa solo mi_convocatoria)', fuera.map((f) => path.relative(ROOT, f)).join(', '));
ok(/rpc\("mi_convocatoria"\)/.test(leer('src/lib/respuestas/jugador.ts')) && !/jugadores_privado|nivel/.test(leer('src/components/inicio/InicioPersonal.tsx')), 'inicio personal (antes Mi zona): «Convocado» con mi_convocatoria, sin niveles');
for (const f of ['src/lib/tablero/datos.ts', 'src/lib/grupos/datos.ts']) ok(/import "server-only"/.test(leer(f)), `${f}: solo en el servidor`);
const usanTablero = repoTodo(path.join(PLAT, 'src')).filter((f) => /\.(ts|tsx)$/.test(f) && /from "@\/lib\/(tablero|grupos)\/datos"/.test(fs.readFileSync(f, 'utf8')) && !/import type/.test(fs.readFileSync(f, 'utf8').match(/.*@\/lib\/(tablero|grupos)\/datos.*/)[0]));
ok(usanTablero.every((f) => f.includes(path.join('gestion', '(panel)'))), 'lo del tablero y los grupos solo lo cargan pantallas de Gestión', usanTablero.map((f) => path.relative(ROOT, f)).join(', '));
const salidas = leer('src/lib/convocatoria/mensajes.ts').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
ok(!/nivel|posicion|privado|dobla\b|regla|motivo/i.test(salidas), 'WhatsApp, SportEasy y el aviso «Estás convocado» no usan niveles, posiciones, reglas ni motivos');
ok(fs.existsSync(path.join(PLAT, 'src/app/gestion/(panel)/convocatoria/page.tsx')) && /exigirGestor/.test(leer('src/app/gestion/(panel)/convocatoria/page.tsx')), 'la pantalla vive dentro del panel de gestión (solo gestores)');
// Claves de la convocatoria, mirando tambien el valor: «posicion» de un equipo en una fase (rivales) o la «regla» de un
// _meta no son datos de jugador; una posicion de jugador (base, escolta…), un nivel A-E o una regla personal si.
const DATO_CONV = { nivel: (v) => /^[A-E]$/.test(v), posicion: (v) => /^(base|escolta|alero|ala_pivot|pivot|ala-p[ií]vot|p[ií]vot)$/i.test(v), regla: (v) => /^(fijo|comodin)$/.test(v) };
const SIEMPRE_CONV = /^(dobla|base_reserva|regla_equipo|sancionado_hasta_jornada|dificultad|nivelMedio)$/;
const clavesConv = (o, r = '') => Array.isArray(o) ? o.flatMap((x, i) => clavesConv(x, `${r}[${i}]`))
  : o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => (SIEMPRE_CONV.test(k) || (DATO_CONV[k] && typeof v === 'string' && DATO_CONV[k](v)) ? [`${r}.${k}`] : []).concat(clavesConv(v, `${r}.${k}`))) : [];
const jsonPublicos = [path.join(ROOT, 'data'), path.join(PLAT, 'src', 'data'), path.join(PLAT, 'public')].flatMap((d) => (fs.existsSync(d) ? repoTodo(d) : [])).filter((f) => f.endsWith('.json'));
const conConv = jsonPublicos.map((f) => [f, clavesConv(JSON.parse(fs.readFileSync(f, 'utf8')))]).filter(([, r]) => r.length);
ok(jsonPublicos.length > 10 && conConv.length === 0, `ningún JSON público (${jsonPublicos.length}) lleva nivel, posición, Dobla, reglas, sanción ni dificultad`, conConv.map(([f, r]) => `${path.relative(ROOT, f)}: ${r.slice(0, 2)}`).join(' | '));
const { execSync } = require('child_process');
const enGit = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter((f) => /\.(csv|tsv|xlsx?)$/i.test(f));
const csvNiveles = enGit.filter((f) => /\.(csv|tsv)$/i.test(f) && /(^|[;,\t])nivel([;,\t]|$)/im.test(fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n')[0]));
ok(csvNiveles.length === 0, 'ningún CSV del repositorio tiene una columna «nivel»', csvNiveles.join(', '));
const pruebasConv = ['convocatoria_motor.mjs', 'rls_convocatoria.mjs', 'convocatoria_pantallas.mjs'].map((f) => leer('pruebas', f)).join('\n');
const personas = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'personas.json'), 'utf8')).personas.map((x) => x.person_id);
const reales = personas.filter((id) => pruebasConv.includes(`'${id}'`));
ok(reales.length === 0, 'las pruebas de la convocatoria usan solo jugadores sintéticos (ningún person_id real)', reales.join(', '));

console.log('\n== Inicio personal y planes (D117-D122): calendario personal, grupos y tablero');
const MIG8 = '20261024200000_inicio_y_planes.sql';
const sql8 = sinComentarios(leer('supabase/migrations', MIG8));
const tablas8 = [...sql8.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
ok(tablas8.length === 4 && tablas8.every((t) => new RegExp('alter table public\\.' + t + '\\s+enable row level security').test(sql8)), `las ${tablas8.length} tablas nuevas tienen RLS (${tablas8.join(', ')})`);
const drops8 = [...sql8.matchAll(/(?:alter|drop)[^;]*\bdrop\b[^;]*;/gi)].map((m) => m[0].replace(/\s+/g, ' '));
ok(drops8.length === 1 && /drop constraint eventos_tipo_check/.test(drops8[0]) && /add constraint eventos_tipo_check/.test(sql8), 'solo aditiva: el único «drop» es el check de eventos.tipo, que se vuelve a poner ampliado', drops8.join(' | '));
ok(!/\btruncate\b|\bdelete\b/i.test(sql8) && !/grant[^;]*\bdelete\b/i.test(sql8), 'sin TRUNCATE, DELETE ni permiso de borrar (un plan borrado queda marcado)');
ok(fs.existsSync(path.join(PLAT, 'supabase', 'migrations', MIG8.replace(/\.sql$/, '.revertir.sql'))), 'con su revertir.sql');
const anon8 = [...sql8.matchAll(/grant[^;]*\bto anon\b[^;]*;/gi)].map((m) => m[0].replace(/\s+/g, ' '));
ok(anon8.length === 1 && /calendario_personal\(text\) to anon, authenticated/.test(anon8[0]), 'a anon solo se le da calendario_personal (D120, excepción acotada a D68)', anon8.join(' | '));
const cuerpo8 = (ini, fin) => sql8.slice(sql8.indexOf(ini), sql8.indexOf(fin));
const calP = cuerpo8('create function public.calendario_personal', 'alter table public.respuestas add column sporteasy_descartado');
ok(calP.length > 500 && !/\.motivo|\.detalle|nivel|posicion|jugadores_privado|sporteasy_|puesto_por/.test(calP) && /r\.person_id = j\.person_id/.test(calP) && /_invitado\(j\.person_id, e\.id\)/.test(calP), 'calendario_personal: solo sus eventos y SU respuesta; sin motivos, detalles, niveles, posiciones ni nada de SportEasy');
ok(/where hash = encode\(sha256/.test(calP) && /not j\.activo/.test(calP) && /peticiones >= 120/.test(calP), 'el enlace se busca por su hash; un inactivo no lee nada; límite de 120 lecturas por hora');
ok(/hash\s+text unique/.test(sql8) && !/token\s+text/.test(sql8.slice(sql8.indexOf('create table public.calendario_tokens'), sql8.indexOf('create function public.mi_calendario_version'))), 'calendario_tokens guarda el hash, nunca el enlace');
const misG = cuerpo8('create function public.mis_grupos', 'alter table public.avisos_personales  enable row level security');
ok(misG.length > 200 && !/explica|nivel|posicion|jugadores_privado/.test(misG) && /'grupo'/.test(misG) && /'companeros'/.test(misG) && /g\.publicado/.test(misG), 'mis_grupos: solo el nombre de su grupo publicado y los motes de sus compañeros (sin niveles ni el criterio)');
const agenda8 = cuerpo8('create function public._mi_agenda', 'create view public.v_mi_agenda');
ok(!/\.motivo|\.detalle|nivel|posicion|sporteasy_|respuesta/.test(agenda8.replace(/pista_motivo/g, '')), 'v_mi_agenda: sin motivos, detalles, niveles, posiciones, respuestas ni estado de SportEasy');
const miPos = cuerpo8('create function public.mi_posicion', 'create table public.avisos_personales');
ok(/select p\.posicion from public\.jugadores_privado p where p\.person_id = public\._mi_person_id\(\)/.test(miPos) && !/nivel/.test(miPos), 'mi_posicion: solo SU posición, nunca su nivel');
ok(/v_eventos_publicos[\s\S]*where e\.oficial and e\.borrado_en is null/.test(sql8), 'la vista pública deja fuera los planes no oficiales y los borrados');
const icsP = leer('src/lib/calendario/icsPersonal.ts').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
ok(!/motivo|nivel|posicion|nombre_visible|organizador/.test(icsP), 'el .ics personal no maneja motivos, niveles, posiciones ni nombres de otros');
const rutaCal = leer('src/app/cal/[archivo]/route.ts');
ok(/noindex/.test(rutaCal) && /NEXT_PUBLIC_SUPABASE_ANON_KEY/.test(rutaCal) && !/SERVICE_ROLE/.test(rutaCal), '/cal/<enlace>.ics: noindex y solo con la clave anónima (lo decide la base)');
ok(/"\/cal"/.test(leer('src/lib/indexacion.ts')), '/cal fuera de los buscadores (Disallow y noindex)');
const pruebasNuevas = ['tablero.mjs', 'grupos.mjs', 'calendario_personal.mjs', 'inicio_personal.mjs', 'ubicacion.mjs', 'rls_planes.mjs'].map((f) => leer('pruebas', f)).join('\n');
const privEnPruebas = [...pruebasNuevas.matchAll(/insert into public\.jugadores_privado[^`]*`/g)].map((m) => m[0]);
const realesPriv = privEnPruebas.filter((t) => personas.some((id) => t.includes(`'${id}'`)));
ok(privEnPruebas.length > 0 && realesPriv.length === 0, 'las pruebas nuevas ponen posición y nivel solo a jugadores sintéticos (ningún person_id real, D39)', realesPriv.join(' | ').slice(0, 200));

console.log('\n== Convocatoria: proyección, modo rápido, aviso y domingo del jugador (D124-D128)');
// D124: la proyeccion lleva la letra de Ataque (privada): solo la cargan el servidor de la convocatoria y las pantallas
// de Gestion; nada publico ni del jugador la importa.
const usanProy = repoTodo(path.join(PLAT, 'src')).filter((f) => /\.(ts|tsx)$/.test(f) && /from "@\/lib\/convocatoria\/proyeccion"|from "\.\/proyeccion"|from "\.\.\/convocatoria\/proyeccion/.test(fs.readFileSync(f, 'utf8')));
ok(usanProy.length > 0 && usanProy.every((f) => f.includes(path.join('gestion', '(panel)')) || f.includes(path.join('lib', 'convocatoria')) || f.includes(path.join('lib', 'tablero'))), 'la proyección solo la usan Gestión y su servidor (convocatoria y tablero)', usanProy.map((f) => path.relative(ROOT, f)).join(', '));
ok(/nota_ataque/.test(leer('src/lib/convocatoria/datos.ts')) && /import "server-only"/.test(leer('src/lib/convocatoria/datos.ts')), 'las letras de Ataque se leen solo en el servidor (datos.ts, server-only)');
const calib = leer('scripts/calibrar_proyeccion.mjs');
ok(/privado/.test(calib) && /read only/.test(calib) && !/console\.log\([^;]*letras\.get/.test(calib), 'la calibración se guarda en privado/ (fuera de git), lee la base en solo lectura y nunca imprime letras');
const enGitProy = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter((f) => /proyecciones_/.test(f));
ok(enGitProy.length === 0, 'ningún fichero de proyecciones en git', enGitProy.join(', '));
const jsonProy = jsonPublicos.filter((f) => /"(aportes|pocosDatos|nota_ataque|letras|sinFactor)"/.test(fs.readFileSync(f, 'utf8')));
ok(jsonProy.length === 0, 'ningún JSON público lleva puntos esperados, tasas ni letras', jsonProy.map((f) => path.relative(ROOT, f)).join(', '));
// D128: la pagina del domingo del jugador. Solo nombres de la convocatoria APROBADA (funcion de la base), nada de
// niveles, posiciones, motivos ni respuestas de otros.
const MIG9 = '20261025100000_convocados_domingo.sql';
const sql9 = sinComentarios(leer('supabase/migrations', MIG9));
ok(!/create table|\bdrop\b|\btruncate\b|\bdelete\b|alter table/i.test(sql9) && fs.existsSync(path.join(PLAT, 'supabase', 'migrations', MIG9.replace(/\.sql$/, '.revertir.sql'))), 'migración del domingo solo aditiva (dos funciones), con su revertir.sql');
const fConv = sql9.slice(sql9.indexOf('create function public.convocados_del_domingo'), sql9.indexOf('create function public.ultima_importacion_respuestas'));
ok(/c\.estado = 'aprobada'/.test(fConv) && /j\.nombre_visible/.test(fConv) && !/nivel|posicion|motivo|respuestas|jugadores_privado|dificultad|origen|cambios|detalle/.test(fConv) && /me\.activo/.test(fConv), 'convocados_del_domingo: solo nombres visibles de una convocatoria aprobada, y solo a quien está en la plantilla activa (o gestores)');
const fImp = sql9.slice(sql9.indexOf('create function public.ultima_importacion_respuestas'), sql9.indexOf('revoke execute'));
ok(/select max\(i\.en\)/.test(fImp) && !/por_nombre|detalle|lineas|aceptadas/.test(fImp), 'ultima_importacion_respuestas: solo la hora (ni quién, ni qué)');
ok(!/to anon/.test(sql9) && /grant execute on function public\.convocados_del_domingo\(date\), public\.ultima_importacion_respuestas\(\) to authenticated/.test(sql9), 'nada para anónimos');
const domingo = leer('src/app/mi-zona/domingo/[fecha]/page.tsx').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
ok(/cargarConvocadosDomingo/.test(domingo) && !/v_quien_va|jugadores_privado|@\/lib\/convocatoria\/|nivel|\.motivo(?!.*horario)/.test(domingo.replace(/rNo\?\.motivo|r\.motivo (!==|===) "(horario|no_confirmo)"/g, '')), 'la página del domingo usa la función de convocados y, desde D141, «quién va» por respuestas solo vía cargarQuienVa (nombre y estado; sin la vista directa, ni datos de la convocatoria de Gestión)');
ok(/rpc\("convocados_del_domingo"/.test(leer('src/lib/respuestas/jugador.ts')) && /rpc\("ultima_importacion_respuestas"\)/.test(leer('src/lib/respuestas/jugador.ts')), 'y la lee con la sesión del jugador (decide la base)');
// D127: el aviso «Estás convocado» sale del servidor con la clave de servicio; su texto no lleva datos privados.
const avConv = leer('src/lib/convocatoria/avisos.ts');
ok(/import "server-only"/.test(avConv) && !/estadoInterruptor/.test(avConv) && /firmaConvocatoria/.test(avConv), 'aviso de convocatoria: solo en el servidor, sin depender del interruptor y con clave única por convocatoria');
// D146 (ajuste del 28/10/2026): la tarea de avisos (service_role) no lee jugadores_privado (niveles): solo
// marcas_disponibilidad(), que devuelve person_id y las dos marcas y solo ejecuta service_role.
const MIG146 = sinComentarios(leer('supabase/migrations', '20261028233000_marcas_disponibilidad_servicio.sql'));
const cuerpo146 = MIG146.slice(MIG146.indexOf('create function public.marcas_disponibilidad'), MIG146.indexOf('comment on function'));
const servidorAvisos = leer('src/lib/avisos/servidor.ts').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
ok(/revoke all on public\.jugadores_privado from service_role/.test(MIG146)
  && /returns table \(person_id text, no_suele_entrenar boolean, nunca_partidos boolean\)/.test(cuerpo146) && !/nivel|posicion|nota|dobla|regla|sancion/.test(cuerpo146)
  && /revoke execute on function public\.marcas_disponibilidad\(\) from public, anon, authenticated/.test(MIG146) && /grant execute on function public\.marcas_disponibilidad\(\) to service_role/.test(MIG146)
  && /rpc\("marcas_disponibilidad"\)/.test(servidorAvisos) && !/jugadores_privado/.test(servidorAvisos),
  'la tarea de avisos NO puede leer jugadores_privado (permisos quitados a service_role) y sí marcas_disponibilidad(), que solo da el jugador y sus dos marcas');

console.log('\n== Página de partido de la liga (D129): por equipo en público; los rivales por jugador, solo gestores');
{
  const PAG = 'src/app/liga/[temporada]/partido/[id]/page.tsx';
  const pag = leer(PAG);
  const sinCom = pag.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
  ok(!/^\s*["']use client["']/.test(pag), 'la página de partido es de servidor (los datos por jugador de los rivales no viajan a un componente de cliente)');
  // La unica lectura de datos por jugador de terceros esta dentro de la funcion que antes comprueba que es gestor.
  const fn = sinCom.slice(sinCom.indexOf('async function rivalesPorJugador'), sinCom.indexOf('const pct ='));
  ok(fn.length > 100 && /if \(!\(await esGestorActual\(\)\)\) return null;/.test(fn) && fn.indexOf('esGestorActual') < fn.indexOf('liga_estadisticas_jugador'),
    'rival por jugador: lo primero es comprobar que es gestor (is_gestor de la sesión); sin sesión de gestor no se consulta nada');
  const fuera = sinCom.replace(fn, '');
  ok(!/liga_estadisticas_jugador|liga_partidos|v_liga_jugadores/.test(fuera), 'ninguna otra parte de la página lee datos por jugador de la liga');
  ok(/from\("liga_estadisticas_jugador"\)/.test(fn) && !/SERVICE_ROLE|service_role|clienteServicio/i.test(sinCom), 'se lee con la sesión del gestor (RLS de gestores, como Scouting), nunca con la clave de servicio');
  ok(/export const dynamic = "force-dynamic"/.test(pag), 'la página se genera en cada petición (lo del gestor nunca queda en una página cacheada para otros)');
  // El resto de la Liga pública no lee nada por jugador de la liga (solo el JSON por equipo y las temporadas públicas).
  const ligaPub = ['src/app/liga', 'src/components/liga', 'src/lib/estadisticas', 'src/components/inicio', 'src/app/page.tsx', 'src/components/web']
    .flatMap((d) => { const b = path.join(PLAT, d); return !fs.existsSync(b) ? [] : fs.statSync(b).isFile() ? [b] : repoTodo(b); })
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith(path.join('partido', '[id]', 'page.tsx')))
    .filter((f) => /liga_estadisticas_jugador|v_liga_jugadores|from\("liga_partidos"\)/.test(fs.readFileSync(f, 'utf8')));
  ok(ligaPub.length === 0, 'el resto de páginas públicas de la liga, la portada y el inicio no leen datos por jugador de la liga', ligaPub.map((f) => path.relative(ROOT, f)).join(', '));
  // El JSON público solo lleva, por partido, los totales de cada equipo.
  const ligaPubJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'liga_2026-27.json'), 'utf8'));
  const res = Object.values(ligaPubJson.grupos).flatMap((g) => g.resultados);
  const clavesEst = new Set(res.filter((r) => r.est).flatMap((r) => [r.est.local, r.est.visitante].flatMap((e) => Object.keys(e))));
  ok(res.length > 0 && res.every((r) => r.id) && [...clavesEst].every((k) => ['pts', 't2', 't3', 'tl', 'tl_int', 'faltas'].includes(k)),
    `cada partido del JSON público lleva su id y solo totales por equipo (${[...clavesEst].join(', ')})`);
  const pruebaPt = leer('pruebas', 'liga_partidos.mjs');
  ok(/rival-por-jugador-seccion/.test(pruebaPt) && /anonimo/.test(pruebaPt) && /jugador/.test(pruebaPt), 'la prueba de pantallas de la página de partido comprueba que ni anónimos ni jugadores ven «Rival por jugador» (npm run pruebas:liga-partidos)');
}

(async () => {
  // En una tanda (pruebas:rapidas/completas) el HTML lo revisa pruebas:privacidad, que va siempre con esta (D149).
  if (process.env.PRUEBAS_EN_TANDA) console.log('  (el HTML renderizado lo revisa pruebas:privacidad en esta misma tanda)');
  else if (fs.existsSync(path.join(PLAT, '.next', 'BUILD_ID'))) {
    const { revisar } = await import(pathToFileURL(path.join(PLAT, 'pruebas', 'privacidad_paginas.mjs')).href);
    fallos += await revisar({ log: console.log });
  } else console.log('  (no hay compilación en plataforma/.next: se omite el HTML renderizado; hazlo tras npm run build)');
  console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
  process.exit(fallos ? 1 : 0);
})();
