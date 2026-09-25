import Link from "next/link";
import { configurado } from "@/lib/supabase";

export default function Inicio() {
  return (
    <>
      <header className="cabecera">
        <div className="dentro">
          <div className="marca">Maccabis · since 2013</div>
          <h1>Plataforma del club</h1>
        </div>
      </header>
      <main className="pagina">
        {!configurado() && (
          <div className="aviso aviso-info">La plataforma aún no está conectada a su base de datos.</div>
        )}
        <section className="tarjeta">
          <h2>Jugadores</h2>
          <p>Cada jugador entra con su enlace personal, que le mandan los gestores por WhatsApp. Si lo has perdido, pide uno nuevo.</p>
        </section>
        <section className="tarjeta">
          <h2>Gestión</h2>
          <p>Solo para los gestores del club.</p>
          <Link className="boton" href="/gestion">Entrar a gestión</Link>
        </section>
        <section className="tarjeta">
          <h2>Estadísticas</h2>
          <p>Las estadísticas y la historia del club son públicas.</p>
          <a className="boton boton-claro" href="https://eyeshar.github.io/MACCABIS/">Ver estadísticas</a>
        </section>
      </main>
    </>
  );
}
