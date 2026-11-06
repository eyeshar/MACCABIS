"use client";

import Link from "next/link";
import { useRuta } from "@/components/nav/useRuta";

// Pestañas del Club (bloque 6 de la estructura nueva): Plantilla · Historia · El club. Las gemelas dinámicas de D175
// (/club/con-parametros, /club/historia/con-parametros) cuentan como su página de siempre.
export const PESTANAS_CLUB = [
  { id: "plantilla", t: "Plantilla", href: "/club" },
  { id: "historia", t: "Historia", href: "/club/historia" },
  { id: "el-club", t: "El club", href: "/club/el-club" },
] as const;

export function pestanaClub(ruta: string): (typeof PESTANAS_CLUB)[number]["id"] | null {
  const r = ruta.replace(/\/con-parametros$/, "");
  if (r === "/club") return "plantilla";
  if (r === "/club/historia") return "historia";
  if (r === "/club/el-club") return "el-club";
  return null;
}

export default function NavClub() {
  const actual = pestanaClub(useRuta());
  return (
    <nav className="e-nav" aria-label="Club" data-testid="pestanas-club">
      {PESTANAS_CLUB.map((p) => (
        <Link prefetch={false} key={p.id} href={p.href} aria-current={actual === p.id ? "page" : undefined}>{p.t}</Link>
      ))}
    </nav>
  );
}
