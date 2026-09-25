import { exigirGestor, origen } from "@/lib/gestor";
import { mensajeBienvenida } from "@/lib/mensajes";
import FilaJugador, { type JugadorGestion } from "./FilaJugador";

export const metadata = { title: "Jugadores y enlaces · Gestión Maccabis" };

export default async function JugadoresYEnlaces() {
  const { supabase } = await exigirGestor();
  const [{ data: jugadores, error }, { data: enlaces }] = await Promise.all([
    supabase.from("jugadores").select("id, person_id, nombre_oficial, nombre_visible, ficha_mda, ficha_mdl, entrena, rol, telefono, activo").order("nombre_visible"),
    supabase.from("enlaces").select("jugador_id, token, creado_en, ultimo_uso").is("anulado_en", null),
  ]);
  if (error) throw new Error(error.message);
  const base = await origen();
  const porJugador = new Map((enlaces ?? []).map((e) => [e.jugador_id as string, e]));
  const lista = (jugadores ?? []) as Omit<JugadorGestion, "enlace" | "mensaje" | "ultimoUso" | "creadoEn">[];
  const activos = lista.filter((j) => j.activo);
  const inactivos = lista.filter((j) => !j.activo);

  const fila = (j: (typeof lista)[number]) => {
    const e = porJugador.get(j.id);
    const enlace = e ? `${base}/j/${e.token}` : null;
    return (
      <FilaJugador key={j.id} jugador={{
        ...j,
        enlace,
        mensaje: enlace ? mensajeBienvenida(j.nombre_visible, enlace) : null,
        ultimoUso: (e?.ultimo_uso as string | null) ?? null,
        creadoEn: (e?.creado_en as string | null) ?? null,
      }} />
    );
  };

  return (
    <>
      <h1>Jugadores y enlaces</h1>
      <div className="aviso aviso-info">
        Cada enlace es la llave de un jugador: quien lo tenga entra como él. Mándalo <strong>solo por privado</strong>.
        Si alguien lo pierde o lo reenvía, pulsa <strong>Regenerar</strong>: el viejo deja de funcionar al momento.
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
