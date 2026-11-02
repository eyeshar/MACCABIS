"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import CopiarTexto from "../../eventos/CopiarTexto";
import { avisarAhora, copiado, reenviar } from "../acciones";

/** El WhatsApp del grupo con «Copiar mensaje» (D173: sin «Ya lo he pegado» ni estados; al copiar se apunta lo copiado para
 *  que el siguiente mensaje empiece por lo que cambie). Sin botón de compartir: Iván lo pega a mano. */
export function CopiarWhatsapp({ fecha, texto }: { fecha: string; texto: string }) {
  return <CopiarTexto texto={texto} etiqueta="Copiar mensaje" id="cv-mensaje" alCopiar={() => { void copiado(fecha); }} />;
}

/** «Avisar del cambio» (tras cambiar una convocatoria ya avisada) o «Reenviar» (solo los avisos que fallaron). */
export function BotonAviso({ fecha, que, etiqueta }: { fecha: string; que: "cambio" | "reenviar"; etiqueta?: string }) {
  const router = useRouter();
  const [pend, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const accion = que === "cambio" ? avisarAhora : reenviar;
  return (
    <div>
      <button type="button" className={`boton ${que === "cambio" ? "boton-amarillo" : "boton-contorno"}`} disabled={pend}
        onClick={() => iniciar(async () => { const r = await accion(fecha); setMsg(r.ok ? { ok: true, t: r.texto ?? "Hecho." } : { ok: false, t: r.error }); router.refresh(); })}>
        {etiqueta ?? (que === "cambio" ? "Avisar del cambio" : "Reenviar")}
      </button>
      {msg && <p className={`aviso ${msg.ok ? "aviso-ok" : "aviso-error"}`} role="status">{msg.t}</p>}
    </div>
  );
}
