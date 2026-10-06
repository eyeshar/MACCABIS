"use client";

import { useActionState, useState } from "react";
import { clienteNavegador } from "@/lib/supabaseBrowser";
import { Google } from "@/components/Iconos";
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
    <div className="acc-form">
      <button type="button" className="acc-google" onClick={entrarConGoogle} disabled={conGoogle}>
        <Google />
        {conGoogle ? "Llevándote a Google…" : "Continuar con Google"}
      </button>

      <div className="acc-o">o con un código por correo</div>

      {estado?.paso !== "codigo" ? (
        <form action={accionEnviar}>
          <label htmlFor="email">Tu correo</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="nombre@correo.com" required defaultValue={estado?.email} key={estado?.email} />
          {estado?.error && <div className="aviso aviso-error" role="alert" style={{ margin: 0 }}>{estado.error}</div>}
          <button className="acc-enviar" disabled={enviando}>{enviando ? "Enviando…" : "Enviarme el código"}</button>
        </form>
      ) : (
        <form action={accionVerificar}>
          <input type="hidden" name="email" value={estado.email} />
          <p className="suave pequeno" style={{ margin: 0 }}>Código enviado a <strong>{estado.email}</strong>.</p>
          {estado.aviso && <div className="aviso aviso-info" role="status" style={{ margin: 0 }}>{estado.aviso}</div>}
          <label htmlFor="codigo">Código de 6 dígitos</label>
          <input id="codigo" name="codigo" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className="cifra" style={{ letterSpacing: "0.3em", fontSize: 22 }} />
          {estado.error && <div className="aviso aviso-error" role="alert" style={{ margin: 0 }}>{estado.error}</div>}
          <button className="acc-enviar lleno" disabled={verificando}>{verificando ? "Comprobando…" : "Entrar"}</button>
        </form>
      )}
    </div>
  );
}
