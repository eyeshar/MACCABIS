"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MOTIVOS_JUGADOR } from "@/lib/respuestas/dominio";
import { cambiarAMano } from "./respuestas-acciones";

type Valor = "va" | "duda" | "no" | "sin_responder";
const BOTONES: { v: Valor; texto: string; clase: string }[] = [
  { v: "va", texto: "Va", clase: "ok" }, { v: "duda", texto: "Duda", clase: "duda" }, { v: "no", texto: "No va", clase: "no" }, { v: "sin_responder", texto: "Sin resp.", clase: "sin" },
];

/** Cambiar a mano la respuesta de un invitado (D159), solo gestores: un toque guarda (va, duda, no va o sin responder),
 *  «puesta por <gestor>». Con «No va», el motivo es opcional: un desplegable al lado, que guarda al elegir. */
export default function CambiarAMano({ eventoId, personId, nombre, actual, motivo, etiqueta, conDuda }: {
  eventoId: string; personId: string; nombre: string; actual: Valor; motivo: string | null; etiqueta?: string; conDuda: boolean;
}) {
  const router = useRouter();
  const [valor, setValor] = useState<Valor>(actual);
  const [mot, setMot] = useState(motivo && MOTIVOS_JUGADOR.some((m) => m.id === motivo) ? motivo : "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const guardar = (v: Valor, m: string | null) => empezar(async () => {
    setError(null);
    const antes = valor, antesM = mot;
    setValor(v); setMot(m ?? "");
    const r = await cambiarAMano(eventoId, personId, v, m);
    if (!r.ok) { setValor(antes); setMot(antesM); setError(r.error); return; }
    router.refresh();
  });
  const quien = `${nombre}${etiqueta ? ` · ${etiqueta}` : ""}`;
  return (
    <div className="ev-mano" data-testid="cambiar-a-mano" data-person={personId} data-evento={eventoId} data-valor={valor}>
      {etiqueta && <span className="ev-mano-etq">{etiqueta}</span>}
      <div className="ev-mano-botones" role="group" aria-label={`Cambiar a mano · ${quien}`}>
        {BOTONES.map((b) => (
          <button key={b.v} type="button" className={`ev-mano-b ev-mano-${b.clase}`} aria-pressed={valor === b.v}
            disabled={pendiente || (b.v === "duda" && !conDuda && valor !== "duda")}
            onClick={() => valor !== b.v && guardar(b.v, null)} aria-label={`${b.texto} · ${quien}`}>{b.texto}</button>
        ))}
      </div>
      {valor === "no" && (
        <select className="ev-mano-motivo" value={mot} disabled={pendiente} aria-label={`Por qué no va (opcional) · ${quien}`} onChange={(e) => guardar("no", e.target.value || null)}>
          <option value="">Sin motivo</option>
          {MOTIVOS_JUGADOR.map((m) => <option key={m.id} value={m.id}>{m.texto}</option>)}
        </select>
      )}
      {error && <p className="aviso aviso-error" role="alert" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
