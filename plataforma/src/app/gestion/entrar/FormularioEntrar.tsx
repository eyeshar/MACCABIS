"use client";

import { useActionState, useState } from "react";
import { entrar, recuperar } from "./acciones";

export default function FormularioEntrar() {
  const [estado, accion, pendiente] = useActionState(entrar, null);
  const [aviso, accionRecuperar, pendienteRec] = useActionState(recuperar, null);
  const [olvido, setOlvido] = useState(false);

  if (olvido) {
    return (
      <form action={accionRecuperar}>
        <div className="campo">
          <label htmlFor="email-rec">Correo</label>
          <input id="email-rec" name="email" type="email" autoComplete="email" required />
        </div>
        {aviso && <div className="aviso aviso-info" role="status">{aviso}</div>}
        <div className="botones">
          <button className="boton boton-bloque" disabled={pendienteRec}>Enviarme un enlace</button>
          <button type="button" className="boton boton-claro boton-bloque" onClick={() => setOlvido(false)}>Volver</button>
        </div>
      </form>
    );
  }
  return (
    <form action={accion}>
      <div className="campo">
        <label htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={estado?.email} key={estado?.email} />
      </div>
      <div className="campo">
        <label htmlFor="password">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {estado?.error && <div className="aviso aviso-error" role="alert">{estado.error}</div>}
      <div className="botones">
        <button className="boton boton-amarillo boton-bloque" disabled={pendiente}>{pendiente ? "Entrando…" : "Entrar"}</button>
        <button type="button" className="boton boton-claro boton-bloque" onClick={() => setOlvido(true)}>He olvidado la contraseña</button>
      </div>
    </form>
  );
}
