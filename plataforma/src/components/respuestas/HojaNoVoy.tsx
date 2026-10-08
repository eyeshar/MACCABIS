"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { MOTIVOS_JUGADOR, type MotivoJugador } from "@/lib/respuestas/dominio";

// Hoja «No voy» (D99, 3.4): dialogo modal accesible (<dialog> nativo: encierra el foco, Esc lo cierra y devuelve el foco
// a quien lo abrio). El motivo es obligatorio: «Guardar «no voy»» esta desactivado hasta elegirlo. Solo lo ven los
// gestores (D46, D82).
export default function HojaNoVoy({ abierta, titulo, motivoInicial, detalleInicial, guardando, error, onCerrar, onGuardar, volverA }: {
  abierta: boolean; titulo: string; motivoInicial?: MotivoJugador | null; detalleInicial?: string | null; guardando?: boolean; error?: string | null;
  onCerrar: () => void; onGuardar: (motivo: MotivoJugador, detalle: string) => void;
  /** Boton que la abrio: recibe el foco al cerrar (un toque en el movil no siempre le da el foco). */
  volverA?: React.RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [motivo, setMotivo] = useState<MotivoJugador | null>(motivoInicial ?? null);
  const [detalle, setDetalle] = useState(detalleInicial ?? "");
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierta && !d.open) { setMotivo(motivoInicial ?? null); setDetalle(detalleInicial ?? ""); d.showModal(); }
    if (!abierta && d.open) { d.close(); volverA?.current?.focus(); }
  }, [abierta, motivoInicial, detalleInicial, volverA]);
  return (
    <dialog ref={ref} className="rw-hoja" aria-labelledby={`${id}-t`} onClose={onCerrar} onCancel={(e) => { e.preventDefault(); onCerrar(); }}
      onClick={(e) => { if (e.target === ref.current) onCerrar(); }}>
      <form method="dialog" className="rw-hoja-dentro" onSubmit={(e) => { e.preventDefault(); if (motivo) onGuardar(motivo, detalle); }}>
        <span className="rw-hoja-asa" aria-hidden="true" />
        <h2 id={`${id}-t`}>No voy al {titulo}</h2>
        <fieldset className="rw-motivos">
          <legend>¿Por qué? Elige uno. <span className="tenue">Solo lo ven los gestores.</span></legend>
          {MOTIVOS_JUGADOR.map((m) => (
            <label key={m.id} className={`rw-motivo${motivo === m.id ? " elegido" : ""}`}>
              <input type="radio" name="motivo" value={m.id} checked={motivo === m.id} onChange={() => setMotivo(m.id)} required />
              <span>{m.texto}</span>
            </label>
          ))}
        </fieldset>
        <label className="rw-detalle">
          <span>Detalle <span className="tenue">(opcional)</span></span>
          <input type="text" maxLength={120} placeholder="Ej.: turno de tarde" value={detalle} onChange={(e) => setDetalle(e.target.value)} />
        </label>
        <Link href="/mi-zona/ausencias/nueva" className="rw-enlace">¿Faltas varios días? Marca una ausencia</Link>
        {error && <p className="aviso aviso-error" role="alert" style={{ margin: 0 }}>{error}</p>}
        <div className="rw-hoja-botones">
          <button type="button" className="boton boton-claro" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="boton rw-btn-no" disabled={!motivo || guardando} aria-disabled={!motivo || guardando}>
            {guardando ? "Guardando…" : "Guardar «no voy»"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
