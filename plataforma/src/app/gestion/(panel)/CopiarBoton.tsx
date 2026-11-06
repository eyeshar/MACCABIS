"use client";

import { useState } from "react";

/** Un botón que copia un texto ya hecho (p. ej. el WhatsApp a quien falta por responder), sin enseñarlo entero. */
export default function CopiarBoton({ texto, etiqueta = "Copiar WhatsApp", prueba }: { texto: string; etiqueta?: string; prueba?: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      window.prompt("Copia el texto:", texto);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }
  return (
    <button type="button" className="boton boton-claro" onClick={copiar} aria-live="polite" data-testid={prueba} data-texto={texto}>
      {copiado ? "Copiado" : etiqueta}
    </button>
  );
}
