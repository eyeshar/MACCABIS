import type { Metadata } from "next";

// Exige login: fuera de los buscadores (D85).
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Toda la zona del jugador (Mi zona, pedido de ropa) va en el tema oscuro del redisenio (D76).
export default function LayoutMiZona({ children }: { children: React.ReactNode }) {
  return <div className="tema-oscuro">{children}</div>;
}
