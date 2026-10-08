"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { responderDomingo } from "@/app/mi-zona/respuestas-acciones";
import type { MotivoJugador, OpcionDomingo } from "@/lib/respuestas/dominio";
import HojaNoVoy from "./HojaNoVoy";

// «¿Puedes jugar?» del domingo (D99.3): una sola respuesta para los dos partidos. «No voy» pide motivo.
export default function ElegirDomingo({ fecha, opciones, actual, nombre, motivo, detalle }: {
  fecha: string; opciones: OpcionDomingo[]; actual: string | null; nombre: string; motivo?: MotivoJugador | null; detalle?: string | null;
}) {
  const router = useRouter();
  const [marcada, setMarcada] = useState(actual);
  const [hoja, setHoja] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const refNo = useRef<HTMLButtonElement>(null);
  const guardar = (o: OpcionDomingo, m?: MotivoJugador, d?: string) => empezar(async () => {
    setError(null);
    const r = await responderDomingo(fecha, o.opcion, o.evento ?? null, m ?? null, d ?? null);
    if (!r.ok) { setError(r.error); return; }
    setMarcada(o.id); setHoja(false); router.refresh();
  });
  const clase = (o: OpcionDomingo) => (o.opcion === "no" ? "rw-btn-no" : o.opcion === "duda" ? "rw-btn-duda" : "rw-btn-va");
  return (
    <div className="rw-domingo-opciones" role="group" aria-label="¿Puedes jugar?">
      {opciones.map((o) => (
        <button key={o.id} ref={o.opcion === "no" ? refNo : undefined} type="button" className={`rw-btn rw-opcion ${clase(o)}${marcada === o.id ? " marcada" : ""}`} aria-pressed={marcada === o.id} disabled={pendiente}
          onClick={() => (o.opcion === "no" ? (setError(null), setHoja(true)) : guardar(o))}>
          {o.texto}
        </button>
      ))}
      {error && !hoja && <p className="aviso aviso-error" role="alert" style={{ margin: 0 }}>{error}</p>}
      <HojaNoVoy abierta={hoja} titulo={nombre} motivoInicial={marcada === "no" ? motivo : null} detalleInicial={marcada === "no" ? detalle : null} guardando={pendiente} volverA={refNo}
        error={hoja ? error : null} onCerrar={() => setHoja(false)} onGuardar={(m, d) => guardar(opciones.find((x) => x.opcion === "no")!, m, d)} />
    </div>
  );
}
