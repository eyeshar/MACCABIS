"use client";

import { useActionState, useState } from "react";
import BotonConfirmar from "@/components/BotonConfirmar";
import { enlaceWhatsApp } from "@/lib/mensajes";
import { regenerarEnlace, anularEnlace, guardarJugador } from "../acciones";

export type JugadorGestion = {
  id: string;
  person_id: string;
  nombre_oficial: string;
  nombre_visible: string;
  ficha_mda: boolean;
  ficha_mdl: boolean;
  entrena: boolean;
  rol: "jugador" | "solo_entreno" | "entrenador";
  telefono: string | null;
  activo: boolean;
  enlace: string | null;
  mensaje: string | null;
  ultimoUso: string | null;
  creadoEn: string | null;
};

const ROLES = { jugador: "Jugador", solo_entreno: "Solo entreno", entrenador: "Entrenador" } as const;

function cuando(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function FilaJugador({ jugador: j }: { jugador: JugadorGestion }) {
  const [copiado, setCopiado] = useState(false);
  const [aviso, accionGuardar, guardando] = useActionState(guardarJugador.bind(null, j.id), null);

  async function copiar() {
    if (!j.mensaje) return;
    try {
      await navigator.clipboard.writeText(j.mensaje);
    } catch {
      window.prompt("Copia el mensaje:", j.mensaje);
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
        {j.enlace ? (
          <>
            <span className="etiqueta etiqueta-ok">Enlace activo</span>{" "}
            {j.ultimoUso ? <span className="suave">Abierto por última vez: {cuando(j.ultimoUso)}</span> : <span className="suave">Aún no lo ha abierto</span>}
          </>
        ) : (
          <span className="etiqueta etiqueta-mal">Sin enlace</span>
        )}
      </p>

      <div className="botones">
        {j.mensaje && (
          <button type="button" className="boton boton-amarillo" onClick={copiar} aria-live="polite">
            {copiado ? "Mensaje copiado" : "Copiar mensaje"}
          </button>
        )}
        {j.mensaje && j.telefono && (
          <a className="boton" href={enlaceWhatsApp(j.telefono, j.mensaje)} target="_blank" rel="noopener noreferrer">
            Enviar por WhatsApp
          </a>
        )}
        <form action={regenerarEnlace.bind(null, j.id)}>
          <BotonConfirmar className="boton boton-claro" pregunta={`¿Regenerar el enlace de ${j.nombre_visible}? El que tiene ahora dejará de funcionar.`}>
            {j.enlace ? "Regenerar" : "Crear enlace"}
          </BotonConfirmar>
        </form>
        {j.enlace && (
          <form action={anularEnlace.bind(null, j.id)}>
            <BotonConfirmar className="boton boton-peligro" pregunta={`¿Anular el enlace de ${j.nombre_visible}? No podrá entrar hasta que le crees otro.`}>
              Anular
            </BotonConfirmar>
          </form>
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
