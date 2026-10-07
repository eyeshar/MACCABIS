"use client";

import type { MdaResumen } from "@/lib/estadisticas/datos";
import { CajaTabla, Dash, N1, N2, NInt, NPct, NSigned1, Nota, SecH } from "./Comunes";

type J = MdaResumen["jugadores"][number];

/** Valor tal cual de la hoja; si la hoja trae un decimal donde deberia haber un entero, se marca con "?" (sin corregir). */
function Crudo({ j, k }: { j: J; k: "pts" | "p3" | "tl" | "min" }) {
  const v = j[k];
  if (v === null || v === undefined) return <Dash />;
  if (j.sospechoso && j.sospechoso.indexOf(k) >= 0) {
    return <span className="e-naranja" title="Valor no entero en la hoja de origen: revisar contra el acta">{(+v).toFixed(2)} ?</span>;
  }
  return <>{String(v)}</>;
}

// Pestaña MdA (histórico, 23/24 y 24/25): resumen de temporada del MdA desde la hoja de Carlos, anomalías marcadas "?".
export default function MdaPestana({ resumen: r }: { resumen: MdaResumen }) {
  const sinCat = r.jugadores.filter((j) => j.catalogado === false && !j.no_jugador).length;
  const cuartos = r.cuartos && r.cuartos.length ? r.cuartos : null;
  const tot = cuartos ? [0, 1, 2, 3].map((k) => cuartos.reduce((a, c) => a + (c.q[k] || 0), 0)) : [];
  const nPartidos = cuartos ? cuartos.filter((c) => c.q.some((v) => v != null)).length : 0;
  const max = Math.max(...tot, 1);
  return (
    <>
      <SecH titulo="Maccabi de Acostar — resumen de temporada" tag={`${r.jugadores.filter((j) => !j.no_jugador).length} jugadores`} />
      <Nota>
        {r.nota}
        {sinCat > 0 && <> <b>{sinCat} nombres siguen sin catalogar</b>: el diccionario de nombres del club solo cubre el MdL, asi que se muestra el mote tal cual, sin asignarle una persona.</>}
      </Nota>
      <CajaTabla>
        <table className="e-tabla" data-testid="mda-tabla">
          <thead>
            <tr>
              <th scope="col" className="e-c">#</th>
              <th scope="col">Jugador</th>
              <th scope="col" className="e-c">Pts</th>
              <th scope="col" className="e-c">Med</th>
              {r.metrics.p3 && <th scope="col" className="e-c">3P</th>}
              {r.metrics.tl && <><th scope="col" className="e-c">TL</th><th scope="col" className="e-c">TL%</th></>}
              {r.metrics.min && <><th scope="col" className="e-c">Min</th><th scope="col" className="e-c">P/min</th></>}
              {r.metrics.pm && <th scope="col" className="e-c">+/- md</th>}
              {r.metrics.asistencia && <><th scope="col" className="e-c">Part.</th><th scope="col" className="e-c">Entr.</th></>}
            </tr>
          </thead>
          <tbody>
            {r.jugadores.map((j, i) => (
              <tr key={(j.person_id ?? j.display) + i} className={j.no_jugador ? "e-dnp" : undefined}>
                <td className="e-c e-mono e-tenue">{j.no_jugador ? "" : i + 1}</td>
                <td className="e-nombre">{j.display}{j.catalogado ? "" : <> <span className="e-completo">sin catalogar</span></>}</td>
                <td className="e-c e-mono e-fuerte"><Crudo j={j} k="pts" /></td>
                <td className="e-c e-mono"><N1 v={j.avg_pts} /></td>
                {r.metrics.p3 && <td className="e-c e-mono"><Crudo j={j} k="p3" /></td>}
                {r.metrics.tl && <><td className="e-c e-mono"><Crudo j={j} k="tl" /></td><td className="e-c e-mono"><NPct v={j.tl_pct} /></td></>}
                {r.metrics.min && <><td className="e-c e-mono"><Crudo j={j} k="min" /></td><td className="e-c e-mono"><N2 v={j.pts_min} /></td></>}
                {r.metrics.pm && <td className="e-c e-mono"><NSigned1 v={j.avg_pm} /></td>}
                {r.metrics.asistencia && <><td className="e-c e-mono"><NInt v={j.asist_partidos} /></td><td className="e-c e-mono"><NInt v={j.asist_entrenos} /></td></>}
              </tr>
            ))}
          </tbody>
        </table>
      </CajaTabla>
      {cuartos && (
        <>
          <SecH titulo="Puntos por cuarto" tag={`${nPartidos} partidos`} />
          <div className="e-cuartos" data-testid="mda-cuartos">
            {tot.map((v, i) => (
              <div key={i} className="e-qbar">
                <div className="e-ql">Cuarto {i + 1}</div>
                <div className="e-qpista">
                  <div className="e-qseg"><div className="e-qbarra e-qus" style={{ width: `${Math.round((v / max) * 100)}%` }} /><span className="e-qv e-pos">{nPartidos ? (v / nPartidos).toFixed(1) : "-"}</span></div>
                </div>
              </div>
            ))}
          </div>
          <Nota>Media de puntos por cuarto del MdA. La fuente no recoge el rival ni el desglose por jugador.</Nota>
        </>
      )}
      {r.anomalias && r.anomalias.length > 0 && (
        <Nota><b className="e-naranja">{r.anomalias.length} celda(s) marcadas con &quot;?&quot;</b>: la hoja de origen trae un valor decimal donde debería haber un entero. Se transcriben tal cual, sin corregir, pendientes de revisar contra las actas.</Nota>
      )}
    </>
  );
}
