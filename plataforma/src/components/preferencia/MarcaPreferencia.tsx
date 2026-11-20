"use client";

import { useState } from "react";
import { enMadrid } from "@/lib/avisos/horario";
import { diaCorto } from "@/lib/eventos/dominio";
import { textoPreferenciaGestor } from "@/lib/respuestas/preferencia";
import "./preferencia.css";

type Eq = "MdA" | "MdL";
export type PreferenciaGestor = { equipo: Eq; motivo: string; nota: string | null; cambiado_en: string };

/** «lunes 16 a las 21:14» */
const cuando = (iso: string) => { const m = enMadrid(new Date(iso)); return `${diaCorto(m.fecha)} a las ${m.hora}`; };

/** Marca de la preferencia de partido (D194), SOLO para gestores. ★ = está (o es) el partido que prefiere; ☆ MdA = prefería
 *  el MdA y está en el otro. Al pulsarla se despliega debajo, en línea, el motivo y la nota (norma 13); otro toque la cierra.
 *  `en`: el partido donde se pinta (su equipo en el tablero, o el evento de la página de respuestas). */
export default function MarcaPreferencia({ p, en, nombre, prueba }: { p: PreferenciaGestor; en: Eq | null; nombre: string; prueba?: string }) {
  const [abierta, setAbierta] = useState(false);
  const suyo = en === p.equipo;
  const titulo = suyo ? `Prefiere el ${p.equipo}` : en ? `Prefería el ${p.equipo} (va al ${en})` : `Prefiere el ${p.equipo}`;
  return (
    <span className="pf-marca" data-testid={prueba ?? "pf-marca"} data-equipo={p.equipo}>
      <button type="button" className={`pf-estrella${suyo ? " pf-suya" : " pf-otra"}`} data-eq={p.equipo} aria-expanded={abierta}
        aria-label={`${nombre}: ${titulo.toLowerCase()}. Ver el motivo`} onClick={() => setAbierta((x) => !x)}>
        {suyo ? "★" : `☆ ${p.equipo}`}
      </button>
      {abierta && (
        <span className="pf-desp" data-eq={p.equipo} role="region" aria-label={`Preferencia de ${nombre}`} data-testid="pf-desplegado">
          <b>{titulo}</b>
          <span>{textoPreferenciaGestor(p)}</span>
          <small>Lo dijo el {cuando(p.cambiado_en)}</small>
          <button type="button" className="pf-cerrar" onClick={() => setAbierta(false)}>Cerrar</button>
        </span>
      )}
    </span>
  );
}

/** Leyenda (una línea) para las pantallas con marcas. */
export function LeyendaPreferencia() {
  return <p className="pf-leyenda" data-testid="pf-leyenda"><b className="pf-l-suya">★</b> está en el partido que prefiere · <b>☆ MdA</b> = prefería el MdA (está en el otro)</p>;
}
