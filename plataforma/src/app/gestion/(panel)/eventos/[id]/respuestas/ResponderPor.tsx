"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MOTIVOS_JUGADOR } from "@/lib/respuestas/dominio";
import { marcarVisto, recordatorioAhora, responderDomingoPor, responderPor } from "../../respuestas-acciones";

type Opcion = { id: string; texto: string; opcion?: string; evento?: string | null };

/** «Responder por él» (D99.11): un gestor pone la respuesta de un jugador (p. ej. si se lo dice por WhatsApp). Queda
 *  guardado quién la puso. «No va» pide motivo, como al jugador. */
export function ResponderPor({ eventoId, personId, nombre, fecha, domingo, opciones }: {
  eventoId: string; personId: string; nombre: string; fecha: string; domingo: boolean; opciones: Opcion[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [op, setOp] = useState(opciones[0]?.id ?? "");
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const elegida = opciones.find((o) => o.id === op);
  const esNo = elegida?.opcion === "no" || elegida?.id === "no";
  const guardar = () => empezar(async () => {
    setError(null);
    if (!elegida) return;
    const r = domingo
      ? await responderDomingoPor(eventoId, fecha, personId, elegida.opcion ?? elegida.id, elegida.evento ?? null, esNo ? motivo || null : null, esNo ? detalle : null)
      : await responderPor(eventoId, personId, elegida.id as "va" | "duda" | "no", esNo ? motivo || null : null, esNo ? detalle : null);
    if (!r.ok) { setError(r.error); return; }
    setAbierto(false); router.refresh();
  });
  if (!abierto) return <button type="button" className="boton boton-claro ev-por" onClick={() => setAbierto(true)} aria-label={`Responder por ${nombre}`}>Responder por él</button>;
  return (
    <div className="ev-por-form" role="group" aria-label={`Responder por ${nombre}`}>
      <select value={op} onChange={(e) => setOp(e.target.value)} aria-label="Respuesta">
        {opciones.map((o) => <option key={o.id} value={o.id}>{o.texto}</option>)}
      </select>
      {esNo && (
        <>
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo" required>
            <option value="">Motivo…</option>
            {MOTIVOS_JUGADOR.map((m) => <option key={m.id} value={m.id}>{m.texto}</option>)}
          </select>
          <input type="text" value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Detalle (opcional)" aria-label="Detalle" maxLength={120} />
        </>
      )}
      <div className="botones" style={{ margin: 0 }}>
        <button type="button" className="boton boton-amarillo" onClick={guardar} disabled={pendiente || (esNo && !motivo)}>Guardar</button>
        <button type="button" className="boton boton-claro" onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
      {error && <p className="aviso aviso-error" role="alert" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}

export function BotonVisto({ eventoId, ids }: { eventoId: string; ids: string[] }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  return <button type="button" className="boton boton-claro" disabled={pendiente} onClick={() => empezar(async () => { await marcarVisto(eventoId, ids); router.refresh(); })}>Visto</button>;
}

export function BotonRecordatorio({ eventoId }: { eventoId: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button type="button" className="boton boton-amarillo" disabled={pendiente}
        onClick={() => { if (window.confirm("¿Enviar ahora un recordatorio a quien no ha respondido?")) empezar(async () => { const r = await recordatorioAhora(eventoId); setTexto(r.ok ? r.texto ?? "Hecho." : r.error); router.refresh(); }); }}>
        {pendiente ? "Enviando…" : "Enviar un recordatorio ahora"}
      </button>
      {texto && <p className="pequeno" role="status" style={{ margin: 0 }}>{texto}</p>}
    </div>
  );
}
