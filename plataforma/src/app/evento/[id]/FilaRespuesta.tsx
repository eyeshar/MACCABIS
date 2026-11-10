"use client";

import { useState, type ReactNode } from "react";

/** Una fila de «Respuestas» del evento (gestor). En el escritorio, la tabla de siempre. En el móvil (≤ 640 px), una línea
 *  por persona —nombre, estado y motivo— y el resto (origen, avisos, cambiar a mano, responder por él) al tocar «Detalle»
 *  (D189: la tabla del móvil era una tarjeta larga por persona). */
export default function FilaRespuesta({ clase, etiqueta, nombre, estado, motivo, children }: {
  clase: string; etiqueta: string; nombre: ReactNode; estado: ReactNode; motivo: string | null; children: ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);
  return (
    <tr data-respuesta={clase} data-abierta={abierta} className="ev-fila">
      <td data-label="Jugador" className="ev-fila-cab">
        <span className={`ev-resp ev-resp-${clase === "sin_responder" ? "sin" : clase}`}>{nombre}</span>
        <span className="ev-fila-resumen">{estado}{motivo && <small>{motivo}</small>}</span>
        <button type="button" className="ev-fila-detalle" aria-expanded={abierta} aria-label={`Detalle de ${etiqueta}`} onClick={() => setAbierta((a) => !a)}>
          <span aria-hidden="true">{abierta ? "▴" : "▾"}</span>
        </button>
      </td>
      {children}
    </tr>
  );
}
