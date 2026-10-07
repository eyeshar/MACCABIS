"use client";

import { useState } from "react";

/** Un texto para pegar en WhatsApp o SportEasy, con su boton de copiar. */
export default function CopiarTexto({ texto, etiqueta = "Copiar mensaje", id }: { texto: string; etiqueta?: string; id?: string }) {
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
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <pre className="ev-mensaje" id={id}>{texto}</pre>
      <div className="botones" style={{ margin: 0 }}>
        <button type="button" className="boton boton-amarillo" onClick={copiar} aria-live="polite">{copiado ? "Copiado" : etiqueta}</button>
      </div>
    </div>
  );
}
