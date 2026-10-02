"use client";

import { useFormStatus } from "react-dom";

// Boton de envio que pide confirmacion antes de una accion que no se deshace.
export default function BotonConfirmar({ pregunta, className, children }: { pregunta: string; className?: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(pregunta)) e.preventDefault();
      }}
    >
      {pending ? "Un momento…" : children}
    </button>
  );
}
