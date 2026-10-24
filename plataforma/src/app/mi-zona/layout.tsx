import type { Metadata } from "next";
import "@/components/respuestas/respuestas.css";
import "@/components/inicio/inicio.css";

// Exige login: fuera de los buscadores (D85). /mi-zona lleva al inicio personal («/», D116); sus paginas (evento,
// domingo, ausencias, pedido de ropa) siguen igual, con la navegacion de toda la web (Inicio · Agenda · Mis números).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function LayoutMiZona({ children }: { children: React.ReactNode }) {
  return children;
}
