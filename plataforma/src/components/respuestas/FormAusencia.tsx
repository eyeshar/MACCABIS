"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { guardarAusencia, previsualizarAusencia, type EventoPeriodo } from "@/app/mi-zona/respuestas-acciones";
import { MOTIVOS_JUGADOR, diaCorto, tituloDe, type MotivoJugador } from "@/lib/respuestas/dominio";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
const ymd = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const dma = (f: string) => `${+f.slice(8, 10)}/${+f.slice(5, 7)}`;

/** Nueva ausencia o editar una (D99, 3.6): calendario mensual con flechas; se toca el primer y el ultimo dia y la franja
 *  queda marcada; un punto señala los dias con evento. Motivo, «Sin fecha de vuelta» y resumen antes de guardar. */
export default function FormAusencia({ hoy, diasConEvento, inicial }: {
  hoy: string; diasConEvento: string[];
  inicial?: { id: string; desde: string; hasta: string | null; motivo: MotivoJugador; detalle: string | null };
}) {
  const router = useRouter();
  const [mes, setMes] = useState(() => { const f = inicial?.desde ?? hoy; return { y: +f.slice(0, 4), m: +f.slice(5, 7) - 1 }; });
  const [desde, setDesde] = useState<string | null>(inicial?.desde ?? null);
  const [hasta, setHasta] = useState<string | null>(inicial?.hasta ?? null);
  const [sinVuelta, setSinVuelta] = useState(inicial ? inicial.hasta == null : false);
  const [motivo, setMotivo] = useState<MotivoJugador | null>(inicial?.motivo ?? null);
  const [detalle, setDetalle] = useState(inicial?.detalle ?? "");
  const [resumen, setResumen] = useState<EventoPeriodo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const conEvento = useMemo(() => new Set(diasConEvento), [diasConEvento]);
  const final = sinVuelta ? null : hasta ?? desde;

  useEffect(() => {
    if (!desde) { setResumen(null); return; }
    let vivo = true;
    previsualizarAusencia(desde, final).then((r) => { if (vivo) setResumen(r.ok ? r.eventos : null); });
    return () => { vivo = false; };
  }, [desde, final]);

  const tocar = (f: string) => {
    if (f < hoy) return;
    if (!desde || sinVuelta || (desde && hasta) || f < desde) { setDesde(f); setHasta(null); return; }
    setHasta(f);
  };
  const primero = new Date(Date.UTC(mes.y, mes.m, 1));
  const huecos = (primero.getUTCDay() + 6) % 7;
  const diasMes = new Date(Date.UTC(mes.y, mes.m + 1, 0)).getUTCDate();
  const mover = (n: number) => setMes((x) => { const d = new Date(Date.UTC(x.y, x.m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const enFranja = (f: string) => !!desde && f >= desde && (sinVuelta ? true : f <= (hasta ?? desde));
  const conVoy = (resumen ?? []).filter((e) => e.respuesta === "va");
  const nombreEv = (e: EventoPeriodo) => `${tituloDe({ tipo: e.tipo as "entreno", equipo: e.equipo as "MdA", titulo: e.titulo, rival: e.rival, es_local: e.es_local })} (${dma(e.fecha)})`;

  const guardar = () => empezar(async () => {
    setError(null);
    if (!desde || !motivo) { setError("Elige los días y el motivo."); return; }
    const r = await guardarAusencia(inicial?.id ?? null, desde, final, motivo, detalle);
    if (!r.ok) { setError(r.error); return; }
    router.push("/mi-zona/ausencias?guardada=1");
    router.refresh();
  });

  return (
    <div className="rw-ausencia">
      <section className="tarjeta rw-cal" aria-label="Elige los días">
        <div className="rw-cal-cab">
          <button type="button" className="boton boton-claro rw-cal-flecha" onClick={() => mover(-1)} aria-label="Mes anterior">‹</button>
          <strong aria-live="polite">{MESES[mes.m]} {mes.y}</strong>
          <button type="button" className="boton boton-claro rw-cal-flecha" onClick={() => mover(1)} aria-label="Mes siguiente">›</button>
        </div>
        <p className="suave pequeno" style={{ margin: 0 }}>{!desde ? "Toca el primer día que no estás." : sinVuelta ? `Desde el ${diaCorto(desde)}, sin fecha de vuelta.` : !hasta ? "Ahora toca el último día (o el mismo, si es uno solo)." : `Del ${diaCorto(desde)} al ${diaCorto(hasta)}.`}</p>
        <div className="rw-cal-rejilla">
          {SEMANA.map((d) => <span key={d} className="rw-cal-sem" aria-hidden="true">{d}</span>)}
          {Array.from({ length: huecos }, (_, i) => <span key={`h${i}`} />)}
          {Array.from({ length: diasMes }, (_, i) => {
            const f = ymd(mes.y, mes.m, i + 1);
            const pasado = f < hoy;
            return (
              <button key={f} type="button" disabled={pasado} onClick={() => tocar(f)} aria-pressed={enFranja(f)}
                className={`rw-cal-dia${enFranja(f) ? " en-franja" : ""}${f === desde || f === hasta ? " extremo" : ""}${f === hoy ? " hoy" : ""}`}
                aria-label={`${diaCorto(f)} de ${MESES[mes.m].toLowerCase()}${conEvento.has(f) ? ", hay evento" : ""}`}>
                {i + 1}{conEvento.has(f) && <span className="rw-cal-punto" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <label className="rw-check"><input type="checkbox" checked={sinVuelta} onChange={(e) => { setSinVuelta(e.target.checked); if (e.target.checked) setHasta(null); }} /> Sin fecha de vuelta <span className="tenue">(p. ej., una lesión)</span></label>
      </section>

      <fieldset className="tarjeta rw-motivos">
        <legend>Motivo <span className="tenue">· solo lo ven los gestores</span></legend>
        {MOTIVOS_JUGADOR.map((m) => (
          <label key={m.id} className={`rw-motivo${motivo === m.id ? " elegido" : ""}`}>
            <input type="radio" name="motivo" value={m.id} checked={motivo === m.id} onChange={() => setMotivo(m.id)} />
            <span>{m.texto}</span>
          </label>
        ))}
        <label className="rw-detalle"><span>Detalle <span className="tenue">(opcional)</span></span>
          <input type="text" maxLength={120} placeholder="Ej.: viaje de trabajo" value={detalle} onChange={(e) => setDetalle(e.target.value)} /></label>
      </fieldset>

      {desde && resumen && (
        <section className="tarjeta rw-resumen" aria-live="polite">
          <p style={{ margin: 0 }}>{resumen.length ? <>Pondremos «no voy» en <strong>{resumen.length} {resumen.length === 1 ? "evento" : "eventos"}</strong>: {resumen.slice(0, 8).map(nombreEv).join(", ")}{resumen.length > 8 ? ` y ${resumen.length - 8} más` : ""}.</> : "En esos días no tienes ningún evento (si se crea alguno, quedará en «no voy»)."}</p>
          {conVoy.length > 0 && <p className="rw-aviso-voy" role="alert">Tenías «voy» en {conVoy.map(nombreEv).join(", ")}: pasará a «no voy».</p>}
        </section>
      )}
      {error && <p className="aviso aviso-error" role="alert">{error}</p>}
      <div className="botones">
        <button type="button" className="boton boton-amarillo" onClick={guardar} disabled={pendiente || !desde || !motivo}>{pendiente ? "Guardando…" : inicial ? "Guardar cambios" : "Guardar ausencia"}</button>
        <button type="button" className="boton boton-claro" onClick={() => router.push("/mi-zona/ausencias")}>Cancelar</button>
      </div>
      <p className="suave pequeno">Si la borras, esos eventos vuelven a «sin responder».</p>
    </div>
  );
}
