"use client";

import { useActionState, useState } from "react";
import { clienteNavegador } from "@/lib/supabaseBrowser";
import { Google } from "@/components/Iconos";
import { enviarCodigo, verificarCodigo } from "./acciones";

export default function FormularioEntrar() {
  const [conGoogle, setConGoogle] = useState(false);
  const [falloGoogle, setFalloGoogle] = useState(false);
  const [estadoEnvio, accionEnviar, enviando] = useActionState(enviarCodigo, null);
  const [estadoCodigo, accionVerificar, verificando] = useActionState(verificarCodigo, estadoEnvio);
  // Lo ultimo que ha pasado: pedir otro codigo despues de un codigo mal puesto debe sustituir al error, no quedar debajo.
  const [ultimo, setUltimo] = useState<"envio" | "codigo">("envio");
  const estado = ultimo === "codigo" ? (estadoCodigo ?? estadoEnvio) : estadoEnvio;

  async function entrarConGoogle() {
    setConGoogle(true);
    const supabase = clienteNavegador();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setConGoogle(false); setFalloGoogle(true); }
  }

  return (
    <div className="acc-form">
      <button type="button" className="acc-google" onClick={entrarConGoogle} disabled={conGoogle}>
        <Google />
        {conGoogle ? "Llevándote a Google…" : "Continuar con Google"}
      </button>
      {falloGoogle && <div className="aviso aviso-error" role="alert" style={{ margin: 0 }}>No hemos podido entrar con Google. <b>Prueba con el código por correo</b>: al entrar una vez así, Google funcionará después.</div>}

      <div className="acc-o">o con un código por correo</div>

      {estado?.paso !== "codigo" ? (
        <form action={accionEnviar} onSubmit={() => setUltimo("envio")}>
          <label htmlFor="email">Tu correo</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="nombre@correo.com" required defaultValue={estado?.email} key={estado?.email} />
          {estado?.error && <div className="aviso aviso-error" role="alert" style={{ margin: 0 }}>{estado.error}</div>}
          <button className="acc-enviar" disabled={enviando}>{enviando ? "Enviando…" : "Enviarme el código"}</button>
        </form>
      ) : (
        <>
        <form action={accionVerificar} onSubmit={() => setUltimo("codigo")}>
          <input type="hidden" name="email" value={estado.email} />
          <p className="suave pequeno" style={{ margin: 0 }}>Código enviado a <strong>{estado.email}</strong>.</p>
          {estado.aviso && <div className="aviso aviso-info" role="status" style={{ margin: 0 }}>{estado.aviso}</div>}
          <label htmlFor="codigo">Código del correo</label>
          <input id="codigo" name="codigo" type="text" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={8} pattern="[0-9]{6,8}" title="Entre 6 y 8 dígitos" required className="cifra" style={{ letterSpacing: "0.3em", fontSize: 22 }} />
          {estado.error && <div className="aviso aviso-error" role="alert" style={{ margin: 0 }}>{estado.error}</div>}
          <button className="acc-enviar lleno" disabled={verificando}>{verificando ? "Comprobando…" : "Entrar"}</button>
        </form>
        <form action={accionEnviar} onSubmit={() => setUltimo("envio")}>
          <input type="hidden" name="email" value={estado.email} />
          <button className="boton boton-claro" disabled={enviando} data-testid="pedir-otro-codigo">{enviando ? "Enviando…" : "Pedir otro código"}</button>
        </form>
        </>
      )}
    </div>
  );
}
