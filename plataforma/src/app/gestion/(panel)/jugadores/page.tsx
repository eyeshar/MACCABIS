import { exigirGestor, origen } from "@/lib/sesion";
import { mensajeBienvenida } from "@/lib/mensajes";
import FilaJugador, { type JugadorGestion } from "./FilaJugador";

export const metadata = { title: "Jugadores · Gestión Maccabis" };

export default async function Jugadores() {
  const { supabase } = await exigirGestor();
  const { data: jugadores, error } = await supabase
    .from("jugadores")
    .select("id, person_id, nombre_oficial, nombre_visible, email, ficha_mda, ficha_mdl, entrena, rol, telefono, activo")
    .order("nombre_visible");
  if (error) throw new Error(error.message);
  const base = await origen();
  const urlEntrar = `${base}/entrar`;
  const lista = (jugadores ?? []) as JugadorGestion[];
  const activos = lista.filter((j) => j.activo);
  const inactivos = lista.filter((j) => !j.activo);

  const fila = (j: JugadorGestion) => (
    <FilaJugador
      key={j.id}
      jugador={j}
      mensaje={j.email ? mensajeBienvenida(j.nombre_visible, j.email, urlEntrar) : null}
    />
  );

  return (
    <>
      <h1>Jugadores</h1>
      <div className="aviso aviso-info">
        Solo entra quien tiene aquí su correo (D68). Pon el correo exacto que usa en Google, o cualquiera al que
        pueda recibir un código. Sin correo, esa persona no puede entrar. Con un correo que no es de Gmail
        ("Entrará con código por correo"), pídele su Gmail si lo tiene: así podrá entrar también con Google.
      </div>
      <section className="tarjeta">
        <h2>Plantilla 2026/27 ({activos.length})</h2>
        <ul className="lista-limpia">{activos.map(fila)}</ul>
      </section>
      {inactivos.length > 0 && (
        <section className="tarjeta">
          <h2>Dados de baja ({inactivos.length})</h2>
          <ul className="lista-limpia">{inactivos.map(fila)}</ul>
        </section>
      )}
      <p className="pie">El teléfono es opcional y solo lo ven los gestores. Sirve para abrir WhatsApp con el mensaje ya escrito.</p>
    </>
  );
}
