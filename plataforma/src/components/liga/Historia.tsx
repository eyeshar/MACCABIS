"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ANIOS, ANIOS_TERMINADOS, EN_CURSO, etiquetaAnio, filasRejilla, kpisHistoria, motivoSinStats, norm, temporadaDeAnio, tiraTemporal, type Filtros, type PersonaH } from "@/lib/estadisticas/historia";
import { Control, Kpi, Nota, SecH, Segmento } from "./Comunes";

// Historia del club («El Club»): rejilla de personas por temporada, dos modos de orden excluyentes (D22), tira temporal y ficha
// de persona con puente a sus estadísticas. Solo enlaza a las temporadas que tienen página (nunca un 404).
export default function HistoriaClub({ personas, personaInicial }: { personas: PersonaH[]; personaInicial: string | null }) {
  const [vista, setVista] = useState<"rejilla" | "tira">("rejilla");
  const [buscar, setBuscar] = useState("");
  const [orden, setOrden] = useState<Filtros["orden"]>("veterania");
  const [quien, setQuien] = useState<Filtros["quien"]>("ALL");
  const [abierta, setAbierta] = useState<string | null>(personaInicial);
  const filtros: Filtros = { buscar: norm(buscar.trim()), quien, orden };
  const k = useMemo(() => kpisHistoria(personas), [personas]);
  const filas = useMemo(() => filasRejilla(personas, filtros), [personas, buscar, quien, orden]); // eslint-disable-line react-hooks/exhaustive-deps
  const tira = useMemo(() => tiraTemporal(personas), [personas]);
  const persona = abierta ? personas.find((p) => p.person_id === abierta) : null;
  const ncol = ANIOS.length + 2;

  const fila = (p: PersonaH, n: number | string) => (
    <tr key={p.person_id} data-pid={p.person_id} onClick={() => setAbierta(p.person_id)} tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAbierta(p.person_id); } }}>
      <td className="e-hname">
        <div className="e-hn">
          <span className="e-hnum">{n}</span>
          <span className="e-hdisp" title={p.formal || p.display}>{p.display}</span>
          {(p.solo_mote || p.de_paso) && <span className="e-hchip e-hchip-mote">de paso</span>}
          {p.es_entrenador && <span className="e-hchip e-hchip-coach">entrenador</span>}
          <span className="e-hveter" title={orden === "debut" ? "Se incorporó en la temporada " + etiquetaAnio(p.temporadas_jugadas[0] || "") : p.n_temporadas + " temporadas en el club"}>
            {orden === "debut" ? (p.temporadas_jugadas.length ? etiquetaAnio(p.temporadas_jugadas[0]) : "—") : p.n_temporadas}
          </span>
        </div>
      </td>
      {ANIOS.map((y, i) => {
        if (!p.temporadas_jugadas.includes(y)) return <td key={y} className={`e-hcell${y === EN_CURSO ? " e-hcurso" : ""}`} />;
        const ini = i === 0 || !p.temporadas_jugadas.includes(ANIOS[i - 1]);
        const fin = i === ANIOS.length - 1 || !p.temporadas_jugadas.includes(ANIOS[i + 1]);
        const st = p.stats.includes(temporadaDeAnio(y));
        const sin = y === EN_CURSO ? " · en curso, aún sin partidos" : " · sin estadísticas de ese año";
        return (
          <td key={y} className={`e-hcell${y === EN_CURSO ? " e-hcurso" : ""}`}>
            <div className={`e-hmark${st ? " e-hstats" : ""}${ini ? " e-hini" : ""}${fin ? " e-hfin" : ""}`}
              title={`${p.display} · ${etiquetaAnio(y)}${st ? " · con estadísticas" : sin}`} />
          </td>
        );
      })}
      <td className="e-hfill" />
    </tr>
  );

  return (
    <>
      <div className="e-controles">
        <Control etiqueta="Vista"><Segmento etiqueta="Vista" valor={vista} opciones={[{ v: "rejilla", t: "Rejilla" }, { v: "tira", t: "Por temporada" }]} onCambia={setVista} /></Control>
        <Control etiqueta="Buscar persona">
          <input type="search" className="e-select e-buscar" placeholder="nombre o apellido…" value={buscar} onChange={(e) => setBuscar(e.target.value)} aria-label="Buscar persona" />
        </Control>
        <Control etiqueta="Ordenar por"><Segmento etiqueta="Orden" valor={orden} opciones={[{ v: "veterania", t: "Veteranía" }, { v: "debut", t: "Año de incorporación" }]} onCambia={setOrden} /></Control>
        <Control etiqueta="Quién"><Segmento etiqueta="Quién" valor={quien} opciones={[{ v: "ALL", t: "Todos" }, { v: "STATS", t: "Con estadísticas" }, { v: "NOSTATS", t: "Sólo presencia" }]} onCambia={setQuien} /></Control>
      </div>

      <div className="e-kpis" data-testid="historia-kpis">
        <Kpi tono="accent" lab="Personas" val={k.personas} foot="han vestido la camiseta" />
        <Kpi tono="grape" lab="Temporadas" val={ANIOS.length} foot={`2013/14 → ${etiquetaAnio(ANIOS[ANIOS.length - 1])}`} />
        <Kpi tono="gold" lab="Más veterano" val={k.top ? k.top.n_temporadas : "—"} foot={k.top ? k.top.display : ""} />
        <Kpi lab="Plantilla media" val={k.media} foot="jugadores por temporada ¹" />
        <Kpi lab="De paso" val={k.fugaces} foot="una sola temporada ¹" />
        <Kpi tono="win" lab="Con estadísticas" val={k.conStats} foot={`de ${k.personas} tienen ficha`} />
      </div>
      <p className="e-nota" data-testid="historia-nota-curso">
        ¹ La {etiquetaAnio(EN_CURSO)} está en curso: cuenta en las temporadas de cada persona, pero no en la plantilla media (solo las {ANIOS_TERMINADOS.length} terminadas) ni en «De paso» (quien solo lleva la {etiquetaAnio(EN_CURSO)} aún no se ha ido).
      </p>

      {vista === "rejilla" ? (
        <div data-testid="historia-rejilla">
          <SecH titulo="Quién ha pasado por el club" tag={`${filas.nJug + filas.tecnico.length} de ${personas.length} personas`} />
          <div className="e-hgrid-wrap" tabIndex={0} aria-label="Rejilla de personas por temporada (desplazable)">
            <table className="e-hgrid">
              <thead>
                <tr>
                  <th className="e-hname">Persona<span className="e-hmodo"> · {orden === "debut" ? "por año de incorporación" : "por veteranía"}</span></th>
                  {ANIOS.map((y) => y === EN_CURSO
                    ? <th key={y} className="e-hcurso" title={`Temporada ${etiquetaAnio(y)}, en curso: la plantilla con ficha y el cuerpo técnico`}>{etiquetaAnio(y)}<span className="e-hcurso-tag">en curso</span></th>
                    : <th key={y} title={`Temporada ${etiquetaAnio(y)}`}>{etiquetaAnio(y)}</th>)}
                  <th className="e-hfill" />
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let n = 0;
                  const cuerpo = filas.tramos.flatMap((t) => [
                    ...(t.tit ? [<tr key={"t" + t.tit} className="e-hsep"><td colSpan={ncol}>{t.tit} <span className="e-tenue">· {t.personas.length}</span></td></tr>] : []),
                    ...t.personas.map((p) => fila(p, ++n)),
                  ]);
                  if (filas.tecnico.length) cuerpo.push(<tr key="tec" className="e-hsep"><td colSpan={ncol}>Cuerpo técnico · nunca jugó</td></tr>, ...filas.tecnico.map((p) => fila(p, "—")));
                  return cuerpo.length ? cuerpo : [<tr key="vacio"><td className="e-vacio" colSpan={ncol}>Nadie coincide con el filtro.</td></tr>];
                })()}
              </tbody>
            </table>
          </div>
          <div className="e-hleyenda">
            <span><i className="e-hl-stats" />Temporada con estadísticas</span>
            <span><i className="e-hl-sin" />En el club, sin estadísticas de ese año</span>
          </div>
          <p className="e-nota" data-testid="historia-nota-encurso">
            La {etiquetaAnio(EN_CURSO)} está <b>en curso</b>: salen todos los jugadores con ficha del MdA o del MdL y el cuerpo técnico. Quien aún no ha jugado ningún partido va en amarillo y pasa a naranja con el primero.
          </p>
          <p className="e-nota" data-testid="historia-nota-orden">
            {orden === "debut"
              ? <>Ordenado por <b>año de incorporación</b>, del más antiguo al más reciente: la cifra dorada es la temporada de debut. Lista plana, sin tramos de veteranía.</>
              : <>Ordenado por <b>veteranía</b> y agrupado por tramos: la cifra dorada es el número de temporadas.</>}
            {" "}El cuerpo técnico va siempre en su propia sección. Pincha en cualquier fila para ver su ficha y saltar a sus estadísticas.
          </p>
        </div>
      ) : (
        <div data-testid="historia-tira">
          <SecH titulo="Temporada a temporada" tag={`${ANIOS.length} temporadas, la última en curso`} />
          <div className="e-htira">
            {tira.map((a) => (
              <div key={a.y} className="e-htcard">
                <div className="e-kpi-tira" />
                <h3>{etiquetaAnio(a.y)}{a.y === EN_CURSO && <span className="e-hcurso-tag">en curso</span>}</h3>
                <div className="e-htn">{a.jugadores}</div><div className="e-htl">jugadores</div>
                <div className="e-htab"><span className="e-alta">▲ {a.altas.length} altas</span><span className="e-baja">▼ {a.bajas.length} bajas</span></div>
                <ul>
                  {a.altas.slice(0, 4).map((p) => <li key={"a" + p.person_id} className="e-alta" title={p.display}>{p.display}</li>)}
                  {a.altas.length > 4 && <li className="e-mas">…y {a.altas.length - 4} más</li>}
                  {a.bajas.slice(0, 4).map((p) => <li key={"b" + p.person_id} className="e-baja" title={p.display}>{p.display}</li>)}
                  {a.bajas.length > 4 && <li className="e-mas">…y {a.bajas.length - 4} más</li>}
                </ul>
              </div>
            ))}
          </div>
          <Nota>Altas = quien no estaba la temporada anterior. Bajas = quien estaba y no siguió. En la {etiquetaAnio(EN_CURSO)}, en curso, cuenta la plantilla con ficha.</Nota>
        </div>
      )}

      {persona && <FichaPersona p={persona} onCerrar={() => setAbierta(null)} />}
    </>
  );
}

function FichaPersona({ p, onCerrar }: { p: PersonaH; onCerrar: () => void }) {
  const cerrar = useRef(onCerrar); cerrar.current = onCerrar;
  const boton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    boton.current?.focus();
    const esc = (ev: KeyboardEvent) => { if (ev.key === "Escape") cerrar.current(); };
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; previo?.focus?.(); };
  }, []);
  const seasons = [...p.stats].sort();
  const aniosPersona = ANIOS.filter((y) => p.temporadas_jugadas.includes(y));
  return (
    <div className="e-modal" onClick={(ev) => { if (ev.target === ev.currentTarget) onCerrar(); }}>
      <div className="e-modal-caja e-modal-hist" role="dialog" aria-modal="true" aria-label={`Ficha de ${p.display}`} data-testid="historia-ficha">
        <div className="e-modal-cab">
          <div className="e-hficha-cab">
            <div className="e-hini-letra">{p.display.charAt(0)}</div>
            <div>
              <h3>{p.display}{(p.solo_mote || p.de_paso) && <span className="e-hchip e-hchip-mote">de paso</span>}{p.es_entrenador && <span className="e-hchip e-hchip-coach">entrenador</span>}</h3>
              <div className="e-modal-sub">{p.solo_mote ? "sin nombre formal registrado" : p.formal || ""}</div>
            </div>
          </div>
          <button ref={boton} type="button" className="e-cerrar" aria-label="Cerrar" onClick={onCerrar}>×</button>
        </div>
        <div className="e-modal-cuerpo">
          <div className="e-kpis">
            <Kpi tono="grape" lab="Temporadas" val={p.n_temporadas} foot="jugadas en el club" />
            <Kpi tono="accent" lab="Debut" val={p.temporadas_jugadas.length ? etiquetaAnio(p.temporadas_jugadas[0]) : "—"} foot={p.temporadas_jugadas.length ? "última: " + etiquetaAnio(p.temporadas_jugadas[p.temporadas_jugadas.length - 1]) : ""} />
            <Kpi tono="gold" lab="Con estadísticas" val={p.stats.length} foot="temporadas con ficha" />
          </div>
          {p.solo_mote && <Nota>Persona real de paso de la que sólo se conserva el mote. Se mantiene en la historia del club, sin ficha de jugador.</Nota>}
          {p.es_entrenador && <Nota>Entrenador y delegado del club. Nunca jugó, así que queda fuera de cualquier ranking de jugador.</Nota>}
          <SecH titulo="Presencia en el club" />
          <div className="e-hyears">
            {aniosPersona.map((y) => {
              const sid = temporadaDeAnio(y);
              if (!p.stats.includes(sid)) return <span key={y} className="e-hy e-hy-jug" title={y === EN_CURSO ? "En la plantilla de la temporada en curso, aún sin partidos" : "Estuvo en el club, sin estadísticas de ese año"}>{etiquetaAnio(y)}{y === EN_CURSO ? " · en curso" : ""}</span>;
              const d = p.destinos[sid];
              if (d === "ficha") return <Link key={y} href={`/jugador/${p.person_id}?t=${sid}`} className="e-hy e-hy-jug e-hy-stats" title={`Ver sus estadísticas de ${etiquetaAnio(y)}${y === EN_CURSO ? " (en curso)" : ""}`}>{etiquetaAnio(y)}{y === EN_CURSO ? " · en curso" : ""} ›</Link>;
              if (d === "mda") return <Link key={y} href={`/liga/${sid}/mda`} className="e-hy e-hy-jug e-hy-stats" title={`Su resumen del MdA de ${etiquetaAnio(y)} (solo hay el resumen de temporada)`}>{etiquetaAnio(y)} ›</Link>;
              return <span key={y} className="e-hy e-hy-jug e-hy-stats e-hy-sinenlace" title="Con estadísticas, sin página propia">{etiquetaAnio(y)}</span>;
            })}
          </div>
          <SecH titulo="Estadísticas" />
          {seasons.length ? (
            <p className="e-hestado">Tiene ficha de jugador en <b>{seasons.length} temporada{seasons.length > 1 ? "s" : ""}</b>: las de arriba en naranja. Pincha cualquiera para abrir sus estadísticas de ese año.</p>
          ) : <p className="e-hestado">{motivoSinStats(p)}</p>}
        </div>
      </div>
    </div>
  );
}
