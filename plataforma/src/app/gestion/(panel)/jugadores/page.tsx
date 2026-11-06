import { exigirGestor, origenMensajes } from "@/lib/sesion";
import Link from "next/link";
import Volver from "@/components/nav/Volver";
import { mensajeBienvenida } from "@/lib/mensajes";
import FilaJugador, { type JugadorGestion } from "./FilaJugador";
import ListaJugadores from "./ListaJugadores";
import "../gestion.css";
import "./jugadores.css";

export const metadata = { title: "Jugadores · Gestión Maccabis" };

type Privado = NonNullable<JugadorGestion["privado"]> & { person_id: string; reserva: boolean | null };

// Plantilla (bloque 4): lista compacta con buscador y fila desplegable con posición, niveles, fichas, dobla, disponibilidad,
// sanción, acceso y teléfono. Los datos privados (jugadores_privado) solo los devuelve la base a los gestores (RLS).
export default async function Jugadores() {
  const { supabase } = await exigirGestor();
  const [{ data: jugadores, error }, { data: privados }] = await Promise.all([
    supabase
      .from("jugadores")
      .select("id, person_id, nombre_oficial, nombre_visible, email, ficha_mda, ficha_mdl, entrena, rol, telefono, activo")
      .order("nombre_visible"),
    supabase.from("jugadores_privado").select("person_id, posicion, nivel, nota_ataque, nota_defensa, dobla, no_suele_entrenar, nunca_partidos, sancionado_hasta_jornada, reserva"),
  ]);
  if (error) throw new Error(error.message);
  const priv = new Map(((privados ?? []) as Privado[]).map((p) => [p.person_id, p]));
  const base = await origenMensajes();
  const urlEntrar = `${base}/entrar`;
  const lista: JugadorGestion[] = ((jugadores ?? []) as Omit<JugadorGestion, "reserva" | "privado">[]).map((j) => {
    const p = priv.get(j.person_id);
    return {
      ...j, reserva: !!p?.reserva,
      privado: p ? { posicion: p.posicion, nivel: p.nivel, nota_ataque: p.nota_ataque, nota_defensa: p.nota_defensa, dobla: !!p.dobla, no_suele_entrenar: !!p.no_suele_entrenar, nunca_partidos: !!p.nunca_partidos, sancionado_hasta_jornada: p.sancionado_hasta_jornada } : null,
    };
  });
  const mensajes = Object.fromEntries(lista.map((j) => [j.id, j.email ? mensajeBienvenida(j.nombre_visible, j.email, urlEntrar) : null]));
  const activos = lista.filter((j) => j.activo);
  const inactivos = lista.filter((j) => !j.activo);
  const sinCorreo = activos.filter((j) => !j.email).length;

  return (
    <div className="gp-panel">
      <Volver defecto="/gestion" etiqueta="Panel" />
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow">Plantilla y club</div>
          <h1>Jugadores</h1>
          <span className="suave">{activos.length} en la plantilla{sinCorreo ? ` · ${sinCorreo} sin correo` : ""}</span>
        </div>
        <div className="ev-botones">
          <Link className="boton boton-contorno" href="/gestion/telefonos">Importar teléfonos</Link>
        </div>
      </div>
      <section className="tarjeta">
        <h2>Plantilla 2026/27 ({activos.length})</h2>
        <ListaJugadores jugadores={activos} mensajes={mensajes} />
      </section>
      {inactivos.length > 0 && (
        <details className="tarjeta jg-plegado">
          <summary>Dados de baja ({inactivos.length})</summary>
          <ul className="lista-limpia">{inactivos.map((j) => <FilaJugador key={j.id} jugador={j} mensaje={mensajes[j.id] ?? null} />)}</ul>
        </details>
      )}
      <details className="pie jg-plegado">
        <summary>Acceso y teléfonos</summary>
        <p className="pequeno">Solo entra quien tiene aquí su correo: el exacto de Google o cualquiera al que pueda recibir un código. Con un correo que no es de Gmail («Entrará con código por correo»), pídele su Gmail si lo tiene. El teléfono solo lo ven los gestores.</p>
      </details>
    </div>
  );
}
