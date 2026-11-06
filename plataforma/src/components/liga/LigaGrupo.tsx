"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import AvisoTarjeta from "@/components/AvisoTarjeta";
import { textoColores } from "@/lib/colores";
import { fechaCorta } from "@/lib/estadisticas/calculo";
import type { Color, ContraNosotros, Grupo, GrupoLiga } from "@/lib/estadisticas/liga";
import { GRUPOS_AJENOS, textoHueco } from "@/lib/gruposLiga";
import type { GrupoAjeno, ResultadoAjeno } from "@/lib/ligaAjena";
import { useSesion } from "@/components/nav/Sesion";
import { CajaTabla, Control, Kpi, Nota, SecH, Segmento } from "./Comunes";

// Liga 26/27 (migrada de GitHub Pages): clasificación calculada con las Bases del 47 JDM, resultados por jornada y ficha
// por equipo. Solo datos por equipo (D73). D129: cada equipo enlaza a su ficha y cada partido a su página; sin «casa/fuera».
// Bloque 6: el aviso de la clasificación calculada en una línea desplegable, la fila entera pulsable, y debajo Resultados
// por jornada y Próximos (que llegan hechos de la página, `proximos`).
// fix/visibilidad-movil: con sesión de jugador con ficha o de gestor (useSesion().verLiga), el selector ofrece también G3-G6.
// Un grupo ajeno no viaja en esta página: elegirlo lleva a /liga?g=G5, que lo carga en el servidor con la sesión (`ajeno`).
// Sus equipos enlazan a su Scouting y sus partidos a su hoja en Liga consolidada (las dos, solo con sesión).
const sig = (v: number) => (v > 0 ? "+" : "") + v;
const dec = (v: number | null | undefined) => (v == null ? "–" : v.toFixed(1).replace(".", ","));

function Colores({ color }: { color: Color | null | undefined }) {
  if (!color) return null;
  return <div className="e-eqcol"><i className="e-eqdot" style={{ background: color.css }} />{textoColores(color)}</div>;
}

export default function LigaGrupoPanel({ grupos, generado, colores, contra, grupoInicial, sinRastro, enlaces, partidos, proximos, ajeno }: {
  grupos: Record<Grupo, GrupoLiga>; generado: string; colores: Record<string, Color | null>;
  contra: Record<string, ContraNosotros | null>; grupoInicial: string; sinRastro: string[];
  enlaces: Record<Grupo, Record<string, string>>; partidos: Record<string, string>; proximos?: ReactNode; ajeno?: GrupoAjeno | null;
}) {
  const router = useRouter();
  const verLiga = useSesion().verLiga;
  const [g, setG] = useState<string>(grupoInicial);
  const [jornada, setJornada] = useState<number | null>(null);
  const [equipo, setEquipo] = useState<string | null>(null);
  const esAjeno = !!ajeno && g === ajeno.grupo;
  const G: Omit<GrupoLiga, "nuestro" | "resultados"> & { nuestro?: GrupoLiga["nuestro"]; resultados: ResultadoAjeno[] } = esAjeno ? ajeno : grupos[g === "G2" ? "G2" : "G1"];
  const nuestro = esAjeno ? null : G.nuestro === "MDL" ? "MdL" : "MdA";
  const hrefEq = (id: string) => (esAjeno ? `/liga/scouting?e=${encodeURIComponent(ajeno.equipos[id]?.nombre ?? id)}` : enlaces[g as Grupo][id]);
  const hrefPar = (r: ResultadoAjeno) => (esAjeno ? (r.hueco ? null : `/liga/consolidada/partido/${encodeURIComponent(r.id)}?grupos=${g}&j=${r.jornada}`) : partidos[r.id]);
  const js = G.jornadas_cargadas;
  const jActual = jornada != null && js.includes(jornada) ? jornada : js[js.length - 1];
  const hayPend = G.clasificacion.some((x) => x.pts == null);
  const eqs = Object.values(G.equipos).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const e = (equipo && eqs.find((x) => x.nombre === equipo)) || eqs.find((x) => x.nuestro) || eqs[0];
  const rs = G.resultados.filter((r) => r.jornada === jActual);
  const fecha = rs[0] && rs[0].fecha ? " · " + fechaCorta(rs[0].fecha).slice(0, 5) : "";
  const descansan = G.descansan[String(jActual)];
  const cont = contra[`${g}:${e.id}`];
  const cambiaGrupo = (nuevo: string) => {
    // Un grupo ajeno se pide al servidor (con la sesión); de un ajeno a G1/G2, también por la URL (que no se quede ?g=G5).
    if ((GRUPOS_AJENOS as readonly string[]).includes(nuevo) || ajeno) { router.push(nuevo === "G1" ? "/liga" : `/liga?g=${nuevo}`, { scroll: false }); return; }
    setG(nuevo); setJornada(null); setEquipo(null);
  };
  const opciones = [{ v: "G1", t: "G1 · MdA" }, { v: "G2", t: "G2 · MdL" }, ...(verLiga ? GRUPOS_AJENOS.map((x) => ({ v: x as string, t: x as string })) : [])];

  return (
    <>
      <div className="e-controles">
        <Control etiqueta={esAjeno ? `Grupo 2026/27 · ${ajeno.nombre}` : "Grupo 2026/27"}>
          <div className={opciones.length > 2 ? "e-segmento-desliza" : undefined} data-testid="selector-grupo-liga">
            <Segmento etiqueta="Grupo" valor={g} opciones={opciones} onCambia={cambiaGrupo} />
          </div>
        </Control>
      </div>
      <details className="e-aviso e-aviso-plegable" data-testid="liga-aviso">
        <summary>
          <span className="e-solo-ancho">Calculada con las hojas de la FBM · pendiente de contrastar con la oficial</span>
          <span className="e-solo-estrecho">Calculada · pendiente de la oficial</span> <span aria-hidden="true">ⓘ</span>
        </summary>
        <p>Victoria 2 puntos, derrota 1 (Bases del 47 JDM). Las incomparecencias restan puntos y no generan hoja: el equipo que no se presenta toma sus puntos de la clasificación oficial.</p>
        <p>Desempate según las Bases (2.9): puntos y diferencia en los partidos entre los empatados, diferencia general, cociente y puntos a favor. PF/PC = puntos a favor y en contra.</p>
      </details>

      <SecH titulo="Clasificación" />
      <CajaTabla>
        <table className="e-tabla e-clasificacion e-fija2" data-testid="liga-clasificacion">
          <thead>
            <tr>
              <th scope="col">#</th><th scope="col">Equipo</th><th scope="col" className="e-c">PJ</th><th scope="col" className="e-c">G</th><th scope="col" className="e-c">P</th>
              <th scope="col" className="e-c e-oculta-sm">PF</th><th scope="col" className="e-c e-oculta-sm">PC</th><th scope="col" className="e-c">Dif</th><th scope="col" className="e-c">Pts</th>
            </tr>
          </thead>
          <tbody>
            {G.clasificacion.map((x) => (
              <tr key={x.id} className={`e-fila-click${x.nuestro ? " e-nos" : ""}`} data-equipo={x.id} onClick={() => router.push(hrefEq(x.id))}>
                <td className="e-mono">{x.pos}</td>
                <td className="e-eq">
                  <Link href={hrefEq(x.id)} className="e-enlace-eq">{x.equipo}</Link>
                  {x.nuestro && <span className="e-chip-nos">Nosotros</span>}
                  {x.incomparecencias ? <> <i className="e-incomp" title="Incomparecencia: sus puntos salen de la clasificación oficial">{x.incomparecencias} incomp.</i></> : null}
                </td>
                <td className="e-c e-mono">{x.pj}</td><td className="e-c e-mono">{x.g}</td><td className="e-c e-mono">{x.p}</td>
                <td className="e-c e-mono e-oculta-sm">{x.pf}</td><td className="e-c e-mono e-oculta-sm">{x.pc}</td><td className="e-c e-mono">{sig(x.dif)}</td>
                <td className="e-c e-mono e-pts">{x.pts == null ? <span className="e-pendiente">pendiente de la oficial</span> : x.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CajaTabla>
      {(hayPend || G.orden_provisional) && <Nota>Orden provisional: hay equipos con incomparecencias pendientes de la clasificación oficial.</Nota>}

      <SecH titulo="Resultados" tag="por jornada" />
      <div className="e-jornadas" role="group" aria-label="Jornada">
        {js.map((j) => <button key={j} type="button" aria-pressed={j === jActual} onClick={() => setJornada(j)}>J{j}</button>)}
      </div>
      <div data-testid="liga-resultados">
        <div className="e-desc"><b>Jornada {jActual}</b>{fecha}</div>
        {rs.map((r, i) => {
          const nos = r.local === nuestro || r.visitante === nuestro;
          const hp = hrefPar(r);
          const marcador = r.hueco && r.pl == null ? textoHueco(r.hueco) : r.incomparecencia && r.pl == null ? "incomp." : `${r.pl} – ${r.pv}`;
          return (
            <div key={i}>
              <div className={`e-partido${nos ? " e-nos-partido" : ""}`} data-partido={r.id} data-hueco={r.hueco}>
                <span className={`e-pl${(r.pl ?? 0) > (r.pv ?? 0) ? " e-gan" : ""}`}><Link href={hrefEq(r.local_id)} className="e-enlace-eq">{r.local}</Link></span>
                {hp ? (
                  <Link href={hp} className="e-m e-m-enlace" aria-label={`Ver el partido ${r.local} – ${r.visitante}`} title={r.incomparecencia ? "Incomparecencia" : "Ver el partido"}>{marcador}</Link>
                ) : <span className="e-m e-m-hueco" title={r.pl == null ? "Sin hoja de estadística: no hay marcador" : "Resultado oficial, sin hoja de estadística"}>{marcador}</span>}
                <span className={(r.pv ?? 0) > (r.pl ?? 0) ? "e-gan" : ""}><Link href={hrefEq(r.visitante_id)} className="e-enlace-eq">{r.visitante}</Link></span>
              </div>
              {r.hueco && r.pl != null ? <div className="e-desc" data-testid="marca-sin-hoja">{textoHueco(r.hueco, r.no_presentado)}</div>
                : r.incomparecencia && r.no_presentado && <div className="e-desc">No se presentó: {r.no_presentado}.</div>}
            </div>
          );
        })}
        {descansan && <div className="e-desc">Descansa: {descansan.join(", ")}</div>}
      </div>

      {esAjeno ? (
        <>
          <SecH titulo="Próximos partidos" />
          <p className="e-nota" data-testid="liga-proximos">Este grupo no tiene calendario cargado: aquí salen sus jornadas ya jugadas. Sus partidos, en Jugadores de la liga.</p>
        </>
      ) : proximos}

      <SecH titulo="Ficha por equipo" tag="solo datos de equipo" />
      <div className="e-ctl">
        <label htmlFor="lg-equipo" className="e-ctl-et">Equipo</label>
        <select id="lg-equipo" className="e-select e-select-liga" value={e.nombre} onChange={(ev) => setEquipo(ev.target.value)}>
          {eqs.map((x) => <option key={x.id}>{x.nombre}</option>)}
        </select>
      </div>
      <div className="e-ficha" id="ficha" data-testid="liga-ficha">
        <h3>{e.nombre}{e.nuestro && <span className="e-chip-nos">Nosotros</span>}</h3>
        <div className="e-kpis">
          <Kpi tono="accent" lab="Puntos a favor" val={dec(e.media_pf)} foot="media por partido" />
          <Kpi tono="grape" lab="En contra" val={dec(e.media_pc)} foot="media por partido" />
          <Kpi tono="gold" lab="Diferencia" val={e.media_dif == null ? "–" : sig(e.media_dif).replace(".", ",")} foot="por partido" />
          {/* La racha toma el color de su ultimo resultado: G en verde, P en rojo (D129). */}
          <Kpi tono={e.racha ? (e.racha.tipo === "G" ? "win" : "loss") : ""} lab="Racha" val={e.racha ? e.racha.n + e.racha.tipo : "–"} foot={e.ultimos.length ? e.ultimos.map((c, i) => <span key={i} className={`e-pastilla e-pastilla-${c} e-pastilla-mini`}>{c}</span>) : "sin partidos"} />
        </div>
        <div className="e-colores">
          {!esAjeno && <Colores color={colores[`${g}:${e.id}`]} />}
          {cont && (
            <>
              <p className="e-nota">Próximo partido contra nosotros: J{cont.jornada} · {fechaCorta(cont.fecha).slice(0, 5)}</p>
              <AvisoTarjeta aviso={cont.aviso} />
            </>
          )}
        </div>
        <Link className="e-boton-enlace" href={hrefEq(e.id)}>
          {esAjeno ? "Ver su Scouting (por jugador, con sesión) →" : e.nuestro ? `Ver la ficha del ${e.nombre} (partidos y boxscore) →` : sinRastro.includes(e.id) ? "Ver su ficha en Rivales 26/27 (sin historial en datos abiertos) →" : "Ver su ficha en Rivales 26/27 →"}
        </Link>
      </div>
      <div className="e-fuente">
        Fuente: hojas de estadística de la FBM (app Afición FBM) hasta la jornada {js[js.length - 1]}. Sólo datos por equipo.
        {esAjeno ? <> Grupo ajeno: solo con sesión, no se publica.{ajeno.sinJornada ? ` ${ajeno.sinJornada} ${ajeno.sinJornada === 1 ? "hoja llegó" : "hojas llegaron"} sin jornada: cuentan en la clasificación, no en Resultados.` : ""}</> : <> Generado el {fechaCorta(generado)}.</>}
      </div>
    </>
  );
}
