import Link from "next/link";
import type { Fantasy } from "@/lib/fantasy/datos";
import { conSigno, fechaCorta, pts, quintetoIdeal } from "@/lib/fantasy/vista";
import type { Consulta } from "../page";
import { enlaceJugador, enlaceManager } from "./Inicio";

/** Una celda de numeros que tambien lleva a la carta del jugador (toda la fila es enlace). El enlace «de verdad», para
 *  teclado y lectores, es el del nombre: estos no entran en el orden de tabulacion ni se leen dos veces. */
function Celda({ id, children }: { id: string; children: React.ReactNode }) {
  return <td className="mono fz-td-enlace"><Link href={enlaceJugador(id)} className="fz-celda" tabIndex={-1} aria-hidden="true">{children}</Link></td>;
}

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
      <div className="gs-cifras fz-cifras fz-cifras-2" data-testid="fz-cifras-jornada">
        <div className="num-caja"><b className="cifra" data-testid="fz-mi-total">{mio ? pts(mio.total) : "—"}</b><span>Tu jornada</span></div>
        <div className="num-caja"><b className="cifra">{media != null ? pts(media) : "—"}</b><span>Media de la liga</span></div>
      </div>

      {Object.keys(resultados).length > 0 && (
        <p className="fz-resultados" data-testid="fz-resultados"><span className="tenue">Nuestros partidos del {fechaCorta(j)}:</span> {Object.entries(resultados).map(([eq, r]) => `${eq} ${r === "gana" ? "ganó" : "perdió"}`).join(" · ")}</p>
      )}

      {mio && media != null && (() => {
        const dif = Math.round((mio.total - media) * 10) / 10;
        const tope = Math.max(mio.total, media, 1) * 1.1;
        const texto = dif > 0 ? `+${pts(dif)} sobre la media` : dif < 0 ? `-${pts(-dif)} bajo la media` : "En la media";
        return (
          <section className="gs-bloque fz-frente" aria-label="Tu jornada frente a la media de la liga" data-testid="fz-frente">
            <p className={`fz-frente-texto${dif > 0 ? " es-mas" : ""}`} data-testid="fz-frente-texto">{texto}</p>
            <div className={`fz-frente-barra${dif < 0 ? " es-menos" : ""}`} role="img" aria-label={`Tú ${pts(mio.total)} puntos; media de la liga ${pts(media)}`}>
              <i style={{ width: `${Math.max(0, Math.min(100, (mio.total / tope) * 100))}%` }} data-testid="fz-frente-mio" />
              <u style={{ left: `${Math.min(100, (media / tope) * 100)}%` }} data-testid="fz-frente-media" />
            </div>
            <div className="fz-frente-leyenda"><span>Tú: <b>{pts(mio.total)}</b></span><span>Media de la liga (la raya): <b>{pts(media)}</b></span></div>
          </section>
        );
      })()}

      {mio && (
        <section className="gs-bloque" aria-labelledby="t-fz-desglose" data-testid="fz-desglose">
          <h2 id="t-fz-desglose" className="fz-h2">Tu alineación</h2>
          <div className="tabla-desplazable">
            <table className="fz-tabla">
              <thead><tr><th scope="col">Jugador</th><th scope="col">Rend.</th><th scope="col">Comp.</th><th scope="col">Cap.</th><th scope="col">Total</th></tr></thead>
              <tbody>
                {(mio.detalle.jugadores ?? []).map((x) => (
                  <tr key={x.person_id} className="fz-fila-enlace" data-testid={`fz-fila-${x.person_id}`}>
                    <th scope="row"><Link href={enlaceJugador(x.person_id)}>{f.nombreJ.get(x.person_id) ?? "?"}</Link>{mio.detalle.dobla === x.person_id && <b className="fz-galon fz-galon-linea" aria-label="Dobló">C</b>}</th>
                    <Celda id={x.person_id}>{pts(x.rendimiento)}</Celda><Celda id={x.person_id}>{conSigno(x.compromiso)}</Celda><Celda id={x.person_id}>{x.doble ? `+${pts(x.doble)}` : ""}</Celda><Celda id={x.person_id}><b>{pts(x.total)}</b></Celda>
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
                <tr key={p.person_id} className="fz-fila-enlace">
                  <th scope="row"><Link href={enlaceJugador(p.person_id)}>{f.nombreJ.get(p.person_id) ?? "?"}</Link>{p.doblete && <span className="pastilla pastilla-jugo fz-doblete">×2</span>}</th>
                  <Celda id={p.person_id}>{deJ.get(p.person_id)?.minutos || "—"}</Celda><Celda id={p.person_id}>{pts(p.rendimiento)}</Celda><Celda id={p.person_id}>{conSigno(p.compromiso)}</Celda><Celda id={p.person_id}><b>{pts(p.total)}</b></Celda>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
