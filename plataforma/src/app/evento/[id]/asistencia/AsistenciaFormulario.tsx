"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { guardarAsistenciaReal, type RAsistencia } from "./acciones";

type Fila = { id: string; nombre: string; marcado: boolean };

export default function AsistenciaFormulario({ eventoId, partido, respondida, van, resto }: { eventoId: string; partido: boolean; respondida: boolean; van: Fila[]; resto: Fila[] }) {
  const [ausentes, setAusentes] = useState<string[]>(van.filter((f) => f.marcado).map((f) => f.id));
  const [sinAvisar, setSinAvisar] = useState<string[]>(resto.filter((f) => f.marcado).map((f) => f.id));
  const [r, setR] = useState<RAsistencia | null>(null);
  const [pendiente, empezar] = useTransition();
  const router = useRouter();
  const alternar = (lista: string[], poner: (x: string[]) => void, id: string) => poner(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
  const guardar = (a: string[], s: string[]) => empezar(async () => {
    const res = await guardarAsistenciaReal(eventoId, a, s, respondida);
    setR(res);
    if (res.ok) router.refresh();
  });
  return (
    <form className="pl-form" onSubmit={(e) => { e.preventDefault(); guardar(ausentes, sinAvisar); }} data-testid="asistencia-form">
      <button type="button" className="boton boton-amarillo boton-bloque" disabled={pendiente} onClick={() => { setAusentes([]); guardar([], sinAvisar); }} data-testid="asistencia-todos">Vinieron todos</button>
      <fieldset className="gs-bloque">
        <legend className="ev2-h2">Dijeron «voy»{partido ? " y estaban convocados" : ""}: marca quién faltó</legend>
        {van.length ? (
          <ul className="lista-limpia pl-lista">
            {van.map((f) => (
              <li key={f.id} className="pl-fila">
                <Link href={`/gestion/asistencia/${encodeURIComponent(f.id)}`}>{f.nombre}</Link>
                <label className="fz-casilla"><input type="checkbox" checked={ausentes.includes(f.id)} onChange={() => alternar(ausentes, setAusentes, f.id)} data-testid={`asistencia-falto-${f.id}`} /> Faltó</label>
              </li>
            ))}
          </ul>
        ) : <p className="suave" style={{ margin: 0 }}>Nadie dijo «voy».</p>}
      </fieldset>
      {resto.length > 0 && (
        <fieldset className="gs-bloque">
          <legend className="ev2-h2">Vino sin avisar</legend>
          <ul className="lista-limpia pl-lista">
            {resto.map((f) => (
              <li key={f.id} className="pl-fila">
                <Link href={`/gestion/asistencia/${encodeURIComponent(f.id)}`}>{f.nombre}</Link>
                <label className="fz-casilla"><input type="checkbox" checked={sinAvisar.includes(f.id)} onChange={() => alternar(sinAvisar, setSinAvisar, f.id)} data-testid={`asistencia-vino-${f.id}`} /> Vino</label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      <button type="submit" className="boton boton-contorno boton-bloque" disabled={pendiente} data-testid="asistencia-guardar">{pendiente ? "Guardando…" : respondida ? "Corregir" : `Guardar (${ausentes.length} ${ausentes.length === 1 ? "ausente" : "ausentes"})`}</button>
      {r && (r.ok ? <p className="aviso aviso-ok" role="status" data-testid="asistencia-ok">Guardado: {r.fueron} vinieron{r.faltaron ? `, ${r.faltaron} ${r.faltaron === 1 ? "faltó" : "faltaron"}` : ""}.</p> : <p className="aviso aviso-error" role="alert" data-testid="asistencia-error">{r.error}</p>)}
    </form>
  );
}
