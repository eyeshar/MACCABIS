"use client";

import { useEffect, useState } from "react";

/** Si el esqueleto sigue en pantalla pasado este tiempo, algo se ha quedado colgado. */
export const ESQUELETO_MAX_MS = 10_000;
/** Una sola recarga automatica por pagina en este tiempo: si vuelve a colgarse, se ofrece el boton (sin bucles). */
const SIN_BUCLE_MS = 120_000;

/**
 * D199: la navegacion ya ha cambiado de ruta (se ve el esqueleto de loading.tsx) pero la pagina no llega nunca. Lo que
 * cubria la salida de emergencia de D198 era la ruta SIN cambiar; esto es lo otro. A los ~10 s, una carga entera de la
 * misma direccion; si ya se hizo hace poco, en vez de recargar sola dice que tarda y da un boton.
 */
export default function VigiaEsqueleto() {
  const [tarda, setTarda] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const clave = `maccabis-esqueleto:${window.location.pathname}${window.location.search}`;
      let antes = 0;
      try { antes = Number(sessionStorage.getItem(clave) ?? 0); } catch {}
      if (Date.now() - antes > SIN_BUCLE_MS) {
        try { sessionStorage.setItem(clave, String(Date.now())); } catch {}
        window.location.reload();
        return;
      }
      setTarda(true);
    }, ESQUELETO_MAX_MS);
    return () => window.clearTimeout(t);
  }, []);
  if (!tarda) return null;
  return (
    <div className="esq-tarda" role="alert" data-testid="esqueleto-tarda">
      <p>Está tardando más de lo normal.</p>
      <button type="button" className="boton boton-amarillo" onClick={() => window.location.reload()}>Recargar</button>
    </div>
  );
}
