import type { Metadata } from "next";
import "@/components/inicio/inicio.css";
import "@/components/respuestas/respuestas.css";

// Planes no oficiales (D118): exigen login, fuera de los buscadores (D85).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function LayoutPlanes({ children }: { children: React.ReactNode }) {
  return children;
}
