#!/usr/bin/env node
// Privacidad de lo que reciben los JUGADORES (D39, D173.F; Iván 02/11/2026: «los niveles generan ruido en el equipo»). Sin base:
// genera con datos sintéticos el TEXTO EXACTO de todos los avisos push a jugadores (recordatorios, plazo, cierre, dudas, paso a
// «no va», «no va (por defecto)», cambios, cancelación, prueba, planes, convocatoria en sus tres casos y los cambios de
// convocatoria), el WhatsApp de la convocatoria, el del recambio (convocatoria con cambios) y el de «faltan jugadores», y falla
// si aparece un nivel (A–E en contexto de nivel), «nivel», «riesgo», «reserva», «dobla» o la proyección.
// Las pantallas de jugador y el registro real de avisos de la pila los recorre pruebas:rutina-c con el mismo patrón.
//
//   npm run pruebas:privacidad-avisos
import * as T from '../src/lib/avisos/textos.ts';
import * as P from '../src/lib/avisos/planificador.ts';
import * as H from '../src/lib/avisos/horario.ts';
import * as CM from '../src/lib/convocatoria/mensajes.ts';
import { PROHIBIDO_JUGADOR, prohibidoEn } from './prohibido.mjs';
import { diferencias } from '../src/lib/convocatoria/motor.ts';

let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };
const M = (f, h) => H.madrid(f, h);

const SITIO = 'CDM Moratalaz, pista 2';
const ev = (id, tipo, equipo, fecha, inicio, extra = {}) => ({ id, tipo, equipo, fecha, inicio, fin: null, quedada: inicio ? H.enMadrid(new Date(M(fecha, inicio).getTime() - 20 * 60000)).hora : null, titulo: null, sitio: SITIO, estado: 'programado', sin_recordatorios: false, creado_en: '2026-11-01T10:00:00Z', ...extra });
const ent = ev('e', 'entreno', 'ambos', '2026-11-11', '20:30'), mda = ev('a', 'liga', 'MdA', '2026-11-15', '10:15'), mdl = ev('l', 'liga', 'MdL', '2026-11-15', '12:45');
const amis = ev('am', 'amistoso', 'ambos', '2026-11-14', '11:00', { titulo: 'Contra Vallecas', creado_en: M('2026-11-09', '08:30').toISOString() });
const plan = ev('pl', 'quedada', 'ambos', '2026-11-14', '21:00', { titulo: 'Cena', oficial: false, recordar_un_dia_antes: true });
const jug = (p, a, l, m = null) => ({ person_id: p, ficha_mda: a, ficha_mdl: l, entrena: true, activo: true, rol: 'jugador', marcas: m });
const JUG = [jug('j1', true, true), jug('j2', true, false), jug('j3', false, true, { no_suele_entrenar: true, nunca_partidos: false })];
const EVS = [ent, mda, mdl, amis, plan];
const datos = (ahora, respuestas = []) => ({ ahora, eventos: EVS, jugadores: JUG, respuestas, ausencias: [] });
const textos = [];
const anota = (de, t) => textos.push({ de, texto: `${t.titulo} ${t.cuerpo}` });

// ---- avisos de la tarea, pasada a pasada durante toda la semana (cada 15 minutos)
const duda = [{ evento_id: 'a', person_id: 'j1', respuesta: 'duda' }, { evento_id: 'e', person_id: 'j2', respuesta: 'duda' }, { evento_id: 'am', person_id: 'j1', respuesta: 'duda' }];
for (let t = M('2026-11-09', '00:00').getTime(); t < M('2026-11-15', '13:00').getTime(); t += 15 * 60000) {
  const d = datos(new Date(t), duda);
  for (const a of P.conAvisosDeDudas([...P.planificar(d), ...P.planificarPlanes(d)], d)) anota('tarea', a);
  for (const a of P.avisosCierre(datos(new Date(t)))) anota('cierre', a);
  for (const a of P.avisosPorDefecto(d)) anota('por defecto', a);
}
const sis = (e, p) => ({ evento_id: e, person_id: p, respuesta: 'no', motivo: 'no_confirmo', origen: 'sistema', cambiado_en: M('2026-11-10', '12:00').toISOString() });
for (const a of P.avisosPasoNoVa({ eventos: EVS, respuestas: [sis('a', 'j1'), sis('l', 'j1'), sis('e', 'j2')] }, M('2026-11-10', '12:05'))) anota('paso a no va', a);
ok(new Set(textos.map((x) => x.de)).size === 4 && textos.length > 10, `avisos de la tarea generados (${textos.length})`);
// ---- avisos sueltos
for (const r of ['va', 'duda', 'no', 'sin_responder']) for (const dia of [true, false]) anota('cambio', T.textoCambio(ent, r, dia));
anota('cancelación', T.textoCancelacion(mda));
anota('prueba', T.TEXTO_PRUEBA);
anota('recordatorio manual', T.textoMartes('2026-11-15', ['10:15', '12:45'], 'hoy a las 12:00'));
anota('entreno hoy', T.textoEntrenoHoy(ent));
anota('plan mañana', T.textoPlanManana(plan));
// ---- convocatoria: los tres casos, dobla, cambios
const PART = [
  { equipo: 'MdA', rival: 'Rival A', es_local: true, inicio: '10:15', encuentro: '09:55', sitio: SITIO, direccion: 'C/ Arroyo Fontarrón, s/n', lineaEquipacion: 'Jugamos de negro (ellos de rojo). Llevad la amarilla por si acaso.' },
  { equipo: 'MdL', rival: 'Rival L', es_local: false, inicio: '12:45', encuentro: '12:25', sitio: SITIO, direccion: null, lineaEquipacion: 'Coinciden colores: cambiamos nosotros, de amarillo. Llevad la amarilla por si acaso.' },
];
for (const [eqs, disp] of [[['MdL'], ['MdA', 'MdL']], [['MdA'], ['MdA']], [[], ['MdL']], [['MdA', 'MdL'], ['MdA', 'MdL']]]) {
  anota('aviso de convocatoria', CM.textoAvisoConvocatoria('2026-11-15', PART, eqs, disp));
  anota('aviso de convocatoria (un partido)', CM.textoAvisoConvocatoria('2026-11-15', [PART[1]], eqs.filter((e) => e === 'MdL'), disp));
}
for (const [eqs, antes] of [[['MdA'], []], [['MdL'], ['MdA']], [[], ['MdA']], [['MdA', 'MdL'], ['MdA']]]) anota('cambio de convocatoria', CM.textoCambioConvocatoria('2026-11-15', PART, eqs, antes));
const nombre = (id) => ({ j1: 'Jon', j2: 'Guille', j3: 'Ana', j4: 'Luis' }[id] ?? id);
const conv = { MdA: [{ person_id: 'j1' }, { person_id: 'j2' }], MdL: [{ person_id: 'j1' }, { person_id: 'j3' }] };
const avisosClub = [{ texto: 'Corte de calles en Moratalaz', para: 'todos' }];
anota('WhatsApp de la convocatoria', { titulo: '', cuerpo: CM.mensajeConvocatoria('2026-11-15', 6, PART, conv, nombre, [], avisosClub) });
const despues = { MdA: [{ person_id: 'j4' }, { person_id: 'j2' }], MdL: [{ person_id: 'j1' }, { person_id: 'j3' }] };
anota('WhatsApp del recambio', { titulo: '', cuerpo: CM.mensajeConvocatoria('2026-11-15', 6, PART, despues, nombre, diferencias(conv, despues, nombre), avisosClub) });
anota('WhatsApp para quien falta', { titulo: '', cuerpo: CM.mensajeFaltan('2026-11-15', ['Jon', 'Ana']) });

console.log(`\n== ${textos.length} textos a jugadores, uno a uno`);
const malos = textos.filter((x) => prohibidoEn(x.texto));
ok(malos.length === 0, `ninguno lleva un nivel, «nivel», «riesgo», «reserva», «dobla» ni la proyección (${textos.length} revisados)`, malos.slice(0, 3).map((x) => `${x.de}: ${x.texto} [${prohibidoEn(x.texto)}]`).join(' | '));
const tipos = [...new Set(textos.map((x) => x.de))];
ok(['tarea', 'cierre', 'por defecto', 'paso a no va', 'aviso de convocatoria', 'cambio de convocatoria', 'WhatsApp de la convocatoria', 'WhatsApp del recambio'].every((t) => tipos.includes(t)), `cubre todos los tipos (${tipos.length})`, tipos.join(', '));
console.log('\n== El patrón detecta lo que debe (para que la prueba no pase en vacío)');
for (const t of ['Nivel A', 'nivel medio B+', 'Riesgo alto: el MdA', 'Fernando (reserva) entra', 'Jon dobla', 'Proyección ≈ 48 puntos', 'Jon (B)', 'equipo con A+ y C-']) ok(!!prohibidoEn(t), `detecta «${t}»`);
for (const t of ['Estás convocado · domingo 15/11', 'MdA a las 10:15 (quedada 09:55).', 'Tienes hasta hoy a las 12:00 para decir si vas', 'Además: A las 10:00', 'Llevad la amarilla por si acaso.']) ok(!prohibidoEn(t), `no confunde «${t}»`);
ok(PROHIBIDO_JUGADOR instanceof RegExp, 'el patrón es el mismo que usa pruebas:rutina-c (prohibido.mjs)');

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
