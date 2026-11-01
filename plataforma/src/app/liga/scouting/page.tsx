import { SecH } from "@/components/liga/Comunes";
import Volver from "@/components/nav/Volver";
import Link from "next/link";
import type { Metadata } from "next";
import { exigirLiga } from "@/lib/sesion";
import { AvisoCaja, Camiseta } from "@/components/ProximoPartido";
import { avisoContra, coloresDe } from "@/lib/equipacion";
import {
  bonito, cargarLiga, codigoNuestro, dec, fechaCorta, masPeligrosos, minimoPartidos, mmss, nombreNuestro, porMediaPts, proximoPartido,
  quienDobla, textoDorsales, type JugadorLiga,
} from "@/lib/liga";

export const dynamic = "force-dynamic";
// Con sesion (D162): nunca se indexa (ademas, robots.txt y la cabecera X-Robots-Tag de RUTAS_PRIVADAS).
export const metadata: Metadata = { title: "Scouting rivales · Maccabis", robots: { index: false, follow: false } };

type Params = { e?: string; v?: string; o?: string };

// Columnas de la tabla, en este orden: en el movil (375 px) se ven sin desplazar jugador, PJ, MEDIA y PTS (D169).
type Col = "nombre" | "pj" | "media" | "pts" | "segundos" | "p2a" | "p3a" | "tl" | "pctTL" | "faltas" | "fpp";
const COLUMNAS: { k: Col; t: string; sub?: string; largo: string }[] = [
  { k: "nombre", t: "Jugador", largo: "jugador" },
  { k: "pj", t: "PJ", largo: "partidos jugados" },
  { k: "media", t: "MEDIA", sub: "pts/partido", largo: "media de puntos por partido" },
  { k: "pts", t: "PTS", largo: "puntos" },
  { k: "segundos", t: "Min", largo: "minutos" },
  { k: "p2a", t: "2P", largo: "canastas de 2" },
  { k: "p3a", t: "3P", largo: "triples" },
  { k: "tl", t: "TL", largo: "tiros libres anotados" },
  { k: "pctTL", t: "TL%", largo: "% de tiros libres" },
  { k: "faltas", t: "Faltas", largo: "faltas" },
  { k: "fpp", t: "F/P", largo: "faltas por partido" },
];
const valor = (j: JugadorLiga, k: Col): number | string | null => {
  switch (k) {
    case "nombre": return j.nombre;
    case "media": return j.pj ? j.pts / j.pj : null;
    case "tl": return j.tla;
    case "pctTL": return j.tli ? j.tla / j.tli : null;
    case "fpp": return j.pj ? j.faltas / j.pj : null;
    default: return j[k];
  }
};
/** Orden de la tabla: por defecto, la media; por cualquier otra columna, de mayor a menor (el nombre, alfabetico). */
function ordenar(lista: JugadorLiga[], k: Col) {
  return [...lista].sort((a, b) => {
    const va = valor(a, k), vb = valor(b, k);
    if (typeof va === "string" || typeof vb === "string") return String(va).localeCompare(String(vb), "es");
    if (va !== vb) return va === null ? 1 : vb === null ? -1 : vb - va;
    return porMediaPts(a, b);
  });
}

export default async function Scouting({ searchParams }: { searchParams: Promise<Params> }) {
  const { supabase } = await exigirLiga();
  const { e, v, o } = await searchParams;
  const liga = await cargarLiga(supabase);
  const { clasificacion, calendario, hoy } = liga;
  if (!clasificacion.length) {
    return (<><Volver defecto="/liga" etiqueta="Liga" /><SecH titulo="Scouting rivales" tag="Con sesión" /><div className="aviso aviso-info">Todavía no hay datos de liga cargados (<code>npm run db:liga</code>).</div></>);
  }

  const proxMdA = proximoPartido(calendario, hoy, "MDA");
  const proxMdL = proximoPartido(calendario, hoy, "MDL");
  const vista = v === "mdl" ? "mdl" : "mda";
  const porDefecto = (vista === "mdl" ? proxMdL : proxMdA)?.rival ?? null;
  const elegido = clasificacion.find((c) => c.equipo === (e ?? porDefecto)) ?? clasificacion.find((c) => c.equipo === porDefecto) ?? clasificacion[0];
  const grupo = elegido.grupo;
  const col: Col = COLUMNAS.some((c) => c.k === o) ? (o as Col) : "media";
  const jugadores = ordenar(liga.jugadores.filter((j) => j.grupo === grupo && j.equipo === elegido.equipo), col);
  // D169: las tarjetas, por media y solo con un minimo de partidos (los demas, solo en la tabla).
  const minimo = minimoPartidos(elegido.pj);
  const peligrosos = masPeligrosos(jugadores, elegido.pj);
  const urlOrden = (k: Col) => `/liga/scouting?${new URLSearchParams({ ...(e ? { e } : {}), ...(v ? { v } : {}), ...(k === "media" ? {} : { o: k }) })}`;
  const dobla = quienDobla(liga.jugadores);
  const prox = elegido.nuestro ? null : proximoPartido(calendario, hoy, codigoNuestro(grupo) as "MDA" | "MDL", elegido.equipo);
  // Aviso de equipacion: con los mismos partidos de la tabla de eventos (D151, D162), como el Panel y la convocatoria.
  const aviso = prox ? avisoContra(codigoNuestro(grupo) as "MDA" | "MDL", elegido.equipo, calendario, hoy) : null;
  const suma = (k: "pts" | "p2a" | "p3a" | "tla" | "tli" | "faltas" | "segundos") => jugadores.reduce((s, j) => s + j[k], 0);
  const grupos = ["G1", "G2"];

  return (
    <>
      <Volver defecto="/liga" etiqueta="Liga" />
      <SecH titulo="Scouting rivales" tag="Con sesión" />
      <div className="aviso aviso-info">
        <b>Solo con sesión.</b> Datos por jugador de otros equipos: son de terceros; los ves por ser del equipo, no se publican (D73, D162).
      </div>

      <section className="tarjeta">
        <p className="lg-etq">Próximo rival</p>
        <div className="botones" style={{ marginTop: 6 }}>
          <Link className={`boton ${!e && vista === "mda" ? "boton-amarillo" : "boton-claro"}`} href="/liga/scouting?v=mda">
            MdA: {proxMdA?.rival ?? "–"}{proxMdA?.fecha ? ` · ${fechaCorta(proxMdA.fecha)}` : ""}
          </Link>
          <Link className={`boton ${!e && vista === "mdl" ? "boton-amarillo" : "boton-claro"}`} href="/liga/scouting?v=mdl">
            MdL: {proxMdL?.rival ?? "–"}{proxMdL?.fecha ? ` · ${fechaCorta(proxMdL.fecha)}` : ""}
          </Link>
        </div>
        <form method="get" action="/liga/scouting" className="lg-form">
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
            <Link className="boton boton-claro" href="/liga/consolidada#todos">Ver todos los jugadores de la liga</Link>
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
              {/* D129: todos juegan en Moratalaz; sin «en casa / fuera», el cartel tal cual sale en el calendario oficial. */}
              <div className="lg-prox-f">{prox.local === false ? `${elegido.equipo} – ${nombreNuestro(grupo)}` : `${nombreNuestro(grupo)} – ${elegido.equipo}`}</div>
              <div className="lg-prox-d">J{prox.jornada} · {prox.fecha ? fechaCorta(prox.fecha) : ""} · {prox.hora} · pista {prox.campo}</div>
              {aviso?.hay && <AvisoCaja a={aviso} />}
              {/* D160: la misma línea que la convocatoria, el WhatsApp y el aviso al móvil. */}
              {aviso?.convocatoria && <p className="lg-sub" data-testid="linea-equipacion">{aviso.convocatoria}</p>}
            </div>
          )}
          {elegido.nuestro && <p className="lg-sub">Es uno de los nuestros: así nos ven los rivales.</p>}
        </div>

        {jugadores.length === 0 ? <p>Sin hojas de este equipo todavía.</p> : (
          <>
            <h3 className="lg-etq" style={{ marginTop: 14 }}>Más peligrosos</h3>
            {peligrosos.length === 0 ? <p className="lg-sub">Nadie llega todavía a {minimo} {minimo === 1 ? "partido" : "partidos"} jugados.</p> : (
              <div className="lg-tres" data-testid="peligrosos">
                {peligrosos.map((j, i) => (
                  <div className="lg-max" key={j.nombre + j.dorsal} data-nombre={j.nombre}>
                    <div className="lg-max-n">{i + 1}.º más peligroso</div>
                    <div className="lg-max-nom">{bonito(j.nombre)} <small>{textoDorsales(j)}</small></div>
                    <div className="lg-max-p">{dec(j.pts / j.pj)}<small> pts/partido</small></div>
                    <div className="lg-max-x">{j.pts} pts en {j.pj} {j.pj === 1 ? "partido" : "partidos"} · {j.p2a} dobles · {j.p3a} triples · TL {j.tla}/{j.tli} · {j.faltas} faltas</div>
                  </div>
                ))}
              </div>
            )}

            <div className="tabla-desplazable lg-tabla-scouting" tabIndex={0} aria-label="Jugadores (desplazable a los lados)">
              <table className="lg-tabla" data-testid="tabla-scouting">
                <thead>
                  <tr>
                    {COLUMNAS.map((c) => (
                      <th key={c.k} scope="col" aria-sort={c.k === col ? (c.k === "nombre" ? "ascending" : "descending") : "none"}>
                        {c.k === col ? <span className="lg-orden-on">{c.t}{c.sub && <small>({c.sub})</small>}</span>
                          : <Link href={urlOrden(c.k)} title={`Ordenar por ${c.largo}`}>{c.t}{c.sub && <small>({c.sub})</small>}</Link>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jugadores.map((j) => (
                    <tr key={j.nombre + j.dorsal} data-nombre={j.nombre} className={peligrosos.includes(j) ? "lg-top" : ""}>
                      <td><b>{bonito(j.nombre)}</b> <small>{textoDorsales(j)}</small>{dobla.has(j.nombre) && <> <span className="etiqueta etiqueta-abierta">dobla</span></>}</td>
                      <td>{j.pj}</td><td><b>{dec(j.pj ? j.pts / j.pj : null)}</b></td><td>{j.pts}</td><td>{mmss(j.segundos)}</td>
                      <td>{j.p2a}</td><td>{j.p3a}</td><td>{j.tla}/{j.tli}</td><td>{j.tli ? `${Math.round((100 * j.tla) / j.tli)}%` : "–"}</td>
                      <td>{j.faltas}</td><td>{dec(j.pj ? j.faltas / j.pj : null)}</td>
                    </tr>
                  ))}
                  <tr className="lg-equipo">
                    <td><b>Equipo</b></td><td>{elegido.pj}</td><td>{dec(elegido.pj ? suma("pts") / elegido.pj : null)}</td><td><b>{suma("pts")}</b></td><td>{mmss(suma("segundos"))}</td>
                    <td>{suma("p2a")}</td><td>{suma("p3a")}</td><td>{suma("tla")}/{suma("tli")}</td><td></td><td>{suma("faltas")}</td><td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="lg-nota">
              2P y 3P: canastas anotadas (la hoja de la FBM no recoge los intentos de campo). TL: anotados/intentados. Los minutos son los de la
              hoja y pueden no cuadrar con el reloj. MEDIA = puntos por partido jugado; la tabla va por la media (toca un encabezado para ordenar por otra
              columna). «Más peligrosos»: los de más media entre quienes han jugado al menos {minimo} {minimo === 1 ? "partido" : "partidos"} (la mitad de los de su equipo,
              redondeando hacia arriba, o 2, lo que sea menor). Solo aparecen los jugadores que han jugado algún minuto según las hojas de la FBM; si alguien
              cambia de dorsal o su nombre viene escrito distinto, sale una vez, con todos sus dorsales.
            </p>
          </>
        )}
      </section>
    </>
  );
}
