#!/usr/bin/env node
// Nombres de los convocados en el WhatsApp de la convocatoria: SIEMPRE el nombre visible de la plantilla
// (jugadores.nombre_visible, el mote; la fuente única de toda la web), con sus tildes, y nunca dos convocados con el mismo
// nombre en un mensaje. Sin base de datos ni navegador.
//   1. Con una plantilla sintética (sint-…): cada convocado sale con SU nombre visible tal cual y no hay dos iguales; el
//      control (dos sintéticos con el mismo nombre) demuestra que la comprobación falla cuando toca.
//   2. La plantilla de la semilla (scripts/plantilla_2026_27.mjs, la que carga npm run db:semilla y la pila de pruebas):
//      nombres visibles distintos, ninguno de quien puede ser convocado es un nombre de pila a secas que comparte con otra
//      persona de la plantilla (dos Víctor, dos Eduardo: «Víctor M.», «Eduardo G.») y respetan las tildes de su nombre.
//      Un FALLO dice la fila de la semilla, no el nombre.
//
//   npm run pruebas:nombres-convocados

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mensajeConvocatoria } from '../src/lib/convocatoria/mensajes.ts';
import { claveNombre, nombreOcupado, nombresRepetidos } from '../src/lib/nombres.ts';
import { PLANTILLA_2026_27 } from '../scripts/plantilla_2026_27.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let fallos = 0;
const ok = (c, m, d = '') => { console.log(`  ${c ? 'OK   ' : 'FALLO'} ${m}${c ? '' : d ? ' -> ' + d : ''}`); if (!c) fallos++; };

const P = (equipo, inicio) => ({ equipo, rival: 'Rival Sintético', es_local: true, inicio, encuentro: null, sitio: 'CDM Moratalaz, pista 2', direccion: null, lineaEquipacion: null });
/** Las listas «Convocados (N): a, b, c.» de un mensaje, por equipo: la línea entera y sus nombres. El punto final no se
 *  dobla si el último ya acaba en punto («… Eduardo G.»): se quita solo si ese nombre no lo lleva (`conocidos`). */
const listas = (msg, conocidos) => Object.fromEntries([...msg.matchAll(/^(MdA|MdL) · [^\n]*\n[^\n]*\n[^\n]*\n(Convocados \((\d+)\): ([^\n]*))$/gm)].map((m) => {
  const nombres = m[4].split(', ');
  const u = nombres.length - 1;
  if (!conocidos.has(nombres[u])) nombres[u] = nombres[u].replace(/\.$/, '');
  return [m[1], { linea: m[2], n: Number(m[3]), nombres }];
}));
/** Repetidos dentro de una lista de nombres (sin tildes ni mayúsculas). */
const repetidos = (nombres) => nombresRepetidos(nombres.map((n, i) => ({ person_id: String(i), nombre: n }))).map((g) => g[0].nombre);

console.log('\n== WhatsApp de la convocatoria: el nombre visible de cada convocado, tal cual');
{
  // La fuente única: la fila de jugadores (nombre_visible). Con tildes y con la inicial del apellido, como la real.
  const plantilla = [
    { person_id: 'sint-01', nombre_visible: 'Sínt Víctor M.' }, { person_id: 'sint-02', nombre_visible: 'Sínt Muro' },
    { person_id: 'sint-03', nombre_visible: 'Sínt Edu' }, { person_id: 'sint-04', nombre_visible: 'Sínt Eduardo G.' },
    { person_id: 'sint-05', nombre_visible: 'Sínt Fernando T.' }, { person_id: 'sint-06', nombre_visible: 'Sínt Carlos B.' },
    { person_id: 'sint-07', nombre_visible: 'Sínt Andrés' },
  ];
  const visible = new Map(plantilla.map((j) => [j.person_id, j.nombre_visible]));
  const nombre = (id) => visible.get(id) ?? id;   // como el de la convocatoria: ctx.jugadores, de jugadores.nombre_visible
  const conv = { MdA: plantilla.slice(0, 5).map((j) => ({ person_id: j.person_id })), MdL: plantilla.slice(2).map((j) => ({ person_id: j.person_id })) };
  const msg = mensajeConvocatoria('2026-10-25', 3, [P('MdA', '10:00'), P('MdL', '12:00')], conv, nombre);
  const l = listas(msg, new Set(visible.values()));
  ok(l.MdA?.n === 5 && l.MdL?.n === 5 && l.MdA.nombres.length === 5 && l.MdL.nombres.length === 5, 'las dos listas «Convocados (5): …», una por partido', JSON.stringify(l));
  for (const eq of ['MdA', 'MdL']) {
    const esperados = conv[eq].map((c) => visible.get(c.person_id)).sort((a, b) => a.localeCompare(b, 'es'));
    ok(JSON.stringify(l[eq]?.nombres) === JSON.stringify(esperados), `${eq}: cada convocado con SU nombre visible exacto (con tildes e inicial), en orden alfabético`, JSON.stringify(l[eq]?.nombres));
    ok(l[eq]?.linea === `Convocados (${esperados.length}): ${esperados.join(', ').replace(/\.?$/, '.')}` && !/\.\.$/.test(l[eq]?.linea), `${eq}: la línea acaba en un solo punto aunque el último lleve la inicial («… Víctor M.», no «M..»)`, l[eq]?.linea);
    ok(repetidos(l[eq]?.nombres ?? []).length === 0, `${eq}: ningún nombre repetido en la lista`, repetidos(l[eq]?.nombres ?? []).join(', '));
  }
  ok(msg.includes('Sínt Víctor M.') && !/Sint Victor/.test(msg), 'respeta las tildes del nombre visible («Víctor», no «Victor»)');
  const todos = [...(l.MdA?.nombres ?? []), ...(l.MdL?.nombres ?? [])];
  ok(todos.every((n) => plantilla.some((j) => j.nombre_visible === n)), 'todos los nombres del mensaje salen de la misma fuente (nombre_visible), ninguno inventado ni recortado');

  // Control: si la fuente tuviera dos iguales (aunque solo cambie una tilde), la comprobación lo pilla.
  const mala = new Map([...visible, ['sint-02', 'Sínt Víctor M.'], ['sint-03', 'sint victor m']]);
  const l2 = listas(mensajeConvocatoria('2026-10-25', 3, [P('MdA', '10:00')], conv, (id) => mala.get(id) ?? id), new Set(mala.values()));
  ok(repetidos(l2.MdA?.nombres ?? []).length === 1, 'control: dos convocados con el mismo nombre (con o sin tilde) se detectan como repetidos', JSON.stringify(l2.MdA?.nombres));
  ok(claveNombre('Víctor M.') === claveNombre('victor m') && claveNombre('Edu') !== claveNombre('Eduardo G.'), 'claveNombre: «Víctor M.» = «victor m»; «Edu» ≠ «Eduardo G.»');
  const activos = plantilla.map((j) => ({ person_id: j.person_id, nombre: j.nombre_visible }));
  ok(nombreOcupado('sínt víctor m', 'sint-07', activos)?.person_id === 'sint-01' && nombreOcupado('Sínt Víctor M.', 'sint-01', activos) === null && nombreOcupado('Sínt Víctor P.', 'sint-07', activos) === null,
    'Gestión → Jugadores no deja poner a otro activo un nombre visible que ya está (sí el suyo, sí con otra inicial)');
}

console.log('\n== La plantilla de la semilla (scripts/plantilla_2026_27.mjs)');
{
  const personas = new Map(JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'personas.json'), 'utf8')).personas.map((p) => [p.person_id, p]));
  const filas = PLANTILLA_2026_27.map((j, i) => ({ ...j, fila: i + 1, nombre: j.visible }));
  ok(filas.length > 20 && filas.every((j) => personas.has(j.person_id) && j.visible?.trim()), `${filas.length} jugadores, todos en data/personas.json y con nombre visible`);
  const rep = nombresRepetidos(filas);
  ok(rep.length === 0, 'ningún nombre visible repetido (sin contar tildes ni mayúsculas)', rep.map((g) => `filas ${g.map((j) => j.fila).join(' y ')}`).join('; '));
  // Nombre de pila de cada persona («Apellidos, Nombre» -> «Nombre»; el primero si tiene dos).
  const pila = (id) => (personas.get(id).formal.split(',')[1] ?? '').trim().split(/\s+/)[0] ?? '';
  const convocable = (j) => j.rol === 'jugador' && (j.mda || j.mdl);
  // Un nombre visible que es un nombre de pila a secas («Victor», «Eduardo», «Carlos») y que comparte otra persona de la
  // plantilla (también el entrenador, que está en el grupo): en el WhatsApp no se sabe quién es.
  const ambiguos = filas.filter((j) => convocable(j) && /^\p{L}+$/u.test(j.visible) && filas.some((o) => o.person_id !== j.person_id && claveNombre(pila(o.person_id)) === claveNombre(j.visible)));
  ok(ambiguos.length === 0, 'ningún convocable lleva a secas un nombre de pila que comparte con otro de la plantilla (lleva la inicial del apellido: «Fernando T.»)', ambiguos.map((j) => `fila ${j.fila}`).join(', '));
  // Si el nombre visible es su nombre de pila (con o sin inicial), con las mismas tildes («Víctor M.», no «Victor M.»).
  const sinTilde = filas.filter((j) => { const w = j.visible.split(/\s+/)[0]; const n = pila(j.person_id); return claveNombre(w) === claveNombre(n) && w !== n; });
  ok(sinTilde.length === 0, 'respetan las tildes de su nombre de pila', sinTilde.map((j) => `fila ${j.fila}`).join(', '));
}

console.log(fallos ? `\n${fallos} FALLO(S)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
