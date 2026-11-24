"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// D198: un fallo al cargar una pantalla nunca se queda en silencio: lo dice claro y deja reintentar (recarga la página
// del servidor, `retry`) o volver al inicio. No enseña el detalle técnico (puede llevar datos); el `digest` sirve para
// buscarlo en los registros de Vercel.
export default function FalloPantalla({ error, retry, reset, que = "esta pantalla" }: {
  error: Error & { digest?: string }; retry?: () => void; reset: () => void; que?: string;
}) {
  const [reintentando, setReintentando] = useState(false);
  useEffect(() => { console.error(error); }, [error]);
  const reintentar = () => { setReintentando(true); (retry ?? reset)(); setTimeout(() => setReintentando(false), 4000); };
  return (
    <main className="pagina fallo" data-testid="fallo-pantalla">
      <section className="tarjeta" role="alert" aria-labelledby="fallo-t">
        <h1 id="fallo-t">No se ha podido cargar {que}</h1>
        <p>Puede ser la conexión o un fallo nuestro. <strong>Tu respuesta no se ha cambiado</strong>: vuelve a intentarlo y, si sigue igual, avisa a un gestor.</p>
        <div className="botones">
          <button type="button" className="boton boton-amarillo" onClick={reintentar} disabled={reintentando} data-testid="fallo-reintentar">
            {reintentando ? "Reintentando…" : "Reintentar"}
          </button>
          <Link href="/" className="boton boton-claro">Ir al inicio</Link>
        </div>
        {error.digest && <p className="tenue pequeno mono" style={{ marginBottom: 0 }}>Código del fallo: {error.digest}</p>}
      </section>
    </main>
  );
}
