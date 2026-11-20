import Link from "next/link";
import type { Fantasy } from "@/lib/fantasy/datos";
import { conSigno, fechaCorta, pts, quintetoIdeal } from "@/lib/fantasy/vista";
import type { Consulta } from "../page";
import { enlaceJugador, enlaceManager } from "./Inicio";

/** Jornada: mi total frente a la media, desglose por jugador (rendimiento y compromiso por separado) y quinteto ideal. */
export default function Jornada({ f, q }: { f: Fantasy; q: Consulta }) {
  const jornadas = f.jornadas.map((j) => j.fecha);
  if (!jornadas.length) return <section className="gs-bloque" data-testid="fz-sin-jornadas"><p className="suave" style={{ margin: 0 }}>Aún no hay ninguna jornada puntuada.</p></section>;
  const j = q.j && jornadas.includes(q.j) ? q.j : jornadas.at(-1)!;
  const yo = f.estado.person_id;
  const dia = f.puntosM.filter((p) => p.jornada === j);
  const mio = dia.find((p) => p.manager === yo);
  const media = dia.length ? Math.round((dia.reduce((s, p) => s + p.total, 0) / dia.length) * 10) / 10 : null;
  const pj = f.puntosJ.filter((p) => p.jornada === j).sort((a, b) => b.total - a.total || b.rendimiento - a.rendimiento);
  const deJ = new Map(pj.map((p) => [p.person_id, p]));
  const ideal = quintetoIdeal(f.puntosJ, j, f.P.alineados);
  const resultados = f.jornadas.find((x) => x.fecha === j)?.resultados ?? {};
  const misPorras = f.porras.filter((p) => p.manager === yo && p.jornada === j);

  return (
    <>
      <nav className="fz-chips" aria-label="Jornadas" data-testid="fz-jornadas">
        {jornadas.map((x) => <Link key={x} href={`/mdfantasy?tab=jornada&j=${x}`} aria-current={x === j ? "page" : undefined}>{fechaCorta(x)}</Link>)}
      </nav>
      <div className="gs-cifras fz-cifras fz-cifras-3" data-testid="fz-cifras-jornada">
        <div className="num-caja"><b className="cifra" data-testid="fz-mi-total">{mio ? pts(mio.total) : "—"}</b><span>Tu jornada</span></div>
        <div className="num-caja"><b className="cifra">{media != null ? pts(media) : "—"}</b><span>Media de los mánagers</span></div>
        <div className="num-caja"><b className="cifra">{Object.entries(resultados).map(([eq, r]) => `${eq} ${r === "gana" ? "G" : "P"}`).join(" · ") || "—"}</b><span>Resultados</span></div>
      </div>

      {mio && (
        <section className="gs-bloque" aria-labelledby="t-fz-desglose" data-testid="fz-desglose">
          <h2 id="t-fz-desglose" className="fz-h2">Tu alineación</h2>
          <div className="tabla-desplazable">
            <table className="fz-tabla">
              <thead><tr><th scope="col">Jugador</th><th scope="col">Rend.</th><th scope="col">Comp.</th><th scope="col">Cap.</th><th scope="col">Total</th></tr></thead>
              <tbody>
                {(mio.detalle.jugadores ?? []).map((x) => (
                  <tr key={x.person_id}>
                    <th scope="row"><Link href={enlaceJugador(x.person_id)}>{f.nombreJ.get(x.person_id) ?? "?"}</Link>{mio.detalle.dobla === x.person_id && <b className="fz-galon fz-galon-linea" aria-label="Dobló">C</b>}</th>
                    <td className="mono">{pts(x.rendimiento)}</td><td className="mono">{conSigno(x.compromiso)}</td><td className="mono">{x.doble ? `+${pts(x.doble)}` : ""}</td><td className="mono"><b>{pts(x.total)}</b></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><th scope="row">Porra{misPorras.length ? ` (${misPorras.filter((p) => p.acierto).length} de ${misPorras.length})` : ""}</th><td /><td /><td /><td className="mono"><b>{conSigno(mio.porra)}</b></td></tr>
                <tr><th scope="row">Total · ingreso {mio.ingreso.toLocaleString("es-ES")} M</th><td /><td /><td /><td className="mono"><b>{pts(mio.total)}</b></td></tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      <section className="gs-bloque" aria-labelledby="t-fz-ideal" data-testid="fz-ideal">
        <h2 id="t-fz-ideal" className="fz-h2">Quinteto ideal <span className="suave fz-h2-nota">{pts(ideal.total)} pts</span></h2>
        <div className="fz-pista" role="list">
          {ideal.jugadores.map((p) => (
            <div key={p.person_id} role="listitem" className={`fz-ficha${ideal.capitan === p.person_id ? " es-cap" : ""}`}>
              {ideal.capitan === p.person_id && <b className="fz-galon" aria-label="Capitán">C</b>}
              <Link href={enlaceJugador(p.person_id)} className="fz-ficha-nombre">{f.nombreJ.get(p.person_id) ?? "?"}</Link>
              <span className="mono">{pts(p.total)} pts</span>
            </div>
          ))}
        </div>
      </section>

      {dia.length > 0 && (
        <section className="gs-bloque" aria-labelledby="t-fz-dia" data-testid="fz-managers-jornada">
          <h2 id="t-fz-dia" className="fz-h2">Mánagers</h2>
          <ol className="fz-orden">
            {[...dia].sort((a, b) => b.total - a.total).map((p) => <li key={p.manager} className={p.manager === yo ? "es-mio" : undefined}><Link href={enlaceManager(p.manager)}>{f.nombreM.get(p.manager) ?? "?"}</Link><b className="mono">{pts(p.total)}</b></li>)}
          </ol>
        </section>
      )}

      <section className="gs-bloque" aria-labelledby="t-fz-todos" data-testid="fz-jugadores-jornada">
        <h2 id="t-fz-todos" className="fz-h2">Todos los jugadores</h2>
        <div className="tabla-desplazable">
          <table className="fz-tabla">
            <thead><tr><th scope="col">Jugador</th><th scope="col">Min</th><th scope="col">Rend.</th><th scope="col">Comp.</th><th scope="col">Total</th></tr></thead>
            <tbody>
              {pj.map((p) => (
                <tr key={p.person_id}>
                  <th scope="row"><Link href={enlaceJugador(p.person_id)}>{f.nombreJ.get(p.person_id) ?? "?"}</Link>{p.doblete && <span className="pastilla pastilla-jugo fz-doblete">×2</span>}</th>
                  <td className="mono">{deJ.get(p.person_id)?.minutos || "—"}</td><td className="mono">{pts(p.rendimiento)}</td><td className="mono">{conSigno(p.compromiso)}</td><td className="mono"><b>{pts(p.total)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
