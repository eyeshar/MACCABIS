"use client";

import { useActionState, useState } from "react";
import { clienteNavegador } from "@/lib/supabaseBrowser";
import { enviarCodigo, verificarCodigo } from "./acciones";

export default function FormularioEntrar() {
  const [conGoogle, setConGoogle] = useState(false);
  const [estadoEnvio, accionEnviar, enviando] = useActionState(enviarCodigo, null);
  const [estadoCodigo, accionVerificar, verificando] = useActionState(verificarCodigo, estadoEnvio);
  const estado = estadoCodigo ?? estadoEnvio;

  async function entrarConGoogle() {
    setConGoogle(true);
    const supabase = clienteNavegador();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setConGoogle(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <button type="button" className="boton boton-amarillo boton-bloque" onClick={entrarConGoogle} disabled={conGoogle}>
        {conGoogle ? "Llevándote a Google…" : "Entrar con Google"}
      </button>

      <p className="suave pequeno" style={{ textAlign: "center", margin: 0 }}>o, de respaldo</p>

      {estado?.paso !== "codigo" ? (
        <form action={accionEnviar}>
          <div className="campo">
            <label htmlFor="email">Recibir código por correo</label>
            <input id="email" name="email" type="email" autoComplete="email" required defaultValue={estado?.email} key={estado?.email} />
          </div>
          {estado?.error && <div className="aviso aviso-error" role="alert">{estado.error}</div>}
          <button className="boton boton-claro boton-bloque" disabled={enviando}>{enviando ? "Enviando…" : "Enviarme un código"}</button>
        </form>
      ) : (
        <form action={accionVerificar}>
          <input type="hidden" name="email" value={estado.email} />
          <p className="suave pequeno">Código enviado a <strong>{estado.email}</strong>.</p>
          <div className="campo">
            <label htmlFor="codigo">Código de 6 dígitos</label>
            <input id="codigo" name="codigo" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
          </div>
          {estado.aviso && <div className="aviso aviso-info" role="status">{estado.aviso}</div>}
          {estado.error && <div className="aviso aviso-error" role="alert">{estado.error}</div>}
          <div className="botones">
            <button className="boton boton-amarillo boton-bloque" disabled={verificando}>{verificando ? "Comprobando…" : "Entrar"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
