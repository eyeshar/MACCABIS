"use client";

import Link from "next/link";
import { useSesion } from "@/components/nav/Sesion";

/** Enlaces de acceso del pie (D89): sin sesion, el acceso; con sesion, sus zonas. Con cookie de sesion y mientras no se sabe
 *  quien es, no se pinta ninguno (el HTML publico lleva el acceso, que se quita al saberlo: ver el CSS en globals.css). */
export default function PieAcceso() {
  const { usuario } = useSesion();
  return (
    <>
      {!usuario && <Link prefetch={false} href="/entrar" className="w-pie-acceso w-pie-sin-sesion">Acceso jugadores y gestores</Link>}
      {usuario?.esJugador && <Link prefetch={false} href="/agenda" className="w-pie-acceso">Tu agenda</Link>}
      {usuario?.esGestor && <Link prefetch={false} href="/gestion" className={usuario.esJugador ? "w-pie-zona" : "w-pie-acceso"}>Gestión</Link>}
    </>
  );
}
