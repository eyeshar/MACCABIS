"use client";

import { useState, useTransition } from "react";
import NombreJugador from "@/components/numeros/Nombre";
import { cambiarPorDefecto } from "./acciones";

type Persona = { person_id: string; nombre: string };

/** Panel, «Entreno del miércoles» (D146, solo gestores): quien «no suele entrenar» y no ha respondido cuenta como «no va
 *  (por defecto)». Desde aquí se pasa a cualquiera a «sin responder» solo para este entreno, y se puede deshacer. */
export default function PorDefectoEntreno({ eventoId, porDefecto, quitados }: { eventoId: string; porDefecto: Persona[]; quitados: Persona[] }) {
  const [pend, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cambiar = (p: Persona, quitar: boolean) => iniciar(async () => {
    setError(null);
    const r = await cambiarPorDefecto(eventoId, p.person_id, quitar);
    if (!r.ok) setError(r.error);
  });
  const nombres = (l: Persona[]) => l.map((p, i) => <span key={p.person_id}>{i > 0 && ", "}<NombreJugador nombre={p.nombre} personId={p.person_id} /></span>);
  if (!porDefecto.length && !quitados.length) return null;
  return (
    <div className="ev-aviso" role="note" data-testid="por-defecto" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
      {porDefecto.length > 0 && (
        <span data-testid="por-defecto-linea"><b>{porDefecto.length} no {porDefecto.length === 1 ? "va" : "van"} por defecto (no {porDefecto.length === 1 ? "suele" : "suelen"} entrenar):</b> {nombres(porDefecto)}. Si responden, manda su respuesta.</span>
      )}
      {quitados.length > 0 && (
        <span className="pequeno" data-testid="por-defecto-quitados">En «sin responder» solo en este entreno: {nombres(quitados)}.</span>
      )}
      <details>
        <summary className="pequeno" style={{ cursor: "pointer", fontWeight: 600, minHeight: 44, display: "flex", alignItems: "center" }}>Cambiar para este entreno</summary>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {porDefecto.map((p) => (
            <li key={p.person_id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ minWidth: 110 }}>{p.nombre}</span>
              <button type="button" className="boton boton-claro" style={{ minHeight: 44 }} disabled={pend} onClick={() => cambiar(p, true)} data-quitar={p.person_id}>Pasar a «sin responder»</button>
            </li>
          ))}
          {quitados.map((p) => (
            <li key={p.person_id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ minWidth: 110 }}>{p.nombre}</span>
              <button type="button" className="boton boton-contorno" style={{ minHeight: 44 }} disabled={pend} onClick={() => cambiar(p, false)} data-devolver={p.person_id}>Volver a «no va (por defecto)»</button>
            </li>
          ))}
        </ul>
        <small className="suave">Solo cambia este entreno. La marca «No suele entrenar» se cambia en <a href="/gestion/convocatoria/datos">Datos de los jugadores</a>. Los jugadores no ven nada de esto.</small>
      </details>
      {error && <span className="ev-no" role="alert">{error}</span>}
    </div>
  );
}
