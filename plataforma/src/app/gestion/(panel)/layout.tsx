import { exigirGestor } from "@/lib/sesion";
import { BarraGestion } from "@/components/nav/BarrasZona";

export const dynamic = "force-dynamic";
// Exige login: fuera de los buscadores (D85).
export const metadata = { robots: { index: false, follow: false } };

// Marco de gestion (D90): la cabecera es la de toda la web (layout raiz, D89); aqui solo la barra propia de Gestion,
// fija debajo de ella, y el contenido en el mismo ancho y tema que la portada.
export default async function PanelGestion({ children }: { children: React.ReactNode }) {
  await exigirGestor();
  return (
    <>
      <BarraGestion />
      <main className="gs-main">{children}</main>
    </>
  );
}
