import type { Metadata } from "next";
import Volver from "@/components/nav/Volver";
import Link from "next/link";
import { exigirSesion, origen } from "@/lib/sesion";
import { miEnlace } from "@/lib/calendario/enlace";
import CalendarioMovil from "@/components/inicio/CalendarioMovil";
import "@/components/inicio/inicio.css";
import { usuarioActual } from "@/lib/usuario";
import { salir } from "@/app/entrar/acciones";
import Instalar from "./Instalar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi cuenta · Maccabis", robots: { index: false, follow: false } };

// Mi cuenta (D90): una sola pagina para jugadores y gestores, a la que se llega desde el menu de usuario. Sustituye a
// /gestion/cuenta (redirige aqui) y a la seccion "Mi cuenta" de Mi zona.
export default async function Cuenta() {
  const { user, supabase } = await exigirSesion();
  const u = await usuarioActual();
  const enlace = u?.personId ? await miEnlace(supabase, u.personId, await origen()).catch(() => null) : null;
  return (
    <main className="pagina cuenta">
      <Volver defecto="/" etiqueta="Inicio" />
      <h1>Mi cuenta</h1>
      <section className="tarjeta" aria-labelledby="t-quien">
        <h2 id="t-quien" className="solo-lectores">Quién eres</h2>
        <p style={{ marginBottom: 4 }}><strong>{u?.completo ?? user.email}</strong></p>
        {u?.papel && <p className="suave" style={{ marginBottom: 12 }}>{u.papel}</p>}
        <p style={{ margin: 0 }}>Entras con <strong>{user.email}</strong>, con Google o con un código a este correo (D68): no hay contraseña que cambiar.</p>
        <div className="botones">
          {u?.esJugador && <Link className="boton boton-claro" href="/">Tu inicio</Link>}
          {u?.esGestor && <Link className="boton boton-claro" href="/gestion">Gestión</Link>}
          <form action={salir}><button className="boton boton-claro" type="submit">Salir</button></form>
        </div>
      </section>
      <section className="tarjeta" id="instalar" aria-labelledby="t-instalar">
        <h2 id="t-instalar">Instalar en el móvil</h2>
        <p className="suave">Maccabis se puede tener como una app más, con su icono en la pantalla de inicio. Abre siempre la web en su última versión.</p>
        <Instalar />
        <ul className="cuenta-pasos">
          <li><strong>iPhone (Safari):</strong> botón Compartir → «Añadir a pantalla de inicio».</li>
          <li><strong>Android (Chrome):</strong> menú ⋮ → «Instalar aplicación» o «Añadir a pantalla de inicio».</li>
        </ul>
        <Link className="boton boton-amarillo" href="/avisos">Activar los avisos en este móvil</Link>
      </section>
      {u?.esJugador && <CalendarioMovil enlace={enlace} />}
      <p className="pie">¿Algo no cuadra? Habla con Iván, Carlos o Edu. · <Link href="/privacidad">Privacidad</Link></p>
    </main>
  );
}
