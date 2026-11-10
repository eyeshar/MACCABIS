"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { estadosPase, recuentoPase, TEXTO_PASE, type EstadoPase } from "@/lib/eventos/paseDeLista";
import { guardarPaseDeLista } from "./pase-acciones";

export type FilaPase = { person_id: string; nombre: string; estado: EstadoPase; motivo: string | null; respuesta: string; guardada: boolean };

/** El pase de lista de un evento ya terminado (D192): una fila por invitado con su estado (por defecto, lo que respondió,
 *  D50) y un solo «Guardar». Nada se guarda hasta pulsarlo. */
export default function PaseDeListaFormulario({ eventoId, partido, filas }: { eventoId: string; partido: boolean; filas: FilaPase[] }) {
  const router = useRouter();
  const [estados, setEstados] = useState<Record<string, EstadoPase>>(() => Object.fromEntries(filas.map((f) => [f.person_id, f.estado])));
  const [texto, setTexto] = useState<{ ok: boolean; t: string } | null>(null);
  const [pendiente, empezar] = useTransition();
  const opciones = estadosPase(partido);
  const r = recuentoPase(Object.values(estados));
  const cambiados = filas.filter((f) => estados[f.person_id] !== f.estado || !f.guardada).length;
  const guardar = () => empezar(async () => {
    setTexto(null);
    const res = await guardarPaseDeLista(eventoId, filas.map((f) => {
      const e = estados[f.person_id];
      return { person_id: f.person_id, estado: e, motivo: e === "con_excusa" || e === "lesion" ? (e === f.estado ? f.motivo : null) : null };
    }));
    setTexto(res.ok ? { ok: true, t: `Pase de lista guardado: ${res.n} ${res.n === 1 ? "persona" : "personas"}.` } : { ok: false, t: res.error });
    if (res.ok) router.refresh();
  });
  return (
    <div className="pl-form" data-testid="pase-formulario">
      <p className="pequeno" style={{ margin: 0 }} data-testid="pase-recuento">
        <b>Fueron {r.fueron}</b>{r.retraso ? ` (${r.retraso} con retraso)` : ""} · con excusa {r.conExcusa} · sin excusa {r.sinExcusa} · lesionados {r.lesion}{partido ? ` · no convocados ${r.noConvocado}` : ""}
      </p>
      <ul className="lista-limpia pl-lista" data-testid="pase-lista">
        {filas.map((f) => (
          <li key={f.person_id} className="pl-fila" data-person={f.person_id} data-estado={estados[f.person_id]}>
            <span className="pl-nombre"><b>{f.nombre}</b><small className="suave">Respondió: {f.respuesta}{f.motivo ? ` · ${f.motivo}` : ""}</small></span>
            <select className="pl-select" value={estados[f.person_id]} disabled={pendiente} aria-label={`Pase de lista · ${f.nombre}`}
              onChange={(e) => setEstados((s) => ({ ...s, [f.person_id]: e.target.value as EstadoPase }))}>
              {opciones.map((o) => <option key={o} value={o}>{TEXTO_PASE[o]}</option>)}
            </select>
          </li>
        ))}
      </ul>
      <div className="botones" style={{ margin: 0 }}>
        <button type="button" className="boton boton-amarillo" onClick={guardar} disabled={pendiente || !filas.length} data-testid="pase-guardar">
          {pendiente ? "Guardando…" : cambiados ? "Guardar el pase de lista" : "Guardar de nuevo"}
        </button>
      </div>
      {texto && <p className={`pequeno ${texto.ok ? "" : "aviso aviso-error"}`} role="status" style={{ margin: 0 }} data-testid="pase-resultado">{texto.t}</p>}
    </div>
  );
}
