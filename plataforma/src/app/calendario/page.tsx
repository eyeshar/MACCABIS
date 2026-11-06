import type { Metadata } from "next";
import Link from "next/link";
import { exigirSesion, esGestorActual, origen } from "@/lib/sesion";
import { cargarMiZona } from "@/app/mi-zona/datos";
import SinZona from "@/app/mi-zona/SinZona";
import CalendarioMovil from "@/components/inicio/CalendarioMovil";
import { FilaAgenda } from "@/components/inicio/piezas";
import { madrid } from "@/lib/avisos/horario";
import { miEnlace } from "@/lib/calendario/enlace";
import { hoyMadrid } from "@/lib/dias";
import { cargarEventos, cargarPistas } from "@/lib/eventos/datos";
import { diaCorto, hhmm, pistaEfectiva, tituloEvento, type EventoFila } from "@/lib/eventos/dominio";
import {
  cargarMiConvocatoria, cargarMisAusencias, cargarMisEventos, cargarMisGrupos, cargarMisRespuestas, misEntrenosPorDefecto,
} from "@/lib/respuestas/jugador";
import { esPlan, unidades, type Unidad } from "@/lib/respuestas/dominio";
import { filtrar, FILTROS, MESES, leerFiltro, type Filtro } from "@/lib/calendario/filtros";
import "@/components/inicio/inicio.css";
import "@/components/respuestas/respuestas.css";
import "./calendario.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Calendario · Maccabis", robots: { index: false, follow: false } };

type Consulta = { f?: string; eq?: string; pasados?: string };

/** Enlace de un chip: conserva el resto del filtro (todo vive en la URL, norma 13.4). */
const href = (f: Filtro, cambio: Partial<Filtro>) => {
  const x = { ...f, ...cambio };
  const p = new URLSearchParams();
  if (x.tipo !== "todo") p.set("f", x.tipo);
  if (x.equipo) p.set("eq", x.equipo);
  if (x.pasados) p.set("pasados", "1");
  const q = p.toString();
  return `/calendario${q ? `?${q}` : ""}`;
};

function Chips({ f }: { f: Filtro }) {
  return (
    <div className="cl-filtros" data-testid="filtros">
      <nav className="cl-chips" aria-label="Qué ver">
        {FILTROS.map((x) => <Link key={x.id} href={href(f, { tipo: x.id })} className="cl-chip" aria-current={f.tipo === x.id ? "true" : undefined}>{x.texto}</Link>)}
      </nav>
      <nav className="cl-chips" aria-label="Equipo">
        {(["MdA", "MdL"] as const).map((e) => (
          <Link key={e} href={href(f, { equipo: f.equipo === e ? null : e })} className={`cl-chip cl-chip-${e}`} aria-current={f.equipo === e ? "true" : undefined}>{e}</Link>
        ))}
        <Link href={href(f, { pasados: !f.pasados })} className="cl-chip" aria-current={f.pasados ? "true" : undefined} data-testid="chip-pasados">Pasados</Link>
      </nav>
    </div>
  );
}

/** Lista por meses con la cabecera del mes fija al desplazar. */
function PorMeses<T extends { fecha: string }>({ items, fila, vacio }: { items: T[]; fila: (x: T) => React.ReactNode; vacio: string }) {
  const porMes = new Map<string, T[]>();
  for (const u of items) porMes.set(u.fecha.slice(0, 7), [...(porMes.get(u.fecha.slice(0, 7)) ?? []), u]);
  if (!items.length) return <p className="suave">{vacio}</p>;
  return (
    <>
      {[...porMes.entries()].map(([mes, us]) => (
        <section key={mes} className="cl-mes" aria-label={`${MESES[+mes.slice(5) - 1]} ${mes.slice(0, 4)}`}>
          <h2 className="cl-mes-cab">{MESES[+mes.slice(5) - 1]} <span className="tenue">{mes.slice(0, 4)}</span></h2>
          <div className="in-lista">{us.map(fila)}</div>
        </section>
      ))}
    </>
  );
}

// Calendario (D189, estructura nueva; sustituye a la Agenda de D117): arriba «Tenlo en el calendario de tu móvil» (D120),
// «+ Proponer un plan» y «Días que no estoy» (las ausencias de D87, /mi-zona/ausencias); chips Todo · Partidos · Entrenos ·
// Planes, MdA y MdL y «Pasados» (en la URL); y la lista por meses con su estado.
export default async function Calendario({ searchParams }: { searchParams: Promise<Consulta> }) {
  const { supabase } = await exigirSesion();
  const f = leerFiltro(await searchParams);
  const hoy = hoyMadrid();
  const ahora = new Date();
  const [zona, esGestor] = await Promise.all([cargarMiZona().catch(() => null), esGestorActual()]);

  if (!zona) {
    // Gestor sin ficha de jugador: los eventos del club (sin respuesta propia), cada uno a su evento.
    if (!esGestor) return <SinZona />;
    const [todos, pistas] = await Promise.all([cargarEventos(supabase, { conPlanes: true }).catch(() => [] as EventoFila[]), cargarPistas(supabase).catch(() => [])]);
    const terminado = (e: EventoFila) => madrid(e.fecha, hhmm(e.fin) ?? hhmm(e.inicio) ?? "23:59") <= ahora;
    const lista = filtrar(todos, f, (e) => ({ tipo: e.tipo, equipo: e.equipo, plan: e.oficial === false })).filter((e) => (f.pasados ? terminado(e) : !terminado(e)));
    if (f.pasados) lista.reverse();
    return (
      <main className="in cl" id="calendario">
        <h1 className="solo-lectores">Calendario</h1>
        <Chips f={f} />
        <PorMeses items={lista} vacio={f.pasados ? "No hay eventos pasados con este filtro." : "No hay nada próximo con este filtro."} fila={(e) => (
          <Link key={e.id} href={`/evento/${e.id}`} className={`in-fila${e.oficial === false ? " es-plan" : ""}`} data-tipo={e.tipo} data-testid="fila-agenda">
            <div className="in-fila-cuando"><b className="in-fila-dia">{diaCorto(e.fecha)}</b><b className="in-fila-hora cifra">{hhmm(e.inicio) ?? "—"}</b></div>
            <div className="in-fila-que">
              {e.oficial === false && <span className="pl-etq-plan">Plan no oficial</span>}
              <strong>{tituloEvento(e)}</strong>
              {e.estado === "cancelado" && <span className="in-pastilla in-p-cancelado">Cancelado</span>}
              <span className="in-fila-lugar suave">{pistaEfectiva(e, pistas).texto}</span>
            </div>
          </Link>
        )} />
      </main>
    );
  }

  const [eventos, respuestas, ausencias, convocatorias, grupos, base] = await Promise.all([
    cargarMisEventos(f.pasados ? "2026-08-01" : hoy).catch(() => []), cargarMisRespuestas().catch(() => []), cargarMisAusencias().catch(() => []),
    cargarMiConvocatoria().catch(() => []), cargarMisGrupos(), origen(),
  ]);
  const porDefecto = await misEntrenosPorDefecto(eventos, respuestas, ausencias).catch(() => new Set<string>());
  const enlace = await miEnlace(supabase, zona.jugador.person_id, base).catch(() => null);
  const abierta = (u: Unidad) => u.eventos.some((e) => e.estado === "programado" && madrid(e.fecha, hhmm(e.inicio) ?? "00:00") > ahora);
  const pasada = (u: Unidad) => u.eventos.every((e) => madrid(e.fecha, hhmm(e.fin) ?? hhmm(e.inicio) ?? "23:59") <= ahora);
  const lista = filtrar(unidades(eventos), f, (u) => ({ tipo: u.eventos[0].tipo, equipo: u.eventos.length > 1 ? "ambos" : u.eventos[0].equipo, plan: esPlan(u.eventos[0]) }))
    .filter((u) => (f.pasados ? pasada(u) : abierta(u) || u.eventos.every((e) => e.estado === "cancelado")));
  if (f.pasados) lista.reverse();
  const grupoDe = (u: Unidad) => (u.eventos[0].tipo === "entreno" ? grupos.find((g) => g.evento_id === u.eventos[0].id) ?? null : null);

  return (
    <main className="in cl" id="calendario">
      <h1 className="solo-lectores">Calendario</h1>
      <CalendarioMovil enlace={enlace} compacto />
      <div className="cl-botones">
        <Link href="/planes/nuevo" className="boton boton-amarillo">+ Proponer un plan</Link>
        <Link href="/mi-zona/ausencias" className="boton boton-claro" data-testid="dias-que-no-estoy">Días que no estoy</Link>
      </div>
      <Chips f={f} />
      <PorMeses items={lista} vacio={f.pasados ? "No hay nada pasado con este filtro." : "No tienes nada próximo con este filtro."}
        fila={(u) => <FilaAgenda key={u.clave} u={u} respuestas={respuestas} ausencias={ausencias} convocatorias={convocatorias} grupo={grupoDe(u)} porDefecto={porDefecto} />} />
    </main>
  );
}
