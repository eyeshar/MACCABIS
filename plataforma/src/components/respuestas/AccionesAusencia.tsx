"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { borrarAusencia, cerrarAusencia } from "@/app/mi-zona/respuestas-acciones";

// Botones de cada ausencia (D99, 3.6): «Ya puedo volver» (sin fecha de vuelta), «Editar» y «Borrar» (con confirmacion).
export default function AccionesAusencia({ id, abierta }: { id: string; abierta: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const hacer = (f: () => Promise<{ ok: boolean; error?: string }>, pregunta: string) => {
    if (!window.confirm(pregunta)) return;
    empezar(async () => { const r = await f(); if (!r.ok) setError(r.error ?? "No se pudo."); else router.refresh(); });
  };
  return (
    <div className="botones rw-aus-botones">
      {abierta && <button type="button" className="boton boton-amarillo" disabled={pendiente} onClick={() => hacer(() => cerrarAusencia(id), "¿Ya puedes volver? Desde hoy te volveremos a preguntar.")}>Ya puedo volver</button>}
      <Link className="boton boton-claro" href={`/mi-zona/ausencias/${id}`}>Editar</Link>
      <button type="button" className="boton boton-claro" disabled={pendiente} onClick={() => hacer(() => borrarAusencia(id), "¿Borrar esta ausencia? Esos eventos vuelven a «sin responder».")}>Borrar</button>
      {error && <p className="aviso aviso-error" role="alert" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
