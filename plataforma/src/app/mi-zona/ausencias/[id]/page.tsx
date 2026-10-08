import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { exigirSesion } from "@/lib/sesion";
import FormAusencia from "@/components/respuestas/FormAusencia";
import { cargarMisAusencias, cargarMisEventos, respuestasWebEncendido } from "@/lib/respuestas/jugador";
import { hoyMadrid } from "@/lib/dias";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Editar ausencia · Maccabis", robots: { index: false, follow: false } };

export default async function EditarAusencia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await exigirSesion();
  if (!(await respuestasWebEncendido())) redirect("/mi-zona");
  const a = (await cargarMisAusencias()).find((x) => x.id === id);
  if (!a) notFound();
  const hoy = hoyMadrid();
  const dias = [...new Set((await cargarMisEventos(hoy)).filter((e) => e.estado === "programado").map((e) => e.fecha))];
  return (
    <main className="pagina rw-ausencias">
      <p className="rw-volver"><Link href="/mi-zona/ausencias">← Mis ausencias</Link></p>
      <h1>Editar ausencia</h1>
      <FormAusencia hoy={hoy} diasConEvento={dias} inicial={{ id: a.id, desde: a.desde, hasta: a.hasta, motivo: a.motivo, detalle: a.detalle }} />
    </main>
  );
}
