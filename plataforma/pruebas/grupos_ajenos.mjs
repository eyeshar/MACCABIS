#!/usr/bin/env node
// Grupos ajenos de la fase en Liga consolidada y Scouting rivales (D184, D186), de extremo a extremo: pila local, web
// compilada y Chrome. Datos SINTETICOS (equipos y jugadores «Sint…», nunca de terceros: va a GitHub Actions): G1 y G2 con un
// jugador que dobla y dos grupos ajenos (G3, G4) cuyos lideres superan a los nuestros, para que cualquier mezcla se note.
// Comprueba: sin sesion no se ve nada de G3-G6 (API y paginas, tambien Resultados y la hoja de un partido); el selector de
// varios grupos (D186: MdA y MdL marcados por defecto, G3-G6 a la vista y desmarcados, como minimo uno, ?grupos= en la URL y el enlace
// antiguo ?grupo= de D184); con cualquier combinacion no sale nadie de un grupo no marcado; el que dobla suma sus dos
// fichas solo con MdA y MdL marcados; el ranking va por grupo, sin mezclar equipos; la pestaña Resultados (jornada, descanso
// y huecos del fichero de jornadas de prueba, pruebas/fixtures/jornadas_ajenas_prueba.json) y la hoja de cada partido;
// Scouting abre un equipo ajeno; y ningun equipo de G3-G6 llega a la liga publicada (data/).
//
//   npm run pruebas:grupos-ajenos
import fs from 'node:fs';
import path from 'node:path';
import { preparar, personas, sinteticos, contador, visto, sinDesbordar, REPO, hasta } from './comun_e2e.mjs';
import { cargarLiga } from '../scripts/cargar_liga.mjs';
import { filasTabla } from '../src/lib/jugadoresLiga.ts';
import { gruposDeUrl, hrefConsolidada, resultadosDeJornada } from '../src/lib/gruposLiga.ts';

const { ok, fallos } = contador();

// ---- La liga sintetica (la misma forma que leerLiga: privado, publico, ajenos y calendario)
const jug = (nombre, num, pts, { sec = 900, fc = 1, tla = 0, tli = 0, p3a = 0 } = {}) =>
  ({ num: String(num), nombre, sec, pts, p2a: Math.max(0, Math.floor((pts - 3 * p3a - tla) / 2)), p2i: 0, p3a, p3i: 0, tla, tli, fc, val: 0, pm: 0 });
const partido = (grupo, jornada, local, visitante, jl, jv) => ({
  grupo, jornada, fecha: null, local, visitante, fichero: `sint_${grupo}_${local}_${visitante}.xlsx`,
  pl: jl.reduce((s, j) => s + j.pts, 0), pv: jv.reduce((s, j) => s + j.pts, 0),
  equipos: [{ equipo: local, jugadores: jl }, { equipo: visitante, jugadores: jv }],
});
const DOBLA = 'SINT DOBLA, PEPE';
const privado = [
  partido('G1', 1, 'MdA', 'Sint Rival Uno', [jug(DOBLA, 7, 10), jug('SINT SOLOMDA, ANA', 4, 8)], [jug('SINT RIVALUNO, LUIS', 5, 12), jug('SINT RIVALUNO, RAUL', 6, 4)]),
  partido('G1', 2, 'Sint Rival Dos', 'MdA', [jug('SINT RIVALDOS, IKER', 9, 9)], [jug(DOBLA, 7, 6), jug('SINT SOLOMDA, ANA', 4, 11)]),
  partido('G2', 1, 'MdL', 'Sint Rival Tres', [jug(DOBLA, 17, 20), jug('SINT SOLOMDL, EVA', 8, 5)], [jug('SINT RIVALTRES, OSCAR', 10, 14)]),
  // Ajenos: con su jornada (la del fichero de jornadas, D186) y con anotadores muy por encima de los nuestros. En la J1 del G3
  // descansa Tres C y en la J2, Tres A; en el G4, los huecos del fichero de prueba (C-D en la J1, A-D en la J2).
  partido('G3', 1, 'Sint Ajeno Tres A', 'Sint Ajeno Tres B', [jug('SINT GTRES, ALFA', 3, 50), jug('SINT GTRES, BETA', 2, 2)], [jug('SINT GTRES, GAMMA', 1, 31)]),
  partido('G3', 2, 'Sint Ajeno Tres B', 'Sint Ajeno Tres C', [jug('SINT GTRES, GAMMA', 1, 25)], [jug('SINT GTRES, DELTA', 8, 22)]),
  partido('G4', 1, 'Sint Ajeno Cuatro A', 'Sint Ajeno Cuatro B', [jug('SINT GCUATRO, EPSILON', 4, 60)], [jug('SINT GCUATRO, ZETA', 5, 41)]),
  partido('G4', 2, 'Sint Ajeno Cuatro B', 'Sint Ajeno Cuatro C', [jug('SINT GCUATRO, ZETA', 5, 30)], [jug('SINT GCUATRO, ETA', 6, 28)]),
];
function clasificar(grupo) {
  const t = new Map();
  for (const p of privado.filter((x) => x.grupo === grupo)) {
    for (const [eq, pf, pc] of [[p.local, p.pl, p.pv], [p.visitante, p.pv, p.pl]]) {
      const x = t.get(eq) ?? { equipo: eq, nuestro: eq === 'MdA' || eq === 'MdL', pj: 0, g: 0, p: 0, pf: 0, pc: 0 };
      x.pj++; x[pf > pc ? 'g' : 'p']++; x.pf += pf; x.pc += pc; t.set(eq, x);
    }
  }
  return [...t.values()].sort((a, b) => b.g - a.g || (b.pf - b.pc) - (a.pf - a.pc)).map((x, i) => ({ pos: i + 1, ...x, pts: 2 * x.g + x.p }));
}
const liga = {
  privado,
  publico: { grupos: { G1: { clasificacion: clasificar('G1') }, G2: { clasificacion: clasificar('G2') } } },
  ajenos: { G3: { nombre: 'DOM MAÑ G3', clasificacion: clasificar('G3') }, G4: { nombre: 'DOM TAR', clasificacion: clasificar('G4') } },
  calendario: [],
};
const nombresDe = (grupos) => privado.filter((p) => grupos.includes(p.grupo)).flatMap((p) => p.equipos.flatMap((e) => e.jugadores.map((j) => j.nombre)));
const equiposDe = (grupos) => [...new Set(privado.filter((p) => grupos.includes(p.grupo)).flatMap((p) => [p.local, p.visitante]))];
const norm = (t) => String(t ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// Lo que delata a un grupo en una pagina: el apellido sintetico de sus jugadores y los nombres de sus equipos
const huellas = (grupos) => [...new Set([...nombresDe(grupos).map((n) => n.split(',')[0]), ...equiposDe(grupos).filter((e) => !['MdA', 'MdL'].includes(e))])].map(norm);
// `propios`: los grupos que se ensenan; quien sale en uno de ellos (el que dobla sale en G1 y en G2) no es una fuga
const fugas = (texto, grupos, propios = []) => { const mias = new Set(huellas(propios)); return huellas(grupos).filter((h) => !mias.has(h) && ` ${norm(texto)} `.includes(` ${h} `)); };

console.log('\n== Lógica pura: grupos de la URL y bloques de resultados (D186)');
const g = (x) => gruposDeUrl(x).join(',');
ok(g({}) === 'G1,G2' && g({ grupo: 'nuestros' }) === 'G1,G2' && g({ grupo: 'Todos' }) === 'G1,G2' && g({ grupos: 'X,Y' }) === 'G1,G2', 'sin grupos válidos: G1 + G2, como siempre');
ok(g({ grupo: 'G3' }) === 'G3' && g({ grupo: 'g4' }) === 'G4', 'el enlace antiguo ?grupo=G3 (D184) sigue valiendo');
ok(g({ grupos: 'G4,G1,G2,G4' }) === 'G1,G2,G4' && g({ grupos: ['G5', 'G3'] }) === 'G3,G5' && g({ grupos: 'G6', grupo: 'G3' }) === 'G6', '?grupos=: cualquier combinación, en el orden de siempre, sin repetir (y manda sobre ?grupo=)');
ok(hrefConsolidada(['G1', 'G2']) === '/liga/consolidada' && hrefConsolidada(['G1', 'G2', 'G4'], { vista: 'resultados', j: 3 }) === '/liga/consolidada?grupos=G1,G2,G4&vista=resultados&j=3', 'el enlace lleva los grupos (con comas) y la pestaña');
{
  const P = [{ id: 'x', grupo: 'G9', jornada: 1, fecha: null, local: 'A', visitante: 'B', pts_local: 50, pts_visitante: 40 }];
  const [b] = resultadosDeJornada(P, { G9: ['A', 'B', 'C', 'D', 'E'] }, ['G9'], 1, { jornadas: [{ grupo: 'G9', jornada: 1, descansa: 'E', huecos: [{ local: 'C', visitante: 'D', motivo: 'sin_hoja' }] }] });
  ok(b.filas.length === 2 && b.filas[1].tipo === 'hueco' && b.descansa.join() === 'E', 'un bloque: el partido, el hueco sin marcador y quien descansa');
  const [c] = resultadosDeJornada(P, { G9: ['A', 'B', 'C'] }, ['G9'], 1);
  ok(c.descansa.join() === 'C', 'sin fichero de jornadas, descansa el único sin partido');
  // Un hueco del fichero que ya tiene partido cargado (p. ej. el marcador sacado del acta, fix/g5-y-rutina-s21): solo el partido
  const P2 = [...P, { id: 'y', grupo: 'G9', jornada: 1, fecha: null, local: 'D', visitante: 'C', pts_local: 38, pts_visitante: 30 }];
  const [d] = resultadosDeJornada(P2, { G9: ['A', 'B', 'C', 'D', 'E'] }, ['G9'], 1, { jornadas: [{ grupo: 'G9', jornada: 1, descansa: 'E', huecos: [{ local: 'C', visitante: 'D', motivo: 'sin_hoja' }] }] });
  ok(d.filas.length === 2 && d.filas.every((f) => f.tipo === 'partido'), 'un hueco ya cargado sale solo como partido, con su marcador (fix/visibilidad-movil)');
}

const e = await preparar();
const { sql, APP } = e;
try {
  await cargarLiga(sql, liga, '2026-27', { log: () => {} });
  await sinteticos(sql, [['sint-ana', 'Ana', true, true]]);
  const P = await personas(e.pila, { jugadores: [['sint-ana', 'ana@pruebas.local']] });
  const intrusoId = await e.pila.crearUsuario('intruso@pruebas.local', 'x');
  const tIntruso = await e.pila.firmar({ sub: intrusoId, role: 'authenticated', email: 'intruso@pruebas.local' });
  const api = async (ruta, token) => {
    const r = await fetch(`${e.pila.url}/rest/v1${ruta}`, { headers: { apikey: e.pila.anonKey, authorization: `Bearer ${token ?? e.pila.anonKey}` } });
    let datos = null; try { datos = await r.json(); } catch {}
    return { status: r.status, datos };
  };
  const nada = (r) => r.status === 401 || r.status === 403 || (Array.isArray(r.datos) && r.datos.length === 0);

  console.log('\n== Datos: los grupos ajenos se cargan como G1/G2, con el grupo como campo y su jornada (D186)');
  const porGrupo = Object.fromEntries((await sql`select grupo, count(*)::int n, count(jornada)::int con_jornada from public.liga_partidos group by grupo`).map((x) => [x.grupo, x]));
  ok(porGrupo.G3?.n === 2 && porGrupo.G4?.n === 2 && porGrupo.G3.con_jornada === 2 && porGrupo.G4.con_jornada === 2, 'G3 y G4 (2 partidos cada uno) cargados, con su jornada', JSON.stringify(porGrupo));
  ok((await sql`select count(*)::int n from public.liga_clasificacion where grupo in ('G3', 'G4')`)[0].n === 6, 'su clasificación calculada, también cargada (6 equipos)');
  let rechaza = false;
  try { await sql`insert into public.liga_partidos (temporada, grupo, jornada, local, visitante, pts_local, pts_visitante) values ('2026-27', 'G1', null, 'A', 'B', 1, 2)`; } catch { rechaza = true; }
  ok(rechaza, 'G1 y G2 siguen exigiendo jornada (la base rechaza un partido del G1 sin jornada)');
  let ajenoSinJornada = true;
  try {
    await sql.begin(async (tx) => {
      await tx`insert into public.liga_partidos (temporada, grupo, jornada, local, visitante, pts_local, pts_visitante) values ('2026-27', 'G5', null, 'A', 'B', 1, 2)`;
      throw new Error('deshacer');
    });
  } catch (x) { ajenoSinJornada = x.message === 'deshacer'; }
  ok(ajenoSinJornada, 'una hoja de G3-G6 que llegue sin jornada se puede cargar igual (jornada opcional en los ajenos, D184)');

  console.log('\n== Sin sesión no se ve ningún dato de G3-G6');
  // liga_estadisticas_jugador no lleva el grupo: va por su partido
  const ruta = (t) => (t === 'liga_estadisticas_jugador' ? '/liga_estadisticas_jugador?select=nombre,liga_partidos!inner(grupo)&liga_partidos.grupo=in.(G3,G4,G5,G6)' : `/${t}?select=*&grupo=in.(G3,G4,G5,G6)`);
  for (const t of ['liga_partidos', 'liga_estadisticas_jugador', 'v_liga_jugadores', 'liga_clasificacion']) {
    ok(nada(await api(ruta(t))), `anónimo: nada de G3-G6 en ${t}`);
    ok(nada(await api(ruta(t), tIntruso)), `cuenta sin ficha: nada de G3-G6 en ${t}`);
  }
  const conFicha = await api('/liga_estadisticas_jugador?select=nombre,liga_partidos!inner(grupo)&liga_partidos.grupo=eq.G3', P['sint-ana'].token);
  ok(conFicha.status === 200 && conFicha.datos.length === 5, 'un jugador con sesión y ficha sí lee el G3 (D162)', `${conFicha.status} / ${conFicha.datos?.length}`);
  const idG4 = (await sql`select id from public.liga_partidos where grupo = 'G4' and jornada = 1`)[0].id;
  for (const r of ['/liga/consolidada?grupo=G3', '/liga/consolidada?grupos=G3,G4', '/liga/consolidada?grupos=G4&vista=resultados', `/liga/consolidada/partido/${idG4}`, `/liga/scouting?e=${encodeURIComponent('Sint Ajeno Tres A')}`]) {
    const res = await fetch(`${APP}${r}`, { redirect: 'manual' });
    ok(res.status >= 300 && res.status < 400 && /\/entrar/.test(res.headers.get('location') ?? ''), `anónimo en ${r}: manda a Entrar`, `${res.status} ${res.headers.get('location')}`);
  }
  for (const r of ['/', '/liga', '/liga?g=G3', '/liga?g=G4', '/liga/2026-27', '/club', '/club/historia', '/club/el-club', '/liga/consolidada?grupo=G3', '/liga/consolidada?grupos=G3,G4&vista=resultados', `/liga/consolidada/partido/${idG4}`, '/liga/scouting']) {
    const html = await (await fetch(`${APP}${r}`, { redirect: 'follow' })).text();
    const f = fugas(html, ['G3', 'G4']);
    ok(f.length === 0, `anónimo en ${r}: ni un jugador ni un equipo de G3-G6`, f.join(', '));
  }
  // La liga publicada (data/ y su copia de la web) no lleva ningun equipo de los grupos ajenos reales (grupos_fase.json)
  const mapa = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts', 'estadisticas', 'grupos_fase.json'), 'utf8'))['2026-27'];
  const ajenosReales = new Set(Object.values(mapa).flatMap((x) => x.equipos).map(norm));
  for (const f of ['data/liga_2026-27.json', 'plataforma/src/data/liga.json']) {
    const pub = JSON.parse(fs.readFileSync(path.join(REPO, f), 'utf8'));
    const equipos = Object.values(pub.grupos).flatMap((x) => x.clasificacion.map((c) => c.equipo));
    ok(Object.keys(pub.grupos).every((x) => x === 'G1' || x === 'G2') && !equipos.some((x) => ajenosReales.has(norm(x))), `${f}: solo G1 y G2, ningún equipo de G3-G6`);
  }

  const p = await e.sesion('ana@pruebas.local', 1280);
  const texto = () => p.evaluate(() => document.querySelector('main')?.innerText ?? document.body.innerText);
  const resumen = () => p.locator('#lideres .lg-sub').first().innerText();
  const filaDe = (nombre) => p.locator('.lg-tabla-todos tbody tr', { hasText: new RegExp(nombre.split(',')[0], 'i') }).filter({ hasText: new RegExp(nombre.split(', ')[1], 'i') });
  const selector = () => p.getByTestId('selector-grupos');
  const casilla = (gr) => selector().locator(`input[type="checkbox"][value="${gr}"]`);
  const marcadas = async () => { const r = []; for (const gr of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6']) if (await casilla(gr).isChecked()) r.push(gr); return r.join(','); };
  // Equipos de cada clasificacion del ranking: ninguno puede ser de otro grupo
  const equiposRanking = async (gr) => p.locator(`[data-testid="ranking-${gr}"] tbody tr td:nth-child(2)`).allInnerTexts();
  const rankingSinMezcla = async (grupos) => {
    for (const gr of grupos) {
      const eqs = (await equiposRanking(gr)).map((x) => x.trim());
      if (!eqs.length || !eqs.every((x) => equiposDe([gr]).includes(x))) return `${gr}: ${eqs.join(', ')}`;
    }
    return (await p.locator('[data-testid^="ranking-"]').count()) === grupos.length ? '' : `hay ${await p.locator('[data-testid^="ranking-"]').count()} clasificaciones`;
  };
  // Cada casilla se aplica al marcarla (D186): espera a la URL y a que la pagina nueva haya pintado su selector.
  const aplicada = async (re) => { await p.waitForURL(re); await p.locator('[data-testid="selector-grupos"][aria-busy="false"]').waitFor(); };

  console.log('\n== Por defecto (MdA y MdL marcados): la página de siempre');
  await p.goto(`${APP}/liga/consolidada`);
  const nuestros = privado.filter((x) => x.grupo === 'G1' || x.grupo === 'G2');
  const { agruparJugadores } = await import('../src/lib/jugadoresLiga.ts');
  const filasHoja = nuestros.flatMap((x, i) => x.equipos.flatMap((q) => q.jugadores.map((j) => ({ partido_id: `p${i}`, grupo: x.grupo, jornada: x.jornada, equipo: q.equipo, dorsal: j.num, nombre: j.nombre, segundos: j.sec, pts: j.pts, p2a: j.p2a, p3a: j.p3a, tla: j.tla, tli: j.tli, faltas: j.fc }))));
  const clasN = [...liga.publico.grupos.G1.clasificacion.map((c) => ({ ...c, grupo: 'G1' })), ...liga.publico.grupos.G2.clasificacion.map((c) => ({ ...c, grupo: 'G2' }))];
  const sumadas = filasTabla(agruparJugadores(filasHoja).jugadores, new Map(clasN.map((c) => [`${c.grupo}|${c.equipo}`, c.pj])));
  const esperado = `${sumadas.length} personas de los ${clasN.filter((c) => c.pj > 0).length} equipos con partidos jugados, hasta la jornada ${Math.max(...clasN.map((c) => c.pj))}. «dobla» = sale con MdA y con MdL (sus dos fichas se suman).`;
  ok((await resumen()) === esperado, `cabecera de siempre: «${esperado}»`, await resumen());
  ok((await marcadas()) === 'G1,G2', 'el selector marca MdA (G1) y MdL (G2), y ningún otro', await marcadas());
  const etiquetas = await selector().locator('label.lg-check').allInnerTexts();   // innerText: solo lo que se ve
  ok(JSON.stringify(etiquetas.map((x) => x.trim())) === JSON.stringify(['MdA (G1)', 'MdL (G2)', 'G3', 'G4', 'G5', 'G6']), 'casillas: MdA y MdL y, a su lado, los cuatro grupos ajenos, todas a la vista', etiquetas.join(' | '));
  ok((await selector().locator('label.lg-check[data-grupo="G5"]').getAttribute('title')) === 'G5 · SAB TAR G1', 'cada grupo ajeno lleva su nombre al pasar por encima (G5 · SAB TAR G1)');
  ok((await selector().locator('details').count()) === 0, 'sin desplegable «Otros grupos» (fix/visibilidad-movil)');
  ok(fugas(await texto(), ['G3', 'G4']).length === 0, 'ni un jugador ni un equipo de G3-G6', fugas(await texto(), ['G3', 'G4']).join(', '));
  const htmlDefecto = await texto();
  for (const r of ['?grupo=nuestros', '?grupos=G1,G2', '?grupo=Todos', '?grupos=nada']) {
    await p.goto(`${APP}/liga/consolidada${r}`);
    ok((await texto()) === htmlDefecto && (await marcadas()) === 'G1,G2', `${r} es la misma página que sin parámetro`);
  }
  await p.locator('#lideres .lg-conmutador button', { hasText: 'Totales' }).click();
  const lider = await p.locator('#lideres .lg-lider').first().locator('li').first().textContent();
  ok(/Sint Dobla, Pepe/i.test(lider) && /36\s*$/.test(lider) && /dobla/.test(lider), 'líder en puntos: el que dobla, con sus dos fichas sumadas (36 = 10 + 6 + 20)', lider);
  ok((await p.locator('details.lg-ranking summary').innerText()).includes('G1 y G2 (5 equipos)'), 'ranking: G1 y G2, 5 equipos');
  await p.locator('details.lg-ranking > summary').click();
  ok((await rankingSinMezcla(['G1', 'G2'])) === '', 'ranking: una clasificación del G1 y otra del G2, sin mezclar equipos', await rankingSinMezcla(['G1', 'G2']));
  const fDobla = await filaDe(DOBLA).first().innerText();
  ok(/MdA \+ MdL/.test(fDobla) && /\t3\t/.test(fDobla) && /\t36\t/.test(fDobla), 'tabla: el que dobla, una fila con «MdA + MdL», 3 PJ y 36 puntos', fDobla);

  console.log('\n== Solo MdA (enlace antiguo ?grupo=G1 y casillas): el que dobla suma solo sus partidos del G1');
  await p.goto(`${APP}/liga/consolidada?grupo=G1`);
  ok((await marcadas()) === 'G1', '?grupo=G1 (D184) marca solo MdA', await marcadas());
  ok(fugas(await texto(), ['G2', 'G3', 'G4'], ['G1']).length === 0, 'G1: ni un jugador ni un equipo de G2, G3 o G4', fugas(await texto(), ['G2', 'G3', 'G4'], ['G1']).join(', '));
  const g1 = await filaDe(DOBLA).first().innerText();
  ok(/\t2\t/.test(g1) && /\t16\t/.test(g1) && !/MdL/.test(g1), 'G1: el que dobla, 2 PJ y 16 puntos (10 + 6), solo la ficha del MdA', g1);
  ok(/dobla/.test(g1), 'G1: la etiqueta «dobla» se sigue viendo', g1);
  ok(/hasta la jornada 2\./.test(await resumen()) && /3 equipos/.test(await resumen()) && /solo cuentan sus partidos con MdA/.test(await resumen()), 'G1: cabecera con los 3 equipos del G1, la jornada 2 y que solo cuentan sus partidos con MdA', await resumen());
  ok((await p.locator('details.lg-ranking summary').innerText()).includes('G1 · MdA (3 equipos)'), 'G1: ranking solo del G1');
  await p.goto(`${APP}/liga/consolidada`);
  ok((await selector().getByRole('button', { name: 'Ver' }).count()) === 0, 'no hay botón «Ver» que pulsar (con JavaScript)');
  await casilla('G1').click();
  await aplicada(/[?&]grupos=G2/);
  ok(new URL(p.url()).searchParams.get('grupos') === 'G2', 'desmarcar MdA se aplica al momento, sin pulsar nada: ?grupos=G2 en la URL', p.url());
  const g2 = await filaDe(DOBLA).first().innerText();
  ok(/\t1\t/.test(g2) && /\t20\t/.test(g2) && /dobla/.test(g2) && fugas(await texto(), ['G1', 'G3', 'G4'], ['G2']).length === 0, 'G2: el que dobla, 1 PJ y 20 puntos, con «dobla»; nadie de otro grupo', g2);
  await casilla('G2').click();
  ok(await visto(selector().getByText('Tiene que quedar al menos un grupo marcado.')) && await casilla('G2').isChecked() && new URL(p.url()).searchParams.get('grupos') === 'G2',
    'quitar el último grupo marcado no se deja: sigue marcado, la URL no cambia y lo dice', p.url());

  console.log('\n== MdA + MdL + G4: todo sale solo de esos tres grupos');
  await p.goto(`${APP}/liga/consolidada`);
  await casilla('G4').click();
  await aplicada(/[?&]grupos=G1,G2,G4/);
  ok(new URL(p.url()).search === '?grupos=G1,G2,G4', 'la selección queda en la URL tal cual: ?grupos=G1,G2,G4', p.url());
  ok((await marcadas()) === 'G1,G2,G4', 'el selector la recuerda');
  const t124 = await texto();
  ok(fugas(t124, ['G3'], ['G1', 'G2', 'G4']).length === 0, 'G1 + G2 + G4: nadie del G3', fugas(t124, ['G3'], ['G1', 'G2', 'G4']).join(', '));
  ok(nombresDe(['G4']).every((n) => norm(t124).includes(norm(n.split(',')[0]))) && /Sint Solomda/i.test(t124), 'salen los jugadores del G4 y los nuestros');
  ok(/\(G1, G2 y G4\), hasta la jornada 2\./.test(await resumen()), 'la cabecera dice qué grupos', await resumen());
  await p.locator('#lideres .lg-conmutador button', { hasText: 'Totales' }).click();
  const lider124 = await p.locator('#lideres .lg-lider').first().locator('li').first().textContent();
  ok(/Sint Gcuatro, Zeta/i.test(lider124) && /71\s*$/.test(lider124), 'líder en puntos: Zeta (G4, 71 = 41 + 30), por encima de los nuestros', lider124);
  ok(/36\t/.test(await filaDe(DOBLA).first().innerText()), 'con MdA y MdL marcados, el que dobla sigue con sus dos fichas sumadas (36)');
  await p.locator('details.lg-ranking > summary').click();
  ok((await rankingSinMezcla(['G1', 'G2', 'G4'])) === '', 'ranking: tres clasificaciones (G1, G2 y G4), una debajo de otra y sin mezclar equipos', await rankingSinMezcla(['G1', 'G2', 'G4']));
  const opcGrupo = await p.locator('.lg-todos label', { hasText: /^Grupo/ }).locator('option').allInnerTexts();
  ok(JSON.stringify(opcGrupo) === JSON.stringify(['Todos los marcados', 'G1 · MdA', 'G2 · MdL', 'G4 · DOM TAR']), 'el filtro de grupo de la tabla solo ofrece los marcados', opcGrupo.join(' | '));
  await p.locator('nav.lg-indice a', { hasText: 'Ranking de equipos' }).click();
  ok(new URL(p.url()).searchParams.get('grupos') === 'G1,G2,G4' && p.url().endsWith('#ranking'), 'ir a Ranking (o a Líderes, Todos) mantiene ?grupos=', p.url());
  ok(await sinDesbordar(p), 'G1 + G2 + G4: sin desbordar');

  console.log('\n== Solo grupos ajenos (G3 + G4) y uno solo (enlace antiguo ?grupo=G3)');
  await p.goto(`${APP}/liga/consolidada?grupos=G3,G4`);
  const t34 = await texto();
  ok(fugas(t34, ['G1', 'G2']).length === 0, 'G3 + G4: nadie de G1 ni de G2', fugas(t34, ['G1', 'G2']).join(', '));
  ok((await p.locator('.lg-todos .lg-check').count()) === 0, 'G3 + G4: sin «Solo Maccabis»');
  await p.locator('details.lg-ranking > summary').click();
  ok((await rankingSinMezcla(['G3', 'G4'])) === '', 'G3 + G4: una clasificación por grupo, sin mezclar', await rankingSinMezcla(['G3', 'G4']));
  await p.goto(`${APP}/liga/consolidada?grupo=G3`);
  ok((await marcadas()) === 'G3', '?grupo=G3 (D184) marca solo el G3');
  const t3 = await texto();
  ok(fugas(t3, ['G1', 'G2', 'G4']).length === 0, 'G3: ni un jugador ni un equipo de G1, G2 o G4', fugas(t3, ['G1', 'G2', 'G4']).join(', '));
  ok((await resumen()) === '4 personas de los 3 equipos con partidos jugados, hasta la jornada 2.', 'G3: cabecera con sus 4 personas, 3 equipos y su jornada', await resumen());
  const lider3 = await p.locator('#lideres .lg-lider').first().locator('li').first().textContent();
  ok(/Sint Gtres, Alfa/i.test(lider3) && /50,0/.test(lider3), 'G3: el líder en puntos por partido es del G3 (Alfa, 50,0), no el del G4 (60)', lider3);
  ok((await p.locator('details.lg-ranking summary').innerText()).includes('G3 · DOM MAÑ G3 (3 equipos)'), 'G3: ranking de sus 3 equipos', await p.locator('details.lg-ranking summary').innerText());
  ok((await p.locator('.lg-todos label', { hasText: /^Grupo/ }).count()) === 0 && (await p.locator('.lg-todos .lg-check').count()) === 0, 'G3: la tabla no ofrece otro grupo ni «Solo Maccabis»');
  const equiposSel = await p.locator('.lg-todos label', { hasText: /^Equipo/ }).locator('option').allInnerTexts();
  ok(equiposSel.slice(1).every((x) => equiposDe(['G3']).includes(x)) && equiposSel.length === 4, 'G3: el filtro de equipo solo lista los del G3', equiposSel.join(' | '));
  await p.goto(`${APP}/liga/consolidada?grupos=G5`);
  ok(/Todavía no hay datos de liga cargados de G5 · SAB TAR G1/.test(await texto()) && fugas(await texto(), ['G1', 'G2', 'G3', 'G4']).length === 0, 'G5 sin hojas: lo dice, sin enseñar nada de otro grupo');

  console.log('\n== Pestaña Resultados: jornada, descanso, huecos y la hoja de cada partido');
  await p.goto(`${APP}/liga/consolidada?grupos=G1,G2,G4`);
  await p.getByTestId('pestanas-consolidada').getByRole('link', { name: 'Resultados' }).click();
  await p.waitForURL(/vista=resultados/);
  const u = new URL(p.url());
  ok(u.searchParams.get('grupos') === 'G1,G2,G4' && (await marcadas()) === 'G1,G2,G4', 'cambiar a Resultados mantiene los grupos marcados', p.url());
  ok(/Resultados · jornada 2/i.test(await p.getByTestId('resultados').innerText()), 'por defecto, la última jornada jugada (J2)');
  const bloques = await p.locator('[data-testid^="resultados-G"]').evaluateAll((b) => b.map((x) => x.getAttribute('data-testid')));
  ok(JSON.stringify(bloques) === JSON.stringify(['resultados-G1', 'resultados-G2', 'resultados-G4']), 'un bloque por grupo marcado: MdA, MdL y luego el resto', bloques.join(', '));
  const b1 = await p.getByTestId('resultados-G1').innerText();
  ok(/Sint Rival Dos\s*9–17\s*MdA/.test(b1) && /Descansa: Sint Rival Uno/.test(b1), 'G1, J2: Sint Rival Dos 9–17 MdA (el local primero) y descansa Sint Rival Uno', b1);
  ok(/Sin partidos cargados de la jornada 2/.test(await p.getByTestId('resultados-G2').innerText()), 'G2 sin partido en la J2: lo dice');
  const b4 = await p.getByTestId('resultados-G4').innerText();
  ok(/Sint Ajeno Cuatro B\s*30–28\s*Sint Ajeno Cuatro C/.test(b4) && /Sint Ajeno Cuatro A\s*–\s*SINT AJENO CUATRO D\s*sin hoja/i.test(b4) && !/Descansa/.test(b4), 'G4, J2: el partido y el hueco «sin hoja», sin marcador inventado; nadie descansa', b4);
  ok(fugas(await texto(), ['G3'], ['G1', 'G2', 'G4']).length === 0, 'Resultados: nadie del G3');
  await p.getByRole('navigation', { name: 'Jornada' }).getByRole('link', { name: 'J1' }).click();
  await p.waitForURL(/[?&]j=1/);
  ok(new URL(p.url()).searchParams.get('grupos') === 'G1,G2,G4', 'cambiar de jornada mantiene los grupos');
  const b4j1 = await p.getByTestId('resultados-G4').innerText();
  ok(/Sint Ajeno Cuatro A\s*60–41\s*Sint Ajeno Cuatro B/.test(b4j1) && /Sint Ajeno Cuatro C\s*–\s*SINT AJENO CUATRO D\s*incomparecencia/i.test(b4j1), 'G4, J1: el partido y la incomparecencia, sin marcador', b4j1);
  ok(/Descansa: MdA/.test(await p.getByTestId('resultados-G1').innerText()) === false && /Descansa: Sint Rival Dos/.test(await p.getByTestId('resultados-G1').innerText()), 'G1, J1: descansa Sint Rival Dos');
  ok(await sinDesbordar(p), 'Resultados: sin desbordar');
  await p.getByTestId('resultados-G4').getByRole('link', { name: /Sint Ajeno Cuatro A/ }).click();
  await p.waitForURL(/\/liga\/consolidada\/partido\//);
  const hoja = await p.getByTestId('partido-consolidada').innerText();
  ok(/Sint Gcuatro, Epsilon/i.test(hoja) && /Sint Gcuatro, Zeta/i.test(hoja) && /60–41/.test(await p.getByTestId('marcador').innerText()), 'pulsar el partido abre su hoja: los jugadores de los dos equipos y el marcador', hoja);
  ok(fugas(hoja, ['G1', 'G2', 'G3'], ['G4']).length === 0 && /G4 · DOM TAR · jornada 1/.test(hoja), 'la hoja: solo ese partido, con su grupo y su jornada');
  const volver = new URL(await p.getByTestId('volver').getAttribute('href'), APP);
  ok(volver.pathname === '/liga/consolidada' && gruposDeUrl({ grupos: volver.searchParams.get('grupos') }).join() === 'G1,G2,G4' && volver.searchParams.get('vista') === 'resultados' && volver.searchParams.get('j') === '1',
    'volver lleva a Resultados con los mismos grupos y la misma jornada', volver.toString());
  await p.goto(`${APP}/liga/consolidada?grupos=G3&vista=resultados&j=1`);
  ok(/Descansa: Sint Ajeno Tres C/.test(await p.getByTestId('resultados-G3').innerText()), 'G3, J1: descansa Sint Ajeno Tres C (del fichero de jornadas)');
  await casilla('G4').click();
  await aplicada(/[?&]grupos=G3,G4/);
  ok(new URL(p.url()).searchParams.get('vista') === 'resultados' && (await p.locator('[data-testid^="resultados-G"]').count()) === 2,
    'en Resultados, marcar el G4 se aplica al momento y sigue en Resultados (un bloque más)', p.url());
  await casilla('G4').click();
  await aplicada((x) => new URL(x).searchParams.get('grupos') === 'G3');
  await p.getByTestId('pestanas-consolidada').getByRole('link', { name: 'Jugadores y equipos' }).click();
  await p.waitForURL((x) => !/vista=resultados/.test(x.toString()));
  ok(new URL(p.url()).searchParams.get('grupos') === 'G3' && (await marcadas()) === 'G3', 'volver a Jugadores mantiene los grupos', p.url());

  console.log('\n== Liga › Clasificación: G3-G6 en el selector de grupo, solo con sesión (fix/visibilidad-movil)');
  const selGrupo = () => p.getByTestId('selector-grupo-liga');
  await p.goto(`${APP}/liga`);
  await hasta(async () => (await selGrupo().locator('button').count()) === 6);
  ok((await selGrupo().locator('button').allTextContents()).map((x) => x.trim()).join(',') === 'G1 · MdA,G2 · MdL,G3,G4,G5,G6', 'con sesión: G1 · MdA | G2 · MdL | G3 | G4 | G5 | G6');
  await selGrupo().getByRole('button', { name: 'G4', exact: true }).click();
  await p.waitForURL(/\/liga\?g=G4$/);
  await hasta(async () => (await selGrupo().locator('button[aria-pressed="true"]').textContent())?.trim() === 'G4');
  const clasG4 = await p.getByTestId('liga-clasificacion').innerText();
  ok(['Sint Ajeno Cuatro A', 'Sint Ajeno Cuatro B', 'Sint Ajeno Cuatro C'].every((x) => clasG4.includes(x)) && fugas(clasG4, ['G3'], ['G4']).length === 0 && !/Sint Rival/.test(clasG4),
    'G4: su clasificación calculada (de Supabase, con sesión), sin equipos de otro grupo', clasG4);
  ok((await p.getByTestId('liga-clasificacion').locator('a').first().getAttribute('href')).startsWith('/liga/scouting?e=Sint'), 'G4: cada equipo enlaza a su Scouting');
  await p.locator('.e-jornadas button', { hasText: 'J2' }).click();
  const res = p.getByTestId('liga-resultados');
  ok((await res.locator('[data-hueco="sin_hoja"]').count()) === 1 && (await res.locator('[data-hueco="sin_hoja"] a.e-m-enlace').count()) === 0 && /sin hoja/.test(await res.locator('[data-hueco="sin_hoja"]').innerText()),
    'G4 · J2: el partido sin hoja sale como «sin hoja», sin marcador ni enlace');
  ok((await res.locator('a.e-m-enlace').first().getAttribute('href') ?? '').startsWith('/liga/consolidada/partido/'), 'G4 · J2: cada partido abre su hoja en Jugadores de la liga');
  ok(/no tiene calendario/.test(await p.getByTestId('liga-proximos').innerText()), 'G4: Próximos dice que el grupo no tiene calendario cargado');
  await selGrupo().getByRole('button', { name: 'G3', exact: true }).click();
  await p.waitForURL(/\/liga\?g=G3$/);
  ok(await hasta(async () => (await p.getByTestId('liga-clasificacion').innerText()).includes('Sint Ajeno Tres A')) && (await selGrupo().locator('button[aria-pressed="true"]').textContent())?.trim() === 'G3'
    && !(await p.getByTestId('liga-clasificacion').innerText()).includes('Sint Ajeno Cuatro'), 'de G4 a G3: la clasificación del G3, sin nada del G4');
  await selGrupo().getByRole('button', { name: 'G1 · MdA', exact: true }).click();
  await p.waitForURL((u) => u.pathname === '/liga' && !u.search);
  await hasta(async () => !(await p.getByTestId('liga-clasificacion').innerText()).includes('Sint Ajeno'));
  ok((await selGrupo().locator('button[aria-pressed="true"]').textContent())?.trim() === 'G1 · MdA', 'volver a G1 deja /liga sin ?g= y la clasificación de siempre');

  console.log('\n== Scouting rivales: cualquier equipo de G3-G6, con sesión');
  await p.goto(`${APP}/liga/scouting?e=${encodeURIComponent('Sint Ajeno Tres A')}`);
  const h2 = await p.locator('.lg-cab-equipo h2').textContent();
  ok(h2.includes('Sint Ajeno Tres A') && h2.includes('G3 · DOM MAÑ G3'), 'Scouting abre un equipo del G3, con su grupo', h2);
  const tabla = await p.getByTestId('tabla-scouting').innerText();
  ok(/Sint Gtres, Alfa/i.test(tabla) && /Sint Gtres, Beta/i.test(tabla) && fugas(tabla, ['G1', 'G2', 'G4']).length === 0, 'su tabla: sus jugadores, nadie de otro grupo', tabla);
  ok((await p.locator('.lg-prox').count()) === 0 && (await p.getByTestId('claves-partido').count()) === 0, 'sin «próximo partido contra nosotros» ni claves (no juega contra nosotros)');
  const grupos = await p.locator('select[name="e"] optgroup').evaluateAll((x) => x.map((y) => y.label));
  ok(JSON.stringify(grupos) === JSON.stringify(['G1 · MdA', 'G2 · MdL', 'G3 · DOM MAÑ G3', 'G4 · DOM TAR']), 'el desplegable agrupa los equipos por grupo, con los ajenos', grupos.join(' | '));
  ok((await p.getByRole('link', { name: 'Ver todos los jugadores del G3' }).getAttribute('href')) === '/liga/consolidada?grupos=G3#todos', 'el enlace a todos los jugadores lleva al G3 en la Liga consolidada');
  await p.locator('select[name="e"]').selectOption('Sint Ajeno Cuatro B');
  await p.getByRole('button', { name: 'Ver' }).click();
  await p.waitForURL(/e=Sint/);
  ok(/Sint Gcuatro, Zeta/i.test(await p.getByTestId('tabla-scouting').innerText()), 'el desplegable abre un equipo del G4');
  await p.goto(`${APP}/liga/scouting?e=MdA`);
  ok(/dobla/.test(await p.getByTestId('tabla-scouting').innerText()) && fugas(await texto(), ['G3', 'G4']).filter((x) => !equiposDe(['G3', 'G4']).map(norm).includes(x)).length === 0, 'nuestro equipo, como siempre (con «dobla»), sin jugadores ajenos');
  await p.context().close();

  ok(e.errores.length === 0, 'sin errores de JavaScript', e.errores.join(' | '));
} finally {
  await e.parar();
}
console.log(fallos() ? `\n${fallos()} FALLO(S)` : '\nTodo OK');
process.exit(fallos() ? 1 : 0);
