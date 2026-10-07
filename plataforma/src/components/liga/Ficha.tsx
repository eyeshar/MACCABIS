import type { Metricas } from "@/lib/estadisticas/calculo";
import { nombrePropio } from "@/lib/estadisticas/calculo";
import type { Temporada } from "@/lib/estadisticas/datos";
import { CajaTabla, ChipEquipo, Dash, Kpi, N1, N2, NInt, NPct, NSigned, NSigned1, Nota, SecH, Tiros } from "./Comunes";

type Jugador = Temporada["players"][number];

// Ficha de jugador (antes, la pestaña «Ficha» de GitHub Pages): indicadores de la temporada, desglose de tiro y partido a
// partido. Solo estadísticas de juego: nada de niveles, posiciones, correos ni datos personales.
export default function FichaJugador({ p, M, multiEquipo }: { p: Jugador; M: Metricas; multiEquipo: boolean }) {
  const a = p.avg || { pts: 0, min: 0, val: 0, pm: 0, fc: 0 };
  const dorsal = p.dorsales && p.dorsales.length ? p.dorsales[0] : (p.display || p.nombre).charAt(0);
  const meta = [p.equipos.map((e) => (e === "MDA" ? "MdA" : "MdL")).join(" + "), `${p.conv} convocatorias`, `${p.pj} jugados`, ...(M.min && p.min_tot != null ? [`${p.min_tot} min`] : [])].join(" · ");
  const games = p.games ?? [];
  return (
    <div data-testid="ficha">
      <div className="e-cabjugador">
        <div className="e-dorsal">{dorsal}</div>
        <div>
          <h2 className="e-nombre-ficha">{p.display || nombrePropio(p.nombre)}</h2>
          <div className="e-meta">{meta}</div>
        </div>
      </div>

      <div className="e-kpis" data-testid="ficha-kpis">
        <Kpi tono="accent" lab="Puntos" val={p.tot.pts} foot={<><N1 v={a.pts} />/pj</>} />
        {M.val && <Kpi tono="gold" lab="Valoración" val={<NInt v={p.tot.val} />} foot={<><N1 v={a.val} />/pj</>} />}
        {M.pm && <Kpi tono={(p.pm_total ?? 0) >= 0 ? "win" : ""} lab="+/- acumulado" val={<NSigned v={p.pm_total} />} foot={<>media <NSigned1 v={a.pm} /></>} />}
        {M.min && <Kpi tono="grape" lab="Minutos" val={<N1 v={a.min} />} foot={<><N2 v={p.ppm} /> pts/min</>} />}
        {M.tl && <Kpi lab="Tiros libres" val={<NPct v={p.tl_pct} />} foot={`${p.tot.tla}/${p.tot.tli}`} />}
        {M.fc && <Kpi lab="Faltas" val={<NInt v={p.tot.fc} />} foot={<><N1 v={a.fc} />/pj</>} />}
      </div>

      <SecH titulo="Desglose de tiro" />
      <div className="e-kpis" data-testid="ficha-tiro">
        {M.p2 && (M.p2_intentos
          ? <Kpi tono="accent" lab="Tiros de 2" val={<NPct v={p.p2_pct} />} foot={`${p.tot.p2a}/${p.tot.p2i}`} />
          : <Kpi tono="accent" lab="Canastas de 2" val={<NInt v={p.tot.p2a} />} foot="anotadas (derivadas)" />)}
        {M.p3 && (M.p3_intentos
          ? <Kpi tono="grape" lab="Tiros de 3" val={<NPct v={p.p3_pct} />} foot={`${p.tot.p3a}/${p.tot.p3i}`} />
          : <Kpi tono="grape" lab="Canastas de 3" val={<NInt v={p.tot.p3a} />} foot="anotadas" />)}
        {M.tl && <Kpi tono="gold" lab="Tiros libres" val={<NPct v={p.tl_pct} />} foot={`${p.tot.tla}/${p.tot.tli}`} />}
        {M.p3 && <Kpi lab="Puntos de 3" val={p.tot.p3a * 3} foot={`${p.tot.pts ? Math.round((p.tot.p3a * 3) / p.tot.pts * 100) : 0}% de sus puntos`} />}
      </div>

      <SecH titulo="Partido a partido" tag={`${games.length} partidos`} />
      <CajaTabla>
        <table className="e-tabla" data-testid="ficha-partidos">
          <thead>
            <tr>
              <th scope="col">#</th>
              {multiEquipo && <th scope="col">Eq</th>}
              <th scope="col">Rival</th>
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
            {games.map((g, i) => {
              const dnp = !g.played;
              return (
                <tr key={i} className={dnp ? "e-dnp" : undefined}>
                  <td className="e-mono e-tenue">{g.pn}</td>
                  {multiEquipo && <td><ChipEquipo equipo={g.eq} corto /></td>}
                  <td>{g.rival ? nombrePropio(g.rival) : "—"}</td>
                  {M.min && <td className="e-c e-mono">{dnp ? <span className="e-tenue">DNP</span> : g.sec == null ? <Dash /> : Math.round(g.sec / 60) + "'"}</td>}
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
      <Nota>{M.min ? "DNP = convocado sin minutos (no computa en las medias)." : "Las filas atenuadas son \"No Jugó\" (NJ): convocatoria sin participación. No entran en el denominador de las medias."}</Nota>
    </div>
  );
}
