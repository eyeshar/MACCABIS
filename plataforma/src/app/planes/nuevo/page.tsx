import type { Metadata } from "next";
import Volver from "@/components/nav/Volver";
import Link from "next/link";
import { exigirSesion } from "@/lib/sesion";
import { cargarMiZona } from "@/app/mi-zona/datos";
import { hoyMadrid } from "@/lib/dias";
import FormularioPlan from "../FormularioPlan";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Proponer un plan · Maccabis" };

export default async function NuevoPlan() {
  await exigirSesion();
  const zona = await cargarMiZona().catch(() => null);
  return (
    <main className="pagina pl-pagina">
      <Volver defecto="/agenda" etiqueta="Agenda" />
      <span className="pl-etq-plan">Plan no oficial</span>
      <h1>Proponer un plan</h1>
      {zona ? <FormularioPlan hoy={hoyMadrid()} volver="/agenda" />
        : <p className="aviso aviso-info">Los planes los proponen los jugadores de la plantilla: tu cuenta no tiene ficha de jugador.</p>}
    </main>
  );
}
