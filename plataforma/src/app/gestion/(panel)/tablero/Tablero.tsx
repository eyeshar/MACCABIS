"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { Convocatoria, Equipo, RespuestaPartido } from "@/lib/convocatoria/motor";
import { MOTIVOS, TEXTO_MOTIVO, type Motivo } from "@/lib/eventos/dominio";
import {
  agrupar, celda, convocarGrupo, doblaEn, marcaDuda, MODOS, noVaANinguno, quitarGrupo, resumenEquipos, TEXTO_CELDA,
  type Bloque, type FilaTablero, type ModoAgrupar,
} from "@/lib/tablero/vista";
import type { OpcionSelector, TableroDomingo, TableroEvento } from "@/lib/tablero/datos";
import { proyeccionDe, textoBajoMinimo, textoCorreccion, textoFactor, textoProyeccion, textoRival } from "@/lib/convocatoria/proyeccion";
import BloqueImportacion from "@/components/gestion/BloqueImportacion";
import { cambiarConvocatoria, deshacerRespuestas, responderTablero, restaurarConvocatoria } from "./acciones";

const CLAVE_AGRUPAR = "maccabis:tablero-agrupar";
const TEXTO_POS: Record<string, string> = { base: "Base", escolta: "Escolta", alero: "Alero", ala_pivot: "Ala-pívot", pivot: "Pívot" };
type Ultimo = { tipo: "conv"; antes: Convocatoria; texto: string } | { tipo: "resp"; registros: string[]; texto: string } | null;
type Accion = "MdA" | "MdL" | "quitar" | "va" | "duda" | "no";

function Selector({ opciones, actual }: { opciones: OpcionSelector[]; actual: string }) {
  const router = useRouter();
  return (
    <div className="tb-selector">
      <label htmlFor="tb-ver">Ver</label>
      <select id="tb-ver" value={actual} onChange={(e) => { const [t, v] = e.target.value.split(":"); router.push(`/gestion/tablero?${t}=${v}`); }}>
        {(["Domingos de partidos", "Eventos sueltos"] as const).map((g) => (
          <optgroup key={g} label={g}>{opciones.filter((o) => o.grupo === g).map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}</optgroup>
        ))}
      </select>
    </div>
  );
}

function Agrupar({ modo, cambiar }: { modo: ModoAgrupar; cambiar: (m: ModoAgrupar) => void }) {
  return (
    <div className="tb-agrupar" role="group" aria-label="Agrupar por">
      <span>Agrupar por</span>
      {MODOS.map((m) => <button key={m.id} type="button" className={`tb-chip${modo === m.id ? " activo" : ""}`} aria-pressed={modo === m.id} onClick={() => cambiar(m.id)}>{m.texto}</button>)}
    </div>
  );
}

function Jugador({ f, conv, dobla }: { f: FilaTablero; conv?: Convocatoria; dobla?: boolean }) {
  return (
    <span className="tb-jugador">
      <b>{f.nombre}</b>
      <small>
        {f.posicion ? TEXTO_POS[f.posicion] : "sin posición"}
        {f.base_reserva && <span className="tb-marca">base de reserva</span>}
        {dobla && conv && <span className="tb-marca tb-dobla">dobla</span>}
        {f.solo_entreno && <span className="tb-marca">solo entreno</span>}
      </small>
    </span>
  );
}

export default function Tablero({ datos, opciones, actual }: { datos: TableroDomingo | TableroEvento; opciones: OpcionSelector[]; actual: string }) {
  const router = useRouter();
  const [modo, setModo] = useState<ModoAgrupar>("posicion");
  const [conv, setConv] = useState<Convocatoria>(datos.vista === "domingo" ? datos.conv : {});
  const [filas, setFilas] = useState<FilaTablero[]>(datos.filas);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [motivo, setMotivo] = useState<Motivo | null>(null);
  const [pidiendoMotivo, setPidiendoMotivo] = useState<string[] | null>(null);
  const [nota, setNota] = useState("ajuste manual");
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ultimo, setUltimo] = useState<Ultimo>(null);
  const [pestana, setPestana] = useState<"va" | "duda" | "no">("va");
  const [pendiente, empezar] = useTransition();

  useEffect(() => { try { const m = localStorage.getItem(CLAVE_AGRUPAR) as ModoAgrupar | null; if (m && MODOS.some((x) => x.id === m)) setModo(m); } catch { /* sin almacenamiento */ } }, []);
  useEffect(() => { setFilas(datos.filas); if (datos.vista === "domingo") setConv(datos.conv); }, [datos]);
  const cambiarModo = (m: ModoAgrupar) => { setModo(m); try { localStorage.setItem(CLAVE_AGRUPAR, m); } catch { /* no pasa nada */ } };
  const nombres = useMemo(() => new Map(filas.map((f) => [f.person_id, f.nombre])), [filas]);
  const lista = (ids: string[]) => ids.map((i) => nombres.get(i) ?? i).join(", ");
  const alternar = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const todosDe = (ids: string[]) => setSel((s) => { const n = new Set(s); const todos = ids.every((i) => n.has(i)); for (const i of ids) { if (todos) n.delete(i); else n.add(i); } return n; });

  // ------------------------------------------------------------ cambios
  const juegan: Equipo[] = datos.vista === "domingo" ? datos.partidos.map((p) => p.equipo) : [];
  async function convocar(ids: string[], equipo: Equipo | null, accion: "anadir" | "quitar") {
    if (datos.vista !== "domingo") return;
    const antes = conv;
    const r = accion === "anadir" ? convocarGrupo(conv, equipo!, filas, ids) : quitarGrupo(conv, ids, equipo ?? undefined);
    const afectados = accion === "anadir" ? (r as { anadidos: string[] }).anadidos : (r as { quitados: string[] }).quitados;
    if (!afectados.length) { setMensaje({ ok: false, texto: accion === "anadir" ? `Nadie de la selección está disponible para el ${equipo}.` : "Nadie de la selección estaba convocado." }); return; }
    setConv(r.conv);
    const res = await cambiarConvocatoria(datos.fecha, { accion, equipo, personas: afectados, nota });
    if (!res.ok) { setConv(antes); setMensaje({ ok: false, texto: res.error }); return; }
    const texto = accion === "anadir" ? `Convocados al ${equipo}: ${lista(afectados)}.` : `Quitada la convocatoria: ${lista(afectados)}.`;
    setUltimo({ tipo: "conv", antes, texto });
    setMensaje({ ok: true, texto: `${texto}${res.aviso ? ` ${res.aviso}` : ""}` });
    setSel(new Set());
    router.refresh();
  }
  async function responder(ids: string[], r: "va" | "duda" | "no", m: Motivo | null) {
    const eventos = datos.vista === "domingo"
      ? datos.partidos.map((p) => ({ id: p.evento_id, personas: ids.filter((id) => filas.find((f) => f.person_id === id)?.invitadoA.includes(p.equipo)) }))
      : [{ id: datos.evento.id, personas: ids }];
    const antes = filas;
    setFilas((fs) => fs.map((f) => (ids.includes(f.person_id) ? { ...f, respuesta: Object.fromEntries(f.invitadoA.map((e) => [e, r])) as FilaTablero["respuesta"], motivo: r === "no" && m ? TEXTO_MOTIVO[m] : null } : f)));
    const res = await responderTablero(eventos, r, m);
    if (!res.ok) { setFilas(antes); setMensaje({ ok: false, texto: res.error }); return; }
    const texto = `${r === "va" ? "Van" : r === "duda" ? "Duda" : "No van"}: ${lista(ids)} (puesta por ti).`;
    setUltimo({ tipo: "resp", registros: res.registros ?? [], texto });
    setMensaje({ ok: true, texto });
    setSel(new Set()); setPidiendoMotivo(null); setMotivo(null);
    router.refresh();
  }
  const ejecutar = (a: Accion, ids: string[]) => empezar(async () => {
    setMensaje(null);
    if (!ids.length) return;
    if (a === "MdA" || a === "MdL") return convocar(ids, a, "anadir");
    if (a === "quitar") return convocar(ids, null, "quitar");
    if (a === "no") { setPidiendoMotivo(ids); return; }
    return responder(ids, a, null);
  });
  const deshacer = () => empezar(async () => {
    if (!ultimo) return;
    const r = ultimo.tipo === "conv" && datos.vista === "domingo" ? await restaurarConvocatoria(datos.fecha, ultimo.antes) : ultimo.tipo === "resp" ? await deshacerRespuestas(ultimo.registros) : null;
    if (r && !r.ok) { setMensaje({ ok: false, texto: r.error }); return; }
    if (ultimo.tipo === "conv") setConv(ultimo.antes);
    setMensaje({ ok: true, texto: `Deshecho: ${ultimo.texto}` });
    setUltimo(null);
    router.refresh();
  });

  // ------------------------------------------------------------ arrastrar y soltar (escritorio; nunca la unica forma)
  const alArrastrar = (id: string) => (e: React.DragEvent) => { const ids = sel.has(id) ? [...sel] : [id]; e.dataTransfer.setData("text/plain", JSON.stringify(ids)); e.dataTransfer.effectAllowed = "move"; };
  const destino = (a: Accion) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.currentTarget.classList.add("tb-encima"); },
    onDragLeave: (e: React.DragEvent) => e.currentTarget.classList.remove("tb-encima"),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); e.currentTarget.classList.remove("tb-encima"); try { ejecutar(a, JSON.parse(e.dataTransfer.getData("text/plain"))); } catch { /* nada */ } },
  });

  const barra = (
    <div className="tb-barra" role="region" aria-label="Acciones con la selección" data-testid="barra-acciones" hidden={sel.size === 0 && !pidiendoMotivo}>
      {pidiendoMotivo ? (
        <div className="tb-motivo" role="group" aria-label="Motivo de «No van»">
          <span>Motivo para {pidiendoMotivo.length === 1 ? lista(pidiendoMotivo) : `${pidiendoMotivo.length} jugadores`}:</span>
          {MOTIVOS.map((m) => <label key={m} className={`tb-chip${motivo === m ? " activo" : ""}`}><input type="radio" name="tb-motivo" value={m} checked={motivo === m} onChange={() => setMotivo(m)} />{TEXTO_MOTIVO[m]}</label>)}
          <button type="button" className="boton boton-peligro" disabled={!motivo || pendiente} onClick={() => empezar(() => responder(pidiendoMotivo, "no", motivo))}>Guardar «No van»</button>
          <button type="button" className="boton boton-claro" onClick={() => { setPidiendoMotivo(null); setMotivo(null); }}>Cancelar</button>
        </div>
      ) : (
        <>
          <span className="tb-n"><b className="cifra">{sel.size}</b> {sel.size === 1 ? "seleccionado" : "seleccionados"}</span>
          {datos.vista === "domingo" ? (
            <>
              {juegan.map((e) => <button key={e} type="button" className={`boton tb-al tb-al-${e}`} disabled={pendiente} onClick={() => ejecutar(e, [...sel])}>Al {e}</button>)}
              <button type="button" className="boton boton-claro" disabled={pendiente} onClick={() => ejecutar("quitar", [...sel])}>Quitar convocatoria</button>
              <button type="button" className="boton boton-peligro" disabled={pendiente} onClick={() => ejecutar("no", [...sel])}>No van</button>
            </>
          ) : (
            <>
              <button type="button" className="boton tb-va" disabled={pendiente} onClick={() => ejecutar("va", [...sel])}>Van</button>
              <button type="button" className="boton boton-claro" disabled={pendiente} onClick={() => ejecutar("duda", [...sel])}>Duda</button>
              <button type="button" className="boton boton-peligro" disabled={pendiente} onClick={() => ejecutar("no", [...sel])}>No van</button>
            </>
          )}
          <button type="button" className="boton boton-claro" onClick={() => setSel(new Set())}>Quitar selección</button>
          {datos.vista === "domingo" && (
            <label className="tb-nota">Motivo<input type="text" value={nota} maxLength={80} onChange={(e) => setNota(e.target.value)} /></label>
          )}
        </>
      )}
    </div>
  );

  const avisoEstado = mensaje && (
    <div className={`aviso ${mensaje.ok ? "aviso-ok" : "aviso-error"} tb-mensaje`} role={mensaje.ok ? "status" : "alert"} data-testid="tb-mensaje">
      <span>{mensaje.texto}</span>
      {mensaje.ok && ultimo && <button type="button" className="boton boton-claro" onClick={deshacer} disabled={pendiente}>Deshacer</button>}
    </div>
  );

  const registro = (
    <section className="gs-bloque tb-registro" aria-labelledby="t-registro" data-testid="registro-cambios">
      <h2 id="t-registro" style={{ fontSize: 20 }}>Registro de cambios</h2>
      {datos.registro.length ? <ul className="gs-pendientes">{datos.registro.map((r) => <li key={r.id}><span><b>{r.por}</b> · {new Date(r.en).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}<br /><span className="suave">{r.texto}</span></span></li>)}</ul>
        : <p className="suave pequeno" style={{ margin: 0 }}>Aún no hay cambios hechos aquí.</p>}
    </section>
  );

  // ------------------------------------------------------------ DOMINGO DE PARTIDOS
  if (datos.vista === "domingo") {
    const juegan2 = juegan;
    const arriba = filas.filter((f) => !noVaANinguno(f, juegan2));
    const abajo = filas.filter((f) => noVaANinguno(f, juegan2));
    const sinConvocar = arriba.filter((f) => !juegan2.some((e) => (conv[e] ?? []).some((c) => c.person_id === f.person_id))).length;
    const resumen = resumenEquipos(datos.entrada, conv, datos.partidos);
    const ESTADO = { sin: "Sin convocatoria todavía", borrador: "Borrador", aprobada: "Aprobada", cambiada: "Aprobada · cambiada (salidas pendientes)" };
    const filaArriba = (f: FilaTablero) => {
      const marca = marcaDuda(f, juegan2);
      const dobla = doblaEn(f, conv);
      return (
        <tr key={f.person_id} draggable onDragStart={alArrastrar(f.person_id)} className={sel.has(f.person_id) ? "tb-sel" : undefined} data-person={f.person_id}>
          <th scope="row" className="tb-fijo">
            <label className="tb-casilla"><input type="checkbox" checked={sel.has(f.person_id)} onChange={() => alternar(f.person_id)} aria-label={`Seleccionar a ${f.nombre}`} /></label>
            <Jugador f={f} conv={conv} dobla={dobla} />
          </th>
          {datos.partidos.map((p) => {
            const c = celda(f, p.equipo, conv, juegan2);
            const activa = c === "convocado" || c === "convocar";
            return (
              <td key={p.equipo} data-label={p.equipo}>
                <button type="button" className={`tb-celda tb-c-${c} tb-eq-${p.equipo}`} disabled={!activa || pendiente} aria-pressed={c === "convocado"}
                  aria-label={`${TEXTO_CELDA[c]} · ${f.nombre} · ${p.equipo}`} data-celda={c}
                  onClick={() => (c === "convocado" ? empezar(() => convocar([f.person_id], p.equipo, "quitar")) : ejecutar(p.equipo, [f.person_id]))}>{TEXTO_CELDA[c]}</button>
              </td>
            );
          })}
          <td data-label="Duda o sin responder">{marca ? <span className="tb-duda">{marca}</span> : <span className="suave">—</span>}</td>
        </tr>
      );
    };
    const filaAbajo = (f: FilaTablero) => (
      <tr key={f.person_id} draggable onDragStart={alArrastrar(f.person_id)} className={sel.has(f.person_id) ? "tb-sel" : undefined} data-person={f.person_id}>
        <th scope="row" className="tb-fijo">
          <label className="tb-casilla"><input type="checkbox" checked={sel.has(f.person_id)} onChange={() => alternar(f.person_id)} aria-label={`Seleccionar a ${f.nombre}`} /></label>
          <Jugador f={f} />
        </th>
        {datos.partidos.map((p) => <td key={p.equipo} data-label={p.equipo}><span className={`tb-celda tb-c-${f.ficha[p.equipo] && f.invitadoA.includes(p.equipo) ? "no_va" : "sin_ficha"}`}>{f.ficha[p.equipo] && f.invitadoA.includes(p.equipo) ? "No va" : "Sin ficha"}</span></td>)}
        <td data-label="Motivo">{f.motivo ?? "—"}{f.ausencia && <small className="tb-ausencia">{f.ausencia}</small>}</td>
      </tr>
    );
    const tabla = (bloques: Bloque[], fila: (f: FilaTablero) => React.ReactNode, ultima: string, testid: string) => (
      <div className="tb-caja" data-testid={testid}>
        <table className="tb-tabla">
          <thead><tr><th scope="col" className="tb-fijo">Jugador</th>{datos.partidos.map((p) => <th key={p.equipo} scope="col">{p.equipo} · {p.inicio ?? "¿?"}</th>)}<th scope="col">{ultima}</th></tr></thead>
          {bloques.map((b) => (
            <tbody key={b.clave} data-bloque={b.clave}>
              <tr className="tb-bloque"><th colSpan={datos.partidos.length + 2} scope="colgroup" className="tb-fijo">
                <span>{b.titulo} <span className="cifra suave">({b.filas.length})</span></span>
                <button type="button" className="tb-todos" onClick={() => todosDe(b.filas.map((f) => f.person_id))}>{b.filas.every((f) => sel.has(f.person_id)) ? "Quitar todos" : "Seleccionar todos"}</button>
              </th></tr>
              {b.filas.map(fila)}
            </tbody>
          ))}
        </table>
      </div>
    );
    return (
      <div className="tb" data-vista="domingo">
        <div className="gs-titulo">
          <div>
            <div className="gs-eyebrow">Tablero · domingo de partidos</div>
            <h1>J{datos.jornada ?? "?"} · {new Date(`${datos.fecha}T12:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })}</h1>
            <span className="suave">Convocatoria: <b data-testid="estado-convocatoria">{ESTADO[datos.estado]}</b> · <Link href={`/gestion/convocatoria?fecha=${datos.fecha}`}>Abrir la convocatoria</Link></span>
          </div>
          <Selector opciones={opciones} actual={actual} />
        </div>
        {avisoEstado}
        {!datos.encendido && <BloqueImportacion estado={datos.importacion} />}
        <div className="tb-resumenes">
          {resumen.map((r) => {
            const pr = proyeccionDe(datos.proyeccion, r.equipo, (conv[r.equipo] ?? []).map((c) => ({ person_id: c.person_id, nombre: nombres.get(c.person_id) ?? c.person_id })), datos.partidos.find((p) => p.equipo === r.equipo)?.dificultad);
            const avisos = pr?.bajoMinimo ? [...r.avisos, textoBajoMinimo(pr)] : r.avisos;
            return (
            <section key={r.equipo} className="tb-resumen" data-equipo={r.equipo} data-testid={`resumen-${r.equipo}`} aria-label={`Resumen ${r.equipo}`} {...destino(r.equipo)}>
              <div className="tb-resumen-cab"><span className={`chip-eq chip-${r.equipo === "MdA" ? "MDA" : "MDL"}`}>{r.equipo}</span><span>{r.rival} · {r.inicio ?? "hora por confirmar"}</span></div>
              <p className="tb-cifras"><b className="cifra">{r.total}</b> convocados · {r.bases} {r.bases === 1 ? "base" : "bases"}{r.basesReserva ? ` + ${r.basesReserva} de reserva` : ""} · {r.exteriores} ext. · {r.interiores} int.</p>
              {pr && (
                <div className="tb-proyeccion" data-testid={`proyeccion-${r.equipo}`}>
                  <p><b>{textoProyeccion(pr)}</b>{pr.notaRival ? ` · ${pr.notaRival}` : ""}{pr.pocosDatos ? ` · ${pr.pocosDatos} con pocos datos` : ""}</p>
                  <p className="suave">{textoRival(pr)}.</p>
                  {pr.aportes.length > 0 && (
                    <details><summary>Quién aporta</summary>
                      <p className="suave" data-testid={`factor-${r.equipo}`}>{textoFactor(pr)}{textoCorreccion(pr) ? ` · ${textoCorreccion(pr)}` : ""}.</p>
                      <ul>{pr.aportes.map((a) => <li key={a.person_id}>{a.nombre}{a.pocosDatos ? " (pocos datos)" : ""}: <span className="cifra">{a.puntos.toLocaleString("es-ES")}</span></li>)}</ul>
                    </details>
                  )}
                </div>
              )}
              {avisos.length > 0 && <ul className="tb-avisos">{avisos.map((a) => <li key={a}>{a}</li>)}</ul>}
              <span className="tb-soltar">Suelta aquí para convocar al {r.equipo}</span>
            </section>
            );
          })}
        </div>
        <Agrupar modo={modo} cambiar={cambiarModo} />
        <section aria-labelledby="t-juegan" className="tb-seccion">
          <h2 id="t-juegan" className="tb-h2">Juegan (<span data-testid="n-juegan">{arriba.length}</span>) · <span data-testid="n-sin-convocar">{sinConvocar}</span> sin convocar</h2>
          {tabla(agrupar(arriba, modo, conv), filaArriba, "Duda o sin responder", "tabla-juegan")}
        </section>
        <section aria-labelledby="t-novan" className="tb-seccion" {...destino("no")}>
          <h2 id="t-novan" className="tb-h2">No van ({abajo.length})</h2>
          {abajo.length ? tabla(agrupar(abajo, modo, conv), filaAbajo, "Motivo o ausencia", "tabla-novan") : <p className="suave">Nadie ha dicho que no a todos sus partidos.</p>}
        </section>
        {registro}
        {barra}
      </div>
    );
  }

  // ------------------------------------------------------------ EVENTO SUELTO: Van · Duda o sin responder · No van
  const col = (r: RespuestaPartido) => (r === "va" ? "va" : r === "no" ? "no" : "duda");
  const cols = { va: filas.filter((f) => col(f.respuesta.evento ?? "sin_responder") === "va"), duda: filas.filter((f) => col(f.respuesta.evento ?? "sin_responder") === "duda"), no: filas.filter((f) => col(f.respuesta.evento ?? "sin_responder") === "no") };
  const TITULO = { va: "Van", duda: "Duda o sin responder", no: "No van" } as const;
  return (
    <div className="tb" data-vista="evento">
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow">Tablero · evento</div>
          <h1>{datos.evento.titulo}</h1>
          <span className="suave">{new Date(`${datos.evento.fecha}T12:00:00Z`).toLocaleDateString("es-ES", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })}{datos.evento.inicio ? ` · ${datos.evento.inicio.slice(0, 5)}` : ""}{!datos.encendido ? " · fase puente: lo que cambies aquí queda «puesto por ti» y una importación de SportEasy no lo pisa" : ""}</span>
        </div>
        <Selector opciones={opciones} actual={actual} />
      </div>
      {avisoEstado}
      <Agrupar modo={modo} cambiar={cambiarModo} />
      <div className="tb-pestanas" role="tablist" aria-label="Respuestas">
        {(["va", "duda", "no"] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={pestana === k} className={`tb-pestana tb-p-${k}`} onClick={() => setPestana(k)}><span>{TITULO[k]}</span><b className="cifra">{cols[k].length}</b></button>)}
      </div>
      <div className="tb-columnas">
        {(["va", "duda", "no"] as const).map((k) => (
          <section key={k} className={`tb-columna tb-col-${k}${pestana === k ? " visible" : ""}`} aria-labelledby={`t-col-${k}`} data-testid={`columna-${k}`} {...destino(k)}>
            <div className="tb-columna-cab"><h2 id={`t-col-${k}`}>{TITULO[k]} <span className="cifra">{cols[k].length}</span></h2>
              {cols[k].length > 0 && <button type="button" className="tb-todos" onClick={() => todosDe(cols[k].map((f) => f.person_id))}>{cols[k].every((f) => sel.has(f.person_id)) ? "Quitar todos" : "Seleccionar todos"}</button>}</div>
            {agrupar(cols[k], modo, {}, "evento").map((b) => (
              <div key={b.clave} className="tb-grupo" data-bloque={b.clave}>
                {modo !== "nombre" && <h3>{b.titulo} <span className="cifra suave">({b.filas.length})</span></h3>}
                <ul className="tb-lista">
                  {b.filas.map((f) => (
                    <li key={f.person_id} draggable onDragStart={alArrastrar(f.person_id)} className={sel.has(f.person_id) ? "tb-sel" : undefined} data-person={f.person_id}>
                      <label className="tb-casilla"><input type="checkbox" checked={sel.has(f.person_id)} onChange={() => alternar(f.person_id)} aria-label={`Seleccionar a ${f.nombre}`} /></label>
                      <Jugador f={f} />
                      <span className="tb-detalle">
                        {k === "duda" && <small>{f.respuesta.evento === "duda" ? "Duda" : "Sin responder"}</small>}
                        {k === "no" && (f.motivo || f.ausencia) && <small>{f.motivo ?? f.ausencia}</small>}
                        {f.puestaPor && <small className="tenue">puesta por {f.puestaPor}</small>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!cols[k].length && <p className="suave pequeno">Nadie.</p>}
          </section>
        ))}
      </div>
      {registro}
      {barra}
    </div>
  );
}
