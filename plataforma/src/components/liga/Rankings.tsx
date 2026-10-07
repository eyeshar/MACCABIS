"use client";

import Link from "next/link";
import { useState } from "react";
import { metricasDeRanking, nombreCorto, topRanking, type FiltroEq, type JugadorEst, type Metricas } from "@/lib/estadisticas/calculo";
import { Control, Nota, OPCIONES_EQUIPO, Segmento } from "./Comunes";

// Pestaña Rankings: top 5 / top 10 por métrica, con barras. Totales de la temporada (partidos con minutos).
export default function RankingsPestana({ jugadores, M, multiEquipo, temporada }: {
  jugadores: JugadorEst[]; M: Metricas; multiEquipo: boolean; temporada?: string;
}) {
  const [equipo, setEquipo] = useState<FiltroEq>("ALL");
  const [n, setN] = useState<5 | 10>(10);
  return (
    <>
      <div className="e-controles">
        {multiEquipo && <Control etiqueta="Equipo"><Segmento etiqueta="Equipo" valor={equipo} opciones={OPCIONES_EQUIPO} onCambia={setEquipo} /></Control>}
        <Control etiqueta="Tamaño"><Segmento etiqueta="Tamaño" valor={n} opciones={[{ v: 5, t: "Top 5" }, { v: 10, t: "Top 10" }]} onCambia={(v) => setN(v as 5 | 10)} /></Control>
      </div>
      <div className="e-rankgrid" data-testid="rankings">
        {metricasDeRanking(M).map((m) => (
          <section key={m.lab} className="e-rankcard" aria-label={m.lab}>
            <h3>{m.lab}<span>top {n}</span></h3>
            {topRanking(jugadores, m, equipo, n).map((f) => {
              const nombre = f.jugador.display || nombreCorto(f.jugador.nombre);
              return (
                <div key={f.jugador.person_id + f.pos} className={`e-rankrow${f.pos === 1 ? " e-top1" : ""}`}>
                  <span className="e-rank-pos">{f.pos}</span>
                  <span className="e-rank-nom">{temporada ? <Link href={`/jugador/${f.jugador.person_id}?t=${temporada}`} className="e-enlace-nombre">{nombre}</Link> : nombre}</span>
                  <span className="e-barra"><span style={{ width: `${f.ancho}%` }} /></span>
                  <span className="e-rank-val">{f.texto}</span>
                </div>
              );
            })}
          </section>
        ))}
      </div>
      <Nota>Totales de la temporada (partidos con minutos).</Nota>
    </>
  );
}
