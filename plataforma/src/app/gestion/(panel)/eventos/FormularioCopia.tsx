"use client";

import { useRef } from "react";
import { marcarCopiado } from "./acciones";

/** Formulario de «Marcar como copiado»: pide confirmacion antes de enviar (solo se pulsa si YA esta copiado en SportEasy). */
export default function FormularioCopia({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLFormElement>(null);
  function confirmar(ev: React.FormEvent<HTMLFormElement>) {
    const f = ref.current;
    if (!f) return;
    const sueltos = f.querySelectorAll<HTMLInputElement>('input[name="id"]:checked').length;
    const serie = f.querySelector<HTMLInputElement>('input[name="serie"]:checked');
    const n = sueltos + (serie ? Number(serie.dataset.n ?? 0) : 0);
    if (n === 0) { ev.preventDefault(); window.alert("Marca antes qué eventos ya están copiados en SportEasy."); return; }
    if (!window.confirm(`¿Confirmas que ${n === 1 ? "este evento ya está copiado" : `estos ${n} eventos ya están copiados`} en SportEasy?`)) ev.preventDefault();
  }
  return <form ref={ref} action={marcarCopiado} onSubmit={confirmar} className={className} style={style}>{children}</form>;
}

/** Marca o desmarca todas las casillas del formulario. */
export function MarcarTodos() {
  return (
    <button type="button" className="boton boton-claro" data-testid="marcar-todos" onClick={(ev) => {
      const f = ev.currentTarget.closest("form");
      if (!f) return;
      const cajas = Array.from(f.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:not([disabled])'));
      const todas = cajas.every((c) => c.checked);
      cajas.forEach((c) => { c.checked = !todas; });
    }}>Marcar todos</button>
  );
}
