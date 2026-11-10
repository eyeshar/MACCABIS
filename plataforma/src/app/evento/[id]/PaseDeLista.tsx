import { exigirGestor } from "@/lib/sesion";
import { cargarJugadores } from "@/lib/eventos/datos";
import { convocadosDe, diaCorto, TEXTO_MOTIVO, type EventoFila, type Motivo, type Respuesta } from "@/lib/eventos/dominio";
import { cargarDefecto } from "@/lib/convocatoria/defecto";
import { convocadosAprobados } from "@/lib/convocatoria/resumen";
import { efectivaEn, NOTA_POR_DEFECTO } from "@/lib/disponibilidad/porDefecto";
import { enMadrid } from "@/lib/avisos/horario";
import { fechaHora } from "@/lib/fechas";
import { estadoGuardado, estadoPorDefecto, finDelEvento } from "@/lib/eventos/paseDeLista";
import PaseDeListaFormulario, { type FilaPase } from "./PaseDeListaFormulario";

const TEXTO_R: Record<Respuesta, string> = { va: "va", duda: "duda", no: "no va", sin_responder: "sin responder" };

/** Pestaña «Pase de lista» del evento, solo gestores (D50, D189, D192): se abre al terminar el entreno o el partido. Cada
 *  invitado con lo que respondió y su estado, que por defecto copia la respuesta; se guarda en asistencia_eventos
 *  (origen «plataforma») y «Asistencia y motivos» lo usa en lugar de la respuesta, sin contarlo dos veces. */
export default async function PaseDeLista({ ev }: { ev: EventoFila }) {
  const { supabase } = await exigirGestor();
  const partido = ev.tipo === "liga";
  const fin = finDelEvento(ev);
  const titulo = <h2 id="t-pase" className="ev2-h2">Pase de lista</h2>;
  if (Date.now() < fin.getTime()) {
    const f = enMadrid(fin);
    return (
      <section className="gs-bloque" aria-labelledby="t-pase" data-testid="pestana-pase">
        {titulo}
        <p className="suave" style={{ margin: 0 }} data-testid="pase-cerrado">Se abre al terminar el {partido ? "partido" : "entreno"}: {diaCorto(f.fecha)} a las {f.hora}.</p>
      </section>
    );
  }
  const ambito = partido ? "partidos" : "entrenos";
  const [jugadores, defecto, { data: resp }, { data: guardadasDB }, { data: deSportEasy }, convocados] = await Promise.all([
    cargarJugadores(supabase), cargarDefecto(supabase, [ev.id]),
    supabase.from("respuestas").select("person_id, respuesta, motivo").eq("evento_id", ev.id),
    supabase.from("asistencia_eventos").select("person_id, estado, motivo, cargado_en, pasado_por_nombre").eq("evento_ref", ev.id).eq("origen", "plataforma"),
    supabase.from("asistencia_eventos").select("person_id").eq("origen", "sporteasy").eq("fecha", ev.fecha).eq("ambito", ambito).limit(1),
    partido ? convocadosAprobados(supabase, ev.fecha, ev.equipo) : Promise.resolve(null),
  ]);
  if ((deSportEasy ?? []).length) {
    return (
      <section className="gs-bloque" aria-labelledby="t-pase" data-testid="pestana-pase">
        {titulo}
        <p className="suave" style={{ margin: 0 }} data-testid="pase-sporteasy">Este día ya está en la asistencia de SportEasy (hasta el 23/10/2026): no se pasa lista otra vez.</p>
      </section>
    );
  }
  const respDe = new Map(((resp ?? []) as { person_id: string; respuesta: Respuesta; motivo: Motivo | null }[]).map((r) => [r.person_id, r]));
  const guardadas = (guardadasDB ?? []) as { person_id: string; estado: string; motivo: string | null; cargado_en: string; pasado_por_nombre: string | null }[];
  const guardadaDe = new Map(guardadas.map((g) => [g.person_id, g]));

  const filas: FilaPase[] = convocadosDe(ev, jugadores)
    .map((j) => {
      const r = respDe.get(j.person_id);
      const ef = efectivaEn(ev, j.person_id, r?.respuesta ?? "sin_responder", defecto);
      return { j, r, ef };
    })
    .filter((x) => !x.ef.fuera)
    .map(({ j, r, ef }) => {
      const motivoResp = ef.por === "defecto" ? NOTA_POR_DEFECTO : r?.motivo ? TEXTO_MOTIVO[r.motivo] : ef.por === "ausencia" && ef.ausencia ? TEXTO_MOTIVO[ef.ausencia.motivo as Motivo] : null;
      const g = guardadaDe.get(j.person_id);
      const lesion = r?.motivo === "lesion" || (ef.por === "ausencia" && ef.ausencia?.motivo === "lesion");
      return {
        person_id: j.person_id, nombre: j.nombre_visible, respuesta: TEXTO_R[ef.respuesta],
        estado: g ? estadoGuardado(g) : estadoPorDefecto({ respuesta: ef.respuesta, lesion, convocado: convocados ? convocados.has(j.person_id) : null }),
        motivo: g ? (g.motivo === "retraso" ? null : g.motivo) : motivoResp, guardada: !!g,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const ultima = guardadas.sort((a, b) => (a.cargado_en < b.cargado_en ? 1 : -1))[0];
  return (
    <section className="gs-bloque" aria-labelledby="t-pase" data-testid="pestana-pase">
      {titulo}
      <p className="pequeno suave" style={{ margin: 0 }} data-testid="pase-estado">
        {ultima ? `Guardado${ultima.pasado_por_nombre ? ` por ${ultima.pasado_por_nombre}` : ""} el ${fechaHora(ultima.cargado_en)}. Puedes cambiarlo y guardar otra vez.`
          : "Sin guardar todavía: cada uno sale con lo que respondió. Ajusta lo que no cuadre y guarda."}
        {partido && !convocados && " Sin convocatoria aprobada: nadie sale como «no convocado» por defecto."}
      </p>
      <PaseDeListaFormulario eventoId={ev.id} partido={partido} filas={filas} />
      <p className="pequeno suave" style={{ margin: 0 }}>Cuenta en «Asistencia y motivos» en lugar de la respuesta (no suma dos veces). «No convocado» y «Lesionado» no cuentan para el porcentaje.</p>
    </section>
  );
}
