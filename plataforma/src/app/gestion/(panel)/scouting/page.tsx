import Link from "next/link";
import { exigirGestor } from "@/lib/sesion";
import { AvisoCaja, Camiseta } from "@/components/ProximoPartido";
import { avisoContra, coloresDe } from "@/lib/equipacion";
import {
  bonito, cargarLiga, codigoNuestro, dec, fechaCorta, mmss, nombreNuestro, proximoPartido, quienDobla,
  type JugadorLiga,
} from "@/lib/liga";

export const metadata = { title: "Scouting rivales · Gestión Maccabis" };

type Params = { e?: string; v?: string };

function Tarjeta({ j, puesto, dobla }: { j: JugadorLiga; puesto: number; dobla: boolean }) {
  return (
    <li className={`lg-jug${puesto <= 3 ? " lg-top" : ""}`}>
      <div className="lg-jug-cab">
        <span className="lg-dorsal">{j.dorsal}</span>
        <b className="lg-nombre">{bonito(j.nombre)}</b>
        {dobla && <span className="etiqueta etiqueta-abierta">dobla</span>}
      </div>
      <div className="lg-jug-num">
        <span><small>PJ</small>{j.pj}</span>
        <span><small>Pts</small><b>{j.pts}</b></span>
        <span><small>Media</small>{dec(j.pj ? j.pts / j.pj : null)}</span>
        <span><small>2P</small>{j.p2a}</span>
        <span><small>3P</small>{j.p3a}</span>
        <span><small>TL</small>{j.tla}/{j.tli}</span>
        <span><small>Faltas</small>{j.faltas}</span>
      </div>
    </li>
  );
}

export default async function Scouting({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase } = await exigirGestor();
  const { e, v } = await searchParams;
  const liga = await cargarLiga(supabase);
  const { clasificacion, calendario, hoy } = liga;
  if (!clasificacion.length) {
    return (<><h1>Scouting rivales</h1><div className="aviso aviso-info">Todavía no hay datos de liga cargados (<code>npm run db:liga</code>).</div></>);
  }

  const proxMdA = proximoPartido(calendario, hoy, "MDA");
  const proxMdL = proximoPartido(calendario, hoy, "MDL");
  const vista = v === "mdl" ? "mdl" : "mda";
  const porDefecto = (vista === "mdl" ? proxMdL : proxMdA)?.rival ?? null;
  const elegido = clasificacion.find((c) => c.equipo === (e ?? porDefecto)) ?? clasificacion.find((c) => c.equipo === porDefecto) ?? clasificacion[0];
  const grupo = elegido.grupo;
  const jugadores = liga.jugadores
    .filter((j) => j.grupo === grupo && j.equipo === elegido.equipo)
    .sort((a, b) => b.pts - a.pts || b.segundos - a.segundos);
  const dobla = quienDobla(liga.jugadores);
  const prox = elegido.nuestro ? null : proximoPartido(calendario, hoy, codigoNuestro(grupo) as "MDA" | "MDL", elegido.equipo);
  const aviso = prox ? avisoContra(codigoNuestro(grupo) as "MDA" | "MDL", elegido.equipo) : null;
  const suma = (k: "pts" | "p2a" | "p3a" | "tla" | "tli" | "faltas" | "segundos") => jugadores.reduce((s, j) => s + j[k], 0);
  const grupos = ["G1", "G2"];

  return (
    <>
      <h1>Scouting rivales</h1>
      <div className="aviso aviso-info">
        <b>Solo gestores.</b> Datos por jugador de otros equipos: son de terceros y no se publican ni se enseñan a los jugadores (D73).
      </div>

      <section className="tarjeta">
        <p className="lg-etq">Próximo rival</p>
        <div className="botones" style={{ marginTop: 6 }}>
          <Link className={`boton ${!e && vista === "mda" ? "boton-amarillo" : "boton-claro"}`} href="/gestion/scouting?v=mda">
            MdA: {proxMdA?.rival ?? "–"}{proxMdA?.fecha ? ` · ${fechaCorta(proxMdA.fecha)}` : ""}
          </Link>
          <Link className={`boton ${!e && vista === "mdl" ? "boton-amarillo" : "boton-claro"}`} href="/gestion/scouting?v=mdl">
            MdL: {proxMdL?.rival ?? "–"}{proxMdL?.fecha ? ` · ${fechaCorta(proxMdL.fecha)}` : ""}
          </Link>
        </div>
        <form method="get" action="/gestion/scouting" className="lg-form">
          <label htmlFor="eq" className="lg-etq">O cualquier equipo de la liga</label>
          <div className="lg-form-fila">
            <select id="eq" name="e" defaultValue={elegido.equipo}>
              {grupos.map((g) => (
                <optgroup key={g} label={`${g} · ${nombreNuestro(g)}`}>
                  {clasificacion.filter((c) => c.grupo === g).map((c) => <option key={c.equipo} value={c.equipo}>{c.equipo}</option>)}
                </optgroup>
              ))}
            </select>
            <button className="boton" type="submit">Ver</button>
            <Link className="boton boton-claro" href="/gestion/liga#todos">Ver todos los jugadores de la liga</Link>
          </div>
        </form>
      </section>

      <section className="tarjeta">
        <div className="lg-cab-equipo">
          <div>
            <h2 style={{ margin: 0, fontSize: "1.5rem" }}>{elegido.equipo} <span className={`etiqueta ${grupo === "G1" ? "etiqueta-abierta" : "etiqueta-cerrada"}`}>{grupo}</span></h2>
            <p className="lg-sub">
              {elegido.pos}º del grupo · {elegido.g} ganados, {elegido.p} perdidos · {elegido.pf}–{elegido.pc} ({elegido.pf - elegido.pc > 0 ? "+" : ""}{elegido.pf - elegido.pc}) ·{" "}
              {elegido.pts === null ? "pendiente de la oficial" : `${elegido.pts} pts`} <i>(clasificación calculada)</i>
            </p>
            <p className="lg-sub" data-testid="color-equipo">{coloresDe(elegido.equipo) ? <Camiseta rival={elegido.equipo} /> : "Sin color de equipación"}</p>
          </div>
          {prox && (
            <div className="lg-prox">
              <div className="lg-prox-e">Próximo partido contra nosotros</div>
              <div className="lg-prox-f">{nombreNuestro(grupo)} {prox.local ? "vs" : "en"} {elegido.equipo}</div>
              <div className="lg-prox-d">J{prox.jornada} · {prox.fecha ? fechaCorta(prox.fecha) : ""} · {prox.hora} · pista {prox.campo} · {prox.local ? "en casa" : "fuera"}</div>
              {aviso?.hay && <AvisoCaja a={aviso} />}
            </div>
          )}
          {elegido.nuestro && <p className="lg-sub">Es uno de los nuestros: así nos ven los rivales.</p>}
        </div>

        {jugadores.length === 0 ? <p>Sin hojas de este equipo todavía.</p> : (
          <>
            <div className="lg-tres">
              {jugadores.slice(0, 3).map((j, i) => (
                <div className="lg-max" key={j.nombre}>
                  <div className="lg-max-n">{i + 1}.º máximo anotador</div>
                  <div className="lg-max-nom">{bonito(j.nombre)}</div>
                  <div className="lg-max-p">{j.pts}<small> pts</small></div>
                  <div className="lg-max-x">{j.p2a} dobles · {j.p3a} triples · TL {j.tla}/{j.tli} · {j.faltas} faltas</div>
                </div>
              ))}
            </div>

            <ul className="lista-limpia lg-tarjetas solo-movil" aria-label="Jugadores">
              {jugadores.map((j, i) => <Tarjeta key={j.nombre} j={j} puesto={i + 1} dobla={dobla.has(j.nombre)} />)}
              <li className="lg-jug lg-equipo">
                <div className="lg-jug-cab"><b>Equipo</b></div>
                <div className="lg-jug-num">
                  <span><small>PJ</small>{elegido.pj}</span><span><small>Pts</small><b>{suma("pts")}</b></span><span><small>Min</small>{mmss(suma("segundos"))}</span>
                  <span><small>2P</small>{suma("p2a")}</span><span><small>3P</small>{suma("p3a")}</span><span><small>TL</small>{suma("tla")}/{suma("tli")}</span><span><small>Faltas</small>{suma("faltas")}</span>
                </div>
              </li>
            </ul>

            <div className="tabla-desplazable solo-escritorio">
              <table className="lg-tabla">
                <thead>
                  <tr><th>Jugador</th><th>PJ</th><th>Min</th><th>Pts</th><th>Media</th><th>2P</th><th>3P</th><th>TL</th><th>TL%</th><th>Faltas</th><th>F/p</th></tr>
                </thead>
                <tbody>
                  {jugadores.map((j, i) => (
                    <tr key={j.nombre} className={i < 3 ? "lg-top" : ""}>
                      <td><b>{bonito(j.nombre)}</b> <small>#{j.dorsal}</small>{dobla.has(j.nombre) && <> <span className="etiqueta etiqueta-abierta">dobla</span></>}</td>
                      <td>{j.pj}</td><td>{mmss(j.segundos)}</td><td><b>{j.pts}</b></td><td>{dec(j.pj ? j.pts / j.pj : null)}</td>
                      <td>{j.p2a}</td><td>{j.p3a}</td><td>{j.tla}/{j.tli}</td><td>{j.tli ? `${Math.round((100 * j.tla) / j.tli)}%` : "–"}</td>
                      <td>{j.faltas}</td><td>{dec(j.pj ? j.faltas / j.pj : null)}</td>
                    </tr>
                  ))}
                  <tr className="lg-equipo">
                    <td><b>Equipo</b></td><td>{elegido.pj}</td><td>{mmss(suma("segundos"))}</td><td><b>{suma("pts")}</b></td><td></td>
                    <td>{suma("p2a")}</td><td>{suma("p3a")}</td><td>{suma("tla")}/{suma("tli")}</td><td></td><td>{suma("faltas")}</td><td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="lg-nota">
              2P y 3P: canastas anotadas (la hoja de la FBM no recoge los intentos de campo). TL: anotados/intentados. Los minutos son los de la
              hoja y pueden no cuadrar con el reloj. Las medias son sobre sus partidos jugados. Solo aparecen los jugadores que figuran en las hojas de la FBM (han jugado al menos un partido).
            </p>
          </>
        )}
      </section>
    </>
  );
}
