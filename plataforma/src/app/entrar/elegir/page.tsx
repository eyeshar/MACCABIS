import Link from "next/link";
import { exigirSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";
export const metadata = { title: "¿A dónde vas? · Maccabis" };

// Para quien es jugador Y gestor a la vez (Iván, Edu): elige a donde entrar.
// Si no tiene las dos cosas, destinoTrasEntrar() no le trae aqui.
export default async function Elegir() {
  await exigirSesion();
  return (
    <>
      <header className="cabecera">
        <div className="dentro">
          <div className="marca">Maccabis</div>
          <h1>¿A dónde vas?</h1>
        </div>
      </header>
      <main className="pagina">
        <section className="tarjeta" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link className="boton boton-amarillo boton-bloque" href="/mi-zona">Mi zona de jugador</Link>
          <Link className="boton boton-claro boton-bloque" href="/gestion">Gestión del club</Link>
        </section>
      </main>
    </>
  );
}
