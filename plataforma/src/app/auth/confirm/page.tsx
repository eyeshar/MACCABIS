import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Escudo } from "@/components/web/Marco";
import { tipoDeEnlace } from "./tipos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entrar · Maccabis", robots: { index: false, follow: false } };

// Enlace del correo (D157). El GET NO gasta el enlace: solo enseña un boton «Entrar». Los lectores de correo (Gmail) abren
// los enlaces por delante para comprobarlos y se lo comerian. El token se canjea en el POST (./entrar), en el servidor y sin
// code_verifier, asi que sirve en cualquier navegador (el interno de Gmail, otro movil...).
export default async function Confirmar({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const { token_hash, type } = await searchParams;
  const tipo = tipoDeEnlace(type);
  if (!token_hash || !tipo) redirect("/entrar?enlace=invalido");
  return (
    <div className="acc">
      <main className="acc-main">
        <div className="acc-marca">
          <Escudo />
          <h1>Acceso Maccabis</h1>
          <p>Pulsa el botón para entrar.</p>
        </div>
        <form method="post" action="/auth/confirm/entrar" className="acc-form" data-testid="confirmar-enlace">
          <input type="hidden" name="token_hash" value={token_hash} />
          <input type="hidden" name="type" value={tipo} />
          <button className="acc-enviar lleno">Entrar</button>
        </form>
        <p className="acc-legal">Si no has sido tú, ignora el correo: no pasa nada si no pulsas.</p>
      </main>
    </div>
  );
}
