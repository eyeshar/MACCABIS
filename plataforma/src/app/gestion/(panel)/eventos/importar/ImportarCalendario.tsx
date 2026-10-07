"use client";

import { useState, useTransition } from "react";
import { analizarCalendario, aplicarCalendario, type ResultadoCalendario } from "../acciones";

const EJEMPLO = `G1;1;Enfermos del Aro;Maccabi de Acostar;04/10/2026;14:00;2
G1;4;Maccabi de Acostar descansa;;08/11/2026;;
G2;2;Quinto Tiempo;Maccabi de Levantar;18/10/2026;10:15;1`;

/** Importar el calendario del Ayuntamiento: pegar, comparar y aceptar/ignorar cada cambio. Nada se aplica sin OK. */
export default function ImportarCalendario() {
  const [texto, setTexto] = useState("");
  const [res, setRes] = useState<ResultadoCalendario | null>(null);
  const [decisiones, setDecisiones] = useState<Record<string, "acepta" | "ignora">>({});
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const comparar = () => empezar(async () => {
    setError(null); setDecisiones({});
    try { setRes(await analizarCalendario(texto)); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo comparar."); }
  });
  const aceptados = Object.entries(decisiones).filter(([, v]) => v === "acepta").map(([k]) => k);
  const aplicar = () => empezar(async () => {
    setError(null);
    try { setRes(await aplicarCalendario(texto, aceptados)); setDecisiones({}); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo aplicar."); }
  });
  const decidir = (id: string, v: "acepta" | "ignora") => setDecisiones((d) => ({ ...d, [id]: d[id] === v ? (undefined as never) : v }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section className="gs-bloque" aria-labelledby="t-pegar">
        <h2 id="t-pegar" style={{ fontSize: 22 }}>Pega el calendario del Ayuntamiento</h2>
        <p className="pequeno suave" style={{ margin: 0 }}>
          Una línea por partido: <code className="mono">grupo;jornada;local;visitante;fecha;hora;pista</code>. G1 = MdA, G2 = MdL. Una jornada de descanso es «Maccabi de Acostar descansa». Las líneas de otros equipos se ignoran. Compara con los partidos de liga y enseña <b>solo los cambios</b>; nada se aplica sin tu OK.
        </p>
        <label htmlFor="cal-texto" className="solo-lectores">Calendario del Ayuntamiento</label>
        <textarea id="cal-texto" className="ev-texto" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={EJEMPLO} spellCheck={false} />
        <div className="botones" style={{ margin: 0 }}>
          <button className="boton boton-amarillo" type="button" onClick={comparar} disabled={pendiente || !texto.trim()}>{pendiente && !res ? "Comparando…" : "Comparar"}</button>
          <button className="boton boton-claro" type="button" onClick={() => { setTexto(""); setRes(null); setDecisiones({}); }} disabled={pendiente}>Limpiar</button>
        </div>
      </section>

      {error && <div className="aviso aviso-error" role="alert">{error}</div>}

      {res && (
        <section className="gs-bloque" aria-labelledby="t-res" data-testid="resultado-calendario">
          <h2 id="t-res" style={{ fontSize: 26 }} data-testid="titulo-resultado">{res.cambios.length === 0 ? "0 cambios" : `${res.cambios.length} ${res.cambios.length === 1 ? "cambio" : "cambios"}`}</h2>
          <p className="pequeno suave" style={{ margin: 0 }} data-testid="resumen-lineas">
            {res.lineas} líneas leídas: {res.nuestras} de MdA y MdL ({res.iguales} sin cambios), {res.ajenas} de otros equipos ignoradas{res.errores.length ? `, ${res.errores.length} con error` : ""}.
          </p>
          {res.aplicado && (
            <div className="aviso aviso-ok" role="status" style={{ margin: 0 }}>
              Aplicado: {res.aplicado.aceptadas} {res.aplicado.aceptadas === 1 ? "cambio aceptado" : "cambios aceptados"}{res.aplicado.cambiosEn.length ? ` (${res.aplicado.cambiosEn.join(", ")})` : ""}. Quedan <b>pendientes de copiar a SportEasy</b>. Importación registrada.
            </div>
          )}

          {res.errores.length > 0 && (
            <div className="aviso aviso-error" style={{ margin: 0 }}>
              <b>Líneas que no se entienden (no se usan):</b>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{res.errores.map((e) => <li key={e.n}>Línea {e.n}: {e.error} <code className="mono">{e.crudo}</code></li>)}</ul>
            </div>
          )}

          {res.cambios.length > 0 && (
            <>
              <div className="tabla-desplazable">
                <table className="gs-tabla ev-tabla" data-testid="tabla-cambios">
                  <thead><tr><th>Partido</th><th>Campo</th><th>Valor actual</th><th>Valor del Ayuntamiento</th><th>¿Lo aplicamos?</th></tr></thead>
                  <tbody>
                    {res.cambios.map((c) => (
                      <tr key={c.id} data-cambio={c.id}>
                        <td data-label="Partido"><b>{c.partido}</b><span className="ev-sub" style={{ color: "var(--tinta-tenue)" }}>J{c.jornada} · {c.equipo}</span></td>
                        <td data-label="Campo">{c.textoCampo}</td>
                        <td data-label="Valor actual"><span className="ev-valor-actual">{c.actual}</span></td>
                        <td data-label="Ayuntamiento"><span className="ev-valor-nuevo">{c.oficial}</span></td>
                        <td data-label="Decisión">
                          <div className="ev-aceptar">
                            <button type="button" className="acepta" aria-pressed={decisiones[c.id] === "acepta"} onClick={() => decidir(c.id, "acepta")}>Aceptar</button>
                            <button type="button" className="ignora" aria-pressed={decisiones[c.id] === "ignora"} onClick={() => decidir(c.id, "ignora")}>Ignorar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="botones" style={{ margin: 0 }}>
                <button className="boton boton-claro" type="button" onClick={() => setDecisiones(Object.fromEntries(res.cambios.map((c) => [c.id, "acepta" as const])))} disabled={pendiente}>Aceptar todos</button>
                <button className="boton boton-amarillo" type="button" onClick={aplicar} disabled={pendiente || aceptados.length === 0}>{pendiente ? "Aplicando…" : `Aplicar lo aceptado (${aceptados.length})`}</button>
              </div>
              <p className="pequeno suave" style={{ margin: 0 }}>Lo que no aceptes se queda como está. Lo aceptado cambia el evento y queda «pendiente de copiar» a SportEasy.</p>
            </>
          )}

          {res.senales.length > 0 && (
            <div className="aviso aviso-info" style={{ margin: 0 }} data-testid="senales">
              <b>Para revisar a mano (no se crea ni se borra nada solo):</b>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{res.senales.map((s, i) => <li key={i}>{s.texto}</li>)}</ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
