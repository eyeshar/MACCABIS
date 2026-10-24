"use client";

import { useRef, useState, useTransition } from "react";

/** Botón que pide confirmación EN LA PROPIA PÁGINA (sin diálogos del navegador): al tocarlo aparece la pregunta con
 *  «Sí, …» y «No». */
export default function ConfirmarEnPagina({ texto, pregunta, si, accion, clase = "boton boton-peligro", testid }: {
  texto: string; pregunta: string; si: string; accion: () => Promise<{ ok: boolean; error?: string } | void>; clase?: string; testid?: string;
}) {
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const boton = useRef<HTMLButtonElement>(null);
  if (!abierta) return <button ref={boton} type="button" className={clase} onClick={() => { setError(null); setAbierta(true); }} data-testid={testid}>{texto}</button>;
  return (
    <div className="confirmar" role="group" aria-label={pregunta} data-testid={testid ? `${testid}-confirmar` : undefined}>
      <p className="confirmar-pregunta">{pregunta}</p>
      <div className="botones" style={{ marginTop: 0 }}>
        <button type="button" className="boton boton-peligro" disabled={pendiente} autoFocus
          onClick={() => empezar(async () => { const r = await accion(); if (r && !r.ok) setError(r.error ?? "No se pudo."); else setAbierta(false); })}>{pendiente ? "Un momento…" : si}</button>
        <button type="button" className="boton boton-claro" disabled={pendiente} onClick={() => { setAbierta(false); setTimeout(() => boton.current?.focus(), 0); }}>No</button>
      </div>
      {error && <p className="aviso aviso-error" role="alert" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
