import Link from "next/link";
import Volver from "@/components/nav/Volver";
import "../eventos/eventos.css";
import "./asistencia.css";
import Plegable from "./Plegable";
import { exigirGestor } from "@/lib/sesion";
import { hoyMadrid } from "@/lib/dias";
import { cargarFilasGuardadas, cargarFilasPlataforma, cargarTotales, TEMPORADA } from "@/lib/eventos/asistenciaDatos";
import {
  calcularJugadores, colorPct, COLUMNAS, DIR_DEFECTO, eventosDe, MINIMO_EVENTOS, ordenar, PRIMERA_GUARDADA, PRIMERA_PRECISA, separar, temporadasDesde, textoPct,
  type Columna, type Cuenta, type FilaJugador, type Filtros,
} from "@/lib/eventos/asistenciaPantalla";

export const metadata = { title: "Asistencia y motivos · Gestión Maccabis" };

type Params = { t?: string; ver?: string; eq?: string; p?: string; o?: string; d?: string };
const ETIQUETA: Record<Columna, string> = { jugador: "Jugador", total: "TOTAL %", entrenos: "Entrenos %", partidos: "Partidos %", sin: "Sin excusa", tendencia: "Tendencia" };

// «Asistencia y motivos» (D170). Solo gestores (D46, D82): lee asistencia_eventos (SportEasy hasta el 23/10/2026), suma en
// vivo las respuestas de la plataforma desde el 24/10 (D161) y, para 2025/26, los totales corregidos a mano de
// asistencia_motivos (D72). Todo vive en la URL: temporadas (t), ver, equipo (eq), periodo (p), orden (o, d).
export default async function Asistencia({ searchParams }: { searchParams: Promise<Params> }) {
  const q = await searchParams;
  const { supabase } = await exigirGestor();
  const hoy = hoyMadrid();
  const [totales, plat] = await Promise.all([cargarTotales(supabase), cargarFilasPlataforma(supabase)]);
  const todas = [...new Set([...totales.map((t) => t.temporada), ...temporadasDesde(PRIMERA_GUARDADA, TEMPORADA)])].sort().reverse();
  const pedidas = (q.t ?? "").split(",").filter((x) => todas.includes(x));
  const temporadas = pedidas.length ? todas.filter((x) => pedidas.includes(x)) : [TEMPORADA];
  const f: Filtros = {
    temporadas, ver: q.ver === "todos" ? "todos" : "actual", equipo: q.eq === "MdA" || q.eq === "MdL" ? q.eq : "todos", periodo: q.p === "4s" ? "4s" : "temporada",
  };
  const col: Columna = COLUMNAS.includes(q.o as Columna) ? (q.o as Columna) : "total";
  const dir: "asc" | "desc" = q.d === "asc" || q.d === "desc" ? q.d : DIR_DEFECTO[col];

  const guardadas = await cargarFilasGuardadas(supabase, { temporadas });
  const filas = [...guardadas, ...(temporadas.includes(TEMPORADA) ? plat.filas : [])];
  const js = ordenar(calcularJugadores({ filas, totales, hoy }, f, f.ver === "actual" ? plat.actuales : null), col, dir);
  const { ranking, pocos } = separar(js);

  const href = (c: Partial<{ t: string[]; ver: string; eq: string; p: string; o: string; d: string }>) => {
    const v = { t: temporadas, ver: f.ver, eq: f.equipo, p: f.periodo === "4s" ? "4s" : "temporada", o: col, d: dir, ...c };
    const u = new URLSearchParams();
    if (v.t.join() !== TEMPORADA) u.set("t", v.t.join(","));
    if (v.ver === "todos") u.set("ver", "todos");
    if (v.eq !== "todos") u.set("eq", v.eq);
    if (v.p === "4s") u.set("p", "4s");
    if (v.o !== "total" || v.d !== "desc") { u.set("o", v.o); u.set("d", v.d); }
    const s = u.toString();
    return s ? `/gestion/asistencia?${s}` : "/gestion/asistencia";
  };
  const alternar = (x: string) => {
    const nuevas = temporadas.includes(x) ? temporadas.filter((y) => y !== x) : todas.filter((y) => y === x || temporadas.includes(y));
    return nuevas.length ? nuevas : temporadas;
  };
  const ultimas2 = todas.slice(0, 2);
  const mismas = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const hayAprox = temporadas.some((t) => t < PRIMERA_PRECISA);
  const haySegun = js.some((j) => j.segunSportEasy);
  const etiquetaT = temporadas.map((t) => t.replace("-", "/")).join(" + ");

  const celdaPct = (c: Cuenta, p: number | null, aprox: boolean) => {
    const color = colorPct(p);
    return (
      <>
        <span className="as-pct">
          <span className={`as-barra ${color ? `as-${color}` : ""}`} aria-hidden="true"><i style={{ width: `${p == null ? 0 : Math.round(p * 100)}%` }} /></span>
          <b>{textoPct(p)}</b>
          {aprox && p != null && <span className="as-aprox" data-testid="marca-aprox" title="Aproximado: SportEasy no guardaba «no convocado» ni casi nunca las lesiones">aprox.</span>}
        </span>
        <span className="as-det">{c.fue} / {eventosDe(c)}</span>
      </>
    );
  };
  const fila = (j: FilaJugador) => (
    <div key={j.person_id} className="as-fila" role="row" data-person={j.person_id}>
      <div className="as-celda" role="cell" data-col="jugador"><Link href={`/gestion/asistencia/${encodeURIComponent(j.person_id)}`}>{j.nombre}</Link></div>
      <div className="as-celda" role="cell" data-col="total" data-valor={j.pctTotal ?? ""}>{celdaPct(j.total, j.pctTotal, j.aprox)}</div>
      <div className="as-celda" role="cell" data-col="entrenos" data-valor={j.pctEntrenos ?? ""}>{celdaPct(j.entrenos, j.pctEntrenos, j.aprox)}</div>
      <div className="as-celda" role="cell" data-col="partidos" data-valor={j.pctPartidos ?? ""}>{celdaPct(j.partidos, j.pctPartidos, j.aprox || j.segunSportEasy)}</div>
      <div className={`as-celda${j.sin > 0 ? " alerta" : ""}`} role="cell" data-col="sin" data-valor={j.sin}>{j.sin}</div>
      <div className="as-celda" role="cell" data-col="tendencia" data-dir={j.tendencia.dir ?? "nada"}>
        {j.tendencia.dir ? (
          <span className={`as-${j.tendencia.dir}`} title={`Últimas 4 semanas: ${textoPct(j.tendencia.pct4)}`} aria-label={`Tendencia ${j.tendencia.dir === "sube" ? "al alza" : j.tendencia.dir === "baja" ? "a la baja" : "estable"}; últimas 4 semanas: ${textoPct(j.tendencia.pct4)}`}>
            {j.tendencia.dir === "sube" ? "▲" : j.tendencia.dir === "baja" ? "▼" : "="}
          </span>
        ) : <span className="as-nada" title="Sin eventos en las últimas 4 semanas">—</span>}
      </div>
    </div>
  );

  return (
    <>
      <Volver defecto="/gestion" etiqueta="Gestión" />
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow">Solo gestores · {etiquetaT}</div>
          <h1>Asistencia y motivos</h1>
        </div>
      </div>
      <Plegable resumen={`Filtros · ${etiquetaT} · ${f.ver === "actual" ? "plantilla actual" : "todos"}${f.equipo !== "todos" ? ` · ${f.equipo}` : ""}${f.periodo === "4s" ? " · últimas 4 semanas" : ""}`}>
        <div className="as-filtros">
          <fieldset className="as-grupo" aria-label="Temporadas">
            <legend>Temporadas</legend>
            <div className="as-chips">
              {todas.map((x) => <Link key={x} href={href({ t: alternar(x) })} aria-pressed={temporadas.includes(x)}>{x.replace("-", "/")}</Link>)}
              <Link className="as-atajo" href={href({ t: [TEMPORADA] })} aria-current={mismas(temporadas, [TEMPORADA]) ? "true" : undefined}>Esta</Link>
              <Link className="as-atajo" href={href({ t: ultimas2 })} aria-current={mismas(temporadas, ultimas2) ? "true" : undefined}>Últimas 2</Link>
              <Link className="as-atajo" href={href({ t: todas })} aria-current={mismas(temporadas, todas) ? "true" : undefined}>Todas</Link>
            </div>
          </fieldset>
          <div className="as-grupo"><span className="as-etq">Ver</span>
            <div className="as-chips">
              <Link href={href({ ver: "actual" })} aria-current={f.ver === "actual" ? "true" : undefined}>Plantilla actual</Link>
              <Link href={href({ ver: "todos" })} aria-current={f.ver === "todos" ? "true" : undefined}>Todos</Link>
            </div>
          </div>
          <div className="as-grupo"><span className="as-etq">Equipo</span>
            <div className="as-chips">
              {(["todos", "MdA", "MdL"] as const).map((e) => <Link key={e} href={href({ eq: e })} aria-current={f.equipo === e ? "true" : undefined}>{e === "todos" ? "Todos" : e}</Link>)}
            </div>
          </div>
          <div className="as-grupo"><span className="as-etq">Periodo</span>
            <div className="as-chips">
              <Link href={href({ p: "temporada" })} aria-current={f.periodo === "temporada" ? "true" : undefined}>Temporada</Link>
              <Link href={href({ p: "4s" })} aria-current={f.periodo === "4s" ? "true" : undefined}>Últimas 4 semanas</Link>
            </div>
          </div>
        </div>
      </Plegable>
      <p className="as-nota">
        Asistencia = fue / (fue + faltas). Faltas = con excusa + sin excusa. No cuentan «no convocado» ni lesión. TOTAL suma entrenos y partidos (no es la media). Mínimo {MINIMO_EVENTOS} eventos para el ranking. Ningún jugador ve esta pantalla (D46, D82).
      </p>
      {hayAprox && (
        <p className="as-nota" data-testid="nota-aprox">
          <b>aprox.</b> Las temporadas anteriores a 2025/26 vienen de SportEasy, que no guardaba «no convocado» ni casi nunca las lesiones: esos porcentajes son aproximados (suelen salir algo más bajos).
        </p>
      )}
      {haySegun && (
        <p className="as-nota" data-testid="nota-segun-sporteasy">
          Partidos de 2025/26 por equipo: los totales corregidos a mano (D72) no distinguen MdA y MdL, así que esos partidos salen del detalle de SportEasy.
        </p>
      )}
      {js.length === 0 ? <div className="hueco" data-testid="sin-datos">No hay datos de asistencia con estos filtros.</div> : (
        <section aria-labelledby="t-res">
          <h2 id="t-res" className="solo-lectores">Resumen por jugador</h2>
          <div className="as-tabla" role="table" aria-label="Asistencia por jugador" data-testid="tabla-asistencia" data-orden={`${col}:${dir}`}>
            <div className="as-fila as-cab" role="row">
              {COLUMNAS.map((c) => (
                <div key={c} role="columnheader" data-col={c} aria-sort={c === col ? (dir === "asc" ? "ascending" : "descending") : undefined}>
                  <Link href={href({ o: c, d: c === col ? (dir === "asc" ? "desc" : "asc") : DIR_DEFECTO[c] })} data-testid={`orden-${c}`}>
                    {ETIQUETA[c]}{c === col ? (dir === "asc" ? " ↑" : " ↓") : ""}
                  </Link>
                </div>
              ))}
            </div>
            {ranking.map(fila)}
            {pocos.length > 0 && <div className="as-separador" role="row" data-testid="menos-de-5">Menos de {MINIMO_EVENTOS} eventos ({pocos.length})</div>}
            {pocos.map(fila)}
          </div>
        </section>
      )}
    </>
  );
}
