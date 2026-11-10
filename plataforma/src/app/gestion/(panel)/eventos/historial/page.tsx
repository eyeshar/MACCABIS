import Link from "next/link";
import Volver from "@/components/nav/Volver";
import { exigirGestor } from "@/lib/sesion";
import { diaYNumero } from "@/lib/dias";
import { fechaHora } from "@/lib/fechas";
import { cargarEventos } from "@/lib/eventos/datos";
import { tituloEvento } from "@/lib/eventos/dominio";
import { historialCalendario, type ImportacionHist } from "@/lib/eventos/historialCalendario";

export const metadata = { title: "Cambios del calendario · Gestión Maccabis" };

// «Últimos cambios del calendario» (D189, bloque 4 de Gestión): el historial, con fecha, de las importaciones del
// calendario y de los cambios avisados a los jugadores. Solo gestores (el layout del panel).
export default async function HistorialCalendario() {
  const { supabase } = await exigirGestor();
  const [eventos, { data: imps }] = await Promise.all([
    cargarEventos(supabase),
    supabase.from("importaciones").select("id, en, por_nombre, lineas, aceptadas, bloqueadas, detalle").eq("tipo", "calendario").order("en", { ascending: false }).limit(40),
  ]);
  const lista = historialCalendario((imps ?? []) as ImportacionHist[], eventos.map((e) => ({ id: e.id, clave: e.clave, fecha: e.fecha, titulo: tituloEvento(e), cambio_visible_en: e.cambio_visible_en ?? null, cambio_visible: e.cambio_visible ?? null })));
  return (
    <>
      <Volver defecto="/gestion" etiqueta="Gestión" />
      <div className="gs-titulo"><div><div className="gs-eyebrow">Solo gestores · calendario</div><h1>Cambios del calendario</h1></div></div>
      <p className="pequeno suave" style={{ marginTop: 0 }}>Las importaciones del calendario (la rutina B de los jueves o a mano) y los cambios que se avisaron a los jugadores, de lo más reciente a lo más antiguo.</p>
      <section className="gs-bloque" aria-label="Historial del calendario" data-testid="historial-calendario">
        {!lista.length ? <p className="suave" style={{ margin: 0 }}>Todavía no hay importaciones ni cambios avisados.</p> : (
          <ol className="lista-limpia hc-lista">
            {lista.map((x) => (
              <li key={`${x.tipo}-${x.id}`} data-tipo={x.tipo} className="hc-fila">
                <span className="pequeno suave hc-fecha">{fechaHora(x.en)}</span>
                <span>
                  <b>{x.titulo}</b>
                  {x.tipo === "importacion" && x.por && <span className="suave"> · {x.por}</span>}
                  {x.tipo === "importacion" && x.errores > 0 && <span className="ev-no"> · {x.errores} con error</span>}
                  {x.tipo === "aviso" && <> · <Link href={x.href}>{diaYNumero(x.fecha)} ›</Link></>}
                  {x.cambios.length > 0 && <ul className="pequeno hc-cambios">{x.cambios.map((c) => <li key={c}>{c}</li>)}</ul>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
