"use client";

import { useEffect } from "react";
import { useRuta } from "@/components/nav/useRuta";
import { rutaDe, salidaDeEmergencia } from "@/lib/navegacion/salida";

/** Enlaces que no pueden quedarse sin respuesta (D203): el evento y los planes, se pinten donde se pinten. */
export const RUTA_GUARDADA = /^\/(evento|planes)\//;
/** Si la navegación no cambia de página ni se hace la carga entera (cancelada, sin red), el enlace vuelve a estar listo. */
const LISTO_OTRA_VEZ_MS = 15_000;

const limpiar = (a: Element) => { a.removeAttribute("data-abriendo"); a.removeAttribute("aria-busy"); };

/**
 * D203 (BACKLOG 25): la salida de emergencia de «Responder al domingo» (D198) para TODOS los enlaces a /evento/… y
 * /planes/…, sin tocar cada enlace: un único escuchador de toques en el documento, montado en el layout raíz.
 *   - El toque se nota en el propio enlace al momento (`data-abriendo`, `aria-busy`; el estilo en globals.css). Nada de
 *     loading.tsx en /evento: rompía su redirección y su 404 (D198).
 *   - Un segundo toque mientras está «abriendo» no relanza la navegación.
 *   - Pestaña de una versión vieja (/version.txt): carga entera en seguida. Navegación colgada: carga entera a los ~6 s.
 * No se mete en lo que no es un toque normal (Ctrl/⌘/Mayús, botón central, otra pestaña, descarga, otro sitio, la misma
 * página) ni en un enlace con su propia salida (`data-salida-propia`, como AbrirDomingo). No pinta nada.
 */
export default function GuardaEnlaces() {
  const ruta = useRuta();
  // Ya en otra página: lo que quedara marcado (un enlace del layout, una pestaña del evento) vuelve a estar listo.
  useEffect(() => { document.querySelectorAll("a[data-abriendo]").forEach(limpiar); }, [ruta]);
  useEffect(() => {
    const alTocar = (ev: MouseEvent) => {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const a = (ev.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || a.hasAttribute("data-salida-propia") || a.hasAttribute("download")) return;
      if (a.target && a.target !== "_self") return;
      const destino = rutaDe(a.href);
      if (!destino || !RUTA_GUARDADA.test(destino) || destino === window.location.pathname + window.location.search) return;
      if (a.hasAttribute("data-abriendo")) { ev.preventDefault(); return; } // segundo toque: ya va
      a.setAttribute("data-abriendo", "");
      a.setAttribute("aria-busy", "true");
      const t = window.setTimeout(() => limpiar(a), LISTO_OTRA_VEZ_MS);
      salidaDeEmergencia(a.href, () => { window.clearTimeout(t); limpiar(a); });
    };
    // En la fase de captura: antes que el onClick de <Link>, para que un segundo toque lo pare (Link mira defaultPrevented).
    document.addEventListener("click", alTocar, true);
    return () => document.removeEventListener("click", alTocar, true);
  }, []);
  return null;
}
