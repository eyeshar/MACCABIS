"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MENU_GESTION } from "@/lib/web";

/** Barra de Gestion (D90): fondo #2A2410, etiqueta GESTIÓN y los submenus en tres grupos; lo que aun no existe, en gris
 *  con "paso 2". En movil, una fila con scroll horizontal. */
export function BarraGestion() {
  const ruta = usePathname();
  const actual = (href: string) => (href === "/gestion" ? ruta === href : ruta.startsWith(href));
  return (
    <nav aria-label="Gestión" className="zb zb-gestion">
      <div className="w-dentro zb-fila">
        <span className="zb-etq" aria-hidden="true">GESTIÓN</span>
        {MENU_GESTION.map((g) => (
          <div key={g.grupo} className="zb-grupo" role="group" aria-label={g.grupo}>
            {g.entradas.map((e) =>
              e.href ? (
                <Link key={e.texto} href={e.href} aria-current={actual(e.href) ? "page" : undefined}>{e.corto}</Link>
              ) : (
                <span key={e.texto} className="zb-paso2" aria-disabled="true">{e.corto} <small>paso 2</small></span>
              ),
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}

// La barra propia de Mi zona (D99) ya no existe (D116): Inicio, Agenda y Mis números estan en la navegacion de toda la
// web y las paginas de /mi-zona/* (evento, domingo, ausencias, ropa) marcan «Agenda».
