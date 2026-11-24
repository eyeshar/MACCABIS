"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { responderDomingo } from "@/app/mi-zona/respuestas-acciones";
import type { MotivoJugador, OpcionDomingo } from "@/lib/respuestas/dominio";
import HojaNoVoy from "./HojaNoVoy";
import { EstadoGuardado, useGuardado } from "./useGuardado";
import PreferenciaDomingo, { type PartidoPref, type PrefGuardada } from "@/components/preferencia/PreferenciaDomingo";
import { muestraPreferencia } from "@/lib/respuestas/preferencia";

// «¿Puedes jugar?» del domingo (D99.3): una sola respuesta para los dos partidos. «No voy» pide motivo.
export default function ElegirDomingo({ fecha, opciones, actual, nombre, motivo, detalle, preferencia }: {
  fecha: string; opciones: OpcionDomingo[]; actual: string | null; nombre: string; motivo?: MotivoJugador | null; detalle?: string | null;
  /** D194: los dos partidos (si tiene las dos fichas) y su preferencia guardada; sin esto, no sale el bloque. */
  preferencia?: { partidos: PartidoPref[]; guardada: PrefGuardada; mismaHora: boolean } | null;
}) {
  const router = useRouter();
  const [marcada, setMarcada] = useState(actual);
  const [hoja, setHoja] = useState(false);
  // D199: se marca solo con el servidor confirmando; un fallo recarga o se ve (useGuardado).
  const { pendiente, lento, error, setError, guardar: guardarConfirmado } = useGuardado();
  const refNo = useRef<HTMLButtonElement>(null);
  const guardar = (o: OpcionDomingo, m?: MotivoJugador, d?: string) => guardarConfirmado(
    () => responderDomingo(fecha, o.opcion, o.evento ?? null, m ?? null, d ?? null),
    () => { setMarcada(o.id); setHoja(false); router.refresh(); },
  );
  const clase = (o: OpcionDomingo) => (o.opcion === "no" ? "rw-btn-no" : o.opcion === "duda" ? "rw-btn-duda" : "rw-btn-va");
  return (
    <div className="rw-domingo-opciones" role="group" aria-label="¿Puedes jugar?">
      {opciones.map((o) => [
        <button key={o.id} ref={o.opcion === "no" ? refNo : undefined} type="button" className={`rw-btn rw-opcion ${clase(o)}${marcada === o.id ? " marcada" : ""}`} aria-pressed={marcada === o.id} disabled={pendiente}
          onClick={() => (o.opcion === "no" ? (setError(null), setHoja(true)) : guardar(o))}>
          {o.texto}
        </button>,
        // D194: «¿Prefieres alguno?» justo debajo de «A los dos» (o de «Voy» a la misma hora), solo si es la marcada.
        preferencia && marcada === o.id && muestraPreferencia(preferencia.partidos.length, o.opcion)
          ? <PreferenciaDomingo key={`pref-${o.id}`} fecha={fecha} partidos={preferencia.partidos} guardada={preferencia.guardada} mismaHora={preferencia.mismaHora} />
          : null,
      ])}
      {!hoja && <EstadoGuardado pendiente={pendiente} lento={lento} />}
      {error && !hoja && <p className="aviso aviso-error" role="alert" style={{ margin: 0 }} data-testid="error-guardado">{error}</p>}
      <HojaNoVoy abierta={hoja} titulo={nombre} motivoInicial={marcada === "no" ? motivo : null} detalleInicial={marcada === "no" ? detalle : null} guardando={pendiente} volverA={refNo}
        error={hoja ? error : null} onCerrar={() => setHoja(false)} onGuardar={(m, d) => guardar(opciones.find((x) => x.opcion === "no")!, m, d)} />
    </div>
  );
}
