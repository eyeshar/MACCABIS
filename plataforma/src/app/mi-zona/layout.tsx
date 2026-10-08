import type { Metadata } from "next";
import { BarraMiZona } from "@/components/nav/BarrasZona";
import { respuestasWebEncendido } from "@/lib/respuestas/jugador";
import "@/components/respuestas/respuestas.css";

// Exige login: fuera de los buscadores (D85).
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Toda la zona del jugador (Mi zona, evento, domingo, ausencias, pedido de ropa) lleva su barra propia debajo de la
// cabecera unica (D89). «Ausencias» solo con «respuestas en la web» encendido (D99).
export default async function LayoutMiZona({ children }: { children: React.ReactNode }) {
  const encendido = await respuestasWebEncendido().catch(() => false);
  return (
    <>
      <BarraMiZona conAusencias={encendido} />
      {children}
    </>
  );
}
