// Reloj de las pruebas (D185): «hoy» es siempre el mismo, el lunes 19/10/2026 a las 10:00 (Madrid), para que ninguna
// prueba cambie de resultado según el día en que se ejecuta. Va con el calendario de prueba (fixtures/calendario_prueba.json),
// cuyas fechas están puestas respecto a este día. El reloj avanza desde ese instante al ritmo normal (las esperas y los
// plazos de unos minutos siguen funcionando).
//
// Dónde se aplica:
//   - la base de la pila: las funciones y los valores por defecto que usan now() pasan a usar pruebas.ahora() (fijarRelojBase);
//   - el servidor de la web: Date desplazado a ese instante (reloj_node.mjs, por NODE_OPTIONS; entornoReloj);
//   - el navegador: Date desplazado igual, inyectado en cada página (relojNavegador); los temporizadores, reales.
// El proceso de la prueba NO cambia de hora: firma y valida las sesiones con la hora real (PostgREST la comprueba). Lo que
// una prueba espera según «hoy» se calcula con HOY_PRUEBA (fechas_prueba.mjs: hoyMadrid()).
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HOY_PRUEBA = '2026-10-19';
export const INSTANTE_PRUEBA = '2026-10-19T10:00:00+02:00';

// Referencia COMÚN: el instante real en que el reloj de las pruebas marca INSTANTE_PRUEBA. La fija el proceso de la prueba
// al empezar y la heredan la base (fijarRelojBase), la web (PRUEBAS_RELOJ_REF) y el navegador: así los tres marcan la misma
// hora simulada (si cada uno contara desde su arranque, la web, que arranca minutos después, iría por detrás de la base).
export const REFERENCIA = Number(process.env.PRUEBAS_RELOJ_REF ??= String(Date.now()));

const PRELOAD = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'reloj_node.mjs')).href;

/** Variables para el proceso de la web (next build y next start). */
export const entornoReloj = (base = process.env) => ({
  PRUEBAS_RELOJ: INSTANTE_PRUEBA,
  PRUEBAS_RELOJ_REF: String(REFERENCIA),
  NODE_OPTIONS: `${(base.NODE_OPTIONS ?? '').replace(/--import \S*reloj_node\.mjs/g, '').trim()} --import ${PRELOAD}`.trim(),
});

/** El navegador de un contexto de Playwright, con el reloj de las pruebas: solo Date (como en la web, reloj_node.mjs), con
 *  el mismo desfase. Los temporizadores (setTimeout, requestAnimationFrame) siguen siendo los reales: el reloj de
 *  Playwright (clock.install) también los simula y, p. ej., el foco que se devuelve en un requestAnimationFrame no volvía. */
export const relojNavegador = (ctx) => ctx.addInitScript((desfase) => {
  const Real = Date;
  const ahora = () => Real.now() + desfase;
  function DatePrueba(...a) {
    if (!new.target) return new Real(ahora()).toString();
    return a.length === 0 ? new Real(ahora()) : new Real(...a);
  }
  DatePrueba.prototype = Real.prototype;
  DatePrueba.now = ahora;
  DatePrueba.parse = Real.parse;
  DatePrueba.UTC = Real.UTC;
  globalThis.Date = DatePrueba;
}, new Date(INSTANTE_PRUEBA).getTime() - REFERENCIA);

/**
 * La base de pruebas con el reloj de las pruebas: crea pruebas.ahora() (el instante fijo más lo que haya pasado desde que
 * se llama) y cambia now() por pruebas.ahora() en las funciones y en los valores por defecto de las columnas de public.
 * Solo en la pila local, nunca en el real. Hay que volver a llamarla tras aplicar migraciones (vuelven a crear funciones).
 */
export async function fijarRelojBase(sql) {
  await sql.unsafe(`
    create schema if not exists pruebas;
    create table if not exists pruebas.reloj (instante timestamptz not null, base timestamptz not null);
    delete from pruebas.reloj;
    insert into pruebas.reloj values ('${INSTANTE_PRUEBA}', to_timestamp(${REFERENCIA} / 1000.0));
    create or replace function pruebas.ahora() returns timestamptz language sql stable security definer set search_path = ''
      as $$ select r.instante + (pg_catalog.now() - r.base) from pruebas.reloj r limit 1 $$;
    grant usage on schema pruebas to anon, authenticated, service_role;
    grant execute on function pruebas.ahora() to anon, authenticated, service_role;
  `);
  const NOW = /(?:pg_catalog\.)?\bnow\(\)/gi;
  const funciones = await sql`select p.oid, pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                              where n.nspname = 'public' and p.prokind in ('f', 'p') and p.prosrc ~* 'now\\(\\)'`;
  for (const f of funciones) await sql.unsafe(f.def.replace(NOW, 'pruebas.ahora()'));
  const defectos = await sql`select table_name, column_name, column_default from information_schema.columns
                             where table_schema = 'public' and column_default ~* 'now\\(\\)'`;
  for (const c of defectos) await sql.unsafe(`alter table public."${c.table_name}" alter column "${c.column_name}" set default ${c.column_default.replace(NOW, 'pruebas.ahora()')}`);
  const vistas = await sql`select viewname from pg_views where schemaname = 'public' and definition ~* 'now\\(\\)'`;
  if (vistas.length) throw new Error(`reloj de las pruebas: vistas con now() sin cambiar: ${vistas.map((v) => v.viewname).join(', ')}`);
  return { funciones: funciones.length, defectos: defectos.length };
}

/** El «ahora» de las pruebas en el proceso de la prueba (el instante fijo más lo que ha pasado desde la referencia común):
 *  el mismo que ven la base, la web y el navegador. Para comparar con plazos que calculan ellos. */
export function ahoraPrueba() { return new Date(new Date(INSTANTE_PRUEBA).getTime() + (Date.now() - REFERENCIA)); }
