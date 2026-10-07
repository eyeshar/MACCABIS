"use client";

import { useState, useTransition } from "react";
import { analizarRespuestas, asignarNombre, guardarRespuestas, type ResultadoRespuestas } from "../acciones";

const EJEMPLO = `evento;jugador;respuesta;motivo;detalle
14/10/2026 entreno;Jon Adrian Esteban Peñas;no voy;trabajo;Turno de tarde
18/10/2026 MdA;Adriano Gianatti;va;;
jugador;desde;hasta;motivo
Adriano Gianatti;20/12/2026;03/01/2027;viaje`;

type Persona = { person_id: string; nombre: string };

/** Importar respuestas y ausencias de SportEasy. Las lineas validas se guardan; un nombre desconocido bloquea SOLO su
 *  linea y se asigna a mano, una vez. */
export default function ImportarRespuestas({ personas }: { personas: Persona[] }) {
  const [texto, setTexto] = useState("");
  const [res, setRes] = useState<ResultadoRespuestas | null>(null);
  const [elegida, setElegida] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const revisar = () => empezar(async () => {
    setError(null);
    try { setRes(await analizarRespuestas(texto)); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo revisar."); }
  });
  const guardar = () => empezar(async () => {
    setError(null);
    try { setRes(await guardarRespuestas(texto)); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar."); }
  });
  const asignar = (nombre: string) => empezar(async () => {
    setError(null);
    const r = await asignarNombre(nombre, elegida[nombre] ?? "");
    if (!r.ok) { setError(r.error ?? "No se pudo asignar."); return; }
    setRes(await analizarRespuestas(texto));
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section className="gs-bloque" aria-labelledby="t-pegar-r">
        <h2 id="t-pegar-r" style={{ fontSize: 22 }}>Pega las respuestas de SportEasy</h2>
        <p className="pequeno suave" style={{ margin: 0 }}>
          Respuestas: <code className="mono">evento;jugador;respuesta;motivo;detalle</code> (respuesta: va, duda, no o sin responder; motivo: lesión, trabajo, viaje, familia u otro). Ausencias por periodo: <code className="mono">jugador;desde;hasta;motivo</code>. El evento se da por su fecha («14/10/2026 entreno», «18/10/2026 MdA») o por su clave.
          Los nombres se buscan en el diccionario <b>cerrado</b>: un nombre desconocido nunca se empareja por parecido, bloquea solo esa línea y lo asignas a mano una vez.
        </p>
        <label htmlFor="resp-texto" className="solo-lectores">Respuestas de SportEasy</label>
        <textarea id="resp-texto" className="ev-texto" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={EJEMPLO} spellCheck={false} />
        <div className="botones" style={{ margin: 0 }}>
          <button className="boton boton-claro" type="button" onClick={revisar} disabled={pendiente || !texto.trim()}>Revisar</button>
          <button className="boton boton-amarillo" type="button" onClick={guardar} disabled={pendiente || !texto.trim()}>{pendiente ? "Un momento…" : "Guardar las válidas"}</button>
        </div>
      </section>

      {error && <div className="aviso aviso-error" role="alert">{error}</div>}

      {res && (
        <section className="gs-bloque" aria-labelledby="t-res-r" data-testid="resultado-respuestas">
          <h2 id="t-res-r" style={{ fontSize: 26 }}>{res.validas} {res.validas === 1 ? "línea válida" : "líneas válidas"}{res.bloqueadas ? ` · ${res.bloqueadas} bloqueadas` : ""}{res.errores ? ` · ${res.errores} con error` : ""}</h2>
          {res.guardadas && (
            <div className="aviso aviso-ok" role="status" style={{ margin: 0 }}>
              Guardado: {res.guardadas.respuestas} {res.guardadas.respuestas === 1 ? "respuesta" : "respuestas"} y {res.guardadas.ausencias} {res.guardadas.ausencias === 1 ? "ausencia" : "ausencias"} por periodo. Importación registrada.
              {res.bloqueadas ? " Las líneas bloqueadas esperan a que asignes el nombre." : ""}
            </div>
          )}
          <div className="tabla-desplazable">
            <table className="gs-tabla ev-tabla" data-testid="tabla-lineas">
              <thead><tr><th>Línea</th><th>Qué dice</th><th>Estado</th></tr></thead>
              <tbody>
                {res.lineas.map((l) => (
                  <tr key={l.n} data-estado={l.estado}>
                    <td data-label="Línea" className="cifra">{l.n}</td>
                    <td data-label="Qué dice">{l.estado === "valida" ? l.resumen : <code className="mono" style={{ textTransform: "none", letterSpacing: 0 }}>{l.crudo}</code>}</td>
                    <td data-label="Estado">
                      {l.estado === "valida" && <span className="pastilla pastilla-ok">Válida</span>}
                      {l.estado === "error" && <><span className="pastilla etiqueta-mal">Error</span><span className="ev-sub" style={{ color: "var(--error)" }}>{l.error}</span></>}
                      {l.estado === "bloqueada" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                          <span className="pastilla etiqueta-aviso">Bloqueada: «{l.nombre}» no está en el diccionario</span>
                          <div className="ev-selector">
                            <label htmlFor={`as-${l.n}`} className="solo-lectores">Persona para «{l.nombre}»</label>
                            <select id={`as-${l.n}`} value={elegida[l.nombre ?? ""] ?? ""} onChange={(e) => setElegida((x) => ({ ...x, [l.nombre ?? ""]: e.target.value }))} style={{ minWidth: 200 }}>
                              <option value="">Elige la persona…</option>
                              {personas.map((p) => <option key={p.person_id} value={p.person_id}>{p.nombre}</option>)}
                            </select>
                            <button className="boton boton-claro" type="button" onClick={() => asignar(l.nombre ?? "")} disabled={pendiente || !elegida[l.nombre ?? ""]}>Asignar</button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {res.nombresPendientes.length > 0 && <p className="pequeno suave" style={{ margin: 0 }}>Al asignar un nombre se guarda en el diccionario (solo los gestores lo cambian) y esa línea pasa a válida; luego pulsa «Guardar las válidas».</p>}
        </section>
      )}
    </div>
  );
}
