"use client";

import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type RefObject } from "react";
import { responder, responderDomingo } from "@/app/mi-zona/respuestas-acciones";
import type { MotivoJugador } from "@/lib/respuestas/dominio";
import { salidaDeEmergencia } from "@/lib/navegacion/salida";
import HojaNoVoy from "./HojaNoVoy";
import { EstadoGuardado, useGuardado } from "./useGuardado";

type Actual = "va" | "duda" | "no" | null;
const BOTONES: { r: "va" | "duda" | "no"; texto: string; clase: string }[] = [
  { r: "va", texto: "Voy", clase: "rw-btn-va" }, { r: "no", texto: "No voy", clase: "rw-btn-no" }, { r: "duda", texto: "Duda", clase: "rw-btn-duda" },
];

// Voy (verde) · No voy (rojo) · Duda (azul), en la tarjeta o en grande en el evento (D99, 3.2 y 3.3). Pasada la hora limite
// de las dudas (`sinDuda`, D141) el boton «Duda» no se pinta. «No voy» abre la
// hoja de motivo. Un domingo con dos partidos a horas distintas no se responde aqui: abre el domingo (D198: «Responder al
// domingo» si aun no ha respondido; si ya respondio o esta convocado, «Ver mi domingo / Cambiar respuesta»).
export default function Responder({ eventoId, fecha, domingo, actual, nombre, grande, motivo, detalle, urlDomingo, sinDuda, respondido }: {
  eventoId?: string; fecha?: string; domingo?: boolean; actual: Actual; nombre: string; grande?: boolean; sinDuda?: boolean;
  motivo?: MotivoJugador | null; detalle?: string | null; urlDomingo?: string; respondido?: boolean;
}) {
  const router = useRouter();
  const [hoja, setHoja] = useState(false);
  const [marcada, setMarcada] = useState<Actual>(actual);
  // D199: se marca solo con el servidor confirmando; un fallo recarga o se ve (useGuardado).
  const { pendiente, lento, error, setError, guardar: guardarConfirmado } = useGuardado();
  const refNo = useRef<HTMLButtonElement>(null);

  if (urlDomingo) {
    return <AbrirDomingo href={urlDomingo} grande={grande} texto={respondido ? "Ver mi domingo / Cambiar respuesta" : "Responder al domingo"} />;
  }

  const guardar = (r: "va" | "duda" | "no", m?: MotivoJugador, d?: string) => guardarConfirmado(
    () => (domingo && fecha
      ? responderDomingo(fecha, r === "va" ? "voy" : r, null, m ?? null, d ?? null)
      : responder(eventoId!, r, m ?? null, d ?? null)),
    () => { setMarcada(r); setHoja(false); router.refresh(); },
  );

  return (
    <div className={`rw-responder${grande ? " grande" : ""}`}>
      <div className="rw-botones" role="group" aria-label={`¿Vas al ${nombre}?`}>
        {BOTONES.filter((b) => !(sinDuda && b.r === "duda")).map((b) => (
          <button key={b.r} ref={b.r === "no" ? refNo : undefined} type="button" className={`rw-btn ${b.clase}${marcada === b.r ? " marcada" : ""}`} aria-pressed={marcada === b.r} disabled={pendiente}
            onClick={() => (b.r === "no" ? (setError(null), setHoja(true)) : guardar(b.r))}>
            {b.texto}
          </button>
        ))}
      </div>
      {!hoja && <EstadoGuardado pendiente={pendiente} lento={lento} />}
      {error && !hoja && <p className="aviso aviso-error" role="alert" style={{ margin: 0 }} data-testid="error-guardado">{error}</p>}
      <HojaNoVoy abierta={hoja} titulo={nombre} motivoInicial={marcada === "no" ? motivo : null} detalleInicial={marcada === "no" ? detalle : null} volverA={refNo}
        guardando={pendiente} error={hoja ? error : null} onCerrar={() => setHoja(false)} onGuardar={(m, d) => guardar("no", m, d)} />
    </div>
  );
}

// D198: el toque se nota al momento («Abriendo…», el boton apagado) aunque el domingo tarde en llegar, y un segundo toque
// mientras carga no relanza la navegacion (antes cada toque pedia la pagina otra vez y no se veia nada).
// D203: la salida de emergencia es la comun (@/lib/navegacion/salida): carga entera si la pestaña es vieja o si a los ~6 s
// la peticion ni ha salido; si salio y sigue en curso, no se recarga y a los ~20 s el boton dice «Está tardando más de lo
// normal · Toca para recargar» (y otro toque recarga).
function AbrirDomingo({ href, texto, grande }: { href: string; texto: string; grande?: boolean }) {
  const cargando = useRef(false);
  const [estado, setEstado] = useState<"listo" | "abriendo" | "tarda">("listo");
  return (
    <Link href={href} className={`boton boton-amarillo rw-abrir${grande ? " grande" : ""}${estado !== "listo" ? " pulsado" : ""}`} data-testid="abrir-domingo" data-salida-propia
      onClick={(ev) => {
        if (estado === "tarda") { ev.preventDefault(); window.location.assign(href); return; }
        if (cargando.current || estado === "abriendo") { ev.preventDefault(); return; }
        setEstado("abriendo");
        salidaDeEmergencia(href, { alCambiar: () => setEstado("listo"), alTardar: () => setEstado("tarda") });
      }}>
      <EstadoEnlace texto={texto} estado={estado} cargando={cargando} />
    </Link>
  );
}

function EstadoEnlace({ texto, estado, cargando }: { texto: string; estado: "listo" | "abriendo" | "tarda"; cargando: RefObject<boolean> }) {
  const { pending } = useLinkStatus();
  useEffect(() => { cargando.current = pending; }, [pending, cargando]);
  if (estado === "tarda") return <span className="rw-abrir-texto" role="alert">Está tardando más de lo normal · Toca para recargar</span>;
  const ocupado = pending || estado === "abriendo";
  return (
    <span className="rw-abrir-texto" aria-live="polite" aria-busy={ocupado || undefined}>
      {ocupado ? <><span className="rw-girando" aria-hidden="true" />Abriendo…</> : texto}
    </span>
  );
}
