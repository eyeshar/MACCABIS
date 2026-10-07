"use client";

import { useRouter } from "next/navigation";

// Selectores de la Ficha y de la Plantilla: navegan a la URL (la temporada y el jugador viven en la dirección, así que
// cada ficha se puede enlazar).
export function SelectorTemporadaRuta({ ruta, temporada, temporadas }: { ruta: string; temporada: string; temporadas: { id: string; label: string }[] }) {
  const router = useRouter();
  return (
    <div className="e-ctl e-selector">
      <label htmlFor="e-sel-temporada" className="e-ctl-et e-oro">Temporada</label>
      <select id="e-sel-temporada" className="e-select" value={temporada} onChange={(ev) => router.push(`${ruta}?t=${ev.target.value}`)}>
        {temporadas.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
    </div>
  );
}

export function SelectorJugador({ temporada, personId, jugadores }: { temporada: string; personId: string; jugadores: { id: string; nombre: string }[] }) {
  const router = useRouter();
  return (
    <div className="e-ctl">
      <label htmlFor="e-sel-jugador" className="e-ctl-et">Jugador</label>
      <select id="e-sel-jugador" className="e-select" value={personId} onChange={(ev) => router.push(`/jugador/${ev.target.value}?t=${temporada}`)}>
        {jugadores.map((j) => <option key={j.id} value={j.id}>{j.nombre}</option>)}
      </select>
    </div>
  );
}
