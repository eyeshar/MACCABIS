"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const ENFOCABLES = 'a[href], button:not([disabled]), [tabindex="0"]';

/** Desplegable accesible (D89): <button aria-expanded> + panel. Se cierra con Esc (y devuelve el foco al boton), con
 *  clic fuera, al salir el foco del panel y al cambiar de pagina; flechas, Inicio y Fin recorren sus entradas.
 *  modal: la hoja "Mas" del movil, que ademas encierra el foco y bloquea el scroll de detras. */
export function useDesplegable({ modal = false }: { modal?: boolean } = {}) {
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const ruta = usePathname();

  const cerrar = useCallback((devolverFoco = false) => {
    setAbierto(false);
    if (devolverFoco) boton.current?.focus();
  }, []);

  const entradas = () => [...(panel.current?.querySelectorAll<HTMLElement>(ENFOCABLES) ?? [])];
  const enfocar = (i: number) => { const l = entradas(); if (l.length) l[(i + l.length) % l.length].focus(); };

  useEffect(() => { setAbierto(false); }, [ruta]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !boton.current?.contains(t)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); cerrar(true); } };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    let scroll = "";
    if (modal) {
      scroll = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => enfocar(0));
    }
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
      if (modal) document.body.style.overflow = scroll;
    };
  }, [abierto, modal, cerrar]);

  const propsBoton = {
    ref: boton,
    type: "button" as const,
    "aria-expanded": abierto,
    onClick: () => setAbierto((a) => !a),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const i = e.key === "ArrowUp" ? -1 : 0;
        // Ya abierto: el panel esta en pantalla y se enfoca al momento; si no, en cuanto se pinte.
        if (abierto) enfocar(i);
        else { setAbierto(true); requestAnimationFrame(() => enfocar(i)); }
      }
    },
  };

  const propsPanel = {
    ref: panel,
    hidden: !abierto,
    onKeyDown: (e: React.KeyboardEvent) => {
      const l = entradas();
      const i = l.indexOf(document.activeElement as HTMLElement);
      if (e.key === "ArrowDown") { e.preventDefault(); enfocar(i + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); enfocar(i - 1); }
      else if (e.key === "Home") { e.preventDefault(); enfocar(0); }
      else if (e.key === "End") { e.preventDefault(); enfocar(-1); }
      else if (e.key === "Tab" && modal && l.length) {
        // Hoja modal: el foco no sale de ella mientras esta abierta.
        if (!e.shiftKey && i === l.length - 1) { e.preventDefault(); enfocar(0); }
        else if (e.shiftKey && i <= 0) { e.preventDefault(); enfocar(-1); }
      }
    },
    onBlur: (e: React.FocusEvent) => {
      if (modal) return;
      const destino = e.relatedTarget as Node | null;
      if (destino && !panel.current?.contains(destino) && !boton.current?.contains(destino)) setAbierto(false);
    },
    // Un enlace a un ancla de la misma pagina no cambia la ruta: cerrar al pulsarlo.
    onClick: (e: React.MouseEvent) => { if ((e.target as HTMLElement).closest("a")) setAbierto(false); },
  };

  return { abierto, cerrar, propsBoton, propsPanel };
}
