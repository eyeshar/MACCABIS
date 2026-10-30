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

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
