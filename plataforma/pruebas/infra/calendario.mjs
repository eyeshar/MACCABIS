// Calendario de las PRUEBAS (D185): las pruebas nunca leen el calendario real (data/calendario_<temporada>.json, la tabla
// real de eventos ni las copias de src/data). Un aplazamiento aceptado en la rutina B no puede poner Actions en rojo.
//
// fixtures/calendario_prueba.json: los 40 partidos y 4 descansos de una temporada con rivales INVENTADOS y fechas fijas
// (respecto a «hoy» = HOY_PRUEBA, infra/reloj.mjs), y en `cambios_prueba` los cambios oficiales que las pruebas aplican a
// propósito: un aplazamiento, un cambio de hora y pista y un cambio de local a visitante (el descanso ya va en el base).
// fixtures/entrenos_prueba.json y fixtures/equipaciones_prueba.json: los entrenos y los colores (con los de los rivales
// inventados), también fijos. La web de las pruebas se compila con estos tres en lugar de los de src/data (next.config.ts,
// PRUEBAS_CALENDARIO).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarEventos as cargarEventosDe, partidosIniciales } from '../../scripts/cargar_eventos.mjs';

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
export const FICHERO_CALENDARIO = path.join(FIX, 'calendario_prueba.json');
export const FICHERO_ENTRENOS = path.join(FIX, 'entrenos_prueba.json');
export const FICHERO_EQUIPACIONES = path.join(FIX, 'equipaciones_prueba.json');

const leer = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
/** El calendario de prueba (una copia nueva cada vez: se puede modificar). */
export const calendarioPrueba = () => leer(FICHERO_CALENDARIO);
export const entrenosPrueba = () => leer(FICHERO_ENTRENOS);
export const equipacionesPrueba = () => leer(FICHERO_EQUIPACIONES);

/** Carga los eventos del calendario de prueba en la base de la pila (como db:eventos con el real). */
export const cargarEventos = (sql, opciones = {}) => cargarEventosDe(sql, { calendario: calendarioPrueba(), entrenos: entrenosPrueba(), ...opciones });
export { partidosIniciales };

/** Un cambio oficial de `cambios_prueba` ('aplazado', 'hora_y_pista', 'local_a_visitante'). */
export const cambioPrueba = (caso) => calendarioPrueba().cambios_prueba.find((c) => c.caso === caso);

/** El calendario de prueba con esos cambios oficiales aplicados (lo que traería la rutina B). */
export function conCambios(casos = ['aplazado', 'hora_y_pista', 'local_a_visitante'], cal = calendarioPrueba()) {
  for (const caso of casos) {
    const c = cal.cambios_prueba.find((x) => x.caso === caso);
    const p = cal.partidos.find((x) => x.equipo === c.equipo && x.jornada === c.jornada);
    Object.assign(p, c.despues);
  }
  return cal;
}

/** Aplica en la tabla de eventos de la pila los cambios oficiales de `cambios_prueba` (como al aceptarlos en Importar →
 *  Calendario, sin avisos). Devuelve las claves de los eventos tocados. */
export async function aplicarCambiosEnBase(sql, casos = ['aplazado', 'hora_y_pista', 'local_a_visitante']) {
  const claves = [];
  for (const caso of casos) {
    const c = cambioPrueba(caso), d = c.despues;
    const clave = `${c.equipo.toLowerCase()}-j${c.jornada}`;
    await sql`update public.eventos set
                fecha = coalesce(${d.fecha ?? null}::date, fecha),
                inicio = coalesce(${d.hora ?? null}::time, inicio),
                numero_pista = coalesce(${d.campo != null ? Number(d.campo) : null}::int, numero_pista),
                es_local = coalesce(${d.local ?? null}::boolean, es_local)
              where clave = ${clave}`;
    claves.push(clave);
  }
  return claves;
}
