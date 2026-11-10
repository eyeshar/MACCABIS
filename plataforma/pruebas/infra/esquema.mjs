// PostgREST con el esquema al día tras deshacer y volver a aplicar migraciones (las suites que prueban un .revertir.sql).
// Cada migración acaba con `notify pgrst, 'reload schema'` y PostgREST relee el esquema EN SEGUNDO PLANO: si una relectura
// empieza mientras aún se aplican las siguientes (o mientras el reloj de las pruebas reescribe funciones), se queda con una
// caché a medias y la primera llamada de la prueba recibe un 404 («Could not find the function … in the schema cache») o
// un 503. En Actions, con cinco carriles a la vez en una máquina pequeña, la relectura tarda más y se ve (pruebas:planes el
// 31/10 y el 01/11; pruebas:domingo el 04/11 y el 09/11, «y sigue dando lo mismo»).
//
// Cómo se sabe que la caché ya es la buena: se crea una función testigo NUEVA después de la última migración (sin permisos
// para nadie) y se pide a PostgREST que relea. Solo una relectura que empezó después de todo lo aplicado la conoce: mientras
// PostgREST conteste 404/503 por ella, la caché es vieja; cuando conteste «sin permiso» (401/403) varias rondas seguidas, la
// caché tiene todo lo migrado. Después se borra el testigo (sin avisar: nadie la llama y la siguiente relectura la quita).
import { PUERTOS } from './puertos.mjs';
import { hasta } from './esperas.mjs';

const VIVA = (s) => s === 401 || s === 403;

/** Espera, con límite, a que PostgREST (el de la pila de este carril, o `rest`) tenga en su caché todo lo migrado. Si no hay
 *  PostgREST escuchando (una suite que solo usa la base), no espera. Si se agota el límite, falla aquí con el motivo. */
export async function esquemaAlDia(sql, { rest = `http://127.0.0.1:${PUERTOS.rest}`, ms = 60000 } = {}) {
  const llamar = async (f) => {
    try { return (await fetch(`${rest}/rpc/${f}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status; }
    catch { return 0; }
  };
  if ((await llamar('_pruebas_sin_funcion')) === 0) return { esperado: false };
  const testigo = `_pruebas_esquema_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  await sql.unsafe(`create function public.${testigo}() returns int language sql immutable as 'select 1';
                    revoke all on function public.${testigo}() from public, anon, authenticated, service_role;`);
  const t0 = Date.now();
  let ultimo = 0, seguidas = 0, avisado = 0;
  try {
    const listo = await hasta(async () => {
      if (!seguidas && Date.now() - avisado > 3000) { avisado = Date.now(); await sql`notify pgrst, 'reload schema'`; }
      ultimo = await llamar(testigo);
      seguidas = VIVA(ultimo) ? seguidas + 1 : 0;
      return seguidas >= 4; // varias rondas seguidas: una relectura vieja que acabe tarde puede pisar la nueva
    }, ms);
    if (!listo) throw new Error(`PostgREST no ha releído el esquema en ${ms / 1000} s tras volver a migrar (la última respuesta, ${ultimo})`);
    return { esperado: true, ms: Date.now() - t0 };
  } finally {
    await sql.unsafe(`drop function if exists public.${testigo}()`);
  }
}
