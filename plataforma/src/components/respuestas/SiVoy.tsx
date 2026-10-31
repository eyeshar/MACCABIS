"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { responder } from "@/app/mi-zona/respuestas-acciones";

// «Sí voy» (D151): a quien le hemos puesto «No vas (puesto por defecto)» en un entreno. Guarda «Voy» con la misma accion
// que el resto de respuestas (la base vuelve a comprobar interruptor, invitacion y que el entreno siga abierto).
export default function SiVoy({ eventoId, nombre, grande }: { eventoId: string; nombre: string; grande?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);
  const [pendiente, empezar] = useTransition();
  const guardar = () => empezar(async () => {
    setError(null);
    const r = await responder(eventoId, "va");
    if (!r.ok) { setError(r.error); return; }
    setHecho(true); router.refresh();
  });
  return (
    <div className={`rw-sivoy${grande ? " grande" : ""}`}>
      <button type="button" className="rw-btn rw-btn-va" onClick={guardar} disabled={pendiente || hecho} aria-label={`Sí voy al ${nombre}`} data-testid="si-voy">
        {hecho ? "Vas" : pendiente ? "Guardando…" : "Sí voy"}
      </button>
      {error && <p className="aviso aviso-error" role="alert" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
