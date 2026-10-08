"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { responder, responderDomingo } from "@/app/mi-zona/respuestas-acciones";
import type { MotivoJugador } from "@/lib/respuestas/dominio";
import HojaNoVoy from "./HojaNoVoy";

type Actual = "va" | "duda" | "no" | null;

// Voy (verde) · No voy (rojo) · Duda (azul), en la tarjeta o en grande en el evento (D99, 3.2 y 3.3). «No voy» abre la
// hoja de motivo. Un domingo con dos partidos a horas distintas no se responde aqui: abre el domingo.
export default function Responder({ eventoId, fecha, domingo, actual, nombre, grande, motivo, detalle, urlDomingo }: {
  eventoId?: string; fecha?: string; domingo?: boolean; actual: Actual; nombre: string; grande?: boolean;
  motivo?: MotivoJugador | null; detalle?: string | null; urlDomingo?: string;
}) {
  const router = useRouter();
  const [hoja, setHoja] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marcada, setMarcada] = useState<Actual>(actual);
  const [pendiente, empezar] = useTransition();

  if (urlDomingo) {
    return <Link href={urlDomingo} className={`boton boton-amarillo rw-abrir${grande ? " grande" : ""}`}>Responder al domingo</Link>;
  }

  const guardar = (r: "va" | "duda" | "no", m?: MotivoJugador, d?: string) => empezar(async () => {
    setError(null);
    const res = domingo && fecha
      ? await responderDomingo(fecha, r === "va" ? "voy" : r, null, m ?? null, d ?? null)
      : await responder(eventoId!, r, m ?? null, d ?? null);
    if (!res.ok) { setError(res.error); return; }
    setMarcada(r); setHoja(false); router.refresh();
  });

  const B = ({ r, texto, clase }: { r: "va" | "duda" | "no"; texto: string; clase: string }) => (
    <button type="button" className={`rw-btn ${clase}${marcada === r ? " marcada" : ""}`} aria-pressed={marcada === r} disabled={pendiente}
      onClick={() => (r === "no" ? (setError(null), setHoja(true)) : guardar(r))}>
      {texto}
    </button>
  );
  return (
    <div className={`rw-responder${grande ? " grande" : ""}`}>
      <div className="rw-botones" role="group" aria-label={`¿Vas al ${nombre}?`}>
        <B r="va" texto="Voy" clase="rw-btn-va" />
        <B r="no" texto="No voy" clase="rw-btn-no" />
        <B r="duda" texto="Duda" clase="rw-btn-duda" />
      </div>
      {error && !hoja && <p className="aviso aviso-error" role="alert" style={{ margin: 0 }}>{error}</p>}
      <HojaNoVoy abierta={hoja} titulo={nombre} motivoInicial={marcada === "no" ? motivo : null} detalleInicial={marcada === "no" ? detalle : null}
        guardando={pendiente} error={hoja ? error : null} onCerrar={() => setHoja(false)} onGuardar={(m, d) => guardar("no", m, d)} />
    </div>
  );
}
