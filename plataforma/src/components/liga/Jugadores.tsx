"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { jugadoresFiltrados, nombreBreve, type ClaveJugador, type Eq, type FiltroEq, type JugadorEst, type Metricas } from "@/lib/estadisticas/calculo";
import { CajaTabla, ChipEquipo, Control, N1, N2, NInt, NPct, NSigned, NSigned1, Nota, OPCIONES_EQUIPO, SecH, Segmento, Nz } from "./Comunes";

// Pestaña Jugadores: la plantilla de la temporada, ordenable por cualquier columna. PJ = partidos con minutos (los DNP no
// cuentan en las medias). Con `temporada`, el nombre enlaza con la ficha del jugador (por person_id).
// `compacta` (Club › Plantilla, bloque 6): ranking a 4 columnas (Jugador, PJ, Pts, Med) y «Más columnas» para el resto;
// en Temporadas › Jugadores, la tabla completa de siempre. Los números son los mismos en las dos.
// fix/visibilidad-movil: nombre corto (nombre + primer apellido, o el mote) con el completo al pasar por encima; a 4 columnas,
// sin dorsal y con los números estrechos y a la derecha (cabe entera a 360 px); con todas, el dorsal en pequeño debajo.
export default function JugadoresPestana({ jugadores, M, multiEquipo, temporada, selector, compacta = false }: {
  jugadores: JugadorEst[]; M: Metricas; multiEquipo: boolean; temporada?: string; selector?: ReactNode; compacta?: boolean;
}) {
  const [mas, setMas] = useState(!compacta);
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
  const num = mas ? "e-c" : "e-r";
  const columnas = !mas ? 4 : 4 + (multiEquipo ? 1 : 0) + (M.min ? 2 : 0) + (M.p2 ? 1 : 0) + (M.p3 ? 1 : 0) + (M.tl ? 1 : 0) + (M.fc ? 1 : 0) + (M.val ? 1 : 0) + (M.pm ? 2 : 0) + 1;

  return (
    <>
      <div className="e-controles">
        {selector}
        {multiEquipo && <Control etiqueta="Equipo"><Segmento etiqueta="Equipo" valor={equipo} opciones={OPCIONES_EQUIPO} onCambia={setEquipo} /></Control>}
        <Control etiqueta="Mínimo de partidos jugados">
          <div className="e-rango">
            <input type="range" min={1} max={maxPj} value={Math.min(minpj, maxPj)} onChange={(e) => setMinpj(+e.target.value)} aria-label="Mínimo de partidos jugados" />
            <span className="e-rango-val">{Math.min(minpj, maxPj)}+</span>
          </div>
        </Control>
      </div>

      <SecH titulo="Ranking de plantilla" tag={`${a.length} jugadores`} />
      {compacta && (
        <button type="button" className="e-boton-mas" aria-expanded={mas} aria-controls="e-tabla-plantilla" onClick={() => setMas((v) => !v)} data-testid="mas-columnas">
          {mas ? "Menos columnas" : "Más columnas"}
        </button>
      )}
      <CajaTabla>
        <table className={`e-tabla${mas ? " e-fija2" : " e-tabla-4"}`} id="e-tabla-plantilla" data-testid="jugadores-tabla" data-columnas={mas ? "todas" : "4"}>
          <thead>
            <tr>
              {mas && <th scope="col" className="e-c">#</th>}
              {th("nombre", "Jugador")}
              {mas && multiEquipo && <th scope="col" className="e-oculta-sm">Eq</th>}
              {th("pj", "PJ", num)}
              {th("pts", "Pts", num)}
              {th("ppg", "Med", num)}
              {mas && <>
              {M.min && th("min", "Min", "e-c")}
              {M.min && th("ppm", "P/min", "e-c")}
              {M.p2 && th("p2", M.p2_intentos ? "2P%" : "2P", "e-c")}
              {M.p3 && th("p3", M.p3_intentos ? "3P%" : "3P", "e-c")}
              {M.tl && th("tl", "TL%", "e-c")}
              {M.fc && th("fc", "FC", "e-c")}
              {M.val && th("val", "VAL", "e-c")}
              {M.pm && th("pmt", "+/- ac", "e-c")}
              {M.pm && th("pm", "+/- md", "e-c")}
              </>}
            </tr>
          </thead>
          <tbody>
            {a.length === 0 && <tr><td colSpan={columnas} className="e-vacio">Sin jugadores.</td></tr>}
            {a.map((p, i) => {
              const a2 = p.avg || ({} as NonNullable<JugadorEst["avg"]>);
              const nombre = nombreBreve(p);
              return (
                <tr key={p.person_id + i}>
                  {mas && <td className="e-c e-mono e-tenue">{i + 1}</td>}
                  <td className="e-nombre">
                    {!mas && <span className="e-mono e-tenue e-pos-num">{i + 1}</span>}
                    {temporada ? <Link href={`/jugador/${p.person_id}?t=${temporada}`} className="e-enlace-nombre" title={p.display || undefined}>{nombre}</Link> : <span title={p.display || undefined}>{nombre}</span>}
                    {mas && p.dorsales && p.dorsales.length > 0 && <span className="e-completo e-dorsal-bajo">#{p.dorsales.join("/")}</span>}
                  </td>
                  {mas && multiEquipo && <td className="e-oculta-sm">{p.equipos.map((e: Eq, k) => <Fragment key={e}>{k > 0 && " "}<ChipEquipo equipo={e} corto /></Fragment>)}</td>}
                  <td className={`${num} e-mono`}>{p.pj}</td>
                  <td className={`${num} e-mono`}>{p.tot.pts}</td>
                  <td className={`${num} e-mono`}><N1 v={a2.pts} /></td>
                  {mas && <>
                  {M.min && <td className="e-c e-mono"><Nz v={a2.min} f={(x) => x.toFixed(1) + "'"} /></td>}
                  {M.min && <td className="e-c e-mono"><N2 v={p.ppm} /></td>}
                  {M.p2 && <td className="e-c e-mono">{M.p2_intentos ? <NPct v={p.p2_pct} /> : <NInt v={p.tot.p2a} />}</td>}
                  {M.p3 && <td className="e-c e-mono">{M.p3_intentos ? <NPct v={p.p3_pct} /> : <NInt v={p.tot.p3a} />}</td>}
                  {M.tl && <td className="e-c e-mono"><NPct v={p.tl_pct} /></td>}
                  {M.fc && <td className="e-c e-mono"><NInt v={p.tot.fc} /></td>}
                  {M.val && <td className="e-c e-mono"><NInt v={p.tot.val} /></td>}
                  {M.pm && <td className="e-c e-mono"><NSigned v={p.pm_total} /></td>}
                  {M.pm && <td className="e-c e-mono"><NSigned1 v={a2.pm} /></td>}
                  </>}
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
