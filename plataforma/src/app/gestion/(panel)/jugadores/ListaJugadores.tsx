"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import FilaJugador, { type JugadorGestion } from "./FilaJugador";

const normal = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Lista compacta de la plantilla con buscador (bloque 4). Lo buscado vive en la URL (?q=, norma 13.4): al volver se conserva. */
export default function ListaJugadores({ jugadores, mensajes }: { jugadores: JugadorGestion[]; mensajes: Record<string, string | null> }) {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const lista = useMemo(() => {
    const b = normal(q.trim());
    return b ? jugadores.filter((j) => normal(`${j.nombre_visible} ${j.nombre_oficial}`).includes(b)) : jugadores;
  }, [q, jugadores]);
  const cambiar = (v: string) => {
    setQ(v);
    const u = new URLSearchParams(params.toString());
    if (v.trim()) u.set("q", v); else u.delete("q");
    router.replace(`${ruta}${u.toString() ? `?${u}` : ""}`, { scroll: false });
  };
  return (
    <>
      <div className="campo jg-buscar">
        <label htmlFor="jg-buscar">Buscar</label>
        <input id="jg-buscar" type="search" value={q} onChange={(e) => cambiar(e.target.value)} placeholder="Nombre" autoComplete="off" data-testid="jg-buscar" />
      </div>
      <ul className="lista-limpia">
        {lista.map((j) => <FilaJugador key={j.id} jugador={j} mensaje={mensajes[j.id] ?? null} />)}
      </ul>
      {!lista.length && <p className="suave" style={{ margin: 0 }}>Nadie con ese nombre.</p>}
    </>
  );
}
