import Link from "next/link";
import { redirect } from "next/navigation";
import { clienteSesion, configurado } from "@/lib/supabase";
import { destinoTrasEntrar } from "@/lib/sesion";
import FormularioEntrar from "./FormularioEntrar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar · Maccabis" };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ salida?: string; sin_zona?: string; error_google?: string }> }) {
  const { salida, sin_zona, error_google } = await searchParams;
  if (configurado() && !salida && !sin_zona && !error_google) {
    const supabase = await clienteSesion();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect(await destinoTrasEntrar(supabase));
  }
  return (
    <>
      <header className="cabecera">
        <div className="dentro">
          <div className="marca">Maccabis</div>
          <h1>Entrar</h1>
        </div>
      </header>
      <main className="pagina">
        {salida && <div className="aviso aviso-ok">Has salido de tu cuenta.</div>}
        {sin_zona && (
          <div className="aviso aviso-error">
            Tu cuenta no tiene ni zona de jugador ni permisos de gestión. Habla con Iván, Carlos o Edu.
          </div>
        )}
        {error_google && (
          <div className="aviso aviso-error">
            No hemos podido entrar con Google. Si tu correo no está dado de alta en Maccabis, habla con Iván, Carlos o Edu; si no, prueba con el código por correo.
          </div>
        )}
        {!configurado() ? (
          <div className="aviso aviso-info">La plataforma aún no está conectada a su base de datos.</div>
        ) : (
          <section className="tarjeta">
            <p className="suave">
              Solo entra quien está dado de alta en el club, con el correo que tenemos tuyo. Si es la primera vez,
              usa el mismo correo que diste al club.
            </p>
            <FormularioEntrar />
          </section>
        )}
        <p className="pie"><Link href="/privacidad">Privacidad: qué datos guardamos y para qué</Link></p>
      </main>
    </>
  );
}
