"use client";

import { useEffect, useState } from "react";
import { CalendarioMas } from "@/components/Iconos";
import { URL_PRODUCCION } from "@/lib/indexacion";

/** «Añadir a mi calendario» de la portada: la suscripcion lleva la direccion absoluta de la web que se esta viendo. La
 *  portada se sirve ya hecha (D175) y no sabe en que direccion esta: sale con la de produccion y, en el navegador, se
 *  cambia por la real (en produccion es la misma; en una vista previa, la suya). */
export default function AnadirCalendario() {
  const [base, setBase] = useState(URL_PRODUCCION);
  useEffect(() => { setBase(window.location.origin); }, []);
  const feed = `${base}/calendario.ics`;
  const webcal = feed.replace(/^https?:/, "webcal:");
  return (
    <details className="w-anadir">
      <summary><CalendarioMas />Añadir a mi calendario</summary>
      <div className="w-anadir-menu">
        <a href={webcal}>iPhone, iPad o Mac<small>Se suscribe y se actualiza solo</small></a>
        <a href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`}>Google Calendar<small>Android o web; se actualiza solo</small></a>
        <a href="/calendario.ics" download="maccabis.ics">Descargar el archivo (.ics)<small>Para Outlook u otros; no se actualiza</small></a>
      </div>
    </details>
  );
}
