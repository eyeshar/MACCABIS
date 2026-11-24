import { notFound } from "next/navigation";
import { exigirSesion } from "@/lib/sesion";
import { cargarMisEventosDelDia } from "@/lib/respuestas/jugador";

// D198: la sesión, la fecha y que ese día haya partidos se comprueban AQUÍ, por encima de loading.tsx. Lo que va por
// debajo del esqueleto se envía en trozos y, una vez empezada la respuesta, un redirect o un notFound ya no pueden ser un
// 307 o un 404 (serían un 200 con la redirección en el navegador). La página vuelve a pedir lo mismo, pero son las mismas
// llamadas (cache de React: sesión, D175, y eventos del día).
export default async function DomingoLayout({ children, params }: { children: React.ReactNode; params: Promise<{ fecha: string }> }) {
  await exigirSesion();
  const { fecha } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) notFound();
  if (!(await cargarMisEventosDelDia(fecha)).some((e) => e.tipo === "liga")) notFound();
  return children;
}
