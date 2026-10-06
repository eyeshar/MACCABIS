import Image from "next/image";
import Link from "next/link";
import { exigirGestor } from "@/lib/sesion";
import { salir } from "@/app/entrar/acciones";
import escudo from "../../../../public/escudo.png";
import NavGestion from "./NavGestion";

export const dynamic = "force-dynamic";
// Exige login: fuera de los buscadores (D85).
export const metadata = { robots: { index: false, follow: false } };

// Marco de gestion (maqueta Gestion, D76): tema claro, cabecera oscura y menu lateral.
export default async function PanelGestion({ children }: { children: React.ReactNode }) {
  const { nombre } = await exigirGestor();
  return (
    <>
      <header className="gs-cab">
        <div className="gs-cab-fila">
          <Link href="/gestion" className="gs-cab-marca" aria-label="Gestión de Maccabis, panel">
            <Image src={escudo} alt="" sizes="40px" />
            <b>MACCABIS</b>
            <span className="gs-etq">GESTIÓN</span>
          </Link>
          <Link className="gs-cab-enlace gs-ocultar-movil" href="/">Ver web pública</Link>
          <span className="gs-yo"><i aria-hidden="true">{nombre.slice(0, 1).toUpperCase()}</i><span className="gs-ocultar-movil">{nombre}</span></span>
          <form action={salir}><button type="submit">Salir</button></form>
        </div>
      </header>
      <div className="gs-cuerpo">
        <NavGestion />
        <main className="gs-main">{children}</main>
      </div>
    </>
  );
}
