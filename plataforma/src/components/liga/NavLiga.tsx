"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// Navegación de la sección Liga: arriba, las tres partes (Liga 26/27, Rivales 26/27, Estadísticas por temporada) y,
// dentro de las temporadas, el selector 2013/14 → 2026/27 y sus pestañas. Con sesion de jugador o gestor (D162), ademas,
// Scouting rivales y Liga consolidada (datos por jugador de terceros: nunca sin sesion).
export function NavLiga({ temporadaPorDefecto, conSesion = false }: { temporadaPorDefecto: string; conSesion?: boolean }) {
  const ruta = usePathname();
  const partes = [
    // La pagina de un partido (D129) es de la Liga 26/27, aunque cuelgue de /liga/<temporada>/partido/<id>.
    { t: "Liga 26/27", href: "/liga", activa: ruta === "/liga" || /^\/liga\/\d{4}-\d{2}\/partido\//.test(ruta) },
    { t: "Rivales 26/27", href: "/liga/rivales", activa: ruta === "/liga/rivales" },
    { t: "Estadísticas por temporada", href: `/liga/${temporadaPorDefecto}/equipo`, activa: /^\/liga\/\d{4}-\d{2}(\/|$)/.test(ruta) && !ruta.includes("/partido/") },
    ...(conSesion ? [
      { t: "Scouting rivales", href: "/liga/scouting", activa: ruta === "/liga/scouting" },
      { t: "Liga consolidada", href: "/liga/consolidada", activa: ruta === "/liga/consolidada" },
    ] : []),
  ];
  return (
    <nav className="e-nav" aria-label="Liga">
      {partes.map((p) => (
        <Link key={p.href} href={p.href} aria-current={p.activa ? "page" : undefined}>{p.t}</Link>
      ))}
    </nav>
  );
}

export function NavTemporada({ temporada, temporadas, pestanas }: {
  temporada: string; temporadas: { id: string; label: string }[]; pestanas: { id: string; t: string }[];
}) {
  const ruta = usePathname();
  const router = useRouter();
  const actual = ruta.split("/")[3] ?? "equipo";
  // En la pagina de un partido (D129) no hay selector de temporada ni pestañas: es de la Liga 26/27.
  if (actual === "partido") return null;
  return (
    <div className="e-temporada">
      <div className="e-ctl e-selector">
        <label htmlFor="e-sel-temporada" className="e-ctl-et e-oro">Temporada</label>
        <select id="e-sel-temporada" className="e-select" value={temporada} onChange={(ev) => router.push(`/liga/${ev.target.value}/${actual}`)}>
          {temporadas.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <nav className="e-pestanas" aria-label="Pestañas de la temporada">
        {pestanas.map((p) => (
          <Link key={p.id} href={p.id === "jugadores" ? `/plantilla?t=${temporada}` : `/liga/${temporada}/${p.id}`} aria-current={actual === p.id ? "page" : undefined}>{p.t}</Link>
        ))}
      </nav>
    </div>
  );
}
