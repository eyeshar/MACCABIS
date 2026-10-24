"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmarEnPagina from "@/components/ConfirmarEnPagina";
import { mensajeGrupos } from "@/lib/grupos/sugerir";
import type { DatosGrupos } from "@/lib/grupos/datos";
import { borrarReparto, duplicarReparto, guardarReparto, publicarReparto, sugerir } from "./acciones";

type G = { nombre: string; personas: string[]; explica?: string };
const TEXTO_POS: Record<string, string> = { base: "Base", escolta: "Escolta", alero: "Alero", ala_pivot: "Ala-pívot", pivot: "Pívot" };
const FUERA = -1;

/** Grupos de entreno (D121, lienzo «Inicio personal»): varios repartos por entreno, «Sugerir grupos» (de 3 a 6 por
 *  grupo), mover con seleccion multiple («Mover N a…») o arrastrando en escritorio, renombrar, añadir o quitar grupos,
 *  duplicar, borrar, «Publicar a la plantilla» (desactivado por defecto) y el mensaje de WhatsApp. */
export default function Grupos({ d }: { d: DatosGrupos }) {
  const router = useRouter();
  const [idActual, setIdActual] = useState<string | null>(d.repartos[0]?.id ?? null);
  const actual = d.repartos.find((r) => r.id === idActual) ?? null;
  const [nombre, setNombre] = useState(actual?.nombre ?? "Grupos");
  const [tamano, setTamano] = useState(actual?.tamano ?? 5);
  const [grupos, setGrupos] = useState<G[]>(actual?.grupos ?? []);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [destino, setDestino] = useState<number>(0);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pendiente, empezar] = useTransition();
  const quien = useMemo(() => new Map(d.jugadores.map((j) => [j.person_id, j])), [d.jugadores]);
  const nombreDe = (id: string) => quien.get(id)?.nombre ?? id;

  const cargar = (id: string | null) => {
    const r = d.repartos.find((x) => x.id === id) ?? null;
    setIdActual(id); setNombre(r?.nombre ?? "Grupos nuevos"); setTamano(r?.tamano ?? 5); setGrupos(r?.grupos ?? []); setSel(new Set()); setMensaje(null);
  };
  const enGrupo = new Set(grupos.flatMap((g) => g.personas));
  const sinGrupo = d.van.filter((id) => !enGrupo.has(id));
  const dudas = d.duda.filter((id) => !enGrupo.has(id));
  const alternar = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const mover = (ids: string[], a: number) => {
    setGrupos((gs) => gs.map((g, i) => ({ ...g, personas: [...g.personas.filter((p) => !ids.includes(p)), ...(i === a ? ids.filter((p) => !g.personas.includes(p)) : [])] })));
    setSel(new Set());
  };
  const arrastrar = (id: string) => (e: React.DragEvent) => e.dataTransfer.setData("text/plain", JSON.stringify(sel.has(id) ? [...sel] : [id]));
  const soltar = (a: number) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.currentTarget.classList.add("tb-encima"); },
    onDragLeave: (e: React.DragEvent) => e.currentTarget.classList.remove("tb-encima"),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); e.currentTarget.classList.remove("tb-encima"); try { mover(JSON.parse(e.dataTransfer.getData("text/plain")), a); } catch { /* nada */ } },
  });

  const hacer = (f: () => Promise<void>) => empezar(async () => { setMensaje(null); await f(); });
  const pedirSugerencia = () => hacer(async () => {
    const r = await sugerir(d.evento.id, tamano);
    if (!r.ok) { setMensaje({ ok: false, texto: r.error }); return; }
    setGrupos(r.dato ?? []); setMensaje({ ok: true, texto: "Sugerencia lista: revisa, mueve lo que quieras y guarda el reparto." });
  });
  const guardar = () => hacer(async () => {
    const r = await guardarReparto(d.evento.id, { id: idActual, nombre, tamano, grupos });
    if (!r.ok) { setMensaje({ ok: false, texto: r.error }); return; }
    setIdActual(r.dato ?? null); setMensaje({ ok: true, texto: "Reparto guardado." }); router.refresh();
  });
  const persona = (id: string, tag?: string) => {
    const j = quien.get(id);
    return (
      <li key={id} draggable onDragStart={arrastrar(id)} className={sel.has(id) ? "tb-sel" : undefined} data-person={id}>
        <label className="tb-casilla"><input type="checkbox" checked={sel.has(id)} onChange={() => alternar(id)} aria-label={`Seleccionar a ${nombreDe(id)}`} /></label>
        <span className="tb-jugador"><b>{nombreDe(id)}</b><small>{j?.posicion ? TEXTO_POS[j.posicion] : "sin posición"}{j?.base_reserva && <span className="tb-marca">base de reserva</span>}{j?.nivel && <span className="tb-marca">nivel {j.nivel}</span>}{tag && <span className="tb-marca">{tag}</span>}</small></span>
      </li>
    );
  };
  const titulo = `Grupos del entreno del ${new Date(`${d.evento.fecha}T12:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric" })}`;
  const textoWhatsApp = mensajeGrupos(titulo, grupos, nombreDe);

  return (
    <div className="gr" data-testid="grupos">
      <div className="gr-repartos" role="tablist" aria-label="Repartos">
        {d.repartos.map((r) => <button key={r.id} type="button" role="tab" aria-selected={r.id === idActual} className={`tb-chip${r.id === idActual ? " activo" : ""}`} onClick={() => cargar(r.id)}>{r.nombre}{r.publicado ? " · publicado" : ""}</button>)}
        <button type="button" role="tab" aria-selected={idActual === null} className={`tb-chip${idActual === null ? " activo" : ""}`} onClick={() => cargar(null)}>+ Nuevo reparto</button>
      </div>

      <section className="gs-bloque gr-cab" aria-label="Reparto">
        <div className="gr-fila">
          <div className="campo" style={{ margin: 0 }}><label htmlFor="gr-nombre">Nombre del reparto</label><input id="gr-nombre" type="text" value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} placeholder="Calentamiento, 5 contra 5…" /></div>
          <div className="campo" style={{ margin: 0 }}><label htmlFor="gr-tamano">Jugadores por grupo</label>
            <select id="gr-tamano" value={tamano} onChange={(e) => setTamano(Number(e.target.value))}>{[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
          <button type="button" className="boton boton-contorno" onClick={pedirSugerencia} disabled={pendiente}>Sugerir grupos</button>
        </div>
        <p className="pequeno suave" style={{ margin: 0 }} data-testid="gr-domingo">
          {d.domingo ? `La sugerencia junta a los que juegan juntos el domingo ${+d.domingo.fecha.slice(8)} (${d.domingo.fuente === "aprobada" ? "convocatoria aprobada" : "propuesta del motor, aún sin aprobar"}); quien no juega completa los grupos más cortos.` : "No hay partido el domingo: la sugerencia hace un reparto equilibrado."}
          {" "}Los grupos no cuentan para nada más (ni asistencia, ni rotación, ni estadísticas).
        </p>
        {mensaje && <div className={`aviso ${mensaje.ok ? "aviso-ok" : "aviso-error"}`} role={mensaje.ok ? "status" : "alert"} style={{ margin: 0 }}>{mensaje.texto}</div>}
      </section>

      <div className="gr-grupos">
        {grupos.map((g, i) => (
          <section key={i} className="gr-grupo" aria-label={g.nombre} data-testid="grupo" {...soltar(i)}>
            <div className="gr-grupo-cab">
              <label className="solo-lectores" htmlFor={`gr-g-${i}`}>Nombre del grupo {i + 1}</label>
              <input id={`gr-g-${i}`} type="text" value={g.nombre} maxLength={40} onChange={(e) => setGrupos((gs) => gs.map((x, k) => (k === i ? { ...x, nombre: e.target.value } : x)))} />
              <span className="cifra suave">{g.personas.length}</span>
              <button type="button" className="tb-todos" onClick={() => setGrupos((gs) => gs.filter((_, k) => k !== i))}>Quitar grupo</button>
            </div>
            {g.explica && <p className="pequeno suave gr-explica">{g.explica}</p>}
            <ul className="tb-lista">{g.personas.map((p) => persona(p, !d.van.includes(p) ? (d.duda.includes(p) ? "duda" : "no ha dicho voy") : undefined))}</ul>
            {!g.personas.length && <p className="pequeno suave">Vacío: mueve aquí a quien quieras.</p>}
          </section>
        ))}
        <button type="button" className="boton boton-claro gr-anadir" onClick={() => setGrupos((gs) => [...gs, { nombre: `Grupo ${gs.length + 1}`, personas: [] }])}>+ Añadir grupo</button>
      </div>

      <div className="gr-pool">
        <section className="gr-grupo gr-sin" aria-labelledby="t-sin" {...soltar(FUERA)}>
          <h2 id="t-sin" style={{ fontSize: 18 }}>Van sin grupo · {sinGrupo.length}</h2>
          <ul className="tb-lista">{sinGrupo.map((p) => persona(p))}</ul>
          {!sinGrupo.length && <p className="pequeno suave">Todos los que van tienen grupo.</p>}
        </section>
        <section className="gr-grupo gr-dudas" aria-labelledby="t-dudas">
          <h2 id="t-dudas" style={{ fontSize: 18 }}>Dudan · {dudas.length}</h2>
          <p className="pequeno suave" style={{ margin: 0 }}>Aparte: añádelos a mano si vienen.</p>
          <ul className="tb-lista">{dudas.map((p) => persona(p, "duda"))}</ul>
        </section>
      </div>

      <section className="gs-bloque" aria-label="Guardar y publicar">
        <div className="botones" style={{ margin: 0 }}>
          <button type="button" className="boton boton-amarillo" onClick={guardar} disabled={pendiente}>{idActual ? "Guardar reparto" : "Guardar como reparto nuevo"}</button>
          {idActual && <button type="button" className="boton boton-claro" disabled={pendiente} onClick={() => hacer(async () => { const r = await duplicarReparto(d.evento.id, idActual); if (!r.ok) setMensaje({ ok: false, texto: r.error }); else { setMensaje({ ok: true, texto: "Reparto duplicado." }); router.refresh(); } })}>Duplicar</button>}
          {idActual && <ConfirmarEnPagina texto="Borrar reparto" pregunta="¿Borrar este reparto? Si estaba publicado, deja de verse." si="Sí, borrar" accion={async () => { const r = await borrarReparto(d.evento.id, idActual); if (r.ok) { router.refresh(); cargar(null); } return r; }} />}
        </div>
        {idActual && (
          <label className="pl-recordar" data-testid="publicar">
            <input type="checkbox" checked={Boolean(actual?.publicado)} disabled={pendiente}
              onChange={(e) => hacer(async () => { const r = await publicarReparto(d.evento.id, idActual, e.target.checked); if (!r.ok) setMensaje({ ok: false, texto: r.error }); else router.refresh(); })} />
            Publicar a la plantilla <span className="suave">(cada jugador ve solo el nombre de su grupo y sus compañeros; nunca niveles ni el criterio)</span>
          </label>
        )}
        <div className="botones" style={{ margin: 0 }}>
          <button type="button" className="boton boton-claro" onClick={async () => { try { await navigator.clipboard.writeText(textoWhatsApp); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { /* sin portapapeles */ } }}>{copiado ? "Mensaje copiado" : "Copiar mensaje de WhatsApp"}</button>
        </div>
        <pre className="gr-mensaje" data-testid="mensaje-grupos">{textoWhatsApp}</pre>
      </section>

      <div className="tb-barra" role="region" aria-label="Mover la selección" hidden={sel.size === 0}>
        <span className="tb-n"><b className="cifra">{sel.size}</b> {sel.size === 1 ? "seleccionado" : "seleccionados"}</span>
        <label className="tb-nota">Mover {sel.size} a
          <select value={destino} onChange={(e) => setDestino(Number(e.target.value))}>
            {grupos.map((g, i) => <option key={i} value={i}>{g.nombre}</option>)}
            <option value={FUERA}>Sin grupo</option>
          </select>
        </label>
        <button type="button" className="boton boton-amarillo" onClick={() => mover([...sel], destino)}>Mover</button>
        <button type="button" className="boton boton-claro" onClick={() => setSel(new Set())}>Quitar selección</button>
      </div>
    </div>
  );
}
