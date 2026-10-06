import Image from "next/image";
import Link from "next/link";
import escudo from "../../../public/escudo.png";
import { FUNDACION, estadisticas } from "@/lib/web";

// Marco de la web publica (maquetas Main y PortadaMovil): contenido y pie. La cabecera y la barra inferior son las de
// toda la web (components/nav, D89) y van en el layout raiz.

export function Escudo({ className, decorativo = false }: { className?: string; decorativo?: boolean }) {
  return <Image src={escudo} alt={decorativo ? "" : "Escudo de Maccabis"} className={className} priority sizes="132px" />;
}

export function PiePublico() {
  return (
    <footer id="pie" className="w-pie">
      <div className="w-dentro w-pie-fila">
        <Escudo decorativo />
        <span>Maccabis · Baloncesto en Madrid desde {FUNDACION}</span>
        <span>Fuente: actas y hojas oficiales de la FBM</span>
        <Link href="/club">El club</Link>
        <a href={estadisticas()}>Todas las estadísticas</a>
        <Link href="/privacidad">Privacidad</Link>
        <Link href="/entrar" className="w-pie-acceso">Acceso jugadores y gestores</Link>
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
