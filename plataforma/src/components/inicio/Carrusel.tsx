"use client";

import { Children, useEffect, useRef, useState } from "react";

/** «Te faltan N respuestas» (D116): en el movil, un carrusel horizontal con scroll-snap (una tarjeta visible y asomando
 *  la siguiente) y el contador «1 de N», que cambia al desplazar; en escritorio, las tarjetas en fila. */
export default function Carrusel({ children, etiqueta }: { children: React.ReactNode; etiqueta: string }) {
  const caja = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(0);
  const n = Children.count(children);
  useEffect(() => {
    const c = caja.current;
    if (!c) return;
    const medir = () => {
      const hijos = [...c.children] as HTMLElement[];
      if (!hijos.length) return;
      const izq = c.getBoundingClientRect().left;
      let mejor = 0, dist = Infinity;
      hijos.forEach((h, i) => { const d = Math.abs(h.getBoundingClientRect().left - izq); if (d < dist) { dist = d; mejor = i; } });
      // Al final del desplazamiento, la ultima (puede no llegar al borde izquierdo).
      if (c.scrollLeft + c.clientWidth >= c.scrollWidth - 2 && c.scrollLeft > 0) mejor = hijos.length - 1;
      setActual(mejor);
    };
    medir();
    c.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => { c.removeEventListener("scroll", medir); window.removeEventListener("resize", medir); };
  }, [n]);
  return (
    <div className="in-carrusel">
      {n > 1 && <p className="in-contador cifra" aria-live="polite" data-testid="contador">{Math.min(actual + 1, n)} de {n}</p>}
      <div ref={caja} className="in-tarjetas" role="list" aria-label={etiqueta} tabIndex={0}>
        {Children.map(children, (c) => <div role="listitem" className="in-tarjeta-caja">{c}</div>)}
      </div>
    </div>
  );
}
