import Volver from "@/components/nav/Volver";
import { exigirGestor } from "@/lib/sesion";
import { fechaHora } from "@/lib/fechas";
import ImportarCalendario from "./ImportarCalendario";

export const metadata = { title: "Importar · Gestión Maccabis" };

/** Importar: solo el calendario del Ayuntamiento (las respuestas ya no se importan; un enlace viejo con
 *  `?t=respuestas` cae aqui igual). */
export default async function Importar() {
  const { supabase } = await exigirGestor();
  const [{ data: registro }, { data: encendido }] = await Promise.all([
    supabase.from("importaciones").select("id, tipo, por_nombre, en, lineas, validas, aceptadas, ignoradas, bloqueadas").order("en", { ascending: false }).limit(10),
    supabase.rpc("respuestas_web_encendido"),
  ]);
  return (
    <>
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow"><Volver enLinea defecto="/gestion/eventos" etiqueta="Eventos" /> · Importar</div>
          <h1>Importar</h1>
        </div>
      </div>
      <ImportarCalendario encendido={Boolean(encendido)} />

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
