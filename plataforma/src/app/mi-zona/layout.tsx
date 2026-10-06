import type { Metadata } from "next";
import { BarraMiZona } from "@/components/nav/BarrasZona";

// Exige login: fuera de los buscadores (D85).
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Toda la zona del jugador (Mi zona, pedido de ropa) lleva su barra propia debajo de la cabecera unica (D89).
export default function LayoutMiZona({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BarraMiZona />
      {children}
    </>
  );
}
