"use client";

import { useState } from "react";
import { diaYNumero, lunes, textoSemana } from "@/lib/dias";

export type EventoPublico = {
  id: string;
  tipo: "partido" | "entreno";
  fecha: string;
  inicio: string | null;
  fin: string | null;
  titulo: string;
  lugar: string;
  pistaPorConfirmar: boolean;
  nota: string | null;
  equipo?: "MDA" | "MDL";
  campo?: string | null;
  chip?: { tipo: string | null; texto: string } | null;
};

const FILTROS = [
  { id: "todo", texto: "Todo", pasa: () => true },
  { id: "partidos", texto: "Partidos", pasa: (e: EventoPublico) => e.tipo === "partido" },
  { id: "entrenos", texto: "Entrenamientos", pasa: (e: EventoPublico) => e.tipo === "entreno" },
  { id: "mda", texto: "MdA", pasa: (e: EventoPublico) => e.equipo === "MDA" },
  { id: "mdl", texto: "MdL", pasa: (e: EventoPublico) => e.equipo === "MDL" },
] as const;
const NOMBRE = { MDA: "MdA", MDL: "MdL" } as const;
const SEMANAS_INICIALES = 3;

// Calendario publico (maqueta Main): partidos de MdA y MdL y entrenos, por semanas, con filtros. Empieza mostrando
// las 3 proximas semanas con algo; "Ver toda la temporada" abre el resto.
export default function CalendarioPublico({ eventos, ultimoDia }: { eventos: EventoPublico[]; ultimoDia: string }) {
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("todo");
  const [todo, setTodo] = useState(false);
  const pasa = FILTROS.find((f) => f.id === filtro)!.pasa;
  const lista = eventos.filter(pasa);
  const semanas: { lunes: string; eventos: EventoPublico[] }[] = [];
  for (const e of lista) {
    const l = lunes(e.fecha);
    if (semanas.at(-1)?.lunes !== l) semanas.push({ lunes: l, eventos: [] });
    semanas.at(-1)!.eventos.push(e);
  }
  const vistas = todo ? semanas : semanas.slice(0, SEMANAS_INICIALES);

  return (
    <>
      <div role="group" aria-label="Filtrar calendario" className="w-filtros">
        {FILTROS.map((f) => (
          <button key={f.id} type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>{f.texto}</button>
        ))}
      </div>
      <div className="w-panel w-cal" data-testid="calendario">
        {vistas.length === 0 && <p className="w-cal-vacio">No queda nada en el calendario de esta temporada.</p>}
        {vistas.map((s) => (
          <div key={s.lunes} role="list" aria-label={textoSemana(s.lunes)}>
            <div className="w-cal-semana" aria-hidden="true">{textoSemana(s.lunes)}</div>
            {s.eventos.map((e) => (
              <div key={e.id} role="listitem" className="w-cal-fila" data-tipo={e.tipo} data-equipo={e.equipo ?? ""} data-id={e.id}>
                <span className="w-cal-dia">{diaYNumero(e.fecha)}</span>
                <span className="w-cal-hora">
                  {e.inicio ? (e.tipo === "entreno" ? `${e.inicio}–${e.fin}` : `${e.inicio}${e.campo ? ` · P${e.campo}` : ""}`) : "Hora por confirmar"}
                </span>
                <span className="w-cal-que">
                  {e.tipo === "entreno" ? <span className="chip-eq chip-entreno">ENTRENO</span> : <span className={`chip-eq chip-${e.equipo}`}>{NOMBRE[e.equipo!]}</span>}
                  <span>
                    {e.titulo}
                    {e.tipo === "entreno" && (
                      e.pistaPorConfirmar
                        ? <> · <span className="w-confirmar">pista por confirmar</span>{e.nota ? <span className="w-cal-lugar"> ({e.nota})</span> : null}</>
                        : <> · {e.lugar}{e.nota ? <span className="w-cal-lugar"> ({e.nota.replace(/\.$/, "").toLowerCase()})</span> : null}</>
                    )}
                  </span>
                </span>
                {e.chip ? <span className={`pastilla pastilla-${e.chip.tipo}`} data-aviso={e.chip.tipo ?? ""}>{e.chip.texto}</span> : <span />}
              </div>
            ))}
          </div>
        ))}
        {semanas.length > SEMANAS_INICIALES && (
          <div className="w-cal-mas">
            <button type="button" aria-expanded={todo} onClick={() => setTodo(!todo)}>
              {todo ? "Ver solo las próximas semanas" : `Ver toda la temporada (hasta el ${ultimoDia}) →`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
