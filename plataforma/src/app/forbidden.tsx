import Link from "next/link";

// 403 (forbidden()): de momento solo lo usa /asistente para quien aun no lo tiene abierto (D142).
export default function Prohibido() {
  return (
    <main className="pagina">
      <h1>No disponible</h1>
      <p>Esta página no está abierta para tu cuenta.</p>
      <p className="pie"><Link href="/">Volver al inicio</Link></p>
    </main>
  );
}
