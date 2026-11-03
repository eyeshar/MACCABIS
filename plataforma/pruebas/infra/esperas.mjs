// Esperas sin tiempos fijos (D149): en vez de «clic y 1,5 s de margen», se espera a lo que de verdad hay que esperar.

/**
 * Hace `accion` (un clic, una tecla, soltar algo...) y espera a que acabe lo que dispare: si en `gracia` ms sale una
 * peticion que no es GET (una accion de servidor o una API), a que contesten todas; y despues a que la red este quieta
 * `quieta` ms (el refresco de la pagina tras guardar). Si no sale ninguna, sigue tras la gracia (lo que antes era una
 * espera fija sirve igual para comprobar que algo NO cambia).
 */
export async function trasAccion(p, accion, { gracia = 400, quieta = 150, ms = 20000 } = {}) {
  const enVuelo = new Set();
  let escrituras = 0;
  const empieza = (r) => { enVuelo.add(r); if (r.method() !== 'GET') escrituras++; };
  const acaba = (r) => enVuelo.delete(r);
  p.on('request', empieza); p.on('requestfinished', acaba); p.on('requestfailed', acaba);
  try {
    await accion();
    const ini = Date.now(), fin = ini + ms;
    while (!escrituras && Date.now() - ini < gracia) await dormir(20);
    let quietaDesde = enVuelo.size ? 0 : Date.now();
    while (Date.now() < fin) {
      if (enVuelo.size) quietaDesde = 0;
      else if (!quietaDesde) quietaDesde = Date.now();
      else if (Date.now() - quietaDesde >= quieta) break;
      await dormir(20);
    }
    // y que React haya pintado lo que llego
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))).catch(() => {});
  } finally {
    p.off('request', empieza); p.off('requestfinished', acaba); p.off('requestfailed', acaba);
  }
}

/** Sondea `cond` (sincrona o async) hasta que sea verdad o pasen `ms`. No falla: la comprobacion de despues dice si se cumplio. */
export async function hasta(cond, ms = 10000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    try { if (await cond()) return true; } catch { /* aun no */ }
    await dormir(50);
  }
  return false;
}

/** La sesion llega al navegador despues del HTML (D175): espera a que la cabecera sepa quien es (con cookie de sesion, el
 *  <html> lleva data-sesion="pendiente" hasta que /api/sesion contesta; sin cookie no espera a nada). */
export async function sesionLista(p, ms = 10000) {
  // Sin cookie de sesion, nada que esperar; con ella, hasta que la cabecera enseñe a la persona (el estado «pendiente» se pone
  // despues del cambio de URL, asi que no basta con mirarlo).
  await p.waitForFunction(() => !/(?:^|; *)sb-[^=;]*-auth-token/.test(document.cookie) || (document.documentElement.dataset.sesion === 'listo' && document.querySelector('header .nv-avatar')), null, { timeout: ms }).catch(() => {});
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))).catch(() => {});
}

/** Que cada goto() de esta pagina espere a la sesion (para pruebas que miran la cabecera nada mas cargar). */
export function gotoConSesion(p) {
  const ir = p.goto.bind(p);
  p.goto = async (...a) => { const r = await ir(...a); await sesionLista(p); return r; };
  return p;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
