import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Volver from "@/components/nav/Volver";
import { exigirGestor } from "@/lib/sesion";
import { cargarEvento } from "@/lib/eventos/datos";
import { diaCorto, tituloEvento } from "@/lib/eventos/dominio";
import { finDelEvento } from "@/lib/eventos/paseDeLista";
import { enMadrid } from "@/lib/avisos/horario";
import { fechaHora } from "@/lib/fechas";
import { filasAsistencia } from "@/lib/fantasy/asistencia";
import AsistenciaFormulario from "./AsistenciaFormulario";
import "../evento.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "¿Faltó alguien? · Maccabis", robots: { index: false, follow: false } };

// «¿Falto alguien ayer?» (D196, fase 4), solo gestores. A donde lleva el aviso del jueves a las 9:00: «Vinieron todos» o
// marcar a los ausentes de entre los que dijeron «voy», mas «vino sin avisar». Vale la primera respuesta; se puede corregir.
export default async function Asistencia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await exigirGestor();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ev = await cargarEvento(supabase, id);
  if (!ev || (ev.tipo !== "entreno" && ev.tipo !== "liga")) notFound();
  const fin = finDelEvento(ev);
  const cab = (
    <>
      <Volver defecto={`/evento/${ev.id}?tab=pase`} etiqueta="Evento" />
      <h1 className="ev2-h2" style={{ fontSize: "1.8rem" }}>¿Faltó alguien?</h1>
      <p className="suave" style={{ margin: 0 }}>{tituloEvento(ev)} · {diaCorto(ev.fecha)}</p>
    </>
  );
  if (Date.now() < fin.getTime()) {
    const f = enMadrid(fin);
    return <main className="pagina ev2" data-testid="asistencia-real">{cab}<p className="aviso aviso-info" data-testid="asistencia-cerrada">Se podrá responder cuando termine: {diaCorto(f.fecha)} a las {f.hora}.</p></main>;
  }
  const { filas, partido, respondida } = await filasAsistencia(supabase, ev);
  return (
    <main className="pagina ev2" data-testid="asistencia-real">
      {cab}
      {respondida && <p className="aviso aviso-ok" data-testid="asistencia-respondida">Ya está respondido{respondida.por ? ` por ${respondida.por}` : ""} ({fechaHora(respondida.en)}). Puedes corregirlo.</p>}
      <AsistenciaFormulario eventoId={ev.id} partido={partido} respondida={!!respondida}
        van={filas.filter((f) => f.dijoVoy).map((f) => ({ id: f.person_id, nombre: f.nombre, marcado: f.guardado != null && f.guardado !== "fue" }))}
        resto={partido ? [] : filas.filter((f) => !f.dijoVoy).map((f) => ({ id: f.person_id, nombre: f.nombre, marcado: f.guardado === "fue" }))} />
      <p className="pequeno suave">Es el mismo pase de lista del evento: cuenta en «Asistencia y motivos». Si nadie responde antes del cierre del domingo, cuenta que vinieron todos los que dijeron «voy».</p>
    </main>
  );
}
