"use client";

import { useEffect, useState } from "react";
import { CLAVE_AVISO, pestanaVieja, recargar, type MotivoRecarga } from "@/lib/version/cliente";

const TEXTO: Record<MotivoRecarga, string> = {
  version: "La web se ha actualizado: vuelve a pulsar tu respuesta.",
  fallo: "No se ha podido guardar tu respuesta: vuelve a pulsarla.",
};
/** Al volver a la pestaña, como mucho una comprobacion de la version por minuto (es un fichero estatico de la CDN). */
const CADA_MS = 60_000;

/**
 * D199 (en el layout raiz). (1) Tras una recarga por version vieja o por un guardado fallido, lo dice arriba, claro y
 * hasta que se cierra: la respuesta NO se ha guardado. (2) Al volver a una pestaña que estaba en segundo plano, si la web
 * ya es otro despliegue, recarga antes de que se pulse nada.
 */
export default function AvisoRecarga() {
  const [motivo, setMotivo] = useState<MotivoRecarga | null>(null);
  useEffect(() => {
    try {
      const m = sessionStorage.getItem(CLAVE_AVISO);
      if (m === "version" || m === "fallo") setMotivo(m);
      sessionStorage.removeItem(CLAVE_AVISO);
    } catch { /* sin sessionStorage: sin aviso */ }
    let ultima = Date.now();
    const alVolver = async () => {
      if (document.visibilityState !== "visible" || Date.now() - ultima < CADA_MS) return;
      ultima = Date.now();
      if (await pestanaVieja()) recargarSinAviso();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, []);
  if (!motivo) return null;
  return (
    <div className="aviso-recarga" role="alert" data-testid="aviso-recarga" data-motivo={motivo}>
      <p>{TEXTO[motivo]}</p>
      <button type="button" className="boton boton-claro" onClick={() => setMotivo(null)}>Entendido</button>
    </div>
  );
}

// Al volver a la pestaña no se ha pulsado nada: se recarga sin aviso (recargar() deja uno; se quita en la pagina nueva).
function recargarSinAviso() {
  if (recargar("version")) { try { sessionStorage.removeItem(CLAVE_AVISO); } catch {} }
}
