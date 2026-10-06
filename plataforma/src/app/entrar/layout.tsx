import type { Metadata } from "next";

// Acceso y eleccion de zona: fuera de los buscadores (D85).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function LayoutEntrar({ children }: { children: React.ReactNode }) {
  return children;
}
