"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leerCsv, TEXTO_ESTADO, type FilaCsv } from "@/lib/whatsapp/importar";
import { guardarTelefonos, revisarTelefonos, type ResultadoGuardar, type ResultadoRevision } from "./acciones";

/** Importar teléfonos (D178): el CSV se lee aquí, en memoria (ni se sube ni se guarda); el servidor cruza y devuelve la
 *  revisión con los teléfonos enmascarados; «Confirmar y guardar» guarda solo contacto y teléfono. */
export default function ImportarTelefonos() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [filas, setFilas] = useState<FilaCsv[] | null>(null);
  const [nombre, setNombre] = useState<string | null>(null);
  const [rev, setRev] = useState<ResultadoRevision | null>(null);
  const [hecho, setHecho] = useState<ResultadoGuardar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const olvidar = () => { setFilas(null); setNombre(null); setRev(null); if (input.current) input.current.value = ""; };
  const leer = async (f: File | undefined) => {
    setError(null); setHecho(null); setRev(null); setFilas(null); setNombre(null);
    if (!f) return;
    if (f.size > 200_000) { setError("El archivo es demasiado grande para una lista de teléfonos."); return; }
    const { filas: fs, error: e } = leerCsv(await f.text());
    if (e) { setError(e); return; }
    setFilas(fs); setNombre(f.name);
    empezar(async () => { setRev(await revisarTelefonos(fs)); });
  };
  const confirmar = () => filas && empezar(async () => {
    const r = await guardarTelefonos(filas);
    setHecho(r);
    // Guardado (o a medias): fuera el archivo de la memoria de la página.
    olvidar();
    router.refresh();
  });

  const asignables = rev?.ok ? rev.filas.filter((r) => r.person_id && (r.estado === "nuevo" || r.estado === "distinto")).length : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section className="gs-bloque" aria-labelledby="t-csv">
        <h2 id="t-csv" style={{ fontSize: 22 }}>Elige el archivo CSV</h2>
        <p className="pequeno suave" style={{ margin: 0 }}>
          Columnas: <code className="mono">mote, whatsapp_contacto, telefono, estado</code> (coma o punto y coma). Teléfonos con el prefijo del país: <code className="mono">+34…</code>, <code className="mono">+54…</code>.
          El archivo se lee en este navegador y no se sube ni se guarda: solo se guardan el contacto y el teléfono de cada jugador, y solo cuando confirmes.
        </p>
        <label htmlFor="csv-telefonos" className="solo-lectores">Archivo CSV de teléfonos</label>
        <input ref={input} id="csv-telefonos" type="file" accept=".csv,text/csv,text/plain" onChange={(e) => leer(e.target.files?.[0])} disabled={pendiente} data-testid="csv-telefonos" />
      </section>

      {error && <div className="aviso aviso-error" role="alert">{error}</div>}
      {hecho && (
        <div className={`aviso ${hecho.ok ? "aviso-ok" : "aviso-error"}`} role="status" data-testid="telefonos-guardados">
          {hecho.ok ? `Guardado: ${hecho.guardados.length} ${hecho.guardados.length === 1 ? "jugador" : "jugadores"}${hecho.guardados.length ? ` (${hecho.guardados.join(", ")})` : ""}.` : hecho.error}
        </div>
      )}
      {rev && !rev.ok && <div className="aviso aviso-error" role="alert">{rev.error}</div>}

      {rev?.ok && (
        <section className="gs-bloque" aria-labelledby="t-rev" data-testid="revision-telefonos">
          <h2 id="t-rev" style={{ fontSize: 22 }}>Revisión · {nombre}</h2>
          <p className="pequeno suave" style={{ margin: 0 }}>{rev.filas.length} filas: {asignables} se guardarían; las «Igual» no cambian nada y las «Sin coincidencia» no se asignan.</p>
          <div className="tabla-desplazable">
            <table className="gs-tabla ev-tabla" data-testid="tabla-revision">
              <thead><tr><th>Jugador</th><th>Contacto</th><th>Teléfono</th><th>Estado</th></tr></thead>
              <tbody>
                {rev.filas.map((r) => (
                  <tr key={r.linea} data-estado={r.estado}>
                    <td data-label="Jugador">{r.jugador ? <b>{r.jugador}</b> : <span className="suave">— (fila {r.linea}: «{r.mote}»)</span>}{r.por === "mote" && <span className="ev-sub suave">por mote</span>}</td>
                    <td data-label="Contacto">{r.contacto || <span className="suave">—</span>}</td>
                    <td data-label="Teléfono" className="mono">{r.enmascarado}</td>
                    <td data-label="Estado"><span className={r.estado === "nuevo" ? "ev-ok" : r.estado === "distinto" ? "ev-duda" : r.estado === "igual" ? "suave" : "ev-no"}>{TEXTO_ESTADO[r.estado]}</span>{r.motivo && <span className="ev-sub suave">{r.motivo}</span>}{r.nota_archivo && <span className="ev-sub suave">archivo: {r.nota_archivo}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div data-testid="sin-telefono">
            <b>Se quedan sin teléfono ({rev.sinTelefono.length}):</b> {rev.sinTelefono.length ? rev.sinTelefono.join(", ") : "nadie"}.
          </div>
          <div className="botones" style={{ margin: 0 }}>
            <button type="button" className="boton boton-amarillo" onClick={confirmar} disabled={pendiente || asignables === 0} data-testid="confirmar-telefonos">
              {pendiente ? "Guardando…" : asignables ? `Confirmar y guardar (${asignables})` : "Nada que guardar"}
            </button>
            <button type="button" className="boton boton-claro" onClick={olvidar} disabled={pendiente}>Descartar</button>
          </div>
        </section>
      )}
    </div>
  );
}
