"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { responder } from "@/app/mi-zona/respuestas-acciones";
import { EstadoGuardado, useGuardado } from "./useGuardado";

// «Sí voy» (D152): a quien le hemos puesto «No vas (puesto por defecto)» en un entreno. Guarda «Voy» con la misma accion
// que el resto de respuestas (la base vuelve a comprobar la invitacion y que el entreno siga abierto).
export default function SiVoy({ eventoId, nombre, grande }: { eventoId: string; nombre: string; grande?: boolean }) {
  const router = useRouter();
  const [hecho, setHecho] = useState(false);
  const { pendiente, lento, error, guardar: guardarConfirmado } = useGuardado();
  const guardar = () => guardarConfirmado(() => responder(eventoId, "va"), () => { setHecho(true); router.refresh(); });
  return (
    <div className={`rw-sivoy${grande ? " grande" : ""}`}>
      <button type="button" className="rw-btn rw-btn-va" onClick={guardar} disabled={pendiente || hecho} aria-label={`Sí voy al ${nombre}`} data-testid="si-voy">
        {hecho ? "Vas" : pendiente ? "Guardando…" : "Sí voy"}
      </button>
      {lento && <EstadoGuardado pendiente={pendiente} lento={lento} />}
      {error && <p className="aviso aviso-error" role="alert" style={{ margin: 0 }} data-testid="error-guardado">{error}</p>}
    </div>
  );
}
