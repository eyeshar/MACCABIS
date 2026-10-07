import Image from "next/image";
import Link from "next/link";
import escudo from "../../../public/escudo.png";
import { FUNDACION, estadisticas } from "@/lib/web";
import { usuarioActual } from "@/lib/usuario";

// Marco de la web publica (maquetas Main y PortadaMovil): contenido y pie. La cabecera y la barra inferior son las de
// toda la web (components/nav, D89) y van en el layout raiz.

export function Escudo({ className, decorativo = false }: { className?: string; decorativo?: boolean }) {
  return <Image src={escudo} alt={decorativo ? "" : "Escudo de Maccabis"} className={className} priority sizes="132px" />;
}

/** Pie de la web publica. Usa la misma sesion que la cabecera (D89): sin sesion, el acceso; con sesion, sus zonas. */
export async function PiePublico() {
  const usuario = await usuarioActual().catch(() => null);
  return (
    <footer id="pie" className="w-pie">
      <div className="w-dentro w-pie-fila">
        <Escudo decorativo />
        <span>Maccabis · Baloncesto en Madrid desde {FUNDACION}</span>
        <span>Fuente: actas y hojas oficiales de la FBM</span>
        <Link href="/club">El club</Link>
        <a href={estadisticas()}>Todas las estadísticas</a>
        <Link href="/privacidad">Privacidad</Link>
        {!usuario && <Link href="/entrar" className="w-pie-acceso">Acceso jugadores y gestores</Link>}
        {usuario?.esJugador && <Link href="/mi-zona" className="w-pie-acceso">Mi zona</Link>}
        {usuario?.esGestor && <Link href="/gestion" className={usuario.esJugador ? "w-pie-zona" : "w-pie-acceso"}>Gestión</Link>}
      </div>
    </footer>
  );
}

/** Pagina publica: contenido y pie. */
export default function MarcoPublico({ children }: { actual?: string; children: React.ReactNode }) {
  return (
    <div className="w-publica">
      <main>{children}</main>
      <PiePublico />
    </div>
  );
}
