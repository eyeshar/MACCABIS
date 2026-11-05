import { SecH } from "@/components/liga/Comunes";
import Volver from "@/components/nav/Volver";
import type { Metadata } from "next";
import { exigirLiga } from "@/lib/sesion";
import { cargarClasificacion, cargarLiga, cargarPartidos, dec, esGrupoNuestro, etiquetaGrupo, GRUPOS_NUESTROS, type FilaClasificacion } from "@/lib/liga";
import { filasFichas, filasTabla } from "@/lib/jugadoresLiga";
import { gruposDeUrl, hrefConsolidada, jornadasJugadas, ordenarGrupos, resultadosDeJornada, sonLosNuestros, textoGrupos, textoHueco, type JornadasAjenas } from "@/lib/gruposLiga";
import Link from "next/link";
import { fichasPorNombreSolo } from "@/lib/estadisticas/liga";
import { fechaCorta } from "@/lib/liga";
import jornadasAjenas from "@/data/jornadasAjenas.json";
import Lideres from "./Lideres";
import TablaJugadores from "./TablaJugadores";
import SelectorGrupos from "./SelectorGrupos";

export const dynamic = "force-dynamic";
// Con sesion (D162): nunca se indexa (ademas, robots.txt y la cabecera X-Robots-Tag de RUTAS_PRIVADAS).
export const metadata: Metadata = { title: "Liga consolidada · Maccabis", robots: { index: false, follow: false } };

// D186 (sustituye al «un grupo cada vez» de D184): cualquier combinacion de grupos marcados (como minimo uno), en la URL
// (?grupos=G1,G2,G4; el enlace antiguo ?grupo=G3 sigue valiendo). Todo sale solo de los grupos marcados. Quien dobla suma
// sus dos fichas solo si estan marcados MdA y MdL; con uno solo, cuentan sus partidos de ese grupo («dobla» se sigue viendo).
// En el ranking, una clasificacion por grupo: nunca se mezclan equipos de grupos distintos en una misma tabla.
type Params = { grupos?: string | string[]; grupo?: string | string[]; vista?: string; j?: string };

export default async function LigaConsolidada({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase } = await exigirLiga();
  const params = await searchParams;
  const sel = gruposDeUrl(params);
  const vista = params.vista === "resultados" ? "resultados" : "jugadores";
  const cabecera = (
    <>
      <Volver defecto="/liga" etiqueta="Liga" />
      <SecH titulo="Liga consolidada" tag="Con sesión" />
      <div className="aviso aviso-info">
        <b>Solo con sesión.</b> Datos por jugador de otros equipos: son de terceros; los ves por ser del equipo, no se publican (D73, D162).
      </div>
      <SelectorGrupos sel={sel} vista={vista} />
      <nav className="lg-pestanas" aria-label="Liga consolidada" data-testid="pestanas-consolidada">
        <Link href={hrefConsolidada(sel)} aria-current={vista === "jugadores" ? "page" : undefined} className={vista === "jugadores" ? "on" : ""}>Jugadores y equipos</Link>
        <Link href={hrefConsolidada(sel, { vista: "resultados" })} aria-current={vista === "resultados" ? "page" : undefined} className={vista === "resultados" ? "on" : ""}>Resultados</Link>
      </nav>
    </>
  );
  if (vista === "resultados") {
    const [partidos, clasificacion] = await Promise.all([cargarPartidos(supabase, sel), cargarClasificacion(supabase, sel)]);
    return <>{cabecera}<Resultados sel={sel} partidos={partidos} clasificacion={clasificacion} pedida={Number(params.j) || null} /></>;
  }

  // G1 o G2 se cargan con los dos: hace falta ver las dos fichas para saber quien dobla (su etiqueta se sigue viendo).
  const ambos = sel.includes("G1") && sel.includes("G2");
  const liga = await cargarLiga(supabase, ordenarGrupos([...sel, ...(sel.some(esGrupoNuestro) ? GRUPOS_NUESTROS : [])]));
  const clasificacion = liga.clasificacion.filter((c) => sel.includes(c.grupo));
  if (!clasificacion.length) {
    return (<>{cabecera}<div className="aviso aviso-info">Todavía no hay datos de liga cargados de {sonLosNuestros(sel) ? "nuestros grupos" : sel.map(etiquetaGrupo).join(", ")} (<code>npm run db:liga</code>).</div></>);
  }
  const pjEquipo = new Map(clasificacion.map((c) => [`${c.grupo}|${c.equipo}`, c.pj]));
  const fichas = filasFichas(liga.jugadores, pjEquipo).filter((j) => sel.includes(j.grupo));   // sin sumar
  // Quien dobla cuenta una vez, con las dos fichas sumadas, solo con MdA y MdL marcados; si no, solo su ficha del grupo marcado.
  const sumadas = ambos ? filasTabla(liga.jugadores.filter((j) => sel.includes(j.grupo)), pjEquipo) : fichas;
  const jornadas = Math.max(...clasificacion.map((c) => c.pj));
  const conPartidos = clasificacion.filter((c) => c.pj > 0);
  const fichasEquipo = fichasPorNombreSolo(); // D129: cada equipo enlaza a su ficha
  const nuestro = sel.find(esGrupoNuestro);
  const notaDobla = ambos ? " «dobla» = sale con MdA y con MdL (sus dos fichas se suman)."
    : nuestro ? ` «dobla» = sale con MdA y con MdL; aquí solo cuentan sus partidos con ${nuestro === "G1" ? "MdA" : "MdL"}.` : "";
  // La cabecera de siempre con G1 + G2 o un solo grupo; con otra combinacion, dice cuales.
  const deQue = sel.length > 1 && !sonLosNuestros(sel) ? ` (${textoGrupos(sel)})` : "";
  const resumen = `${sumadas.length} personas de los ${conPartidos.length} equipos con partidos jugados${deQue}, hasta la jornada ${jornadas}.${notaDobla}`;

  return (
    <>
      {cabecera}
      <nav className="lg-indice" aria-label="En esta página">
        <a href="#lideres">Líderes</a>
        <a href="#todos">Todos los jugadores</a>
        <a href="#ranking">Ranking de equipos</a>
      </nav>

      <Lideres filas={sumadas} resumen={resumen} sumaDobla={ambos} />

      <div id="todos" className="lg-ancla">
        <TablaJugadores
          sumadas={sumadas}
          fichas={fichas}
          fichasEquipo={fichasEquipo}
          equipos={clasificacion.map((c) => ({ grupo: c.grupo, equipo: c.equipo }))}
          grupos={sel}
        />
      </div>

      <details id="ranking" className="tarjeta lg-ranking">
        <summary>Ranking de equipos · {sonLosNuestros(sel) ? "G1 y G2" : sel.length === 1 ? etiquetaGrupo(sel[0]) : textoGrupos(sel)} ({conPartidos.length} equipos)</summary>
        <p className="lg-sub">
          {sel.length > 1 ? "Una clasificación por grupo: los grupos tienen rivales distintos, así que sus equipos no se mezclan ni se comparan. " : ""}Cada una, por
          puntos de la clasificación calculada; con % de victorias, diferencia y puntos a favor por partido.
        </p>
        {sel.map((g) => <RankingGrupo key={g} grupo={g} filas={conPartidos.filter((c) => c.grupo === g)} fichasEquipo={fichasEquipo} />)}
        <p className="lg-nota">Solo equipos con partidos jugados. Los puntos son los de la clasificación calculada (pendiente de contrastar con la oficial).</p>
      </details>
    </>
  );
}

/** La clasificacion de UN grupo (en el orden de la clasificacion calculada). */
function RankingGrupo({ grupo, filas, fichasEquipo }: { grupo: string; filas: FilaClasificacion[]; fichasEquipo: Record<string, string> }) {
  return (
    <section className="lg-ranking-grupo" data-testid={`ranking-${grupo}`}>
      <h3>{etiquetaGrupo(grupo)} <small>({filas.length} equipos)</small></h3>
      {filas.length === 0 ? <p className="lg-nota">Todavía sin partidos cargados.</p> : (
        <div className="tabla-desplazable">
          <table className="lg-tabla lg-tabla-rank">
            <thead>
              <tr><th>#</th><th>Equipo</th><th className="lg-oculto-movil">PJ</th><th className="lg-oculto-movil">G</th><th className="lg-oculto-movil">P</th><th className="lg-solo-mov">G-P</th><th>%V</th><th className="lg-oculto-movil">PF/p</th><th className="lg-oculto-movil">PC/p</th><th>Dif/p</th><th className="lg-oculto-movil">Pts</th></tr>
            </thead>
            <tbody>
              {[...filas].sort((a, b) => a.pos - b.pos).map((c, i) => (
                <tr key={c.equipo} className={c.nuestro ? "lg-nuestro" : ""}>
                  <td>{i + 1}</td>
                  <td>{fichasEquipo[c.equipo] ? <Link href={fichasEquipo[c.equipo]} className="lg-enlace"><b>{c.equipo}</b></Link> : <b>{c.equipo}</b>}</td>
                  <td className="lg-oculto-movil">{c.pj}</td><td className="lg-oculto-movil">{c.g}</td><td className="lg-oculto-movil">{c.p}</td><td className="lg-solo-mov">{c.g}-{c.p}</td><td>{Math.round((100 * c.g) / c.pj)}%</td>
                  <td className="lg-oculto-movil">{dec(c.pf / c.pj)}</td><td className="lg-oculto-movil">{dec(c.pc / c.pj)}</td>
                  <td>{(c.pf - c.pc) / c.pj > 0 ? "+" : ""}{dec((c.pf - c.pc) / c.pj)}</td>
                  <td className="lg-oculto-movil">{c.pts === null ? "pend." : c.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Pestaña Resultados (D186): un selector de jornada (por defecto, la ultima jugada) y, por cada grupo marcado, sus partidos
 *  de esa jornada; quien descansa y los huecos (sin hoja o incomparecencia), sin inventar marcadores. */
function Resultados({ sel, partidos, clasificacion, pedida }: { sel: string[]; partidos: Awaited<ReturnType<typeof cargarPartidos>>; clasificacion: FilaClasificacion[]; pedida: number | null }) {
  const js = jornadasJugadas(partidos, sel);
  if (!js.length) return <div className="aviso aviso-info">Todavía no hay resultados con jornada de {sel.map(etiquetaGrupo).join(", ")}.</div>;
  const jornada = pedida && js.includes(pedida) ? pedida : js[js.length - 1];
  const equipos = Object.fromEntries(sel.map((g) => [g, clasificacion.filter((c) => c.grupo === g).map((c) => c.equipo)]));
  const bloques = resultadosDeJornada(partidos, equipos, sel, jornada, jornadasAjenas as JornadasAjenas);
  const sinJornada = partidos.filter((p) => p.jornada == null).length;
  return (
    <section className="lg-seccion" data-testid="resultados">
      <h2>Resultados · jornada {jornada}</h2>
      <nav className="lg-jornadas" aria-label="Jornada">
        {js.map((j) => (
          <Link key={j} href={hrefConsolidada(sel, { vista: "resultados", j })} aria-current={j === jornada ? "page" : undefined} className={j === jornada ? "on" : ""}>J{j}</Link>
        ))}
      </nav>
      {bloques.map((b) => (
        <section key={b.grupo} className="tarjeta lg-res-grupo" data-testid={`resultados-${b.grupo}`}>
          <h3>{etiquetaGrupo(b.grupo)}</h3>
          {b.sinPartidos ? <p className="lg-nota">Sin partidos cargados de la jornada {jornada}.</p> : (
            <ul className="lista-limpia lg-res-lista">
              {b.filas.map((f) => f.tipo === "partido" ? (
                <li key={f.id}>
                  <Link href={`/liga/consolidada/partido/${f.id}?${new URLSearchParams({ grupos: sel.join(","), j: String(jornada) }).toString().replace(/%2C/g, ",")}`} className="lg-res-partido">
                    <span className={f.pl != null && f.pv != null && f.pl > f.pv ? "gana" : ""}>{f.local}</span>
                    <b className="lg-res-marcador">{f.pl ?? "–"}–{f.pv ?? "–"}</b>
                    <span className={f.pl != null && f.pv != null && f.pv > f.pl ? "gana" : ""}>{f.visitante}</span>
                    {f.fecha && <small>{fechaCorta(f.fecha)}</small>}
                  </Link>
                </li>
              ) : (
                <li key={`${f.local}-${f.visitante}`} className="lg-res-hueco" data-testid="hueco">
                  <span>{f.local}</span><b className="lg-res-marcador">–</b><span>{f.visitante}</span>
                  <span className="etiqueta etiqueta-cerrada">{textoHueco(f.motivo)}</span>
                </li>
              ))}
            </ul>
          )}
          {b.descansa.length === 1 && <p className="lg-nota" data-testid="descansa">Descansa: <b>{b.descansa[0]}</b></p>}
          {b.descansa.length > 1 && !b.sinPartidos && <p className="lg-nota">Sin partido cargado esta jornada: {b.descansa.join(", ")}.</p>}
        </section>
      ))}
      <p className="lg-nota">
        Pulsa un partido para ver su hoja (datos por jugador, solo con sesión). Los huecos son partidos sin hoja de estadística (la app no la
        tiene) o incomparecencias: no tienen marcador.{sinJornada ? ` ${sinJornada} ${sinJornada === 1 ? "hoja llegó" : "hojas llegaron"} sin jornada y no salen aquí.` : ""}
      </p>
    </section>
  );
}
