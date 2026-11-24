"use client";

import { useEffect, useState, useTransition } from "react";
import { guardarSeguro, type Resultado } from "@/lib/version/cliente";

/** Si el servidor no ha contestado en este tiempo, se dice en la pantalla que la respuesta aun NO esta guardada. */
export const SIN_CONFIRMAR_MS = 10_000;

/**
 * D199: el guardado de una respuesta (Voy / No voy / Duda, el domingo, un plan). El boton solo se marca cuando el
 * servidor confirma (`alGuardar` se llama solo con ok); un error del servidor se ve; una accion que falla o una pestaña
 * vieja recargan la pagina (guardarSeguro); y si tarda, «Guardando…» pasa a decir que aun no esta guardada.
 */
export function useGuardado() {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lento, setLento] = useState(false);
  useEffect(() => {
    if (!pendiente) { setLento(false); return; }
    const t = setTimeout(() => setLento(true), SIN_CONFIRMAR_MS);
    return () => clearTimeout(t);
  }, [pendiente]);
  const guardar = <R extends Resultado>(accion: () => Promise<R>, alGuardar: (r: R) => void) => empezar(async () => {
    setError(null);
    const r = await guardarSeguro(accion);
    if (r === "recargando") return;
    if (!r.ok) { setError(r.error); return; }
    alGuardar(r as R);
  });
  return { pendiente, lento, error, setError, guardar };
}

/** «Guardando…» y, si tarda, que todavia no se ha guardado. Sin nada cuando no hay guardado en marcha. */
export function EstadoGuardado({ pendiente, lento }: { pendiente: boolean; lento: boolean }) {
  if (!pendiente) return null;
  return (
    <p className={`rw-guardando${lento ? " lento" : ""}`} role="status" aria-live="polite" data-testid={lento ? "sin-confirmar" : "guardando"}>
      {lento ? "Aún no se ha confirmado: tu respuesta todavía NO está guardada. Si no llega, recarga la página y vuelve a pulsarla." : "Guardando…"}
    </p>
  );
}
