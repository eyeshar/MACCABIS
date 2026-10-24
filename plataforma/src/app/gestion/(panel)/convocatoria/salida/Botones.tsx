"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { avisarAhora, marcar } from "../acciones";

/** «Ya lo he pegado en el grupo» (WhatsApp) / «Marcar como copiado» (SportEasy), con confirmacion. */
export function BotonMarcar({ fecha, que, texto }: { fecha: string; que: "whatsapp" | "sporteasy"; texto: string }) {
  const router = useRouter();
  const [pend, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const pregunta = que === "whatsapp" ? "¿Confirmas que el mensaje ya está en el grupo de WhatsApp?" : "¿Confirmas que la convocatoria ya está copiada en SportEasy (sin notificar)?";
  return (
    <div>
      <button type="button" className="boton boton-amarillo" disabled={pend} onClick={() => { if (window.confirm(pregunta)) iniciar(async () => { const r = await marcar(fecha, que); if (r.ok) router.refresh(); else setError(r.error); }); }}>{texto}</button>
      {error && <p className="aviso aviso-error" role="alert">{error}</p>}
    </div>
  );
}

/** «Enviar ahora» el aviso «Estás convocado» (solo funciona con el interruptor encendido). */
export function BotonAvisar({ fecha }: { fecha: string }) {
  const router = useRouter();
  const [pend, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  return (
    <div>
      <button type="button" className="boton boton-amarillo" disabled={pend} onClick={() => iniciar(async () => { const r = await avisarAhora(fecha); setMsg(r.ok ? { ok: true, t: r.texto ?? "Enviado." } : { ok: false, t: r.error }); router.refresh(); })}>Enviar ahora</button>
      {msg && <p className={`aviso ${msg.ok ? "aviso-ok" : "aviso-error"}`} role="status">{msg.t}</p>}
    </div>
  );
}
