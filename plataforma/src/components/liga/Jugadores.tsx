"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { jugadoresFiltrados, nombreCorto, type ClaveJugador, type Eq, type FiltroEq, type JugadorEst, type Metricas } from "@/lib/estadisticas/calculo";
import { CajaTabla, ChipEquipo, Control, N1, N2, NInt, NPct, NSigned, NSigned1, Nota, OPCIONES_EQUIPO, SecH, Segmento, Nz } from "./Comunes";

// Pestaña Jugadores: la plantilla de la temporada, ordenable por cualquier columna. PJ = partidos con minutos (los DNP no
// cuentan en las medias). `fichaHref`, si se da, enlaza el nombre con la ficha del jugador (por person_id).
export default function JugadoresPestana({ jugadores, M, multiEquipo, temporada }: {
  jugadores: JugadorEst[]; M: Metricas; multiEquipo: boolean; temporada?: string;
}) {
  const [equipo, setEquipo] = useState<FiltroEq>("ALL");
  const [minpj, setMinpj] = useState(1);
  const [orden, setOrden] = useState<{ k: ClaveJugador; d: 1 | -1 }>({ k: "pts", d: -1 });
  const maxPj = Math.max(1, ...jugadores.map((p) => p.pj));
  const a = useMemo(() => jugadoresFiltrados(jugadores, { equipo, minpj, k: orden.k, d: orden.d }, M), [jugadores, equipo, minpj, orden, M]);
  const ordenaPor = (k: ClaveJugador) => {
    if (k === "rank") return;
    setOrden((o) => (o.k === k ? { k, d: (o.d * -1) as 1 | -1 } : { k, d: k === "nombre" ? 1 : -1 }));
  };
  const th = (k: ClaveJugador, texto: string, extra = "") => (
    <th scope="col" className={`${extra} ${orden.k === k ? "e-ordenada" : ""}`.trim()} aria-sort={orden.k === k ? (orden.d === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" className="e-th-boton" onClick={() => ordenaPor(k)}>{texto}</button>
    </th>
  );
  const columnas = 4 + (multiEquipo ? 1 : 0) + (M.min ? 2 : 0) + (M.p2 ? 1 : 0) + (M.p3 ? 1 : 0) + (M.tl ? 1 : 0) + (M.fc ? 1 : 0) + (M.val ? 1 : 0) + (M.pm ? 2 : 0) + 1;

  return (
    <>
      <div className="e-controles">
        {multiEquipo && <Control etiqueta="Equipo"><Segmento etiqueta="Equipo" valor={equipo} opciones={OPCIONES_EQUIPO} onCambia={setEquipo} /></Control>}
        <Control etiqueta="Mínimo de partidos jugados">
          <div className="e-rango">
            <input type="range" min={1} max={maxPj} value={Math.min(minpj, maxPj)} onChange={(e) => setMinpj(+e.target.value)} aria-label="Mínimo de partidos jugados" />
            <span className="e-rango-val">{Math.min(minpj, maxPj)}+</span>
          </div>
        </Control>
      </div>

      <SecH titulo="Ranking de plantilla" tag={`${a.length} jugadores`} />
      <CajaTabla>
        <table className="e-tabla" data-testid="jugadores-tabla">
          <thead>
            <tr>
              <th scope="col" className="e-c">#</th>
              {th("nombre", "Jugador")}
              {multiEquipo && <th scope="col" className="e-oculta-sm">Eq</th>}
              {th("pj", "PJ", "e-c")}
              {th("pts", "Pts", "e-c")}
              {th("ppg", "Med", "e-c")}
              {M.min && th("min", "Min", "e-c")}
              {M.min && th("ppm", "P/min", "e-c")}
              {M.p2 && th("p2", M.p2_intentos ? "2P%" : "2P", "e-c")}
              {M.p3 && th("p3", M.p3_intentos ? "3P%" : "3P", "e-c")}
              {M.tl && th("tl", "TL%", "e-c")}
              {M.fc && th("fc", "FC", "e-c")}
              {M.val && th("val", "VAL", "e-c")}
              {M.pm && th("pmt", "+/- ac", "e-c")}
              {M.pm && th("pm", "+/- md", "e-c")}
            </tr>
          </thead>
          <tbody>
            {a.length === 0 && <tr><td colSpan={columnas} className="e-vacio">Sin jugadores.</td></tr>}
            {a.map((p, i) => {
              const a2 = p.avg || ({} as NonNullable<JugadorEst["avg"]>);
              const nombre = p.display || nombreCorto(p.nombre);
              return (
                <tr key={p.person_id + i}>
                  <td className="e-c e-mono e-tenue">{i + 1}</td>
                  <td className="e-nombre">
                    {temporada ? <Link href={`/jugador/${p.person_id}?t=${temporada}`} className="e-enlace-nombre">{nombre}</Link> : nombre}
                    {p.dorsales && p.dorsales.length > 0 && <> <span className="e-completo">#{p.dorsales.join("/")}</span></>}
                  </td>
                  {multiEquipo && <td className="e-oculta-sm">{p.equipos.map((e: Eq, k) => <Fragment key={e}>{k > 0 && " "}<ChipEquipo equipo={e} corto /></Fragment>)}</td>}
                  <td className="e-c e-mono">{p.pj}</td>
                  <td className="e-c e-mono">{p.tot.pts}</td>
                  <td className="e-c e-mono"><N1 v={a2.pts} /></td>
                  {M.min && <td className="e-c e-mono"><Nz v={a2.min} f={(x) => x.toFixed(1) + "'"} /></td>}
                  {M.min && <td className="e-c e-mono"><N2 v={p.ppm} /></td>}
                  {M.p2 && <td className="e-c e-mono">{M.p2_intentos ? <NPct v={p.p2_pct} /> : <NInt v={p.tot.p2a} />}</td>}
                  {M.p3 && <td className="e-c e-mono">{M.p3_intentos ? <NPct v={p.p3_pct} /> : <NInt v={p.tot.p3a} />}</td>}
                  {M.tl && <td className="e-c e-mono"><NPct v={p.tl_pct} /></td>}
                  {M.fc && <td className="e-c e-mono"><NInt v={p.tot.fc} /></td>}
                  {M.val && <td className="e-c e-mono"><NInt v={p.tot.val} /></td>}
                  {M.pm && <td className="e-c e-mono"><NSigned v={p.pm_total} /></td>}
                  {M.pm && <td className="e-c e-mono"><NSigned1 v={a2.pm} /></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CajaTabla>
      {M.min ? (
        <Nota>Pincha en cualquier cabecera para ordenar por esa columna. PJ = partidos con minutos (los DNP no cuentan en las medias). +/- ac = acumulado (suma) · +/- md = medio por partido · P/min = puntos por minuto.</Nota>
      ) : (
        <Nota>Pincha en cualquier cabecera para ordenar por esa columna. En esta temporada no hay minutos registrados: <b>las medias son por partido jugado</b> y los &quot;NJ&quot; (No Jugó) no entran en el denominador.</Nota>
      )}
    </>
  );
}
