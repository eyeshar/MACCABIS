// Guardia de destino (norma 19, D187): todo script que se conecta a una base para escribir, revertir o crear cuentas
// dice ANTES a qué base va, y este modulo lo compara con la conexion que le llega y para si no cuadra. Sin conectarse.
//
//   --pila               la pila local de las pruebas (solo 127.0.0.1). NUNCA lee plataforma/.env.local: la conexion
//                        le tiene que llegar en SUPABASE_DB_URL (y NEXT_PUBLIC_SUPABASE_URL si la usa); si no, para.
//   --confirmar <ref>    el Supabase real. <ref> es el proyecto escrito abajo (REAL.ref), no lo que diga .env.local:
//                        la conexion de .env.local tiene que ser de ese proyecto y de uno de sus servidores.
//
// Sin ninguna de las dos, para. Las dos a la vez, para. Codigo de salida 3 (ver `exigirDestino`).
// Excepcion de la norma: las suites -real (solo leen, en transacciones read only) siguen con `conectar()` de db.mjs.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** El Supabase real (eu-west-1). El ref es publico (va en NEXT_PUBLIC_SUPABASE_URL y en la cookie de proxy.ts). */
export const REAL = Object.freeze({
  ref: 'pqbjnxmknhawlkszwmln',
  // El pooler es compartido entre proyectos: el proyecto sale del usuario (postgres.<ref>). La conexion directa lleva
  // el ref en el host.
  pooler: 'aws-1-eu-west-1.pooler.supabase.com',
  directo: 'db.pqbjnxmknhawlkszwmln.supabase.co',
  api: 'https://pqbjnxmknhawlkszwmln.supabase.co',
});
const HOST_PILA = '127.0.0.1';
export const CODIGO_DESTINO = 3;
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export class DestinoIncorrecto extends Error {}

/** Que servidor es una cadena de conexion de Postgres. Nunca devuelve la contrasena. */
export function servidorDe(url) {
  if (!url) return { tipo: 'vacio', texto: 'ninguna conexión (SUPABASE_DB_URL vacía)' };
  let u;
  try { u = new URL(url); } catch { return { tipo: 'ilegible', texto: 'una conexión ilegible' }; }
  if (!/^postgres(ql)?:$/.test(u.protocol)) return { tipo: 'ilegible', texto: `una conexión ${u.protocol} (no es de Postgres)` };
  const host = u.hostname;
  const puerto = u.port || '5432';
  if (host === HOST_PILA) return { tipo: 'pila', host, puerto, texto: `la pila local (${host}:${puerto})` };
  const usuario = decodeURIComponent(u.username);
  const ref = host === REAL.pooler ? usuario.split('.')[1] : (host.match(/^db\.([a-z0-9]+)\.supabase\.co$/) || [])[1];
  if (ref === REAL.ref) return { tipo: 'real', host, puerto, ref, texto: `el Supabase real (${ref} en ${host})` };
  return { tipo: 'otro', host, puerto, ref, texto: `${host}:${puerto}${ref ? ` (proyecto ${ref})` : ''}` };
}

/** Que API es una URL de Supabase (NEXT_PUBLIC_SUPABASE_URL). */
export function apiDe(url) {
  if (!url) return { tipo: 'vacio', texto: 'ninguna API (NEXT_PUBLIC_SUPABASE_URL vacía)' };
  let u;
  try { u = new URL(url); } catch { return { tipo: 'ilegible', texto: 'una API ilegible' }; }
  if (u.protocol === 'http:' && u.hostname === HOST_PILA) return { tipo: 'pila', texto: `la API de la pila local (${u.host})` };
  if (u.origin === REAL.api) return { tipo: 'real', texto: `la API del real (${u.host})` };
  return { tipo: 'otro', texto: `la API ${u.origin}` };
}

/** Separa --pila y --confirmar <ref> (o --confirmar=<ref>) del resto de argumentos del script. */
export function leerOpciones(args) {
  const resto = [];
  let pila = false;
  let confirmado = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--pila') pila = true;
    else if (a === '--confirmar') confirmado = args[++i] ?? '';
    else if (a.startsWith('--confirmar=')) confirmado = a.slice('--confirmar='.length);
    else resto.push(a);
  }
  return { pila, confirmado, resto };
}

/** Compara el destino pedido con la conexion (y la API, si `conApi`). Lanza DestinoIncorrecto; no se conecta. */
export function comprobarDestino({ pila, confirmado }, { url, api, conApi = false }) {
  if (pila && confirmado !== null) throw new DestinoIncorrecto('Has pedido --pila y --confirmar a la vez: elige uno.');
  if (!pila && confirmado === null) {
    throw new DestinoIncorrecto(`Di a qué base va: --pila (la pila local de las pruebas) o --confirmar ${REAL.ref} (el Supabase real).`);
  }
  const s = servidorDe(url);
  const a = conApi ? apiDe(api) : null;
  if (pila) {
    if (s.tipo !== 'pila') throw new DestinoIncorrecto(`Has pedido la pila local y la conexión es ${s.texto}.`);
    if (a && a.tipo !== 'pila') throw new DestinoIncorrecto(`Has pedido la pila local y la API es ${a.texto}.`);
    return { modo: 'pila', servidor: s, api: a };
  }
  if (confirmado !== REAL.ref) {
    throw new DestinoIncorrecto(`--confirmar «${confirmado}» no es el proyecto real (${REAL.ref}).`);
  }
  if (s.tipo !== 'real') throw new DestinoIncorrecto(`Has confirmado el real (${REAL.ref}) y la conexión es ${s.texto}.`);
  if (a && a.tipo !== 'real') throw new DestinoIncorrecto(`Has confirmado el real (${REAL.ref}) y la API es ${a.texto}.`);
  return { modo: 'real', servidor: s, api: a };
}

/**
 * Lo que usan los scripts: lee las opciones, carga plataforma/.env.local SOLO si el destino es el real, comprueba y
 * devuelve { destino, args } (args sin --pila ni --confirmar). Si no cuadra, imprime el motivo y sale con codigo 3,
 * antes de conectarse a nada.
 */
export async function exigirDestino(args, { conApi = false, log = console.log, entorno = process.env } = {}) {
  const opciones = leerOpciones(args);
  try {
    if (!opciones.pila && opciones.confirmado !== null) {
      const dotenv = await import('dotenv');
      dotenv.config({ path: path.join(RAIZ, '.env.local'), processEnv: entorno, quiet: true });
    }
    const destino = comprobarDestino(opciones, { url: entorno.SUPABASE_DB_URL, api: entorno.NEXT_PUBLIC_SUPABASE_URL, conApi });
    log(`Destino comprobado: ${destino.servidor.texto}${destino.api ? ` · ${destino.api.texto}` : ''}.`);
    return { destino, args: opciones.resto };
  } catch (e) {
    if (!(e instanceof DestinoIncorrecto)) throw e;
    console.error(`DESTINO NO COMPROBADO (norma 19): ${e.message} No se ha conectado a nada.`);
    process.exit(CODIGO_DESTINO);
  }
}
