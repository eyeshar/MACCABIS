import Link from "next/link";
import { exigirGestor } from "@/lib/sesion";
import { salir } from "@/app/entrar/acciones";

export const dynamic = "force-dynamic";

export default async function PanelGestion({ children }: { children: React.ReactNode }) {
  const { nombre } = await exigirGestor();
  return (
    <>
      <header className="cabecera cabecera-ancha">
        <div className="dentro">
          <div className="marca">Maccabis · gestión · {nombre}</div>
          <nav aria-label="Gestión" className="botones" style={{ marginTop: 10 }}>
            <Link className="boton boton-claro" href="/gestion">Inicio</Link>
            <Link className="boton boton-claro" href="/gestion/jugadores">Jugadores</Link>
            <Link className="boton boton-claro" href="/gestion/ropa">Pedido de ropa</Link>
            <Link className="boton boton-claro" href="/gestion/scouting">Scouting rivales</Link>
            <Link className="boton boton-claro" href="/gestion/liga">Liga consolidada</Link>
            <Link className="boton boton-claro" href="/gestion/cuenta">Mi cuenta</Link>
            <Link className="boton boton-claro" href="/mi-zona">Mi zona</Link>
            <form action={salir}>
              <button className="boton boton-amarillo" type="submit">Salir</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="pagina pagina-ancha">{children}</main>
    </>
  );
}
