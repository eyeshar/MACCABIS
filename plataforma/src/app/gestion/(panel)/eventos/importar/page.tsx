import Link from "next/link";
import { exigirGestor } from "@/lib/sesion";
import { cargarEventos, cargarJugadores } from "@/lib/eventos/datos";
import { hhmm } from "@/lib/eventos/dominio";
import { madrid } from "@/lib/avisos/horario";
import { estadoImportacion } from "@/lib/eventos/importacionAuto";
import BloqueImportacion from "@/components/gestion/BloqueImportacion";
import { fechaHora } from "@/lib/fechas";
import ImportarCalendario from "./ImportarCalendario";
import ImportarRespuestas from "./ImportarRespuestas";

export const metadata = { title: "Importar · Gestión Maccabis" };

export default async function Importar({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const pestana = t === "respuestas" ? "respuestas" : "calendario";
  const { supabase } = await exigirGestor();
  const [jugadores, { data: registro }, { data: encendido }, eventos] = await Promise.all([
    cargarJugadores(supabase),
    supabase.from("importaciones").select("id, tipo, por_nombre, en, lineas, validas, aceptadas, ignoradas, bloqueadas, detalle").order("en", { ascending: false }).limit(10),
    supabase.rpc("respuestas_web_encendido"),
    cargarEventos(supabase),
  ]);
  // D126: ultima importacion de respuestas, proxima automatica y si pueden estar desactualizadas.
  const ultimaResp = (registro ?? []).find((r) => r.tipo === "respuestas") ?? null;
  const ahora = new Date();
  const proximo = eventos.filter((e) => e.tipo === "liga" && e.estado === "programado").map((e) => madrid(e.fecha, hhmm(e.inicio) ?? "10:00")).filter((t) => t > ahora).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const estadoImp = estadoImportacion(ultimaResp?.en ?? null, ultimaResp?.por_nombre ?? null, proximo, ahora);
  const personas = jugadores.map((j) => ({ person_id: j.person_id, nombre: j.nombre_visible }));
  return (
    <>
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow"><Link href="/gestion/eventos">← Eventos</Link> · Importar</div>
          <h1>Importar</h1>
        </div>
      </div>
      <nav className="ev-pestanas" aria-label="Qué importar">
        <Link href="/gestion/eventos/importar" aria-current={pestana === "calendario" ? "true" : undefined}>Calendario</Link>
        <Link href="/gestion/eventos/importar?t=respuestas" aria-current={pestana === "respuestas" ? "true" : undefined}>Respuestas</Link>
      </nav>
      {pestana === "calendario" ? <ImportarCalendario encendido={Boolean(encendido)} /> : <><BloqueImportacion estado={estadoImp} enlaceImportar={false} /><div style={{ height: 16 }} /><ImportarRespuestas personas={personas} /></>}

      <section className="gs-bloque" style={{ marginTop: 20 }} aria-labelledby="t-registro" data-testid="registro-importaciones">
        <h2 id="t-registro" style={{ fontSize: 22 }}>Importaciones registradas</h2>
        {(registro ?? []).length === 0 ? <p className="suave" style={{ margin: 0 }}>Todavía no se ha importado nada.</p> : (
          <div className="tabla-desplazable">
            <table className="gs-tabla ev-tabla">
              <thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th><th>Líneas</th><th>Aceptadas</th></tr></thead>
              <tbody>
                {(registro ?? []).map((r) => (
                  <tr key={r.id}>
                    <td data-label="Cuándo">{fechaHora(r.en)}</td>
                    <td data-label="Quién">{r.por_nombre}</td>
                    <td data-label="Qué">{r.tipo === "calendario" ? "Calendario" : "Respuestas"}</td>
                    <td data-label="Líneas" className="cifra">{r.lineas} ({r.validas} válidas{r.bloqueadas ? `, ${r.bloqueadas} bloqueadas` : ""})</td>
                    <td data-label="Aceptadas" className="cifra">{r.aceptadas}{r.ignoradas ? ` · ${r.ignoradas} ignoradas` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
