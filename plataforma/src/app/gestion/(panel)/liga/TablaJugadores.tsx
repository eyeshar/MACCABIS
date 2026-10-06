"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { bonito, dec, mmss, type FilaTabla } from "@/lib/jugadoresLiga";
import { comparadorTabla, pasaMinimo, type Columna, type Minimo } from "@/lib/ordenLideres";

// Tabla "Todos los jugadores" de la liga (G1 + G2, con MdA y MdL). Solo gestores (D73): son datos de terceros.
// Solo lo que trae la hoja de la FBM; nada estimado.

const POR_PAGINA = 25;
const COLUMNAS: { k: Columna; t: string; largo: string; texto?: boolean }[] = [
  { k: "nombre", t: "Jugador", largo: "Jugador", texto: true },
  { k: "equipo", t: "Equipo", largo: "Equipo", texto: true },
  { k: "pj", t: "PJ", largo: "Partidos jugados" },
  { k: "segundos", t: "MIN", largo: "Minutos" },
  { k: "pts", t: "PTS", largo: "Puntos" },
  { k: "media", t: "Media", largo: "Media de puntos" },
  { k: "p2a", t: "2P", largo: "Dobles anotados" },
  { k: "p3a", t: "3P", largo: "Triples anotados" },
  { k: "tla", t: "TL", largo: "Tiros libres (anotados/intentados)" },
  { k: "pctTL", t: "TL%", largo: "% de tiros libres" },
  { k: "faltas", t: "Faltas", largo: "Faltas cometidas" },
  { k: "fpp", t: "F/P", largo: "Faltas por partido" },
];

const urlEquipo = (e: string) => `/gestion/scouting?e=${encodeURIComponent(e)}`;

function celda(j: FilaTabla, k: Columna, pp: boolean): string {
  const por = (v: number) => (j.pj ? v / j.pj : 0);
  switch (k) {
    case "nombre": return bonito(j.nombre);
    case "equipo": return `${j.equipos.join(" + ")} · ${j.grupos.join("+")}`;
    case "pj": return String(j.pj);
    case "segundos": return mmss(pp ? por(j.segundos) : j.segundos);
    case "pts": return String(j.pts);
    case "media": return j.pj ? dec(j.pts / j.pj) : "–";
    case "p2a": return pp ? dec(por(j.p2a)) : String(j.p2a);
    case "p3a": return pp ? dec(por(j.p3a)) : String(j.p3a);
    case "tla": return pp ? `${dec(por(j.tla))}/${dec(por(j.tli))}` : `${j.tla}/${j.tli}`;
    case "pctTL": return j.tli ? `${Math.round((100 * j.tla) / j.tli)}%` : "–";
    case "faltas": return pp ? dec(por(j.faltas)) : String(j.faltas);
    case "fpp": return j.pj ? dec(j.faltas / j.pj) : "–";
  }
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const clave = (j: FilaTabla) => `${j.grupo}|${j.equipo}|${j.nombre}`;

export default function TablaJugadores({ filas, equipos }: { filas: FilaTabla[]; equipos: { grupo: string; equipo: string }[] }) {
  const [col, setCol] = useState<Columna>("pts");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [porPartido, setPorPartido] = useState(false);
  const [grupo, setGrupo] = useState("todos");
  const [equipo, setEquipo] = useState("todos");
  const [soloMaccabis, setSoloMaccabis] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [minimo, setMinimo] = useState<string>("auto");
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const [abierta, setAbierta] = useState<string | null>(null);

  const cambiar = <T,>(f: (v: T) => void) => (v: T) => { f(v); setVisibles(POR_PAGINA); setAbierta(null); };
  const ordenarPor = (k: Columna) => {
    if (k === col) setDir((d) => (d === 1 ? -1 : 1));
    else { setCol(k); setDir(COLUMNAS.find((c) => c.k === k)?.texto ? 1 : -1); }
    setVisibles(POR_PAGINA); setAbierta(null);
  };

  const equiposVisibles = equipos.filter((e) => grupo === "todos" || e.grupo === grupo);
  const min: Minimo = minimo === "auto" || minimo === "todos" ? minimo : Number(minimo);

  const lista = useMemo(() => {
    const q = sinTildes(buscar.trim());
    return filas
      .filter((j) => (grupo === "todos" || j.grupos.includes(grupo))
        && (equipo === "todos" || j.equipos.includes(equipo))
        && (!soloMaccabis || j.nuestro)
        && (!q || sinTildes(j.nombre).includes(q))
        && pasaMinimo(j, col, min, porPartido))
      .sort(comparadorTabla(col, dir, porPartido));
  }, [filas, grupo, equipo, soloMaccabis, buscar, col, dir, porPartido, min]);

  const ocultosPorMinimo = useMemo(() => {
    if (min === "todos") return 0;
    const q = sinTildes(buscar.trim());
    return filas.filter((j) => (grupo === "todos" || j.grupos.includes(grupo)) && (equipo === "todos" || j.equipos.includes(equipo))
      && (!soloMaccabis || j.nuestro) && (!q || sinTildes(j.nombre).includes(q)) && !pasaMinimo(j, col, min, porPartido)).length;
  }, [filas, grupo, equipo, soloMaccabis, buscar, col, min, porPartido]);

  const visible = lista.slice(0, visibles);
  const nombreCol = COLUMNAS.find((c) => c.k === col)!;
  const flecha = (k: Columna) => (k === col ? (dir === 1 ? " ▲" : " ▼") : "");

  const enlaceEquipos = (j: FilaTabla) =>
    j.equipos.map((e, i) => (
      <span key={e}>{i > 0 && " + "}<Link href={urlEquipo(e)} className="lg-enlace">{e}</Link></span>
    ));

  return (
    <section className="tarjeta lg-todos" aria-label="Todos los jugadores">
      <h2 style={{ marginTop: 0 }}>Todos los jugadores</h2>
      <p className="lg-sub">{filas.length} personas de la liga (G1 + G2, con MdA y MdL). «dobla» = sale con MdA y con MdL: una sola fila, con las dos fichas sumadas.</p>

      <div className="lg-filtros">
        <div className="lg-conmutador" role="group" aria-label="Totales o por partido">
          <button type="button" className={!porPartido ? "on" : ""} aria-pressed={!porPartido} onClick={() => cambiar(setPorPartido)(false)}>Totales</button>
          <button type="button" className={porPartido ? "on" : ""} aria-pressed={porPartido} onClick={() => cambiar(setPorPartido)(true)}>Por partido</button>
        </div>
        <label>Grupo
          <select value={grupo} onChange={(e) => { cambiar(setGrupo)(e.target.value); setEquipo("todos"); }}>
            <option value="todos">Todos</option><option value="G1">G1 · MdA</option><option value="G2">G2 · MdL</option>
          </select>
        </label>
        <label>Equipo
          <select value={equipo} onChange={(e) => cambiar(setEquipo)(e.target.value)}>
            <option value="todos">Todos</option>
            {equiposVisibles.map((e) => <option key={e.equipo} value={e.equipo}>{e.equipo}</option>)}
          </select>
        </label>
        <label>Buscar
          <input type="search" value={buscar} placeholder="Nombre…" onChange={(e) => cambiar(setBuscar)(e.target.value)} />
        </label>
        <label>Mínimo de partidos
          <select value={minimo} onChange={(e) => cambiar(setMinimo)(e.target.value)}>
            <option value="auto">Automático</option><option value="todos">Todos</option>
            <option value="2">2 o más</option><option value="3">3 o más</option><option value="5">5 o más</option>
          </select>
        </label>
        <label className="lg-check"><input type="checkbox" checked={soloMaccabis} onChange={(e) => cambiar(setSoloMaccabis)(e.target.checked)} /> Solo Maccabis</label>
        <label className="lg-ordenar solo-movil-bloque">Ordenar por
          <span className="lg-ordenar-fila">
            <select value={col} onChange={(e) => ordenarPor(e.target.value as Columna)} aria-label="Ordenar por">
              {COLUMNAS.map((c) => <option key={c.k} value={c.k}>{c.largo}</option>)}
            </select>
            <button type="button" className="boton boton-claro" onClick={() => { setDir((d) => (d === 1 ? -1 : 1)); setVisibles(POR_PAGINA); }} aria-label={dir === 1 ? "Orden ascendente" : "Orden descendente"}>{dir === 1 ? "▲" : "▼"}</button>
          </span>
        </label>
      </div>

      <p className="lg-nota" role="status">
        Mostrando {Math.min(visibles, lista.length)} de {lista.length} · orden: {nombreCol.largo} ({dir === 1 ? "de menor a mayor" : "de mayor a menor"}){porPartido ? ", por partido" : ""}.
        {ocultosPorMinimo > 0 && ` ${ocultosPorMinimo} ${ocultosPorMinimo === 1 ? "persona oculta" : "personas ocultas"} por el mínimo de partidos${min === "auto" ? " (al ordenar por una media: la mitad de los partidos de su equipo, y 3 TL intentados para el %)" : ""}.`}
      </p>

      {/* Escritorio: tabla completa, cabeceras pulsables y cabecera fija al desplazar */}
      <div className="lg-tabla-scroll solo-escritorio">
        <table className="lg-tabla lg-tabla-todos">
          <thead>
            <tr>
              {COLUMNAS.map((c) => (
                <th key={c.k} scope="col" aria-sort={c.k === col ? (dir === 1 ? "ascending" : "descending") : "none"}>
                  <button type="button" onClick={() => ordenarPor(c.k)} title={`Ordenar por: ${c.largo}`}>{c.t}{c.k === "tla" || c.k === "p2a" || c.k === "p3a" || c.k === "segundos" || c.k === "faltas" ? (porPartido ? "/p" : "") : ""}{flecha(c.k)}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((j) => (
              <tr key={clave(j)} className={j.nuestro ? "lg-nuestro" : ""}>
                <td><Link href={urlEquipo(j.equipos[0])} className="lg-enlace"><b>{bonito(j.nombre)}</b></Link> <small>#{j.dorsal}</small>{j.dobla && <> <span className="etiqueta etiqueta-abierta">dobla</span></>}</td>
                <td>{enlaceEquipos(j)} <small>{j.grupos.join("+")}</small></td>
                <td>{j.pj}</td><td>{celda(j, "segundos", porPartido)}</td><td><b>{j.pts}</b></td><td>{celda(j, "media", false)}</td>
                <td>{celda(j, "p2a", porPartido)}</td><td>{celda(j, "p3a", porPartido)}</td><td>{celda(j, "tla", porPartido)}</td><td>{celda(j, "pctTL", false)}</td>
                <td>{celda(j, "faltas", porPartido)}</td><td>{celda(j, "fpp", false)}</td>
              </tr>
            ))}
            {visible.length === 0 && <tr><td colSpan={12}>Ningún jugador con estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Movil: filas compactas; al tocar una se despliega el resto */}
      <ul className="lista-limpia lg-compactas solo-movil" aria-label="Jugadores">
        {visible.map((j) => {
          const k = clave(j);
          const abierto = abierta === k;
          const otra = col !== "pts" && col !== "nombre" && col !== "equipo";
          return (
            <li key={k} className={`lg-fila${j.nuestro ? " lg-nuestro" : ""}${abierto ? " abierta" : ""}`}>
              <button type="button" className="lg-fila-cab" aria-expanded={abierto} onClick={() => setAbierta(abierto ? null : k)}>
                <span className="lg-fila-nom">
                  <b>{bonito(j.nombre)}</b> <small>#{j.dorsal}</small>{j.dobla && <> <span className="etiqueta etiqueta-abierta">dobla</span></>}
                  <small className="lg-fila-eq">{j.equipos.join(" + ")} · {j.grupos.join("+")}</small>
                </span>
                {otra && <span className="lg-fila-val"><small>{nombreCol.t}</small>{celda(j, col, porPartido)}</span>}
                <span className="lg-fila-val lg-fila-pts"><small>PTS</small><b>{j.pts}</b></span>
              </button>
              {abierto && (
                <div className="lg-fila-det">
                  <dl>
                    {COLUMNAS.filter((c) => c.k !== "nombre" && c.k !== "equipo").map((c) => (
                      <div key={c.k}><dt>{c.t}{porPartido && ["segundos", "p2a", "p3a", "tla", "faltas"].includes(c.k) ? "/p" : ""}</dt><dd>{celda(j, c.k, porPartido)}</dd></div>
                    ))}
                  </dl>
                  <p className="lg-fila-enl">Ver en Scouting: {enlaceEquipos(j)}</p>
                </div>
              )}
            </li>
          );
        })}
        {visible.length === 0 && <li className="lg-fila">Ningún jugador con estos filtros.</li>}
      </ul>

      {lista.length > visibles && (
        <div className="lg-vermas">
          <button type="button" className="boton" onClick={() => setVisibles((v) => v + POR_PAGINA)}>Ver {Math.min(POR_PAGINA, lista.length - visibles)} más</button>
        </div>
      )}

      <p className="lg-nota">
        Solo datos que trae la hoja de la FBM: <b>no hay faltas recibidas ni intentos de campo</b> (2P y 3P son canastas anotadas), y los tiros
        libres son anotados/intentados. Los minutos son los de la hoja y pueden no cuadrar con el reloj. Nada está estimado. «Por partido»
        divide minutos, 2P, 3P, TL y faltas entre los partidos jugados (PJ); PTS, Media, TL% y F/P no cambian. A igualdad en la columna
        elegida, el orden es siempre el mismo: puntos, media, nombre y equipo.
      </p>
    </section>
  );
}
