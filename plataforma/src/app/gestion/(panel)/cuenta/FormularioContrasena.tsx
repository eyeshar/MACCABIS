"use client";

import { useActionState } from "react";
import { cambiarContrasena } from "../acciones";

export default function FormularioContrasena() {
  const [aviso, accion, pendiente] = useActionState(cambiarContrasena, null);
  return (
    <form action={accion}>
      <div className="campo">
        <label htmlFor="nueva">Contraseña nueva (mínimo 10 caracteres)</label>
        <input id="nueva" name="nueva" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      <div className="campo">
        <label htmlFor="repetir">Repite la contraseña</label>
        <input id="repetir" name="repetir" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      <button className="boton" disabled={pendiente}>{pendiente ? "Guardando…" : "Cambiar contraseña"}</button>
      {aviso && <p className="ayuda" role="status">{aviso}</p>}
    </form>
  );
}
