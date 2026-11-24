"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { guardarPreferencia, quitarPreferencia } from "@/app/mi-zona/respuestas-acciones";
import { faltaParaGuardar, MOTIVO_CON_NOTA, MOTIVOS_PREFERENCIA, NOTA_MAXIMA, TEXTO_FIJO_PREFERENCIA } from "@/lib/respuestas/preferencia";
import { guardarSeguro } from "@/lib/version/cliente";
import "./preferencia.css";

export type PartidoPref = { id: string; equipo: string; hora: string | null; rival: string };
export type PrefGuardada = { evento_id: string; motivo: string; nota: string | null } | null;

/** «¿Prefieres alguno?» (D194): solo cuando va a los dos partidos («A los dos», o «Voy» a la misma hora). Estrella por
 *  partido (una a la vez; volver a pulsar la quita), motivo OBLIGATORIO de la lista, nota opcional salvo con «Otro». Se
 *  guarda con «Guardar preferencia»; si toca algo y no guarda, lo dice aquí mismo y, al irse de la página, pregunta. */
export default function PreferenciaDomingo({ fecha, partidos, guardada, mismaHora }: { fecha: string; partidos: PartidoPref[]; guardada: PrefGuardada; mismaHora: boolean }) {
  const router = useRouter();
  const [evento, setEvento] = useState<string | null>(guardada?.evento_id ?? null);
  const [motivo, setMotivo] = useState<string | null>(guardada?.motivo ?? null);
  const [nota, setNota] = useState(guardada?.nota ?? "");
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState(false);
  const [pendiente, empezar] = useTransition();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [destino, setDestino] = useState<string | null>(null);
  useEffect(() => { setEvento(guardada?.evento_id ?? null); setMotivo(guardada?.motivo ?? null); setNota(guardada?.nota ?? ""); }, [guardada?.evento_id, guardada?.motivo, guardada?.nota]);

  // Sin guardar: hay algo elegido que no es lo guardado (con una estrella puesta; quitarla se guarda al momento).
  const sucio = !!evento && (evento !== guardada?.evento_id || motivo !== (guardada?.motivo ?? null) || nota.trim() !== (guardada?.nota ?? ""));
  const falta = faltaParaGuardar(evento, motivo, nota);

  // Al irse sin guardar: el navegador pregunta (cerrar o recargar) y los enlaces de la web abren el diálogo.
  useEffect(() => {
    if (!sucio) return;
    const antes = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const clic = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey || a.origin !== window.location.origin) return;
      e.preventDefault(); e.stopPropagation();
      setDestino(a.pathname + a.search + a.hash);
      dialogo.current?.showModal();
    };
    window.addEventListener("beforeunload", antes);
    document.addEventListener("click", clic, true);
    return () => { window.removeEventListener("beforeunload", antes); document.removeEventListener("click", clic, true); };
  }, [sucio]);

  const guardar = (y?: string) => empezar(async () => {
    setError(null); setHecho(false);
    if (falta || !evento || !motivo) { setError(falta); return; }
    // D199: pestaña vieja o fallo, recarga (nunca un «guardado» sin confirmar).
    const r = await guardarSeguro(() => guardarPreferencia(fecha, evento, motivo, motivo === MOTIVO_CON_NOTA || nota.trim() ? nota : null));
    if (r === "recargando") return;
    if (!r.ok) { setError(r.error); return; }
    setHecho(true);
    if (y) { dialogo.current?.close(); router.push(y); } else router.refresh();
  });
  const pulsarEstrella = (id: string) => {
    setError(null); setHecho(false);
    if (evento !== id) { setEvento(id); return; }
    // Volver a pulsar la quita: si estaba guardada, se borra al momento.
    setEvento(null); setMotivo(guardada ? null : motivo);
    if (guardada) empezar(async () => { const r = await guardarSeguro(() => quitarPreferencia(fecha)); if (r === "recargando") return; if (!r.ok) setError(r.error); else { setMotivo(null); setNota(""); router.refresh(); } });
  };
  const salirSinGuardar = () => { const y = destino; setEvento(guardada?.evento_id ?? null); setMotivo(guardada?.motivo ?? null); setNota(guardada?.nota ?? ""); dialogo.current?.close(); if (y) setTimeout(() => router.push(y), 0); };

  return (
    <div className="pf-bloque" data-testid="preferencia" aria-label="Preferencia de partido">
      <p className="pf-tit">{mismaHora ? "Juegas en uno. ¿Prefieres alguno?" : "¿Prefieres alguno?"} <small>opcional</small></p>
      <div className="pf-partidos">
        {partidos.map((p) => {
          const on = evento === p.id;
          return (
            <button key={p.id} type="button" className="pf-partido" data-eq={p.equipo} aria-pressed={on} disabled={pendiente} data-testid={`pf-estrella-${p.equipo}`}
              aria-label={`${on ? "Tu preferido" : "Prefiero este"}: ${p.hora ?? ""} ${p.equipo}`} onClick={() => pulsarEstrella(p.id)}>
              <span className="pf-ic" aria-hidden="true">{on ? "★" : "☆"}</span>
              <span className="pf-que"><b>{p.hora ? `${p.hora} · ` : ""}{p.equipo}</b><span>{p.rival}</span></span>
              <span className="pf-acc">{on ? "Tu preferido · quitar" : "Prefiero este"}</span>
            </button>
          );
        })}
      </div>
      {evento && (
        <>
          <p className="pf-motivo-tit" id={`pf-mot-${fecha}`}>¿Por qué? <span>(elige uno)</span></p>
          <div className="pf-chips" role="radiogroup" aria-labelledby={`pf-mot-${fecha}`}>
            {MOTIVOS_PREFERENCIA.map((m) => (
              <button key={m.id} type="button" role="radio" className="pf-chip" aria-checked={motivo === m.id} data-testid={`pf-motivo-${m.id}`}
                onClick={() => { setMotivo(m.id); setHecho(false); setError(null); }}>{m.texto}</button>
            ))}
          </div>
          <textarea className="pf-nota" data-testid="pf-nota" value={nota} maxLength={NOTA_MAXIMA} onChange={(e) => { setNota(e.target.value); setHecho(false); }}
            aria-label={motivo === MOTIVO_CON_NOTA ? "Nota (obligatoria con «Otro»)" : "Nota (opcional)"} aria-invalid={motivo === MOTIVO_CON_NOTA && !nota.trim()}
            placeholder={motivo === MOTIVO_CON_NOTA ? "Cuéntanos el motivo (obligatorio con «Otro»)" : "Nota (opcional)"} />
          <span className="pf-cuenta">{nota.length} / {NOTA_MAXIMA}</span>
          {error && <p className="aviso aviso-error" role="alert" style={{ margin: 0 }} data-testid="pf-error">{error}</p>}
          <button type="button" className="pf-guardar" disabled={!!falta || pendiente || !sucio} onClick={() => guardar()} data-testid="pf-guardar">Guardar preferencia</button>
          {falta && sucio && <p className="pf-pista" data-testid="pf-pista">{falta}</p>}
          {sucio && <p className="pf-singuardar" role="status" data-testid="pf-sin-guardar">Sin guardar: tu preferencia aún no cuenta.</p>}
          {!sucio && hecho && <span className="pf-ok" role="status" data-testid="pf-guardada">✓ Preferencia guardada</span>}
        </>
      )}
      {!evento && error && <p className="aviso aviso-error" role="alert" style={{ margin: 0 }}>{error}</p>}
      <p className="pf-fija">{TEXTO_FIJO_PREFERENCIA}</p>
      <dialog ref={dialogo} className="pf-dialogo" data-testid="pf-dialogo" aria-labelledby={`pf-dlg-${fecha}`}>
        <h3 id={`pf-dlg-${fecha}`}>No has guardado tu preferencia</h3>
        <p className="suave" style={{ margin: 0 }}>Si sales ahora, se queda como estaba.</p>
        <div className="pf-botones">
          {!falta && <button type="button" className="pf-guardar" onClick={() => guardar(destino ?? undefined)} disabled={pendiente}>Guardar y salir</button>}
          <button type="button" className="pf-sec" onClick={salirSinGuardar}>Salir sin guardar</button>
          <button type="button" className="pf-sec" onClick={() => dialogo.current?.close()} autoFocus>Seguir aquí</button>
        </div>
      </dialog>
    </div>
  );
}
