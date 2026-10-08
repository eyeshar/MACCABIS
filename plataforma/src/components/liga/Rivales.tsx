"use client";

import { useEffect, useRef, useState } from "react";
import { textoColores } from "@/lib/colores";
import { fechaCorta } from "@/lib/estadisticas/calculo";
import type { Color, DatosRivales, Rival } from "@/lib/estadisticas/liga";
import { CajaTabla, Control, Nota, SecH, Segmento } from "./Comunes";

// Rivales 26/27 (migrado de GitHub Pages): lo esencial del grupo, tarjetas de rivales y ficha con trayectoria y cara a cara.
// Fuente: Ayuntamiento de Madrid, datos abiertos (datos.madrid.es), CC BY 4.0. Enlace directo: /liga/rivales?g=MdA&r=<id>.
type G = "MdA" | "MdL";
const rvT = (t: string) => t.slice(2, 4) + "/" + t.slice(5, 7);
const rvFecha = (f: string | null) => (f ? fechaCorta(f) : "");

function orden(a: Rival, b: Rival) {
  const ka = a.sin_rastro ? 2 : a.t2526 ? 0 : 1, kb = b.sin_rastro ? 2 : b.t2526 ? 0 : 1;
  if (ka !== kb) return ka - kb;
  // % de victorias en partidos jugados en 2025/26; empate: puesto oficial (D29)
  if (a.t2526 && b.t2526) {
    if (b.t2526.pct !== a.t2526.pct) return b.t2526.pct - a.t2526.pct;
    return a.t2526.pos - b.t2526.pos;
  }
  return a.nombre.localeCompare(b.nombre, "es");
}

const Aviso = ({ txt }: { txt?: string }) => (txt ? <> <i className="e-aviso-i" title={txt}>⚠</i></> : null);
const Incomp = ({ n, g, p, punto = true }: { n?: number; g: number; p: number; punto?: boolean }) =>
  n ? <>{punto ? " · " : " "}<i className="e-incomp" title={`No presentarse resta puntos: la clasificación oficial es real, pero su balance en pista es ${g}-${p}`}>{n} incomparecencia{n > 1 ? "s" : ""}</i></> : null;

function BalanceH2H({ h }: { h: Rival["h2h"] }) {
  const pj = h.g + h.p;
  if (!pj) return <div className="e-h2h"><div className="e-gp e-gp-nunca">Nunca nos hemos enfrentado</div></div>;
  return (
    <div className="e-h2h">
      <div className="e-gp" title="Nuestro cara a cara: ganados-perdidos"><span className="e-pos">{h.g}</span><span className="e-sep">-</span><span className="e-neg">{h.p}</span></div>
      <div className="e-h2h-barra">
        <div className="e-h2h-tira"><span className="e-g" style={{ width: `${(100 * h.g) / pj}%` }} /><span className="e-p" style={{ width: `${(100 * h.p) / pj}%` }} /></div>
        <div className="e-h2h-lab">{pj} partidos · {h.pf}-{h.pc}</div>
      </div>
    </div>
  );
}

function Ultimo({ h }: { h: Rival["h2h"] }) {
  const u = h.partidos[0];
  if (!u) return <>Último: —</>;
  return <>Último: {u.fecha ? rvFecha(u.fecha) : rvT(u.t)} · {u.ficha} · {u.pf}-{u.pc} {u.res}</>;
}

function Tarjeta({ r, onAbrir }: { r: Rival; onAbrir: (id: string) => void }) {
  const antes = r.antes.length ? <div className="e-rv-antes">antes: {r.antes.join(", ")}</div> : null;
  if (r.sin_rastro) {
    return (
      <div className="e-rv e-rv-sin"><div className="e-rv-tira" /><h4>{r.nombre}</h4>{antes}
        <span className="e-rv-tag">Sin rastro en los JDM</span>
        <div className="e-rv-donde">Equipo nuevo, cambio de nombre o competición externa.</div>
        <BalanceH2H h={r.h2h} />
      </div>
    );
  }
  const t = r.t2526;
  return (
    <div className={`e-rv${t && t.pos <= 3 ? " e-rv-top" : ""}`} role="button" tabIndex={0} aria-label={`Ver ficha de ${r.nombre}`}
      onClick={() => onAbrir(r.id)} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onAbrir(r.id); } }}>
      <div className="e-rv-tira" /><h4>{r.nombre}</h4>{antes}
      {t ? (
        <div className="e-rv-donde">2025/26: <b>{t.pos}º/{t.n}</b><Incomp n={t.incomparecencias} g={t.g} p={t.p} /> · {t.g}-{t.p}<Aviso txt={t.aviso} /> · {t.distrito}<br />{t.grupo}{t.extra.length > 0 && <><br />{t.extra.join(" · ")}</>}</div>
      ) : <div className="e-rv-donde">No jugó en 2025/26.</div>}
      <BalanceH2H h={r.h2h} />
      <div className="e-rv-pie"><span><Ultimo h={r.h2h} /></span><span>{r.temporadas_jdm} de {r.temporadas_disponibles} temporadas en los JDM</span></div>
    </div>
  );
}

/** Puesto relativo en liga por temporada (1º arriba), normalizado por tamaño de grupo. Sin datos = hueco. */
function Grafico({ r }: { r: Rival }) {
  const Gr = r.grafico, W = 600, H = 230, L = 46, R = 18, T = 26, B = 34;
  const x = (i: number) => L + (i * (W - L - R)) / (Gr.length - 1), y = (v: number) => T + (1 - v) * (H - T - B);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Puesto relativo en liga por temporada">
      {([[1, "1º"], [0.5, "mitad"], [0, "último"]] as const).map(([v, l]) => (
        <g key={l}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="e-g-linea" strokeDasharray={v === 0.5 ? "3 4" : "0"} />
          <text x={L - 8} y={y(v) + 4} className="e-g-eje" fontSize="11" textAnchor="end">{l}</text>
        </g>
      ))}
      {Gr.map((p, i) => <text key={p.t} x={x(i)} y={H - 12} className={p.pos ? "e-g-eje" : "e-g-eje-hueco"} fontSize="11" textAnchor="middle">{rvT(p.t)}</text>)}
      {Gr.map((p, i) => i > 0 && p.pos && Gr[i - 1].pos ? <line key={"l" + i} x1={x(i - 1)} y1={y(Gr[i - 1].rel!)} x2={x(i)} y2={y(p.rel!)} className="e-g-trazo" strokeWidth="2.5" /> : null)}
      {Gr.map((p, i) => {
        if (!p.pos) return null;
        const tip = `${rvT(p.t)}: ${p.pos}º de ${p.n} · ${p.nombre} · ${p.grupo}${p.varias ? " · (varias ligas esa temporada: se muestra la primera)" : ""}${p.aviso ? " · ⚠ " + p.aviso : ""}`;
        return (
          <g key={"p" + i}>
            <title>{tip}</title>
            <circle cx={x(i)} cy={y(p.rel!)} r="5.5" className={p.aviso ? "e-g-punto-aviso" : "e-g-punto"} strokeWidth="2" />
            <text x={x(i)} y={y(p.rel!) - 10} className="e-g-etq" fontSize="11.5" textAnchor="middle">{p.pos}º/{p.n}{p.aviso ? " ⚠" : ""}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Ficha({ r, color, onCerrar }: { r: Rival; color: Color | null | undefined; onCerrar: () => void }) {
  const h = r.h2h;
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
  return (
    <div className="e-modal" onClick={(ev) => { if (ev.target === ev.currentTarget) onCerrar(); }}>
      <div className="e-modal-caja e-modal-rv" role="dialog" aria-modal="true" aria-label={`Ficha de ${r.nombre}`} data-testid="rivales-ficha">
        <div className="e-modal-cab">
          <div>
            <h3>{r.nombre}</h3>
            <div className="e-modal-sub">Grupo del {r.grupo} en 2026/27{r.antes.length ? ` · antes: ${r.antes.join(", ")}` : ""}</div>
            <div className="e-modal-sub">{r.temporadas_jdm} de {r.temporadas_disponibles} temporadas en los JDM · mejor: {r.mejor}</div>
            {color && <div className="e-eqcol"><i className="e-eqdot" style={{ background: color.css }} />{textoColores(color)}</div>}
          </div>
          <button ref={boton} type="button" className="e-cerrar" aria-label="Cerrar" onClick={onCerrar}>✕</button>
        </div>
        <div className="e-modal-cuerpo">
          <BalanceH2H h={h} />
          <SecH titulo="Trayectoria en liga" tag="puesto relativo · 1º arriba" />
          <div className="e-grafico"><Grafico r={r} /></div>
          <Nota>Primera fase de liga de cada temporada, normalizada por el tamaño del grupo. Las temporadas sin datos quedan vacías: 2019/20 no está en el portal.</Nota>
          <SecH titulo="Temporada a temporada" />
          <CajaTabla>
            <table className="e-tabla">
              <thead><tr><th>Temp.</th><th>Compitió como</th><th>Distrito</th><th>Fase</th><th>Grupo</th><th>Puesto</th><th>PJ</th><th>G-P</th><th>PF-PC</th><th>Hasta dónde</th></tr></thead>
              <tbody>
                {r.trayectoria.map((f) => (
                  <tr key={f.t + f.grupo}>
                    <td className="e-mono">{rvT(f.t)}{f.t === "2025-26" && <> <span className="e-po">pasada</span></>}</td>
                    <td>{f.nombre}</td><td>{f.distrito}</td><td>{f.fase}</td>
                    <td>{f.grupo}{f.calculado && <> <i className="e-nota-i" title="Sin fila en la clasificación oficial: balance calculado de los partidos">¹</i></>}</td>
                    <td className="e-mono">{f.pos ? `${f.pos}º/${f.n}` : "—"}<Aviso txt={f.aviso} />{f.incomparecencias ? <Incomp n={f.incomparecencias} g={f.g ?? 0} p={f.p ?? 0} punto={false} /> : null}</td>
                    <td className="e-mono">{f.pj == null ? "—" : f.pj}</td>
                    <td className="e-mono">{f.g == null ? "—" : `${f.g}-${f.p}`}</td>
                    <td className="e-mono">{f.pf == null ? "—" : `${f.pf}-${f.pc}`}</td>
                    <td>{f.hasta || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CajaTabla>
          {r.homonimos.length > 0 && <Nota>⚠ {r.homonimos.map((x) => `${rvT(x.t)}: ${x.aviso}`).join(" · ")}</Nota>}
          <SecH titulo="Cara a cara" tag={`${h.g + h.p} partidos · más reciente primero`} />
          {h.partidos.length ? (
            <CajaTabla>
              <table className="e-tabla">
                <thead><tr><th>Fecha</th><th>Ficha</th><th>Rival jugó como</th><th>Fase</th><th className="e-c">Marcador</th><th className="e-c">Res</th></tr></thead>
                <tbody>
                  {h.partidos.map((p, i) => (
                    <tr key={i}>
                      <td className="e-mono">{p.fecha ? rvFecha(p.fecha) : rvT(p.t)}</td>
                      <td><span className={`e-chip e-chip-${p.ficha.toUpperCase()}`}>{p.ficha}</span></td>
                      <td>{p.rival}</td><td>{p.fase || "—"}</td>
                      <td className="e-c e-marcador">{p.pf}-{p.pc}{p.nota && <> <i className="e-nota-i" title={p.nota}>ⓘ</i></>}</td>
                      <td className="e-c"><span className={`e-insignia e-insignia-${p.res}`}>{p.res}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CajaTabla>
          ) : <Nota>Nunca nos hemos enfrentado.</Nota>}
          <Nota>Fuente: Ayuntamiento de Madrid, datos abiertos (datos.madrid.es), CC BY 4.0. Cara a cara completado con el histórico propio del club.</Nota>
        </div>
      </div>
    </div>
  );
}

export default function RivalesPanel({ datos, colores, grupoInicial, rivalInicial }: {
  datos: DatosRivales; colores: Record<string, Color | null>; grupoInicial: G; rivalInicial: string | null;
}) {
  const inicial = rivalInicial ? datos.rivales.find((x) => x.id === rivalInicial && !x.sin_rastro) : undefined;
  const [grupo, setGrupo] = useState<G>(inicial ? inicial.grupo : grupoInicial);
  const [abierto, setAbierto] = useState<string | null>(inicial ? inicial.id : null);
  const url = (g: G, r?: string | null) => window.history.replaceState(null, "", `/liga/rivales?g=${g}${r ? `&r=${encodeURIComponent(r)}` : ""}`);
  const lista = datos.rivales.filter((r) => r.grupo === grupo).sort(orden);
  const ficha = abierto ? datos.rivales.find((r) => r.id === abierto) : null;
  const abrir = (id: string) => { setAbierto(id); url(grupo, id); };
  const cerrar = () => { setAbierto(null); url(grupo); };
  return (
    <>
      <div className="e-controles">
        <Control etiqueta="Grupo 2026/27">
          <Segmento etiqueta="Grupo" valor={grupo} opciones={[{ v: "MdA", t: "Grupo MdA" }, { v: "MdL", t: "Grupo MdL" }]} onCambia={(v) => { setGrupo(v); setAbierto(null); url(v); }} />
        </Control>
      </div>
      <div className="e-esencial" data-testid="rivales-esencial">
        <h3>Lo esencial · grupo del {grupo}</h3>
        <ul>{(datos.lo_esencial[grupo] || []).map((l, i) => <li key={i}>{l}</li>)}</ul>
      </div>
      <SecH titulo="Rivales" tag={`${lista.length} equipos`} />
      <div className="e-rvgrid" data-testid="rivales-lista">{lista.map((r) => <Tarjeta key={r.id} r={r} onAbrir={abrir} />)}</div>
      <Nota>Ordenados por su porcentaje de victorias en partidos jugados en la liga de 2025/26 (si empatan, por su puesto oficial; los que no tienen rastro, al final). El puesto que se muestra es el de la clasificación oficial, que resta puntos por las incomparecencias. Pincha en una tarjeta para ver su trayectoria y el cara a cara completo. El cara a cara suma las dos fichas del club (MdL + MdA).</Nota>
      {ficha && !ficha.sin_rastro && <Ficha r={ficha} color={colores[ficha.id]} onCerrar={cerrar} />}
      <div className="e-fuente">Fuente: Ayuntamiento de Madrid, datos abiertos (datos.madrid.es), CC BY 4.0</div>
    </>
  );
}
