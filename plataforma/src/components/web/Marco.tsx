import Image from "next/image";
import Link from "next/link";
import escudo from "../../../public/escudo.png";
import { FUNDACION } from "@/lib/web";
import PieAcceso from "./PieAcceso";

// Marco de la web publica (maquetas Main y PortadaMovil): contenido y pie. La cabecera y la barra inferior son las de
// toda la web (components/nav, D89) y van en el layout raiz.

export function Escudo({ className, decorativo = false }: { className?: string; decorativo?: boolean }) {
  return <Image src={escudo} alt={decorativo ? "" : "Escudo de Maccabis"} className={className} priority sizes="132px" />;
}

/** Pie de la web publica. Usa la misma sesion que la cabecera (D89): sin sesion, el acceso; con sesion, sus zonas
 *  (PieAcceso, en el navegador desde D175: el pie no lleva nada de la sesion en el HTML). */
export function PiePublico() {
  return (
    <footer id="pie" className="w-pie">
      <div className="w-dentro w-pie-fila">
        <Escudo decorativo />
        <span>Maccabis · Baloncesto en Madrid desde {FUNDACION}</span>
        <span>Fuente: actas y hojas oficiales de la FBM</span>
        <Link href="/club">El club</Link>
        <Link href="/liga">Todas las estadísticas</Link>
        <Link href="/privacidad">Privacidad</Link>
        <PieAcceso />
      </div>
    </footer>
  );
}

/** Pagina publica: contenido y pie. */
export default function MarcoPublico({ actual, children }: { actual?: string; children: React.ReactNode }) {
  return (
    <div className="w-publica" data-actual={actual}>
      <main>{children}</main>
      <PiePublico />
    </div>
  );
}
