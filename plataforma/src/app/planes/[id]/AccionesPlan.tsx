"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import ConfirmarEnPagina from "@/components/ConfirmarEnPagina";
import { borrarPlan, cancelarPlan, hacerOficial, responderPlan } from "../acciones";

type R = "va" | "duda" | "no";

/** «¿Te apuntas?» de un plan (D117): Voy / No voy / Duda, sin motivo. Con plazas llenas, «Voy» pasa a «Completo». */
export function ResponderPlan({ id, actual, completo, nombre }: { id: string; actual: R | null; completo: boolean; nombre: string }) {
  const router = useRouter();
  const [marcada, setMarcada] = useState<R | null>(actual);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const guardar = (r: R) => empezar(async () => {
    setError(null);
    const res = await responderPlan(id, r);
    if (!res.ok) { setError(res.error); return; }
    setMarcada(r); router.refresh();
  });
  const lleno = completo && marcada !== "va";
  return (
    <div className="rw-responder grande">
      <div className="rw-botones" role="group" aria-label={`¿Te apuntas a ${nombre}?`}>
        {lleno
          ? <button type="button" className="rw-btn rw-btn-completo" disabled aria-disabled="true">Completo</button>
          : <button type="button" className={`rw-btn rw-btn-va${marcada === "va" ? " marcada" : ""}`} aria-pressed={marcada === "va"} disabled={pendiente} onClick={() => guardar("va")}>Voy</button>}
        <button type="button" className={`rw-btn rw-btn-no${marcada === "no" ? " marcada" : ""}`} aria-pressed={marcada === "no"} disabled={pendiente} onClick={() => guardar("no")}>No voy</button>
        <button type="button" className={`rw-btn rw-btn-duda${marcada === "duda" ? " marcada" : ""}`} aria-pressed={marcada === "duda"} disabled={pendiente} onClick={() => guardar("duda")}>Duda</button>
      </div>
      {error && <p className="aviso aviso-error" role="alert" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}

/** Cancelar / restablecer (organizador o gestor), y lo de «Como gestor»: hacer oficial y borrar (con confirmación en la
 *  propia página). */
export function CancelarPlan({ id, cancelado }: { id: string; cancelado: boolean }) {
  const router = useRouter();
  if (cancelado) {
    return <ConfirmarEnPagina texto="Restablecer el plan" pregunta="¿Vuelve a estar en pie?" si="Sí, restablecer" clase="boton boton-claro" testid="restablecer-plan"
      accion={async () => { const r = await cancelarPlan(id, true); if (r.ok) router.refresh(); return r; }} />;
  }
  return <ConfirmarEnPagina texto="Cancelar el plan" pregunta="¿Seguro que lo cancelas? Sigue en la agenda como cancelado." si="Sí, cancelar" testid="cancelar-plan"
    accion={async () => { const r = await cancelarPlan(id); if (r.ok) router.refresh(); return r; }} />;
}

export function AccionesGestor({ id }: { id: string }) {
  return (
    <>
      <ConfirmarEnPagina texto="Hacer oficial" pregunta="Pasa a ser un evento del club: cuenta para todo y entra en la copia a SportEasy." si="Sí, hacerlo oficial" clase="boton boton-amarillo" testid="hacer-oficial"
        accion={async () => hacerOficial(id)} />
      <ConfirmarEnPagina texto="Borrar" pregunta="¿Borrar el plan? Desaparece de la agenda de todos y se avisa a quien lo organiza." si="Sí, borrar" testid="borrar-plan"
        accion={async () => borrarPlan(id)} />
    </>
  );
}
