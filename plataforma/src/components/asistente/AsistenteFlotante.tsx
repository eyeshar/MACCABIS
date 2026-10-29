"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { asistenteEnRuta } from "@/lib/chat/acceso";
import { Bocadillo } from "@/components/Iconos";
import Chat from "./Chat";
import { borrarConversacion } from "./conversacion";

const ENFOCABLES = 'a[href], button:not([disabled]), textarea:not([disabled]), [tabindex="0"]';

/** Boton flotante «Pregunta al asistente» (D142) y su panel: hoja desde abajo en el movil (~85 % del alto), panel lateral
 *  de 400 px en escritorio. Solo con sesion y acceso (CHAT_IA_ABIERTO; lo decide el servidor en Cabecera: `chat` null =
 *  sin acceso) y solo en Inicio y las pantallas con login (asistenteEnRuta). Se cierra con ✕, Escape, tocando fuera o al
 *  cambiar de pantalla; la conversacion sigue (sessionStorage) y se borra al cerrar sesion. En Convocatoria, Tablero y
 *  Grupos el boton se esconde mientras su barra fija de acciones esta en pantalla (CSS). */
export default function AsistenteFlotante({ chat }: { chat: { nombre: string; dueno: string } | null }) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Sin sesion (o sin acceso): fuera la conversacion que hubiera en la pestaña.
  useEffect(() => { if (!chat) borrarConversacion(); }, [chat]);
  useEffect(() => { setAbierto(false); }, [ruta]);

  // El boton esta oculto mientras el panel esta abierto: el foco vuelve a el cuando ya se ve.
  const cerrar = useCallback(() => { setAbierto(false); requestAnimationFrame(() => boton.current?.focus()); }, []);

  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); cerrar(); return; }
      // Modal: el foco no sale del panel.
      if (e.key !== "Tab" || !panel.current) return;
      const l = [...panel.current.querySelectorAll<HTMLElement>(ENFOCABLES)].filter((x) => x.offsetParent !== null);
      if (!l.length) return;
      const i = l.indexOf(document.activeElement as HTMLElement);
      if (!e.shiftKey && i === l.length - 1) { e.preventDefault(); l[0].focus(); }
      else if (e.shiftKey && i <= 0) { e.preventDefault(); l[l.length - 1].focus(); }
    };
    document.addEventListener("keydown", tecla);
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("textarea:not([disabled])")?.focus());
    return () => { document.removeEventListener("keydown", tecla); document.body.style.overflow = scroll; };
  }, [abierto, cerrar]);

  if (!chat || !asistenteEnRuta(ruta)) return null;
  return (
    <>
      <button
        ref={boton} type="button" className="af-boton" aria-label="Pregunta al asistente" aria-haspopup="dialog" aria-expanded={abierto}
        aria-controls="af-panel" data-testid="boton-asistente" onClick={() => { setMontado(true); setAbierto(true); }}
      >
        <Bocadillo />
      </button>
      {abierto && <div className="af-velo" aria-hidden="true" data-testid="velo-asistente" onClick={cerrar} />}
      <div ref={panel} id="af-panel" className="af-panel" role="dialog" aria-modal="true" aria-labelledby="af-titulo" hidden={!abierto} data-testid="panel-asistente">
        <div className="af-asa" aria-hidden="true" />
        <div className="af-cab">
          <p id="af-titulo" className="af-titulo">Asistente</p>
          <button type="button" className="nv-cerrar" onClick={cerrar} aria-label="Cerrar">×</button>
        </div>
        <p className="as-aviso" data-testid="aviso-fijo">Respuestas automáticas, pueden equivocarse. Lo oficial es lo que pone la web.</p>
        {montado && <Chat nombre={chat.nombre} dueno={chat.dueno} activo={abierto} />}
      </div>
    </>
  );
}
