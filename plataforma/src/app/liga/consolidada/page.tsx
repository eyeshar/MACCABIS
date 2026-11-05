import { SecH } from "@/components/liga/Comunes";
import Volver from "@/components/nav/Volver";
import type { Metadata } from "next";
import { exigirLiga } from "@/lib/sesion";
import { cargarLiga, dec, esGrupoNuestro, etiquetaGrupo, GRUPOS_NUESTROS, GRUPOS_TODOS } from "@/lib/liga";
import { filasFichas, filasTabla } from "@/lib/jugadoresLiga";
import Link from "next/link";
import { fichasPorNombreSolo } from "@/lib/estadisticas/liga";
import Lideres from "./Lideres";
import TablaJugadores from "./TablaJugadores";

export const dynamic = "force-dynamic";
// Con sesion (D162): nunca se indexa (ademas, robots.txt y la cabecera X-Robots-Tag de RUTAS_PRIVADAS).
export const metadata: Metadata = { title: "Liga consolidada · Maccabis", robots: { index: false, follow: false } };

// D184: un grupo cada vez. «Nuestros grupos» (G1 + G2, como siempre) o uno solo: G1, G2 o un grupo ajeno (G3-G6). No hay
// «Todos»: nunca se mezclan grupos ajenos entre si ni con los nuestros. La opcion va en la URL (?grupo=G3).
type Params = { grupo?: string };
const NUESTROS = "nuestros";

export default async function LigaConsolidada({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase } = await exigirLiga();
  const { grupo: pedido } = await searchParams;
  const sel = pedido && GRUPOS_TODOS.includes(pedido) ? pedido : NUESTROS;
  const deLosNuestros = sel === NUESTROS || esGrupoNuestro(sel);
  // G1 o G2 solos se cargan con los dos: hace falta ver las dos fichas para saber quien dobla (su etiqueta se sigue viendo).
  const liga = await cargarLiga(supabase, deLosNuestros ? GRUPOS_NUESTROS : [sel]);
  const clasificacion = sel === NUESTROS ? liga.clasificacion : liga.clasificacion.filter((c) => c.grupo === sel);
  const selector = <SelectorGrupo sel={sel} />;
  if (!clasificacion.length) {
    return (<><Volver defecto="/liga" etiqueta="Liga" /><SecH titulo="Liga consolidada" tag="Con sesión" />{selector}<div className="aviso aviso-info">Todavía no hay datos de liga cargados de {sel === NUESTROS ? "nuestros grupos" : etiquetaGrupo(sel)} (<code>npm run db:liga</code>).</div></>);
  }
  const pjEquipo = new Map(clasificacion.map((c) => [`${c.grupo}|${c.equipo}`, c.pj]));
  const fichas = filasFichas(liga.jugadores, pjEquipo).filter((j) => sel === NUESTROS || j.grupo === sel);   // sin sumar
  // Quien dobla cuenta una vez, con las dos fichas sumadas, solo en «Nuestros grupos»; con un grupo, solo su ficha de ese grupo.
  const sumadas = sel === NUESTROS ? filasTabla(liga.jugadores, pjEquipo) : fichas;
  const jornadas = Math.max(...clasificacion.map((c) => c.pj));
  const ranking = clasificacion.filter((c) => c.pj > 0).sort((a, b) =>
    b.g / b.pj - a.g / a.pj || (b.pf - b.pc) / b.pj - (a.pf - a.pc) / a.pj || b.pf / b.pj - a.pf / a.pj);
  const fichasEquipo = fichasPorNombreSolo(); // D129: cada equipo enlaza a su ficha
  const notaDobla = sel === NUESTROS ? " «dobla» = sale con MdA y con MdL (sus dos fichas se suman)."
    : deLosNuestros ? ` «dobla» = sale con MdA y con MdL; aquí solo cuentan sus partidos con ${sel === "G1" ? "MdA" : "MdL"}.` : "";
  const resumen = `${sumadas.length} personas de los ${ranking.length} equipos con partidos jugados, hasta la jornada ${jornadas}.${notaDobla}`;

  return (
    <>
      <Volver defecto="/liga" etiqueta="Liga" />
      <SecH titulo="Liga consolidada" tag="Con sesión" />
      <div className="aviso aviso-info">
        <b>Solo con sesión.</b> Datos por jugador de otros equipos: son de terceros; los ves por ser del equipo, no se publican (D73, D162).
      </div>
      {selector}
      <nav className="lg-indice" aria-label="En esta página">
        <a href="#lideres">Líderes</a>
        <a href="#todos">Todos los jugadores</a>
        <a href="#ranking">Ranking de equipos</a>
      </nav>

      <Lideres filas={sumadas} resumen={resumen} sumaDobla={sel === NUESTROS} />

      <div id="todos" className="lg-ancla">
        <TablaJugadores
          sumadas={sumadas}
          fichas={fichas}
          fichasEquipo={fichasEquipo}
          equipos={clasificacion.map((c) => ({ grupo: c.grupo, equipo: c.equipo }))}
          grupo={sel === NUESTROS ? null : sel}
        />
      </div>

      <details id="ranking" className="tarjeta lg-ranking">
        <summary>Ranking de equipos · {sel === NUESTROS ? "G1 y G2" : etiquetaGrupo(sel)} ({ranking.length} equipos)</summary>
        <p className="lg-sub">
          {sel === NUESTROS ? "Los grupos tienen rivales distintos, así que no se comparan puntos de clasificación: se ordena" : "Se ordena"} por % de victorias, luego diferencia
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
                  <td>{fichasEquipo[c.equipo] ? <Link href={fichasEquipo[c.equipo]} className="lg-enlace"><b>{c.equipo}</b></Link> : <b>{c.equipo}</b>} <span className={`etiqueta ${c.grupo === "G1" ? "etiqueta-abierta" : "etiqueta-cerrada"}`}>{c.grupo}</span></td>
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

/** Selector de grupo (D184): un formulario GET, sin JavaScript; la opcion queda en la URL y se mantiene en Líderes, Todos los
 *  jugadores y Ranking (son anclas de esta misma pagina). */
function SelectorGrupo({ sel }: { sel: string }) {
  return (
    <form method="get" action="/liga/consolidada" className="tarjeta lg-form" data-testid="selector-grupo">
      <label htmlFor="grupo" className="lg-etq">Grupo</label>
      <div className="lg-form-fila">
        <select id="grupo" name="grupo" defaultValue={sel}>
          <option value={NUESTROS}>Nuestros grupos (G1 + G2)</option>
          {GRUPOS_TODOS.map((g) => <option key={g} value={g}>{etiquetaGrupo(g)}</option>)}
        </select>
        <button className="boton" type="submit">Ver</button>
      </div>
      <p className="lg-nota">Un grupo cada vez: los grupos ajenos no se mezclan entre sí ni con los nuestros.</p>
    </form>
  );
}
