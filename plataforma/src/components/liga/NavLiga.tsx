"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// Navegación de la sección Liga: arriba, las tres partes (Liga 26/27, Rivales 26/27, Estadísticas por temporada) y,
// dentro de las temporadas, el selector 2013/14 → 2026/27 y sus pestañas.
export function NavLiga({ temporadaPorDefecto }: { temporadaPorDefecto: string }) {
  const ruta = usePathname();
  const partes = [
    { t: "Liga 26/27", href: "/liga", activa: ruta === "/liga" },
    { t: "Rivales 26/27", href: "/liga/rivales", activa: ruta === "/liga/rivales" },
    { t: "Estadísticas por temporada", href: `/liga/${temporadaPorDefecto}/equipo`, activa: /^\/liga\/\d{4}-\d{2}(\/|$)/.test(ruta) },
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
          <Link key={p.id} href={`/liga/${temporada}/${p.id}`} aria-current={actual === p.id ? "page" : undefined}>{p.t}</Link>
        ))}
      </nav>
    </div>
  );
}
