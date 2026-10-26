import type { Metadata } from "next";
import Volver from "@/components/nav/Volver";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirSesion } from "@/lib/sesion";
import { hoyMadrid } from "@/lib/dias";
import { cargarPlan } from "@/lib/planes/datos";
import { hhmm } from "@/lib/respuestas/dominio";
import FormularioPlan, { type PlanInicial } from "../../FormularioPlan";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Editar plan · Maccabis" };

// Editar un plan: su organizador o un gestor (la base lo vuelve a comprobar en editar_plan).
export default async function EditarPlan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await exigirSesion();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const v = await cargarPlan(id);
  if (!v || v.borrado || v.evento.oficial !== false || (!v.evento.es_mio && !v.esGestor)) notFound();
  const e = v.evento;
  const plan: PlanInicial = {
    id: e.id, tipo: e.tipo as PlanInicial["tipo"], titulo: e.titulo ?? "", fecha: e.fecha, inicio: hhmm(e.inicio), quedada: hhmm(e.quedada),
    equipo: e.equipo, plazas: e.plazas ?? null, notas: e.notas, recordar: Boolean(e.recordar_un_dia_antes), rival_texto: e.rival_texto ?? null,
    lugar: e.lugar_nombre || e.lugar_enlace ? { nombre: e.lugar_nombre ?? "Ubicación de Google Maps", direccion: e.lugar_direccion ?? null, lat: e.lugar_lat ?? null, lng: e.lugar_lng ?? null, enlace: e.lugar_enlace ?? null } : null,
  };
  return (
    <main className="pagina pl-pagina">
      <Volver defecto={`/planes/${id}`} etiqueta="El plan" />
      <span className="pl-etq-plan">Plan no oficial</span>
      <h1>Editar el plan</h1>
      {!e.es_mio && <p className="aviso aviso-info">Lo organiza {e.organizador ?? "otro jugador"}: al guardar le llega un aviso.</p>}
      <FormularioPlan plan={plan} hoy={hoyMadrid()} volver={`/planes/${id}`} />
    </main>
  );
}
