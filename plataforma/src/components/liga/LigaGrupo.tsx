"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import AvisoTarjeta from "@/components/AvisoTarjeta";
import { textoColores } from "@/lib/colores";
import { fechaCorta } from "@/lib/estadisticas/calculo";
import type { Color, ContraNosotros, Grupo, GrupoLiga } from "@/lib/estadisticas/liga";
import { CajaTabla, Control, Kpi, Nota, SecH, Segmento } from "./Comunes";

// Liga 26/27 (migrada de GitHub Pages): clasificación calculada con las Bases del 47 JDM, resultados por jornada y ficha
// por equipo. Solo datos por equipo (D73).
const sig = (v: number) => (v > 0 ? "+" : "") + v;
const dec = (v: number | null | undefined) => (v == null ? "–" : v.toFixed(1).replace(".", ","));

function Colores({ color }: { color: Color | null | undefined }) {
  if (!color) return null;
  return <div className="e-eqcol"><i className="e-eqdot" style={{ background: color.css }} />{textoColores(color)}</div>;
}

export default function LigaGrupoPanel({ grupos, generado, colores, contra, grupoInicial, sinRastro }: {
  grupos: Record<Grupo, GrupoLiga>; generado: string; colores: Record<string, Color | null>;
  contra: Record<string, ContraNosotros | null>; grupoInicial: Grupo; sinRastro: string[];
}) {
  const [g, setG] = useState<Grupo>(grupoInicial);
  const [jornada, setJornada] = useState<number | null>(null);
  const [equipo, setEquipo] = useState<string | null>(null);
  const fichaRef = useRef<HTMLDivElement>(null);
  const G = grupos[g];
  const nuestro = G.nuestro === "MDL" ? "MdL" : "MdA";
  const js = G.jornadas_cargadas;
  const jActual = jornada != null && js.includes(jornada) ? jornada : js[js.length - 1];
  const hayPend = G.clasificacion.some((x) => x.pts == null);
  const eqs = Object.values(G.equipos).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const e = (equipo && eqs.find((x) => x.nombre === equipo)) || eqs.find((x) => x.nuestro) || eqs[0];
  const rs = G.resultados.filter((r) => r.jornada === jActual);
  const fecha = rs[0] && rs[0].fecha ? " · " + fechaCorta(rs[0].fecha).slice(0, 5) : "";
  const descansan = G.descansan[String(jActual)];
  const cont = contra[`${g}:${e.id}`];
  const cambiaGrupo = (nuevo: Grupo) => { setG(nuevo); setJornada(null); setEquipo(null); };

  return (
    <>
      <div className="e-controles">
        <Control etiqueta="Grupo 2026/27">
          <Segmento etiqueta="Grupo" valor={g} opciones={[{ v: "G1", t: "G1 · MdA" }, { v: "G2", t: "G2 · MdL" }]} onCambia={cambiaGrupo} />
        </Control>
      </div>
      <div className="e-aviso">
        Clasificación <b>calculada</b> a partir de las hojas de estadística de la FBM, <b>pendiente de contrastar con la oficial</b>. Victoria 2 puntos, derrota 1 (Bases del 47 JDM). Las incomparecencias restan puntos y no generan hoja: el equipo que no se presenta toma sus puntos de la clasificación oficial.
      </div>

      <SecH titulo="Clasificación" tag={G.nombre} />
      <CajaTabla>
        <table className="e-tabla e-clasificacion" data-testid="liga-clasificacion">
          <thead>
            <tr>
              <th scope="col">#</th><th scope="col">Equipo</th><th scope="col" className="e-c">PJ</th><th scope="col" className="e-c">G</th><th scope="col" className="e-c">P</th>
              <th scope="col" className="e-c e-oculta-sm">PF</th><th scope="col" className="e-c e-oculta-sm">PC</th><th scope="col" className="e-c">Dif</th><th scope="col" className="e-c">Pts</th>
            </tr>
          </thead>
          <tbody>
            {G.clasificacion.map((x) => (
              <tr key={x.id} className={x.nuestro ? "e-nos" : undefined} data-equipo={x.id}>
                <td className="e-mono">{x.pos}</td>
                <td className="e-eq">
                  <button type="button" className="e-enlace-boton" onClick={() => { setEquipo(G.equipos[x.id].nombre); fichaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>{x.equipo}</button>
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
      <Nota>
        {(hayPend || G.orden_provisional ? "Orden provisional: hay equipos con incomparecencias pendientes de la clasificación oficial. " : "")}
        Desempate según las Bases (2.9): puntos y diferencia en los partidos entre los empatados, diferencia general, cociente y puntos a favor. PF/PC = puntos a favor y en contra.
      </Nota>

      <SecH titulo="Resultados" tag="por jornada" />
      <div className="e-jornadas" role="group" aria-label="Jornada">
        {js.map((j) => <button key={j} type="button" aria-pressed={j === jActual} onClick={() => setJornada(j)}>J{j}</button>)}
      </div>
      <div data-testid="liga-resultados">
        <div className="e-desc"><b>Jornada {jActual}</b>{fecha}</div>
        {rs.map((r, i) => {
          const nos = r.local === nuestro || r.visitante === nuestro;
          return (
            <div key={i}>
              <div className={`e-partido${nos ? " e-nos-partido" : ""}`}>
                <span className={`e-pl${(r.pl ?? 0) > (r.pv ?? 0) ? " e-gan" : ""}`}>{r.local}</span>
                {r.incomparecencia ? <span className="e-m" title="Incomparecencia">incomp.</span> : <span className="e-m">{r.pl} – {r.pv}</span>}
                <span className={(r.pv ?? 0) > (r.pl ?? 0) ? "e-gan" : ""}>{r.visitante}</span>
              </div>
              {r.incomparecencia && <div className="e-desc">No se presentó: {r.no_presentado}.</div>}
            </div>
          );
        })}
        {descansan && <div className="e-desc">Descansa: {descansan.join(", ")}</div>}
      </div>

      <SecH titulo="Ficha por equipo" tag="solo datos de equipo" />
      <div className="e-ctl">
        <label htmlFor="lg-equipo" className="e-ctl-et">Equipo</label>
        <select id="lg-equipo" className="e-select e-select-liga" value={e.nombre} onChange={(ev) => setEquipo(ev.target.value)}>
          {eqs.map((x) => <option key={x.id}>{x.nombre}</option>)}
        </select>
      </div>
      <div className="e-ficha" ref={fichaRef} data-testid="liga-ficha">
        <h3>{e.nombre}{e.nuestro && <span className="e-chip-nos">Nosotros</span>}</h3>
        <div className="e-kpis">
          <Kpi tono="accent" lab="Puntos a favor" val={dec(e.media_pf)} foot="media por partido" />
          <Kpi tono="grape" lab="En contra" val={dec(e.media_pc)} foot="media por partido" />
          <Kpi tono="gold" lab="Diferencia" val={e.media_dif == null ? "–" : sig(e.media_dif).replace(".", ",")} foot="por partido" />
          <Kpi tono="win" lab="Racha" val={e.racha ? e.racha.n + e.racha.tipo : "–"} foot={e.ultimos.length ? e.ultimos.map((c, i) => <span key={i} className={`e-pastilla e-pastilla-${c} e-pastilla-mini`}>{c}</span>) : "sin partidos"} />
        </div>
        <div className="e-dos">
          {([["En casa", e.casa], ["Fuera", e.fuera]] as const).map(([t, c]) => (
            <div key={t} className="e-mini"><div className="e-mini-t">{t}</div><div className="e-mini-v">{c.g}–{c.p}</div><div className="e-mini-s">{dec(c.media_pf)} / {dec(c.media_pc)} por partido</div></div>
          ))}
        </div>
        <Nota>Casa y fuera: ganados–perdidos y media de puntos a favor / en contra.</Nota>
        <div className="e-colores">
          <Colores color={colores[`${g}:${e.id}`]} />
          {cont && (
            <>
              <p className="e-nota">Próximo partido contra nosotros: J{cont.jornada} · {fechaCorta(cont.fecha).slice(0, 5)}</p>
              <AvisoTarjeta aviso={cont.aviso} />
            </>
          )}
        </div>
        {!e.nuestro && (
          <Link className="e-boton-enlace" href={`/liga/rivales?g=${nuestro}&r=${encodeURIComponent(e.id)}`}>
            {sinRastro.includes(e.id) ? "Ver Rivales 26/27 (sin historial en datos abiertos) →" : "Ver su ficha en Rivales 26/27 →"}
          </Link>
        )}
      </div>
      <div className="e-fuente">Fuente: hojas de estadística de la FBM (app Afición FBM) hasta la jornada {js[js.length - 1]}. Sólo datos por equipo. Generado el {fechaCorta(generado)}.</div>
    </>
  );
}
