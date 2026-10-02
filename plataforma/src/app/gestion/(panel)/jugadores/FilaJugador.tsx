"use client";

import { useActionState, useState } from "react";
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
  activo: boolean;
};

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

  return (
    <li className="fila-jugador" data-person={j.person_id}>
      <h3 style={{ marginBottom: 2 }}>{j.nombre_visible}</h3>
      <p className="pequeno suave" style={{ marginBottom: 6 }}>
        {j.nombre_oficial} · {fichas} · {ROLES[j.rol]}{j.entrena ? " · entrena" : ""}
      </p>
      <p className="pequeno" style={{ marginBottom: 0 }}>
        {j.email ? (
          <>
            <span className="etiqueta etiqueta-ok">Puede entrar</span>{" "}
            {!esGmail(j.email) && <span className="etiqueta etiqueta-aviso">Entrará con código por correo</span>}{" "}
            <span className="suave">{j.email}</span>
          </>
        ) : (
          <span className="etiqueta etiqueta-mal">Sin correo: no puede entrar</span>
        )}
      </p>

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

      <details style={{ marginTop: 8 }}>
        <summary>Editar datos</summary>
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
          </div>
          <div>
            <button className="boton" disabled={guardando}>{guardando ? "Guardando…" : "Guardar datos"}</button>
            {aviso && <p className="ayuda" role="status">{aviso}</p>}
          </div>
        </form>
      </details>
    </li>
  );
}
