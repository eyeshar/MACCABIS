import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirSesion } from "@/lib/sesion";
import FormAusencia from "@/components/respuestas/FormAusencia";
import { cargarMisEventos, respuestasWebEncendido } from "@/lib/respuestas/jugador";
import { hoyMadrid } from "@/lib/dias";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nueva ausencia · Maccabis", robots: { index: false, follow: false } };

export default async function NuevaAusencia() {
  await exigirSesion();
  if (!(await respuestasWebEncendido())) redirect("/mi-zona");
  const hoy = hoyMadrid();
  const dias = [...new Set((await cargarMisEventos(hoy)).filter((e) => e.estado === "programado").map((e) => e.fecha))];
  return (
    <main className="pagina rw-ausencias">
      <p className="rw-volver"><Link href="/mi-zona/ausencias">← Mis ausencias</Link></p>
      <h1>Nueva ausencia</h1>
      <FormAusencia hoy={hoy} diasConEvento={dias} />
    </main>
  );
}
