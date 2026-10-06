import { exigirGestor } from "@/lib/sesion";
import { bonito, cargarLiga, dec, quienDobla, unirDoblan, type JugadorLiga } from "@/lib/liga";
import { porFaltas, porMedia, porPuntos, porTirosLibres, porTriples } from "@/lib/ordenLideres";

export const metadata = { title: "Liga consolidada · Gestión Maccabis" };

export default async function LigaConsolidada() {
  const { supabase } = await exigirGestor();
  const liga = await cargarLiga(supabase);
  const { clasificacion } = liga;
  const jugadores = unirDoblan(liga.jugadores);   // quien dobla cuenta una vez, con las dos fichas sumadas
  if (!clasificacion.length) {
    return (<><h1>Liga consolidada</h1><div className="aviso aviso-info">Todavía no hay datos de liga cargados (<code>npm run db:liga</code>).</div></>);
  }
  const dobla = quienDobla(liga.jugadores);
  const pjEquipo = new Map(clasificacion.map((c) => [`${c.grupo}|${c.equipo}`, c.pj]));
  const jornadas = Math.max(...clasificacion.map((c) => c.pj));
  const equiposConPartidos = clasificacion.filter((c) => c.pj > 0).length;   // el mismo recuento que el ranking

  const lider = (
    titulo: string, orden: (a: JugadorLiga, b: JugadorLiga) => number, valor: (j: JugadorLiga) => string,
    lista: JugadorLiga[] = jugadores, nota?: string,
  ) => {
    const top = [...lista].sort(orden).slice(0, 8);
    return (
      <section className="tarjeta lg-lider">
        <h3>{titulo}</h3>
        <ol className="lista-limpia">
          {top.map((j, i) => (
            <li key={`${j.grupo}${j.equipo}${j.nombre}`}>
              <span>{i + 1}</span>
              <span>
                <b>{bonito(j.nombre)}</b>{dobla.has(j.nombre) && <> <span className="etiqueta etiqueta-abierta">dobla</span></>}
                <small>{j.equipo}{j.grupo === "G1+G2" ? "" : ` · ${j.grupo}`}</small>
              </span>
              <b>{valor(j)}</b>
            </li>
          ))}
        </ol>
        {nota && <p className="lg-nota">{nota}</p>}
      </section>
    );
  };

  const minPj = (j: JugadorLiga) => j.grupo === "G1+G2" ? 1 : Math.max(1, Math.ceil((pjEquipo.get(`${j.grupo}|${j.equipo}`) ?? 0) / 2));
  const ranking = clasificacion.filter((c) => c.pj > 0).sort((a, b) =>
    b.g / b.pj - a.g / a.pj || (b.pf - b.pc) / b.pj - (a.pf - a.pc) / a.pj || b.pf / b.pj - a.pf / a.pj);

  return (
    <>
      <h1>Liga consolidada</h1>
      <div className="aviso aviso-info">
        <b>Solo gestores.</b> Datos por jugador de otros equipos: son de terceros y no se publican ni se enseñan a los jugadores (D73).
      </div>
      <h2>Líderes individuales de la liga</h2>
      <p className="lg-sub">{jugadores.length} personas de los {equiposConPartidos} equipos con partidos jugados, hasta la jornada {jornadas}. «dobla» = sale con MdA y con MdL (sus dos fichas se suman).</p>
      <div className="lg-lideres">
        {lider("Puntos", porPuntos, (j) => String(j.pts))}
        {lider("Media de puntos", porMedia, (j) => dec(j.pj ? j.pts / j.pj : 0), jugadores.filter((j) => j.pj >= minPj(j)),
          "Mínimo: la mitad de los partidos jugados por su equipo (al menos 1).")}
        {lider("Triples", porTriples, (j) => String(j.p3a))}
        {lider("Tiros libres", porTirosLibres, (j) => `${j.tla}/${j.tli}`, jugadores.filter((j) => j.tli >= 3), "Con al menos 3 tiros libres intentados.")}
        {lider("Faltas", porFaltas, (j) => String(j.faltas), jugadores, "Faltas cometidas (5 = eliminado). A igualdad de faltas va primero quien las hizo en menos partidos (más faltas por partido); después, por nombre.")}
      </div>

      <details className="tarjeta lg-ranking">
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
