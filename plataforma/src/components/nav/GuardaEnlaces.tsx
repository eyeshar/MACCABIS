"use client";

import { useEffect, useState } from "react";
import { useRuta } from "@/components/nav/useRuta";
import { rutaDe, salidaDeEmergencia, vigilarPeticiones } from "@/lib/navegacion/salida";

/** Enlaces que no pueden quedarse sin respuesta (D203): el evento y los planes, se pinten donde se pinten. */
export const RUTA_GUARDADA = /^\/(evento|planes)\//;

const limpiar = (a: Element) => { a.removeAttribute("data-abriendo"); a.removeAttribute("data-tarda"); a.removeAttribute("aria-busy"); };

type Aviso = { href: string; top: number; left: number; ancho: number };

/**
 * D203 (BACKLOG 25): la salida de emergencia de «Responder al domingo» (D198) para TODOS los enlaces a /evento/… y
 * /planes/…, sin tocar cada enlace: un único escuchador de toques en el documento, montado en el layout raíz.
 *   - El toque se nota en el propio enlace al momento (`data-abriendo`, `aria-busy`; el estilo en globals.css). Nada de
 *     loading.tsx en /evento: rompía su redirección y su 404 (D198).
 *   - Un segundo toque mientras está «abriendo» no relanza la navegación.
 *   - Pestaña de una versión vieja: carga entera en seguida. Navegación que no ha salido del navegador a los ~6 s: carga
 *     entera. Petición en curso: no se recarga (cargas reales de 12–31 s); a los ~20 s, bajo el enlace, «Está tardando
 *     más de lo normal» con «Recargar» (y otro toque en el enlace también recarga).
 * No se mete en lo que no es un toque normal (Ctrl/⌘/Mayús/Alt, botón central, otra pestaña, descarga, otro sitio, la
 * misma dirección) ni en un enlace con su propia salida (`data-salida-propia`, como AbrirDomingo).
 */
export default function GuardaEnlaces() {
  const ruta = useRuta();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  // Ya en otra página: lo que quedara marcado vuelve a estar listo y el aviso se va.
  useEffect(() => { document.querySelectorAll("a[data-abriendo], a[data-tarda]").forEach(limpiar); setAviso(null); }, [ruta]);
  useEffect(() => {
    vigilarPeticiones();
    document.documentElement.setAttribute("data-guarda-enlaces", "");
    const alTocar = (ev: MouseEvent) => {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const a = (ev.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || a.hasAttribute("data-salida-propia") || a.hasAttribute("download")) return;
      if (a.target && a.target !== "_self") return;
      const destino = rutaDe(a.href);
      if (!destino || !RUTA_GUARDADA.test(destino) || destino === window.location.pathname + window.location.search) return;
      if (a.hasAttribute("data-tarda")) { ev.preventDefault(); window.location.assign(a.href); return; } // recargar a mano
      if (a.hasAttribute("data-abriendo")) { ev.preventDefault(); return; } // segundo toque: ya va
      a.setAttribute("data-abriendo", "");
      a.setAttribute("aria-busy", "true");
      salidaDeEmergencia(a.href, {
        alCambiar: () => limpiar(a),
        alTardar: () => {
          if (!a.isConnected) return;
          a.setAttribute("data-tarda", "");
          const r = a.getBoundingClientRect();
          setAviso({ href: a.href, top: r.bottom + window.scrollY, left: Math.max(8, Math.min(r.left, window.innerWidth - 236)) + window.scrollX, ancho: Math.min(r.width, window.innerWidth - 16) });
        },
      });
    };
    // En la fase de captura: antes que el onClick de <Link>, para que un segundo toque lo pare (Link mira defaultPrevented).
    document.addEventListener("click", alTocar, true);
    return () => document.removeEventListener("click", alTocar, true);
  }, []);
  if (!aviso) return null;
  return (
    <div className="enlace-tarda" role="alert" data-testid="enlace-tarda" style={{ top: aviso.top, left: aviso.left, width: Math.max(aviso.ancho, 220) }}>
      <span>Está tardando más de lo normal.</span>
      <button type="button" className="boton boton-amarillo" onClick={() => window.location.assign(aviso.href)}>Recargar</button>
    </div>
  );
}
