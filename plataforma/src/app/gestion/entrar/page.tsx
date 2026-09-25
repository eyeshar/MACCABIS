import { redirect } from "next/navigation";
import { clienteGestor, configurado } from "@/lib/supabase";
import FormularioEntrar from "./FormularioEntrar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar · Gestión Maccabis" };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ sin_permiso?: string; salir?: string }> }) {
  const { sin_permiso, salir } = await searchParams;
  if (configurado() && !sin_permiso && !salir) {
    const supabase = await clienteGestor();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/gestion");
  }
  return (
    <>
      <header className="cabecera">
        <div className="dentro">
          <div className="marca">Maccabis · gestión</div>
          <h1>Entrar</h1>
        </div>
      </header>
      <main className="pagina">
        {sin_permiso && <div className="aviso aviso-error">Tu usuario no es gestor del club. Si crees que debería, habla con Iván.</div>}
        {salir && <div className="aviso aviso-ok">Has salido de la zona de gestión.</div>}
        {!configurado() ? (
          <div className="aviso aviso-info">La plataforma aún no está conectada a su base de datos.</div>
        ) : (
          <section className="tarjeta">
            <p className="suave">Solo para Iván, Carlos y Edu. Los jugadores entran con su enlace personal, sin contraseña.</p>
            <FormularioEntrar />
          </section>
        )}
      </main>
    </>
  );
}
