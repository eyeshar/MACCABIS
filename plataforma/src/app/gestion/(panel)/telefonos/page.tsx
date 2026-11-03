import Volver from "@/components/nav/Volver";
import { exigirGestor } from "@/lib/sesion";
import { enmascarar } from "@/lib/whatsapp/importar";
import ImportarTelefonos from "./ImportarTelefonos";

export const metadata = { title: "Importar teléfonos · Gestión Maccabis" };

/** Importar teléfonos (D178, solo gestores): contacto de WhatsApp y teléfono de cada jugador, desde un CSV. Los teléfonos
 *  nunca van al repositorio: se cargan aquí. Abajo, lo que hay ahora (teléfono enmascarado). */
export default async function Telefonos() {
  const { supabase } = await exigirGestor();
  const { data } = await supabase.from("jugadores").select("person_id, nombre_visible, whatsapp_contacto, telefono").eq("activo", true).order("nombre_visible");
  const jugadores = (data ?? []) as { person_id: string; nombre_visible: string; whatsapp_contacto: string | null; telefono: string | null }[];
  const conTel = jugadores.filter((j) => j.telefono?.trim()).length;
  return (
    <>
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow"><Volver enLinea defecto="/gestion/jugadores" etiqueta="Jugadores" /> · Importar teléfonos</div>
          <h1>Importar teléfonos</h1>
          <span className="suave">Para el botón «WhatsApp» de quien no ha respondido y la ayuda de las menciones (solo gestores).</span>
        </div>
      </div>
      <ImportarTelefonos />
      <section className="gs-bloque" style={{ marginTop: 20 }} aria-labelledby="t-ahora" data-testid="telefonos-ahora">
        <h2 id="t-ahora" style={{ fontSize: 22 }}>Ahora · {conTel} de {jugadores.length} con teléfono</h2>
        <div className="tabla-desplazable">
          <table className="gs-tabla ev-tabla">
            <thead><tr><th>Jugador</th><th>Contacto de WhatsApp</th><th>Teléfono</th></tr></thead>
            <tbody>
              {jugadores.map((j) => (
                <tr key={j.person_id}>
                  <td data-label="Jugador"><b>{j.nombre_visible}</b></td>
                  <td data-label="Contacto">{j.whatsapp_contacto ?? <span className="suave">—</span>}</td>
                  <td data-label="Teléfono" className="mono">{j.telefono?.trim() ? (enmascarar(j.telefono) === "—" ? "guardado sin prefijo de país" : enmascarar(j.telefono)) :<span className="suave">Falta teléfono</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
