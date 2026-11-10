"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { enlaceWhatsApp } from "@/lib/mensajes";
import { guardarJugador } from "../acciones";

export type JugadorGestion = {
  id: string;
  person_id: string;
  nombre_oficial: string;
  nombre_visible: string;
  email: string | null;
  ficha_mda: boolean;
  ficha_mdl: boolean;
  entrena: boolean;
  rol: "jugador" | "solo_entreno" | "entrenador";
  telefono: string | null;
  /** D178: cómo está guardado en el móvil de Iván (para la mención @ de WhatsApp). Solo gestores. */
  whatsapp_contacto: string | null;
  activo: boolean;
  /** D158: reserva (de jugadores_privado; solo gestores). */
  reserva: boolean;
  /** Datos privados (jugadores_privado; solo gestores, RLS): se ven en la fila desplegada; se editan en «Datos de los jugadores». */
  privado?: {
    posicion: string | null; nivel: string | null; nota_ataque: string | null; nota_defensa: string | null; dobla: boolean;
    no_suele_entrenar: boolean; nunca_partidos: boolean; sancionado_hasta_jornada: number | null;
  } | null;
};

const TEXTO_POS: Record<string, string> = { base: "Base", escolta: "Escolta", alero: "Alero", ala_pivot: "Ala-pívot", pivot: "Pívot" };

const ROLES = { jugador: "Jugador", solo_entreno: "Solo entreno", entrenador: "Entrenador" } as const;

// "Entrar con Google" exige una cuenta de Google con ese correo exacto; con un
// correo que no es de Gmail lo normal es que esa persona no tenga cuenta de
// Google ahí, así que entrará con el código de un solo uso (igual de válido,
// solo que hay que avisarla). No es una validación: solo una pista para el gestor.
function esGmail(email: string) {
  return /@gmail\.com$/i.test(email.trim());
}

export default function FilaJugador({ jugador: j, mensaje }: { jugador: JugadorGestion; mensaje: string | null }) {
  const [copiado, setCopiado] = useState(false);
  const [aviso, accionGuardar, guardando] = useActionState(guardarJugador.bind(null, j.id), null);

  async function copiar() {
    if (!mensaje) return;
    try {
      await navigator.clipboard.writeText(mensaje);
    } catch {
      window.prompt("Copia el mensaje:", mensaje);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  const fichas = [j.ficha_mda && "MdA", j.ficha_mdl && "MdL"].filter(Boolean).join(" + ") || "sin ficha";

  const p = j.privado;
  return (
    <li className="fila-jugador jg-fila" data-person={j.person_id}>
      <details>
      {/* La fila compacta: nombre, fichas, papel y si puede entrar; al tocarla se despliega lo demás (bloque 4). */}
      <summary className="jg-cab">
        <span className="jg-nombre"><b>{j.nombre_visible}</b>{p?.posicion && <small className="suave"> · {TEXTO_POS[p.posicion] ?? p.posicion}</small>}</span>
        <span className="pequeno suave jg-linea">
          {j.nombre_oficial} · {fichas} · {ROLES[j.rol]}{j.reserva ? " · reserva" : ""}{j.entrena ? " · entrena" : ""}
        </span>
        <span className="pequeno jg-acceso">
          {j.email ? (
            <>
              <span className="etiqueta etiqueta-ok">Puede entrar</span>{" "}
              {!esGmail(j.email) && <span className="etiqueta etiqueta-aviso">Entrará con código por correo</span>}
            </>
          ) : (
            <span className="etiqueta etiqueta-mal">Sin correo: no puede entrar</span>
          )}
        </span>
      </summary>

      <dl className="jg-datos" data-testid="jg-datos">
        <div><dt>Posición</dt><dd>{p?.posicion ? TEXTO_POS[p.posicion] ?? p.posicion : "sin cargar"}</dd></div>
        <div><dt>Nivel</dt><dd><b>{p?.nivel ?? "–"}</b> global · {p?.nota_ataque ?? "–"} ataque · {p?.nota_defensa ?? "–"} defensa</dd></div>
        <div><dt>Fichas</dt><dd>{fichas}</dd></div>
        <div><dt>Dobla</dt><dd>{p ? (p.dobla ? "Dobla" : "No dobla") : "–"}</dd></div>
        <div><dt>Disponibilidad</dt><dd>{[j.rol === "solo_entreno" && "solo entreno", p?.nunca_partidos && "nunca a partidos", p?.no_suele_entrenar && "no suele entrenar", j.reserva && "reserva"].filter(Boolean).join(" · ") || "normal"}</dd></div>
        <div><dt>Sanción</dt><dd>{p?.sancionado_hasta_jornada ? `sancionado hasta la J${p.sancionado_hasta_jornada}` : "no"}</dd></div>
        <div><dt>Acceso</dt><dd>{j.email ?? "sin correo"}</dd></div>
        <div><dt>Teléfono</dt><dd>{j.telefono ?? "sin teléfono"}</dd></div>
        <div><dt>Contacto de WhatsApp</dt><dd>{j.whatsapp_contacto ?? "sin contacto guardado"}</dd></div>
      </dl>
      <p className="pequeno" style={{ margin: "4px 0 0" }}><Link href="/gestion/convocatoria/datos">Cambiar posición, nivel, dobla o sanción ›</Link></p>

      <div className="botones">
        {mensaje && (
          <button type="button" className="boton boton-amarillo" onClick={copiar} aria-live="polite">
            {copiado ? "Mensaje copiado" : "Copiar mensaje"}
          </button>
        )}
        {mensaje && j.telefono && (
          <a className="boton" href={enlaceWhatsApp(j.telefono, mensaje)} target="_blank" rel="noopener noreferrer">
            Enviar por WhatsApp
          </a>
        )}
      </div>

      <div style={{ marginTop: 8 }}>
        <h4 className="jg-editar">Editar datos</h4>
        <form action={accionGuardar} className="rejilla-2">
          <div className="campo">
            <label htmlFor={`nv-${j.id}`}>Nombre visible</label>
            <input id={`nv-${j.id}`} name="nombre_visible" type="text" defaultValue={j.nombre_visible} maxLength={40} required />
          </div>
          <div className="campo">
            <label htmlFor={`email-${j.id}`}>Correo (para entrar)</label>
            <input id={`email-${j.id}`} name="email" type="email" defaultValue={j.email ?? ""} placeholder="nombre@correo.com" />
          </div>
          <div className="campo">
            <label htmlFor={`tel-${j.id}`}>Teléfono (opcional, solo gestores)</label>
            <input id={`tel-${j.id}`} name="telefono" type="tel" inputMode="tel" defaultValue={j.telefono ?? ""} placeholder="600 000 000" />
          </div>
          <div className="campo">
            <label htmlFor={`wa-${j.id}`}>Contacto de WhatsApp (como está en el móvil, solo gestores)</label>
            <input id={`wa-${j.id}`} name="whatsapp_contacto" type="text" defaultValue={j.whatsapp_contacto ?? ""} maxLength={60} placeholder="Nombre Baloncesto" />
          </div>
          <div className="campo">
            <label htmlFor={`rol-${j.id}`}>Rol</label>
            <select id={`rol-${j.id}`} name="rol" defaultValue={j.rol}>
              {Object.entries(ROLES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
          <div className="campo opciones">
            <label className="opcion"><input type="checkbox" name="ficha_mda" defaultChecked={j.ficha_mda} /> Ficha MdA</label>
            <label className="opcion"><input type="checkbox" name="ficha_mdl" defaultChecked={j.ficha_mdl} /> Ficha MdL</label>
            <label className="opcion"><input type="checkbox" name="entrena" defaultChecked={j.entrena} /> Entrena</label>
            <label className="opcion"><input type="checkbox" name="activo" defaultChecked={j.activo} /> Activo</label>
            <label className="opcion" title="Solo entra en la convocatoria si sin él no se cubren los mínimos"><input type="checkbox" name="reserva" defaultChecked={j.reserva} data-campo="reserva" /> Reserva</label>
          </div>
          <div>
            <button className="boton" disabled={guardando}>{guardando ? "Guardando…" : "Guardar datos"}</button>
            {aviso && <p className="ayuda" role="status">{aviso}</p>}
          </div>
        </form>
      </div>
      </details>
    </li>
  );
}
