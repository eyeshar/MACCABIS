import Link from "next/link";
import { exigirSesion } from "@/lib/sesion";
import { Escudo } from "@/components/web/Marco";

export const dynamic = "force-dynamic";
export const metadata = { title: "¿A dónde vas? · Maccabis" };

// Para quien es jugador Y gestor a la vez (Iván, Edu): elige a donde entrar.
// Si no tiene las dos cosas, destinoTrasEntrar() no le trae aqui.
export default async function Elegir() {
  await exigirSesion();
  return (
    <div className="tema-oscuro">
      <div className="acc">
        <main className="acc-main">
          <div className="acc-marca">
            <Escudo />
            <h1>¿A dónde vas?</h1>
            <p>Tienes zona de jugador y permisos de gestión.</p>
          </div>
          <nav className="acc-elegir" aria-label="Elegir zona">
            <Link href="/mi-zona"><b>Mi zona de jugador</b><span>Tu agenda, tu temporada y el pedido de ropa</span></Link>
            <Link href="/gestion"><b>Gestión del club</b><span>Panel de la semana, jugadores, liga y scouting</span></Link>
          </nav>
        </main>
      </div>
    </div>
  );
}
