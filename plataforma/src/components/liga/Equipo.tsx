"use client";

import { Fragment, useMemo, useState } from "react";
import {
  esPO, minutos, nombreCorto, ordenarPartidos, partidosFiltrados, resumenEquipo, sinPO,
  type ClavePartido, type Eq, type FilaBox, type FiltroEq, type Metricas, type PartidoEst,
} from "@/lib/estadisticas/calculo";
import { ChipEquipo, CajaTabla, Control, Dash, Kpi, NInt, NSigned, Nota, OPCIONES_EQUIPO, SecH, Segmento, Tiros } from "./Comunes";

// Pestaña Equipo: balance, puntos a favor y en contra, racha y tabla de partidos ordenable con boxscore desplegable.
export default function EquipoPestana({ partidos, box, M, equipos }: {
  partidos: PartidoEst[]; box: Record<string, FilaBox[]>; M: Metricas; equipos: Eq[];
}) {
  const [equipo, setEquipo] = useState<FiltroEq>("ALL");
  const [comp, setComp] = useState<"ALL" | "LIGA" | "PO">("ALL");
  const [orden, setOrden] = useState<{ k: ClavePartido; d: 1 | -1 }>({ k: "fecha", d: 1 });
  const [abierto, setAbierto] = useState<string | null>(null);
  const multi = equipos.length > 1;
  const hayPO = partidos.some(esPO);

  const a = useMemo(() => partidosFiltrados(partidos, { equipo, comp }, M.fecha), [partidos, equipo, comp, M.fecha]);
  const r = useMemo(() => resumenEquipo(a), [a]);
  const filas = useMemo(() => ordenarPartidos(a, orden.k, orden.d, M.fecha), [a, orden, M.fecha]);
  const ordenaPor = (k: ClavePartido) => setOrden((o) => (o.k === k ? { k, d: (o.d * -1) as 1 | -1 } : { k, d: 1 }));
  const clave = (p: PartidoEst) => `${p.pn}_${p.equipo}`;

  const etiquetaEquipos = equipo === "ALL" ? (multi ? "MdA + MdL" : equipos[0] === "MDA" ? "MdA" : "MdL") : equipo;
  const th = (k: ClavePartido, texto: string, extra = "") => (
    <th scope="col" className={`${extra} ${orden.k === k ? "e-ordenada" : ""}`.trim()} aria-sort={orden.k === k ? (orden.d === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" className="e-th-boton" onClick={() => ordenaPor(k)}>{texto}</button>
    </th>
  );

  return (
    <>
      {(multi || hayPO) && (
        <div className="e-controles">
          {multi && <Control etiqueta="Equipo"><Segmento etiqueta="Equipo" valor={equipo} opciones={OPCIONES_EQUIPO} onCambia={(v) => { setEquipo(v); setAbierto(null); }} /></Control>}
          {hayPO && (
            <Control etiqueta="Competición">
              <Segmento etiqueta="Competición" valor={comp} onCambia={(v) => { setComp(v); setAbierto(null); }}
                opciones={[{ v: "ALL", t: "Todo" }, { v: "LIGA", t: "Liga" }, { v: "PO", t: "Playoff" }]} />
            </Control>
          )}
        </div>
      )}

      <div className="e-kpis" data-testid="equipo-kpis">
        <Kpi tono="win" lab="Balance" val={`${r.g}-${r.l}`} foot={`${r.pct}% victorias`} />
        <Kpi tono="accent" lab="Partidos" val={a.length} foot={etiquetaEquipos} />
        <Kpi lab="Puntos a favor" val={r.pf} foot={`media ${r.af.toFixed(1)}/pj`} />
        <Kpi lab="Puntos en contra" val={r.pc} foot={`media ${r.ac.toFixed(1)}/pj`} />
        <Kpi tono="gold" lab="Diferencial" val={(r.pf - r.pc >= 0 ? "+" : "") + (r.pf - r.pc)} foot="temporada" />
        <Kpi tono="grape" lab="Mejor victoria" val={r.mejor ? "+" + (r.mejor.pf - r.mejor.pc) : "—"} foot={r.mejor ? "vs " + sinPO(r.mejor.rival) : ""} />
      </div>

      <SecH titulo="Racha de resultados" tag={`${r.g}G · ${r.l}P`} />
      <div className="e-racha" data-testid="equipo-racha">
        {a.map((p) => (
          <div key={clave(p) + p.fecha} className={`e-pastilla e-pastilla-${p.res}`} tabIndex={0}>
            {p.res}
            <span className="e-tip">{(p.fecha ? p.fecha.slice(5) : "J" + p.pn) + " · " + sinPO(p.rival) + " · " + (p.incomp ? "inc." : p.pf + "-" + p.pc)}</span>
          </div>
        ))}
      </div>

      <SecH titulo="Partidos" tag={`${a.length} partidos`} />
      <CajaTabla>
        <table className="e-tabla" data-testid="equipo-partidos">
          <thead>
            <tr>
              {th("fecha", M.fecha ? "Fecha" : "Jorn.")}
              {th("equipo", "Eq")}
              {th("rival", "Rival")}
              {th("pf", "Marcador", "e-c")}
              {th("res", "Res", "e-c")}
              {th("dif", "Dif", "e-c e-oculta-sm")}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={6} className="e-vacio">Sin partidos.</td></tr>}
            {filas.map((p) => {
              const dif = p.pf - p.pc;
              const k = clave(p);
              const tieneBox = !!box[k];
              const abrible = !p.incomp && !!p.pn && tieneBox;
              const cuando = M.fecha ? p.fecha : "J" + p.pn;
              const alAbrir = () => setAbierto((x) => (x === k ? null : k));
              return (
                <Fragment key={k + (p.fecha ?? "")}>
                  <tr
                    className={abrible ? "e-fila-click" : undefined}
                    {...(abrible ? { onClick: alAbrir, tabIndex: 0, role: "button", "aria-expanded": abierto === k, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); alAbrir(); } } } : {})}
                  >
                    <td className="e-mono">{cuando}{tieneBox && !p.incomp && <> <span className="e-flecha">{abierto === k ? "▾" : "▸"}</span></>}</td>
                    <td><ChipEquipo equipo={p.equipo} /></td>
                    <td>
                      {sinPO(p.rival)}
                      {esPO(p) && <span className="e-po">PO</span>}
                      {p.sin_stats && <span className="e-po e-po-gris" title="El marcador consta, pero no se conserva la estadística individual de este partido">sin stats</span>}
                      {p.pendiente_acta && <span className="e-po e-po-gris" title="Resultado según la hoja de estadística; faltan los parciales por cuarto, que llegarán con el acta oficial">pend. acta</span>}
                    </td>
                    <td className="e-c e-marcador">{p.incomp ? "—" : `${p.pf} : ${p.pc}`}</td>
                    <td className="e-c">{p.incomp ? <span className="e-insignia e-insignia-eq">Inc.</span> : <span className={`e-insignia e-insignia-${p.res}`}>{p.res === "G" ? "Gana" : "Pierde"}</span>}</td>
                    <td className={`e-c e-mono e-oculta-sm ${dif >= 0 ? "e-pos" : "e-neg"}`}>{p.incomp ? "—" : (dif >= 0 ? "+" : "") + dif}</td>
                  </tr>
                  {abierto === k && abrible && (
                    <tr className="e-fila-box"><td colSpan={6}><Boxscore filas={box[k]} M={M} /></td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </CajaTabla>
      <Nota>Pincha en un partido para ver el boxscore completo de ese encuentro.</Nota>
    </>
  );
}

/** Boxscore de un partido: columnas segun lo que recogia la liga esa temporada. */
function Boxscore({ filas, M }: { filas: FilaBox[]; M: Metricas }) {
  const noCat = filas.filter((g) => g.no_jugador);
  return (
    <div className="e-box">
      <CajaTabla>
        <table className="e-tabla e-tabla-box" data-testid="boxscore">
          <thead>
            <tr>
              {M.dorsal && <th scope="col">#</th>}
              <th scope="col">Jugador</th>
              {M.min && <th scope="col" className="e-c">Min</th>}
              <th scope="col" className="e-c">Pts</th>
              {M.p2 && <th scope="col" className="e-c">{M.p2_intentos ? "2P" : <>2P<span className="e-completo">an.</span></>}</th>}
              {M.p3 && <th scope="col" className="e-c">{M.p3_intentos ? "3P" : <>3P<span className="e-completo">an.</span></>}</th>}
              {M.tl && <th scope="col" className="e-c">TL</th>}
              {M.fc && <th scope="col" className="e-c">FC</th>}
              {M.val && <th scope="col" className="e-c">VAL</th>}
              {M.pm && <th scope="col" className="e-c">+/-</th>}
            </tr>
          </thead>
          <tbody>
            {filas.map((g, i) => {
              const dnp = g.sec === 0;
              return (
                <tr key={i} className={dnp ? "e-dnp" : undefined}>
                  {M.dorsal && <td className="e-mono e-tenue">{g.num == null ? "" : g.num}</td>}
                  <td className={`e-nombre${g.no_jugador ? " e-sin-ficha" : ""}`}>
                    {g.display || nombreCorto(g.nombre)}
                    {g.no_jugador && <> <span className="e-completo">{g.mote}</span></>}
                  </td>
                  {M.min && <td className="e-c e-mono">{dnp ? "DNP" : g.sec == null ? <Dash /> : minutos(g.sec)}</td>}
                  <td className="e-c e-mono e-fuerte">{dnp ? "—" : <NInt v={g.pts} />}</td>
                  {M.p2 && <td className="e-c e-mono">{dnp ? "" : <Tiros a={g.p2a} i={g.p2i} conIntentos={M.p2_intentos} />}</td>}
                  {M.p3 && <td className="e-c e-mono">{dnp ? "" : <Tiros a={g.p3a} i={g.p3i} conIntentos={M.p3_intentos} />}</td>}
                  {M.tl && <td className="e-c e-mono">{dnp ? "" : <Tiros a={g.tla} i={g.tli} conIntentos />}</td>}
                  {M.fc && <td className="e-c e-mono">{dnp ? "" : <NInt v={g.fc} />}</td>}
                  {M.val && <td className="e-c e-mono e-oro">{dnp ? "" : <NInt v={g.val} />}</td>}
                  {M.pm && <td className="e-c e-mono">{dnp ? "" : <NSigned v={g.pm} />}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CajaTabla>
      {noCat.length > 0 && <Nota>Filas sin ficha: sus puntos cuentan en el marcador del equipo, pero no en rankings ni en fichas individuales.</Nota>}
    </div>
  );
}
