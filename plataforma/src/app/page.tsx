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
          <h2>Jugadores y gestión</h2>
          <p>Entra con Google o con un código a tu correo, si está dado de alta en el club.</p>
          <Link className="boton" href="/entrar">Entrar</Link>
        </section>
        <section className="tarjeta">
          <h2>Estadísticas</h2>
          <p>Las estadísticas y la historia del club son públicas.</p>
          <a className="boton boton-claro" href="https://eyeshar.github.io/MACCABIS/">Ver estadísticas</a>
        </section>
        <p className="pie"><Link href="/privacidad">Privacidad: qué datos guardamos y para qué</Link></p>
      </main>
    </>
  );
}
