import Link from "next/link";
import { redirect } from "next/navigation";
import { clienteSesion, configurado } from "@/lib/supabase";
import { destinoTrasEntrar } from "@/lib/sesion";
import { Escudo } from "@/components/web/Marco";
import { Volver } from "@/components/Iconos";
import FormularioEntrar from "./FormularioEntrar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acceso · Maccabis" };

// Acceso (maqueta Acceso, D76). La logica no cambia (D68): Google o codigo por correo, lista blanca, y el reparto
// jugador -> /mi-zona, gestor -> /gestion, ambos -> /entrar/elegir.
export default async function Entrar({ searchParams }: { searchParams: Promise<{ salida?: string; sin_zona?: string; error_google?: string }> }) {
  const { salida, sin_zona, error_google } = await searchParams;
  if (configurado() && !salida && !sin_zona && !error_google) {
    const supabase = await clienteSesion();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect(await destinoTrasEntrar(supabase));
  }
  return (
    <div className="tema-oscuro">
      <div className="acc">
        <header className="acc-cab">
          <Link href="/" aria-label="Volver a la portada"><Volver />Volver a la web</Link>
        </header>
        <main className="acc-main">
          <div className="acc-marca">
            <Escudo />
            <h1>Acceso Maccabis</h1>
            <p>Solo para jugadores y gestores del club. Entra con el correo que tienes dado de alta.</p>
          </div>
          {salida && <div className="aviso aviso-ok" role="status">Has salido de tu cuenta.</div>}
          {sin_zona && (
            <div className="aviso aviso-error" role="alert">
              Tu cuenta no tiene ni zona de jugador ni permisos de gestión. Habla con Iván, Carlos o Edu.
            </div>
          )}
          {error_google && (
            <div className="aviso aviso-error" role="alert">
              No hemos podido entrar con Google. Si tu correo no está dado de alta en Maccabis, habla con Iván, Carlos o Edu; si no, prueba con el código por correo.
            </div>
          )}
          {!configurado() ? (
            <div className="aviso aviso-info">La plataforma aún no está conectada a su base de datos.</div>
          ) : (
            <FormularioEntrar />
          )}
          <p className="acc-legal">
            Si tu correo no está en la lista del club, no podrás entrar. Escribe a Iván, Carlos o Edu para darte de alta.{" "}
            <Link href="/privacidad">Privacidad</Link>
          </p>
        </main>
        <footer className="acc-pie" />
      </div>
    </div>
  );
}
