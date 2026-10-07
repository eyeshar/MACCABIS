"use client";

import { useState } from "react";
import { resumenCuartos, type FiltroEq, type QStats } from "@/lib/estadisticas/calculo";
import { Control, Kpi, Nota, OPCIONES_EQUIPO, SecH, Segmento, Vacio } from "./Comunes";

// Pestaña Por cuartos: media de puntos por cuarto a nivel de equipo (dato de las actas).
export default function CuartosPestana({ qstats, multiEquipo }: { qstats: Record<string, QStats>; multiEquipo: boolean }) {
  const [equipo, setEquipo] = useState<FiltroEq>("ALL");
  const d = qstats[equipo];
  const r = d ? resumenCuartos(d) : null;
  const nombre = equipo === "ALL" ? "Maccabis" : equipo;
  return (
    <>
      {multiEquipo && <div className="e-controles"><Control etiqueta="Equipo"><Segmento etiqueta="Equipo" valor={equipo} opciones={OPCIONES_EQUIPO} onCambia={setEquipo} /></Control></div>}
      <SecH titulo="Rendimiento por cuartos" tag={d ? `${d.n} partidos` : undefined} />
      {!d || !r ? <Vacio>Sin datos.</Vacio> : (
        <>
          <div className="e-kpis" data-testid="cuartos-kpis">
            <Kpi tono="accent" lab="Mejor cuarto" val={`Q${r.mejor}`} foot={`${d.us[r.mejor - 1]} pts de media`} />
            <Kpi tono="grape" lab="1er cuarto" val={d.us[0]} foot="anotados de media" />
            <Kpi tono="gold" lab="4º cuarto" val={d.us[3]} foot="anotados de media" />
            <Kpi lab="Peor defensa" val={`Q${r.peorDef}`} foot={`${d.them[r.peorDef - 1]} encajados`} />
          </div>
          <SecH titulo="Anotados vs encajados por cuarto" />
          <div className="e-cuartos" data-testid="cuartos-grafico">
            <div className="e-leyenda">
              <span><b className="e-leyenda-us" />{nombre}</span>
              <span><b className="e-leyenda-ellos" />Rival</span>
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="e-qbar">
                <div className="e-ql">Cuarto {i + 1}</div>
                <div className="e-qpista">
                  <div className="e-qseg"><div className="e-qbarra e-qus" style={{ width: `${r.ancho(d.us[i])}%` }} /><span className="e-qv e-pos">{d.us[i]}</span></div>
                  <div className="e-qseg"><div className="e-qbarra e-qellos" style={{ width: `${r.ancho(d.them[i])}%` }} /><span className="e-qv e-tenue">{d.them[i]}</span></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <Nota>Media de puntos por cuarto a nivel de equipo (dato de las actas). No existe desglose por jugador y cuarto en ninguna fuente.</Nota>
    </>
  );
}
