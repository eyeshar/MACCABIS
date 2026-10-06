import { exigirGestor } from "@/lib/sesion";
import { cargarLiga, dec } from "@/lib/liga";
import { filasFichas, filasTabla } from "@/lib/jugadoresLiga";
import Lideres from "./Lideres";
import TablaJugadores from "./TablaJugadores";

export const metadata = { title: "Liga consolidada · Gestión Maccabis" };

export default async function LigaConsolidada() {
  const { supabase } = await exigirGestor();
  const liga = await cargarLiga(supabase);
  const { clasificacion } = liga;
  if (!clasificacion.length) {
    return (<><h1>Liga consolidada</h1><div className="aviso aviso-info">Todavía no hay datos de liga cargados (<code>npm run db:liga</code>).</div></>);
  }
  const pjEquipo = new Map(clasificacion.map((c) => [`${c.grupo}|${c.equipo}`, c.pj]));
  const sumadas = filasTabla(liga.jugadores, pjEquipo);   // quien dobla cuenta una vez, con las dos fichas sumadas
  const fichas = filasFichas(liga.jugadores, pjEquipo);   // sin sumar: para la tabla filtrada por grupo o equipo
  const jornadas = Math.max(...clasificacion.map((c) => c.pj));
  const ranking = clasificacion.filter((c) => c.pj > 0).sort((a, b) =>
    b.g / b.pj - a.g / a.pj || (b.pf - b.pc) / b.pj - (a.pf - a.pc) / a.pj || b.pf / b.pj - a.pf / a.pj);
  const resumen = `${sumadas.length} personas de los ${ranking.length} equipos con partidos jugados, hasta la jornada ${jornadas}. «dobla» = sale con MdA y con MdL (sus dos fichas se suman).`;

  return (
    <>
      <h1>Liga consolidada</h1>
      <div className="aviso aviso-info">
        <b>Solo gestores.</b> Datos por jugador de otros equipos: son de terceros y no se publican ni se enseñan a los jugadores (D73).
      </div>
      <nav className="lg-indice" aria-label="En esta página">
        <a href="#lideres">Líderes</a>
        <a href="#todos">Todos los jugadores</a>
        <a href="#ranking">Ranking de equipos</a>
      </nav>

      <Lideres filas={sumadas} resumen={resumen} />

      <div id="todos" className="lg-ancla">
        <TablaJugadores
          sumadas={sumadas}
          fichas={fichas}
          equipos={clasificacion.map((c) => ({ grupo: c.grupo, equipo: c.equipo }))}
        />
      </div>

      <details id="ranking" className="tarjeta lg-ranking">
        <summary>Ranking de equipos · G1 y G2 ({ranking.length} equipos)</summary>
        <p className="lg-sub">
          Los grupos tienen rivales distintos, así que no se comparan puntos de clasificación: se ordena por % de victorias, luego diferencia
          y puntos a favor por partido.
        </p>
        <div className="tabla-desplazable">
          <table className="lg-tabla lg-tabla-rank">
            <thead>
              <tr><th>#</th><th>Equipo</th><th className="lg-oculto-movil">PJ</th><th className="lg-oculto-movil">G</th><th className="lg-oculto-movil">P</th><th className="lg-solo-mov">G-P</th><th>%V</th><th className="lg-oculto-movil">PF/p</th><th className="lg-oculto-movil">PC/p</th><th>Dif/p</th><th className="lg-oculto-movil">Pts</th></tr>
            </thead>
            <tbody>
              {ranking.map((c, i) => (
                <tr key={`${c.grupo}${c.equipo}`} className={c.nuestro ? "lg-nuestro" : ""}>
                  <td>{i + 1}</td>
                  <td><b>{c.equipo}</b> <span className={`etiqueta ${c.grupo === "G1" ? "etiqueta-abierta" : "etiqueta-cerrada"}`}>{c.grupo}</span></td>
                  <td className="lg-oculto-movil">{c.pj}</td><td className="lg-oculto-movil">{c.g}</td><td className="lg-oculto-movil">{c.p}</td><td className="lg-solo-mov">{c.g}-{c.p}</td><td>{Math.round((100 * c.g) / c.pj)}%</td>
                  <td className="lg-oculto-movil">{dec(c.pf / c.pj)}</td><td className="lg-oculto-movil">{dec(c.pc / c.pj)}</td>
                  <td>{(c.pf - c.pc) / c.pj > 0 ? "+" : ""}{dec((c.pf - c.pc) / c.pj)}</td>
                  <td className="lg-oculto-movil">{c.pts === null ? "pend." : c.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="lg-nota">Solo equipos con partidos jugados. Los puntos son los de la clasificación calculada (pendiente de contrastar con la oficial).</p>
      </details>
    </>
  );
}
