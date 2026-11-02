"use client";
import { useEffect, useRef } from "react";

/** Los filtros: abiertos en pantallas anchas y plegados en el móvil (D170). Sin JS quedan plegados y se abren al pulsar. */
export default function Plegable({ resumen, children }: { resumen: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (ref.current && window.matchMedia("(min-width: 720px)").matches) ref.current.open = true; }, []);
  return (
    <details ref={ref} className="as-plegable" data-testid="filtros">
      <summary>{resumen}</summary>
      {children}
    </details>
  );
}
