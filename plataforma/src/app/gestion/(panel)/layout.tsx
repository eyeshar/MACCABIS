import { exigirGestor } from "@/lib/sesion";
import { problemaTarea, type Pasada } from "@/lib/avisos/alarma";
import { BarraGestion } from "@/components/nav/BarrasZona";

export const dynamic = "force-dynamic";
// Exige login: fuera de los buscadores (D85).
export const metadata = { robots: { index: false, follow: false } };

// Marco de gestion (D90): la cabecera es la de toda la web (layout raiz, D89); aqui solo la barra propia de Gestion,
// fija debajo de ella, y el contenido en el mismo ancho y tema que la portada.
export default async function PanelGestion({ children }: { children: React.ReactNode }) {
  const { supabase } = await exigirGestor();
  const { data } = await supabase.rpc("estado_tarea_avisos");
  const problema = problemaTarea(((data ?? []) as { codigo: number | null; creado: string }[]).map((x): Pasada => ({ codigo: x.codigo, creado: x.creado })));
  return (
    <>
      <BarraGestion />
      {problema && (
        <div role="alert" data-testid="alarma-tarea" style={{ background: "#b3261e", color: "#fff", padding: "10px 16px", fontWeight: 600 }}>
          La tarea de avisos está fallando. {problema}
        </div>
      )}
      <main className="gs-main">{children}</main>
    </>
  );
}
