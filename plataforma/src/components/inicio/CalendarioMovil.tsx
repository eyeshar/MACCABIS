"use client";

import { useState } from "react";
import ConfirmarEnPagina from "@/components/ConfirmarEnPagina";
import { cambiarMiEnlace } from "@/app/agenda/acciones";

/** «Tu calendario en el móvil» (D120): suscribirse a SU calendario desde Google Calendar, el iPhone u Outlook. */
export default function CalendarioMovil({ enlace }: { enlace: { https: string; webcal: string } | null }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <section className="in-sec in-calendario" aria-labelledby="t-calendario" data-testid="tu-calendario">
      <h2 id="t-calendario">Tu calendario en el móvil</h2>
      {enlace ? (
        <>
          <p className="suave" style={{ margin: 0 }}>Tus partidos, entrenos y planes, con tu estado, en el calendario de tu móvil. Es solo tuyo: no compartas el enlace.</p>
          <div className="in-cal-botones">
            <a className="boton boton-amarillo" href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(enlace.webcal)}`} target="_blank" rel="noopener noreferrer">Añadir a Google Calendar</a>
            <a className="boton boton-claro" href={enlace.webcal}>Añadir al iPhone</a>
            <button type="button" className="boton boton-claro" onClick={async () => { try { await navigator.clipboard.writeText(enlace.https); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { setCopiado(false); } }}>
              {copiado ? "Enlace copiado" : "Copiar enlace"}
            </button>
          </div>
          <p className="pequeno suave" style={{ margin: 0 }}>«Copiar enlace» sirve para Outlook u otros calendarios: añádelo como «calendario de Internet».</p>
          <p className="in-nota" style={{ margin: 0 }}>Los cambios llegan a tu calendario en unas horas (Google puede tardar hasta un día). Para cambios de última hora, mira los avisos.</p>
          <ConfirmarEnPagina texto="Cambiar mi enlace" pregunta="El enlace actual dejará de funcionar: tendrás que volver a añadir el calendario." si="Sí, cambiarlo" clase="boton boton-claro" testid="cambiar-enlace"
            accion={async () => cambiarMiEnlace()} />
        </>
      ) : <p className="suave" style={{ margin: 0 }}>El calendario personal aún no está disponible.</p>}
    </section>
  );
}
