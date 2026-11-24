"use client";

import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type RefObject } from "react";
import { responder, responderDomingo } from "@/app/mi-zona/respuestas-acciones";
import type { MotivoJugador } from "@/lib/respuestas/dominio";
import HojaNoVoy from "./HojaNoVoy";

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
  const [error, setError] = useState<string | null>(null);
  const [marcada, setMarcada] = useState<Actual>(actual);
  const [pendiente, empezar] = useTransition();
  const refNo = useRef<HTMLButtonElement>(null);

  if (urlDomingo) {
    return <AbrirDomingo href={urlDomingo} grande={grande} texto={respondido ? "Ver mi domingo / Cambiar respuesta" : "Responder al domingo"} />;
  }

  const guardar = (r: "va" | "duda" | "no", m?: MotivoJugador, d?: string) => empezar(async () => {
    setError(null);
    const res = domingo && fecha
      ? await responderDomingo(fecha, r === "va" ? "voy" : r, null, m ?? null, d ?? null)
      : await responder(eventoId!, r, m ?? null, d ?? null);
    if (!res.ok) { setError(res.error); return; }
    setMarcada(r); setHoja(false); router.refresh();
  });

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
      {error && !hoja && <p className="aviso aviso-error" role="alert" style={{ margin: 0 }}>{error}</p>}
      <HojaNoVoy abierta={hoja} titulo={nombre} motivoInicial={marcada === "no" ? motivo : null} detalleInicial={marcada === "no" ? detalle : null} volverA={refNo}
        guardando={pendiente} error={hoja ? error : null} onCerrar={() => setHoja(false)} onGuardar={(m, d) => guardar("no", m, d)} />
    </div>
  );
}

// D198: el toque se nota al momento («Abriendo…», el boton apagado) aunque el domingo tarde en llegar, y un segundo toque
// mientras carga no relanza la navegacion (antes cada toque pedia la pagina otra vez y no se veia nada).
function AbrirDomingo({ href, texto, grande }: { href: string; texto: string; grande?: boolean }) {
  const cargando = useRef(false);
  const [pulsado, setPulsado] = useState(false);
  // Si la navegacion no llega a cambiar de pagina (cancelada, sin red), el boton vuelve a estar listo.
  useEffect(() => { if (!pulsado) return; const t = setTimeout(() => setPulsado(false), 15000); return () => clearTimeout(t); }, [pulsado]);
  return (
    <Link href={href} className={`boton boton-amarillo rw-abrir${grande ? " grande" : ""}${pulsado ? " pulsado" : ""}`} data-testid="abrir-domingo"
      onClick={(ev) => { if (cargando.current) { ev.preventDefault(); return; } setPulsado(true); salidaDeEmergencia(href); }}>
      <EstadoEnlace texto={texto} pulsado={pulsado} cargando={cargando} />
    </Link>
  );
}

// D198: salida de emergencia. El 24/11 los toques de un jugador no llegaron al servidor: la navegacion del cliente se
// quedo dentro del movil (lo mas probable, una pestaña de Safari con una version vieja tras un despliegue). Si a los
// ~6 s del toque la ruta sigue siendo la de antes, se carga la pagina entera, como un enlace normal. El temporizador no
// depende del componente: si la navegacion si llego (o se fue a otra pagina), la ruta ya no es la de antes y no hace nada.
const ESPERA_EMERGENCIA_MS = 6000;
function salidaDeEmergencia(href: string) {
  const antes = window.location.pathname + window.location.search;
  window.setTimeout(() => {
    if (window.location.pathname + window.location.search === antes) window.location.assign(href);
  }, ESPERA_EMERGENCIA_MS);
}

function EstadoEnlace({ texto, pulsado, cargando }: { texto: string; pulsado: boolean; cargando: RefObject<boolean> }) {
  const { pending } = useLinkStatus();
  useEffect(() => { cargando.current = pending; }, [pending, cargando]);
  const ocupado = pending || pulsado;
  return (
    <span className="rw-abrir-texto" aria-live="polite" aria-busy={ocupado || undefined}>
      {ocupado ? <><span className="rw-girando" aria-hidden="true" />Abriendo…</> : texto}
    </span>
  );
}
