"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRuta } from "@/components/nav/useRuta";
import { useSesion } from "@/components/nav/Sesion";

// Navegación de la Liga (bloque 6 de la estructura nueva): cuatro pestañas en una fila fija, Clasificación · Rivales ·
// Jugadores de la liga · Temporadas. «Jugadores de la liga» (Liga consolidada) son datos por jugador de terceros: solo
// aparece con sesión de jugador con ficha o de gestor (D162; la sesión llega del navegador, D175). Rivales incluye el
// Scouting (también solo con sesión). Las gemelas dinámicas (/liga/con-parametros) cuentan como /liga.
const sinGemela = (r: string) => r.replace(/\/con-parametros$/, "") || "/";

export function NavLiga({ temporadaPorDefecto }: { temporadaPorDefecto: string }) {
  const ruta = sinGemela(useRuta());
  const conSesion = useSesion().verLiga;
  const temporadas = /^\/liga\/\d{4}-\d{2}(\/|$)/.test(ruta) && !ruta.includes("/partido/");
  const partes = [
    // La página de un partido (D129) es de la clasificación, aunque cuelgue de /liga/<temporada>/partido/<id>.
    { t: "Clasificación", href: "/liga", activa: ruta === "/liga" || /^\/liga\/\d{4}-\d{2}\/partido\//.test(ruta) },
    { t: "Rivales", href: "/liga/rivales", activa: ruta === "/liga/rivales" || ruta === "/liga/scouting" },
    ...(conSesion ? [{ t: "Jugadores de la liga", href: "/liga/consolidada", activa: ruta.startsWith("/liga/consolidada") }] : []),
    { t: "Temporadas", href: `/liga/${temporadaPorDefecto}/equipo`, activa: temporadas },
  ];
  return (
    <nav className="e-nav" aria-label="Liga" data-testid="pestanas-liga">
      {partes.map((p) => (
        <Link prefetch={false} key={p.href} href={p.href} aria-current={p.activa ? "page" : undefined}>{p.t}</Link>
      ))}
    </nav>
  );
}

/** Subpestañas de una temporada (Equipo · Jugadores · Rankings · Por cuartos · Asistencia, y MdA donde la hay). */
export function NavTemporada({ temporada, pestanas }: { temporada: string; pestanas: { id: string; t: string }[] }) {
  const ruta = useRuta();
  const actual = ruta.split("/")[3] ?? "equipo";
  // En la página de un partido (D129) no hay pestañas: es de la clasificación.
  if (actual === "partido") return null;
  return (
    <nav className="e-pestanas" aria-label="Pestañas de la temporada" data-testid="pestanas-temporada">
      {pestanas.map((p) => (
        <Link prefetch={false} key={p.id} href={`/liga/${temporada}/${p.id}`} aria-current={actual === p.id ? "page" : undefined}>{p.t}</Link>
      ))}
    </nav>
  );
}

/** Selector de temporada (va en la misma fila que el de equipo, dentro de los controles de cada pestaña). */
export function SelectorTemporada({ temporada, temporadas }: { temporada: string; temporadas: { id: string; label: string }[] }) {
  const ruta = useRuta();
  const router = useRouter();
  const actual = ruta.split("/")[3] ?? "equipo";
  return (
    <div className="e-ctl e-selector">
      <label htmlFor="e-sel-temporada" className="e-ctl-et e-oro">Temporada</label>
      <select id="e-sel-temporada" className="e-select e-select-temporada" value={temporada} onChange={(ev) => router.push(`/liga/${ev.target.value}/${actual}`)}>
        {temporadas.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
    </div>
  );
}
