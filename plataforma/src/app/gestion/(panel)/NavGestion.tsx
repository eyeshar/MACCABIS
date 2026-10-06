"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Barras, Bolsa, Calendario, Casa, Lista, Lupa, Panel, Persona, Personas, Tarjeta } from "@/components/Iconos";

const ENLACES = [
  { href: "/gestion", texto: "Panel", icono: <Panel /> },
  { href: "/gestion/jugadores", texto: "Jugadores", icono: <Personas size={20} /> },
  { href: "/gestion/ropa", texto: "Pedido de ropa", icono: <Bolsa size={20} /> },
  { href: "/gestion/scouting", texto: "Scouting rivales", icono: <Lupa /> },
  { href: "/gestion/liga", texto: "Liga consolidada", icono: <Barras size={20} /> },
];
// Llegan en los pasos 2 y 3 (docs/BACKLOG.md): se ven, pero no son enlaces.
const PRONTO = [
  { texto: "Convocatoria", icono: <Lista /> },
  { texto: "Calendario y eventos", icono: <Calendario size={20} /> },
  { texto: "Tesorería", icono: <Tarjeta /> },
];

// Menu lateral de gestion (maqueta Gestion). En movil pasa a una rejilla de dos columnas encima del contenido.
export default function NavGestion() {
  const ruta = usePathname();
  const actual = (href: string) => (href === "/gestion" ? ruta === href : ruta.startsWith(href));
  return (
    <nav aria-label="Gestión" className="gs-lateral">
      {ENLACES.map((e) => (
        <Link key={e.href} href={e.href} aria-current={actual(e.href) ? "page" : undefined}>{e.icono}{e.texto}</Link>
      ))}
      {PRONTO.map((e) => (
        <span key={e.texto} className="gs-pronto" aria-disabled="true">{e.icono}{e.texto}<small>pronto</small></span>
      ))}
      <hr />
      <Link href="/gestion/cuenta" aria-current={actual("/gestion/cuenta") ? "page" : undefined}><Persona size={20} />Mi cuenta</Link>
      <Link href="/mi-zona"><Casa size={20} />Mi zona</Link>
    </nav>
  );
}
