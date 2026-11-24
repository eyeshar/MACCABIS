"use client";

// D198: si falla el propio layout (la cabecera, la sesión), Next no puede usar app/error.tsx: esto sustituye a toda la
// página, con su <html> y sin las hojas de estilos de la web (por eso los estilos van aquí mismo).
export default function FalloGlobal({ error, reset, retry }: { error: Error & { digest?: string }; reset: () => void; retry?: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, background: "#0e0d12", color: "#f2f0ea", fontFamily: "system-ui, sans-serif", padding: "max(24px, env(safe-area-inset-top)) 20px 24px" }}>
        <main role="alert" style={{ maxWidth: 520, margin: "0 auto" }}>
          <h1 style={{ fontSize: 26 }}>No se ha podido cargar Maccabis</h1>
          <p>Puede ser la conexión o un fallo nuestro. Vuelve a intentarlo y, si sigue igual, avisa a un gestor.</p>
          <p style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button" onClick={() => (retry ?? reset)()} style={{ minHeight: 48, padding: "0 20px", borderRadius: 10, border: 0, background: "#f3c519", color: "#0e0d12", fontWeight: 700, fontSize: 17, touchAction: "manipulation" }}>Reintentar</button>
            <a href="/" style={{ minHeight: 48, display: "inline-flex", alignItems: "center", padding: "0 20px", borderRadius: 10, border: "1px solid #555", color: "inherit", textDecoration: "none", touchAction: "manipulation" }}>Ir al inicio</a>
          </p>
          {error.digest && <p style={{ opacity: .6, fontSize: 13, fontFamily: "monospace" }}>Código del fallo: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
