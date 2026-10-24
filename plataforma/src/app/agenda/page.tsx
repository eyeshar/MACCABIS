import type { Metadata } from "next";
import Link from "next/link";
import { exigirSesion, origen } from "@/lib/sesion";
import { cargarMiZona } from "@/app/mi-zona/datos";
import SinZona from "@/app/mi-zona/SinZona";
import { Calendario } from "@/components/Iconos";
import CalendarioMovil from "@/components/inicio/CalendarioMovil";
import { FilaAgenda } from "@/components/inicio/piezas";
import { madrid } from "@/lib/avisos/horario";
import { miEnlace } from "@/lib/calendario/enlace";
import { hoyMadrid } from "@/lib/dias";
import {
  cargarMiConvocatoria, cargarMisAusencias, cargarMisEventos, cargarMisGrupos, cargarMisRespuestas, respuestasWebEncendido,
} from "@/lib/respuestas/jugador";
import { hhmm, unidades, type Unidad } from "@/lib/respuestas/dominio";
import "@/components/inicio/inicio.css";
import "@/components/respuestas/respuestas.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agenda · Maccabis", robots: { index: false, follow: false } };

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Agenda (D116): toda su agenda, oficiales y planes no oficiales (D117), por meses; «Proponer un plan», «Marcar días que
// no estoy» (con respuestas en la web) y «Tu calendario en el móvil» (D119).
export default async function Agenda() {
  const { supabase } = await exigirSesion();
  const zona = await cargarMiZona();
  if (!zona) return <SinZona />;
  const hoy = hoyMadrid();
  const ahora = new Date();
  const [encendido, eventos, respuestas, ausencias, convocatorias, grupos, base] = await Promise.all([
    respuestasWebEncendido(), cargarMisEventos(hoy).catch(() => []), cargarMisRespuestas().catch(() => []), cargarMisAusencias().catch(() => []),
    cargarMiConvocatoria().catch(() => []), cargarMisGrupos(), origen(),
  ]);
  const enlace = await miEnlace(supabase, zona.jugador.person_id, base).catch(() => null);
  const abierta = (u: Unidad) => u.eventos.some((e) => e.estado === "programado" && madrid(e.fecha, hhmm(e.inicio) ?? "00:00") > ahora);
  const lista = unidades(eventos).filter((u) => abierta(u) || u.eventos.every((e) => e.estado === "cancelado"));
  const porMes = new Map<string, Unidad[]>();
  for (const u of lista) porMes.set(u.fecha.slice(0, 7), [...(porMes.get(u.fecha.slice(0, 7)) ?? []), u]);
  const grupoDe = (u: Unidad) => (u.eventos[0].tipo === "entreno" ? grupos.find((g) => g.evento_id === u.eventos[0].id) ?? null : null);

  return (
    <main className="in in-pagina-agenda" id="agenda">
      <div className="in-sec-cab"><h1>Agenda</h1></div>
      <div className="botones" style={{ marginTop: 0 }}>
        <Link href="/planes/nuevo" className="boton boton-amarillo">Proponer un plan</Link>
        {encendido && <Link href="/mi-zona/ausencias" className="boton boton-claro"><Calendario size={20} />Marcar días que no estoy</Link>}
      </div>
      {!encendido && <p className="in-nota">Por ahora, los partidos y entrenos se responden en SportEasy. Los planes no oficiales, aquí.</p>}
      <div className="in-cols in-cols-agenda">
        <div className="in-col">
          {[...porMes.entries()].map(([mes, us]) => (
            <section key={mes} className="in-sec" aria-label={`${MESES[+mes.slice(5) - 1]} ${mes.slice(0, 4)}`}>
              <h2>{MESES[+mes.slice(5) - 1]}</h2>
              <div className="in-lista">
                {us.map((u) => <FilaAgenda key={u.clave} u={u} respuestas={respuestas} ausencias={ausencias} convocatorias={convocatorias} grupo={grupoDe(u)} encendido={encendido} />)}
              </div>
            </section>
          ))}
          {!lista.length && <p className="suave">No tienes nada en la agenda.</p>}
        </div>
        <div className="in-col">
          <CalendarioMovil enlace={enlace} />
        </div>
      </div>
    </main>
  );
}
