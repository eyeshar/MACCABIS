"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  LINEA_DE, POSICIONES, REGLAS, TEXTO_DIFICULTAD, TEXTO_POSICION, proponer, revisar, textoNivelMedio,
  type Aviso, type Convocatoria as Conv, type Dificultad, type Equipo, type Posicion, type Recuento,
} from "@/lib/convocatoria/motor";
import { entradaDe, type Contexto, type JugadorVista, type PartidoVista } from "@/lib/convocatoria/vista";
import { cruce, diaTexto } from "@/lib/convocatoria/mensajes";
import { aprobar, cambiarDificultad, empezar, guardarCambio, type Accion, type Motivo } from "./acciones";

// Convocatoria del domingo (D107): cabecera con contadores, una tarjeta por equipo que juega, disponibles sin convocar y
// las hojas «Cambiar a mano» y «Añadir jugador». El recuento y los avisos se recalculan al momento con el motor
// (revisar); la propuesta solo se rehace con «Recalcular propuesta». Solo gestores (layout del panel).

const MOTIVOS: { id: Motivo; texto: string }[] = [
  { id: "rotacion", texto: "Rotación" }, { id: "rival", texto: "Rival" }, { id: "lesion", texto: "Lesión" },
  { id: "equilibrar", texto: "Equilibrar" }, { id: "pedido", texto: "Lo ha pedido" }, { id: "otro", texto: "Otro" },
];
const TEXTO_RESP = { va: "Va", duda: "Duda", no: "No va", sin_responder: "Sin responder" } as const;
const TEXTO_MOTIVO_NO: Record<string, string> = { lesion: "lesión", trabajo: "trabajo", viaje: "viaje", familia: "familia", otro: "otro", horario: "solo puede al otro" };
const otro = (e: Equipo): Equipo => (e === "MdA" ? "MdL" : "MdA");
const ids = (c: Conv, e: Equipo) => new Set((c[e] ?? []).map((x) => x.person_id));

function Casillas({ r, testid }: { r: Recuento; testid?: string }) {
  return (
    <div className="cv-casillas" data-testid={testid}>
      <div className={`cv-casilla cv-${r.bases.estado}`}><b>{r.bases.texto}</b><span>bases</span></div>
      <div className={`cv-casilla cv-${r.exteriores.estado}`}><b>{r.exteriores.texto}</b><span>exteriores</span></div>
      <div className={`cv-casilla cv-${r.interiores.estado}`}><b>{r.interiores.texto}</b><span>interiores</span></div>
    </div>
  );
}

function ListaAvisos({ avisos, nombre }: { avisos: Aviso[]; nombre?: string }) {
  if (!avisos.length) return <p className="pequeno suave cv-sin-avisos">Sin avisos.</p>;
  return (
    <ul className="cv-avisos" aria-label={nombre ? `Avisos del ${nombre}` : "Avisos"}>
      {avisos.map((a, i) => (
        <li key={`${a.regla}-${a.person_id ?? ""}-${i}`} className={`cv-aviso cv-aviso-${a.gravedad}`}>
          <span>{a.texto}</span>
          <small title={REGLAS[a.regla]}>Regla {a.regla} · {REGLAS[a.regla]}</small>
        </li>
      ))}
    </ul>
  );
}

/** Estado de un jugador para un partido: «Va», «No va · trabajo», «Sin responder», «Sin ficha del MdL»… */
function estadoPara(j: JugadorVista, e: Equipo) {
  if (!j.ficha[e]) return { texto: `Sin ficha del ${e}`, clase: "no" };
  if (j.sancionado) return { texto: `Sancionado (hasta la J${j.sancionHasta})`, clase: "no" };
  const r = j.respuesta[e] ?? "sin_responder";
  const m = r === "no" && j.motivoNo[e] ? ` · ${TEXTO_MOTIVO_NO[j.motivoNo[e]!] ?? j.motivoNo[e]}` : "";
  return { texto: `${TEXTO_RESP[r]}${m}`, clase: r === "va" ? "ok" : r === "no" ? "no" : r === "duda" ? "duda" : "sin" };
}

type Hoja = { tipo: "cambiar"; person_id: string; equipo: Equipo } | { tipo: "anadir"; equipo: Equipo; person_id?: string } | null;

export default function Convocatoria({ ctx }: { ctx: Contexto }) {
  const router = useRouter();
  const [pendiente, empezarTransicion] = useTransition();
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [hoja, setHoja] = useState<Hoja>(null);
  const entrada = useMemo(() => entradaDe(ctx), [ctx]);
  const propuesta = useMemo(() => proponer(entrada), [entrada]);
  const fila = ctx.convocatoria;
  const empezada = !!fila?.origen;
  const conv: Conv = empezada ? fila!.equipos : propuesta.convocatoria;
  const rev = useMemo(() => (empezada ? revisar(entrada, conv, undefined) : propuesta), [empezada, entrada, conv, propuesta]);
  const porId = useMemo(() => new Map(ctx.jugadores.map((j) => [j.person_id, j])), [ctx.jugadores]);
  const nombre = (id: string) => porId.get(id)?.nombre ?? id;
  const bloqueado = ctx.sinMigracion || pendiente;
  const mismaHora = rev.mismaHora;
  // Los motivos de «sin convocar» de la propuesta (tope, solo entreno…) siguen valiendo tras editar a mano.
  const sinConvocar = useMemo(() => {
    const motivo = new Map(propuesta.sinConvocar.map((s) => [s.person_id, s]));
    return rev.sinConvocar.map((s) => (s.motivo === "No convocado a mano" && motivo.get(s.person_id)) || s);
  }, [rev.sinConvocar, propuesta.sinConvocar]);

  const correr = (f: () => Promise<{ ok: boolean; error?: string; texto?: string }>, despues?: { cerrar?: boolean; ir?: string }) => empezarTransicion(async () => {
    const r = await f();
    if (!r.ok) { setMensaje({ ok: false, texto: r.error ?? "No se pudo guardar." }); return; }
    setMensaje(r.texto ? { ok: true, texto: r.texto } : null);
    if (despues?.cerrar) setHoja(null);
    if (despues?.ir) router.push(despues.ir); else router.refresh();
  });

  const generales = rev.avisos.filter((a) => !a.equipo);

  return (
    <>
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow">Convocatoria · <Link href="/gestion/convocatoria/datos">Datos de los jugadores</Link></div>
          <h1>{ctx.jornada ? `Jornada ${ctx.jornada}` : "Convocatoria"}</h1>
          <span className="suave" data-testid="cv-fecha">{diaTexto(ctx.fecha)[0].toUpperCase() + diaTexto(ctx.fecha).slice(1)} · {ctx.partidos.length === 1 ? `solo juega el ${ctx.partidos[0].equipo}` : mismaHora ? "los dos a la misma hora" : "MdA y MdL"}</span>
        </div>
        <div className="ev-botones">
          {fila && (
            <span className={`pastilla ${fila.estado === "aprobada" ? "pastilla-ok" : "pastilla-pendiente"}`} data-testid="cv-estado">{fila.estado === "aprobada" ? "Aprobada" : "Borrador"}</span>
          )}
          {/* D121: el tablero, para ver de un vistazo quién va y ajustar a mano. */}
          <Link className="boton boton-contorno" href={`/gestion/tablero?domingo=${ctx.fecha}`}>Abrir tablero</Link>
        </div>
      </div>

      {ctx.domingos.length > 1 && (
        <nav className="ev-filtros cv-domingos" aria-label="Domingo">
          {ctx.domingos.map((d) => <Link key={d.fecha} href={`/gestion/convocatoria?fecha=${d.fecha}`} aria-current={d.fecha === ctx.fecha ? "true" : undefined}>{d.jornada ? `J${d.jornada}` : ""} · {d.fecha.slice(8)}/{d.fecha.slice(5, 7)}</Link>)}
        </nav>
      )}

      {ctx.sinMigracion && (
        <div className="ev-aviso" role="alert" data-testid="cv-sin-migracion"><span><b>Falta aplicar la migración de la convocatoria en esta base</b> (staging antes que producción). Se ve la propuesta sin datos privados; todavía no se puede guardar nada.</span></div>
      )}
      {!ctx.sinMigracion && ctx.sinDatosPrivados > 0 && (
        <div className="ev-aviso" role="note" data-testid="cv-faltan-datos"><span><b>{ctx.sinDatosPrivados} {ctx.sinDatosPrivados === 1 ? "jugador invitado no tiene" : "jugadores invitados no tienen"} posición o nivel.</b> Cuentan como exterior de nivel C hasta que los cargues.</span><Link className="boton boton-contorno" href="/gestion/convocatoria/datos">Cargar datos</Link></div>
      )}
      {mensaje && <div className={`aviso ${mensaje.ok ? "aviso-ok" : "aviso-error"}`} role={mensaje.ok ? "status" : "alert"} style={{ marginBottom: 16 }}>{mensaje.texto}</div>}

      <section className="gs-bloque cv-cab" aria-label="Respuestas del domingo">
        <div className="gs-cifras cv-contadores" data-testid="cv-contadores">
          <div><b className="ev-ok">{ctx.contadores.van}</b><span>van</span></div>
          <div><b>{ctx.contadores.sin}</b><span>sin responder{ctx.contadores.dudan ? ` (${ctx.contadores.dudan} duda${ctx.contadores.dudan === 1 ? "" : "n"})` : ""}</span></div>
          <div><b className="ev-no">{ctx.contadores.no}</b><span>no van</span></div>
        </div>
        {!ctx.encendido && (
          <p className="pequeno cv-importacion" data-testid="cv-importacion">
            Fase puente: las respuestas llegan de SportEasy. Última importación: <b>{ctx.ultimaImportacion ? new Date(ctx.ultimaImportacion).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "ninguna"}</b>.
            {ctx.respuestasDelDomingo === 0 && " Para este domingo todavía no hay ninguna respuesta importada."}{" "}
            <Link href="/gestion/eventos/importar?t=respuestas">Importar respuestas →</Link>
          </p>
        )}
        {ctx.eventoRespuestas && <Link href={`/gestion/eventos/${ctx.eventoRespuestas}/respuestas#t-rec`} className="cv-enlace">Recordar a los que no han respondido →</Link>}
        {!empezada ? (
          <div className="cv-empezar">
            <p className="pequeno suave" style={{ margin: 0 }}>Abajo tienes la propuesta del motor (vista previa). Elige cómo empezar:</p>
            <div className="botones" style={{ margin: 0 }}>
              <button type="button" className="boton boton-amarillo" disabled={bloqueado} onClick={() => correr(() => empezar(ctx.fecha, "propuesta"))}>Usar propuesta</button>
              <button type="button" className="boton boton-claro" disabled={bloqueado} onClick={() => correr(() => empezar(ctx.fecha, "blanco"))}>Empezar en blanco (a mano)</button>
            </div>
          </div>
        ) : (
          <div className="botones" style={{ margin: 0 }}>
            <button type="button" className="boton boton-claro" disabled={bloqueado} onClick={() => { if (window.confirm("¿Rehacer la convocatoria con la propuesta del motor? Se pierden los cambios a mano (quedan en el historial).")) correr(() => empezar(ctx.fecha, "recalcular")); }}>Recalcular propuesta</button>
          </div>
        )}
      </section>

      {generales.length > 0 && <section className="gs-bloque" aria-label="Avisos del domingo" style={{ marginBottom: 16 }}><ListaAvisos avisos={generales} /></section>}

      <div className="cv-equipos">
        {ctx.partidos.map((p) => (
          <TarjetaEquipo key={p.equipo} p={p} conv={conv} r={rev.recuento[p.equipo]!} maximo={rev.maximo} avisos={rev.avisos.filter((a) => a.equipo === p.equipo)}
            previa={!empezada} bloqueado={bloqueado} nombre={nombre} porId={porId}
            onDificultad={(v) => correr(() => cambiarDificultad(ctx.fecha, p.equipo, v))}
            onCambiar={(id) => setHoja({ tipo: "cambiar", person_id: id, equipo: p.equipo })}
            onAnadir={() => setHoja({ tipo: "anadir", equipo: p.equipo })} />
        ))}
      </div>

      <section className="gs-bloque" aria-labelledby="t-sinconv" data-testid="cv-sin-convocar" style={{ marginTop: 16 }}>
        <h2 id="t-sinconv">Disponibles sin convocar · {sinConvocar.length}</h2>
        {sinConvocar.length ? (
          <ul className="cv-lista">
            {sinConvocar.map((s) => {
              const j = porId.get(s.person_id);
              return (
                <li key={s.person_id} className="cv-fila">
                  <div className="cv-fila-nombre"><b>{j?.nombre ?? s.person_id}</b><small>{s.motivo} · regla {s.regla}</small></div>
                  {empezada && <button type="button" className="boton boton-contorno cv-boton" disabled={bloqueado} onClick={() => setHoja({ tipo: "anadir", equipo: ctx.partidos.find((x) => j?.respuesta[x.equipo] === "va" && j.ficha[x.equipo])?.equipo ?? ctx.partidos[0].equipo, person_id: s.person_id })}>Añadir</button>}
                </li>
              );
            })}
          </ul>
        ) : <p className="suave" style={{ margin: 0 }}>Todos los disponibles están convocados.</p>}
      </section>

      {empezada && (
        <section className="gs-bloque cv-aprobar" aria-label="Aprobar">
          {fila!.estado === "aprobada" ? (
            <>
              <p style={{ margin: 0 }}>Aprobada{fila!.aprobada_por_nombre ? ` por ${fila!.aprobada_por_nombre}` : ""}. {fila!.whatsapp_estado === "pendiente" || fila!.sporteasy_estado === "pendiente" ? "Hay salidas pendientes." : "WhatsApp y SportEasy al día."}</p>
              <div className="botones" style={{ margin: 0 }}>
                <Link className="boton boton-amarillo" href={`/gestion/convocatoria/salida?fecha=${ctx.fecha}`}>Ver salida (WhatsApp, aviso y SportEasy)</Link>
              </div>
            </>
          ) : (
            <>
              {rev.avisos.some((a) => a.gravedad === "error") && <p className="pequeno ev-no" style={{ margin: 0 }}>Hay avisos en rojo: puedes aprobar igual, decides tú.</p>}
              <button type="button" className="boton boton-amarillo boton-bloque" disabled={bloqueado} onClick={() => correr(() => aprobar(ctx.fecha), { ir: `/gestion/convocatoria/salida?fecha=${ctx.fecha}` })}>Aprobar convocatoria</button>
            </>
          )}
        </section>
      )}

      {ctx.cambios.length > 0 && (
        <details className="gs-bloque cv-historial" style={{ marginTop: 16 }}>
          <summary><b>Historial de cambios · {ctx.cambios.length}</b></summary>
          <ul className="cv-lista">
            {ctx.cambios.map((c) => (
              <li key={c.id} className="pequeno">
                <span className="suave">{new Date(c.en).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {c.por_nombre}:</span>{" "}
                {textoCambio(c, nombre)}
              </li>
            ))}
          </ul>
        </details>
      )}

      {hoja && empezada && (
        <HojaCambio key={`${hoja.tipo}-${hoja.equipo}-${hoja.person_id ?? ""}`} hoja={hoja} ctx={ctx} conv={conv} porId={porId} mismaHora={mismaHora} pendiente={pendiente}
          onCerrar={() => setHoja(null)}
          onGuardar={(nueva, cambio) => correr(() => guardarCambio(ctx.fecha, nueva, cambio), { cerrar: true })}
          error={mensaje && !mensaje.ok ? mensaje.texto : null} />
      )}
    </>
  );
}

const TEXTO_ACCION: Record<string, string> = {
  propuesta: "usa la propuesta", blanco: "empieza en blanco", recalcular: "recalcula la propuesta", mover: "cambia de equipo a", doblar: "hace doblar a",
  quitar: "quita a", anadir: "añade a", posicion: "cambia la posición de", dificultad: "cambia la dificultad", aprobar: "aprueba la convocatoria",
  whatsapp: "copia el mensaje a WhatsApp", sporteasy: "marca SportEasy al día", aviso: "aviso de la web",
};
function textoCambio(c: Contexto["cambios"][number], nombre: (id: string) => string) {
  const motivo = MOTIVOS.find((m) => m.id === c.motivo)?.texto;
  return `${TEXTO_ACCION[c.accion] ?? c.accion}${c.person_id ? ` ${nombre(c.person_id)}` : ""}${c.equipo ? ` (${c.equipo})` : ""}${motivo ? ` · ${motivo}` : ""}${c.nota ? ` · «${c.nota}»` : ""}`;
}

function TarjetaEquipo({ p, conv, r, maximo, avisos, previa, bloqueado, nombre, porId, onDificultad, onCambiar, onAnadir }: {
  p: PartidoVista; conv: Conv; r: Recuento; maximo: number; avisos: Aviso[]; previa: boolean; bloqueado: boolean;
  nombre: (id: string) => string; porId: Map<string, JugadorVista>;
  onDificultad: (v: Dificultad) => void; onCambiar: (id: string) => void; onAnadir: () => void;
}) {
  const lista = conv[p.equipo] ?? [];
  const delOtro = ids(conv, otro(p.equipo));
  const orden = { base: 0, exterior: 1, interior: 2 } as const;
  const filas = lista.map((c) => ({ c, j: porId.get(c.person_id) })).sort((a, b) => {
    const la = a.j?.privado?.posicion || a.c.posicion ? LINEA_DE[(a.c.posicion ?? a.j!.privado!.posicion)!] : "exterior";
    const lb = b.j?.privado?.posicion || b.c.posicion ? LINEA_DE[(b.c.posicion ?? b.j!.privado!.posicion)!] : "exterior";
    return orden[la] - orden[lb] || nombre(a.c.person_id).localeCompare(nombre(b.c.person_id), "es");
  });
  return (
    <section className={`gs-bloque cv-equipo cv-equipo-${p.equipo}`} aria-labelledby={`t-${p.equipo}`} data-testid={`cv-equipo-${p.equipo}`}>
      <div className="cv-equipo-cab">
        <span className={`chip-eq chip-${p.equipo.toUpperCase()}`}>{p.equipo}</span>
        <h2 id={`t-${p.equipo}`}>{cruce(p)}</h2>
      </div>
      <p className="cv-datos">
        <b className="cifra">{p.inicio ?? "hora por confirmar"}</b> · {p.es_local === false ? "visitante" : "local"} · {p.sitio}<br />
        <span className="suave">Encuentro {p.encuentro ?? "—"} (20 minutos antes){p.direccion ? ` · ${p.direccion}` : ""}</span>
      </p>
      {p.aviso?.hay ? (
        <div className={`eq-aviso eq-${p.aviso.tipo}`} role="note"><b className="eq-etq">{p.aviso.etiqueta}</b><span className="eq-txt">{p.aviso.texto}</span></div>
      ) : <p className="pequeno suave" style={{ margin: 0 }}>Equipación: la habitual (sin choque de colores).</p>}

      <fieldset className="cv-dificultad" disabled={bloqueado}>
        <legend>Dificultad del rival</legend>
        <div className="ev-radios">
          {(["alta", "media", "baja"] as Dificultad[]).map((d) => (
            <label key={d}><input type="radio" name={`dif-${p.equipo}`} checked={p.dificultad.valor === d} onChange={() => onDificultad(d)} />{TEXTO_DIFICULTAD[d]}</label>
          ))}
        </div>
        <small className="suave" data-testid={`cv-porque-${p.equipo}`}>Propuesta: {TEXTO_DIFICULTAD[p.dificultad.propuesta].toLowerCase()} · {p.dificultad.porque}{p.dificultad.manual ? " · corregida a mano" : ""}</small>
      </fieldset>

      <Casillas r={r} testid={`cv-casillas-${p.equipo}`} />
      <p className="pequeno suave" style={{ margin: 0 }} data-testid={`cv-total-${p.equipo}`}>{r.total} convocados (máximo {maximo}) · nivel medio {textoNivelMedio(r.nivelMedio)}</p>
      <ListaAvisos avisos={avisos} nombre={p.equipo} />

      {previa && <p className="pequeno cv-previa">Vista previa de la propuesta: elige «Usar propuesta» para editarla.</p>}
      <ul className="cv-lista" aria-label={`Convocados del ${p.equipo}`}>
        {filas.map(({ c, j }) => {
          const pos = c.posicion ?? j?.privado?.posicion ?? null;
          const dobla = delOtro.has(c.person_id);
          const reserva = r.basesDeReserva.includes(c.person_id);
          return (
            <li key={c.person_id} className="cv-fila" data-person={c.person_id}>
              <div className="cv-fila-nombre">
                <b>{nombre(c.person_id)}</b>
                <small>
                  {pos ? TEXTO_POSICION[pos] : "sin posición"}{c.posicion ? " (este partido)" : ""}{reserva ? " · hace de base" : ""}
                  {dobla && <span className="cv-etq cv-etq-dobla">dobla</span>}
                  {j && j.respuesta[p.equipo] !== "va" && <span className="cv-etq cv-etq-no">{TEXTO_RESP[j.respuesta[p.equipo] ?? "sin_responder"]}</span>}
                </small>
              </div>
              <span className="cv-nivel" title="Nivel (solo gestores)">{j?.privado?.nivel ?? "–"}</span>
              {!previa && <button type="button" className="boton boton-claro cv-boton" disabled={bloqueado} onClick={() => onCambiar(c.person_id)} aria-label={`Cambiar a ${nombre(c.person_id)}`}>Cambiar</button>}
            </li>
          );
        })}
        {!filas.length && <li className="suave">Nadie convocado todavía.</li>}
      </ul>
      {!previa && <button type="button" className="boton boton-contorno boton-bloque" disabled={bloqueado} onClick={onAnadir}>+ Añadir jugador a {p.equipo}</button>}
    </section>
  );
}

// ---------------------------------------------------------------- hoja «Cambiar a mano» / «Añadir jugador»
type Opcion = "mover" | "doblar" | "quitar" | "posicion" | "anadir";

function HojaCambio({ hoja, ctx, conv, porId, mismaHora, pendiente, onCerrar, onGuardar, error }: {
  hoja: NonNullable<Hoja>; ctx: Contexto; conv: Conv; porId: Map<string, JugadorVista>; mismaHora: boolean; pendiente: boolean;
  onCerrar: () => void; onGuardar: (c: Conv, cambio: { accion: Accion; person_id: string; equipo: Equipo | null; motivo: Motivo; nota: string | null }) => void;
  error: string | null;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [persona, setPersona] = useState<string | null>(hoja.person_id ?? null);
  const [busca, setBusca] = useState("");
  const [opcion, setOpcion] = useState<Opcion | null>(hoja.tipo === "anadir" ? "anadir" : null);
  const [posicion, setPosicion] = useState<Posicion | "">("");
  const [motivo, setMotivo] = useState<Motivo | null>(null);
  const [nota, setNota] = useState("");
  const juegan = ctx.partidos.map((p) => p.equipo);
  const dosPartidos = juegan.length === 2;
  const e = hoja.equipo;
  const j = persona ? porId.get(persona) ?? null : null;

  useEffect(() => {
    const t = panel.current?.querySelector<HTMLElement>("input, button");
    t?.focus();
    const esc = (ev: KeyboardEvent) => { if (ev.key === "Escape") onCerrar(); };
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [onCerrar]);

  // La convocatoria tal como quedaria con el cambio elegido.
  const nueva = useMemo<Conv | null>(() => {
    if (!persona || !opcion) return null;
    const c: Conv = Object.fromEntries(juegan.map((x) => [x, [...(conv[x] ?? [])]]));
    const sin = (x: Equipo) => { c[x] = (c[x] ?? []).filter((y) => y.person_id !== persona); };
    if (opcion === "anadir") { if (!ids(c, e).has(persona)) c[e] = [...(c[e] ?? []), { person_id: persona }]; }
    else if (opcion === "quitar") juegan.forEach(sin);
    else if (opcion === "mover") { sin(e); c[otro(e)] = [...(c[otro(e)] ?? []).filter((y) => y.person_id !== persona), { person_id: persona }]; }
    else if (opcion === "doblar") { if (!ids(c, otro(e)).has(persona)) c[otro(e)] = [...(c[otro(e)] ?? []), { person_id: persona }]; }
    else if (opcion === "posicion") c[e] = (c[e] ?? []).map((y) => (y.person_id === persona ? (posicion && posicion !== j?.privado?.posicion ? { person_id: persona, posicion } : { person_id: persona }) : y));
    return c;
  }, [persona, opcion, posicion, conv, e, juegan, j]);
  const revNueva = useMemo(() => (nueva ? revisar(entradaDe(ctx), nueva) : null), [nueva, ctx]);

  // Avisos antes de guardar: dijo «no voy» o no tiene ficha del equipo al que va.
  const destino: Equipo | null = opcion === "anadir" ? e : opcion === "mover" || opcion === "doblar" ? otro(e) : null;
  const avisosPrevios: string[] = [];
  if (j && destino) {
    if (!j.ficha[destino]) avisosPrevios.push(`${j.nombre} no tiene ficha del ${destino}.`);
    const r = j.respuesta[destino] ?? "sin_responder";
    if (r === "no") avisosPrevios.push(`${j.nombre} dijo «no voy» a este partido${j.motivoNo[destino] ? ` (${TEXTO_MOTIVO_NO[j.motivoNo[destino]!] ?? j.motivoNo[destino]})` : ""}.`);
    else if (r === "sin_responder") avisosPrevios.push(`${j.nombre} no ha respondido a este partido.`);
    else if (r === "duda") avisosPrevios.push(`${j.nombre} tiene «duda» para este partido.`);
    if (j.sancionado) avisosPrevios.push(`${j.nombre} está sancionado.`);
  }
  const yaEnOtro = persona ? ids(conv, otro(e)).has(persona) : false;
  const bloqueoMismaHora = mismaHora && (opcion === "doblar" || (opcion === "anadir" && yaEnOtro));
  const accion: Accion | null = opcion === "anadir" ? "anadir" : opcion;
  const puedeGuardar = !!(persona && opcion && motivo && nueva && !bloqueoMismaHora && (opcion !== "posicion" || posicion) && !pendiente);

  const candidatos = useMemo(() => {
    const q = busca.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    const dentro = ids(conv, e);
    return ctx.jugadores.filter((x) => !dentro.has(x.person_id))
      .filter((x) => !q || x.nombre.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").includes(q))
      .sort((a, b) => Number(b.respuesta[e] === "va") - Number(a.respuesta[e] === "va") || a.nombre.localeCompare(b.nombre, "es"));
  }, [busca, ctx.jugadores, conv, e]);

  const titulo = hoja.tipo === "anadir" ? `Añadir jugador a ${e}` : `Cambiar a mano · ${j?.nombre ?? ""}`;
  return (
    <>
      <div className="nv-velo cv-velo" aria-hidden="true" onClick={onCerrar} />
      <div ref={panel} className="cv-hoja" role="dialog" aria-modal="true" aria-labelledby="cv-hoja-titulo" data-testid="cv-hoja">
        <div className="cv-hoja-cab">
          <h2 id="cv-hoja-titulo">{titulo}</h2>
          <button type="button" className="nv-cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
        </div>

        {hoja.tipo === "anadir" && !persona && (
          <div className="cv-hoja-cuerpo">
            <label htmlFor="cv-busca">Busca en toda la plantilla</label>
            <input id="cv-busca" type="search" value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Nombre" autoComplete="off" />
            <ul className="cv-lista" aria-label="Plantilla">
              {candidatos.map((x) => {
                const est = estadoPara(x, e);
                return (
                  <li key={x.person_id}>
                    <button type="button" className="cv-candidato" onClick={() => setPersona(x.person_id)}>
                      <b>{x.nombre}</b>
                      <small className={`cv-est cv-est-${est.clase}`}>{est.texto}{ids(conv, otro(e)).has(x.person_id) ? ` · ya en el ${otro(e)}` : ""}</small>
                    </button>
                  </li>
                );
              })}
              {!candidatos.length && <li className="suave">Nadie con ese nombre.</li>}
            </ul>
          </div>
        )}

        {persona && j && (
          <div className="cv-hoja-cuerpo">
            <p className="pequeno" style={{ margin: 0 }}>
              <b>{j.nombre}</b> · {j.privado?.posicion ? TEXTO_POSICION[j.privado.posicion] : "sin posición"} · nivel {j.privado?.nivel ?? "–"} · {j.privado ? (j.privado.dobla ? "Dobla" : "No dobla") : "sin datos"}<br />
              {juegan.map((x) => <span key={x} className="suave">{x}: {estadoPara(j, x).texto}. </span>)}
              <span className="suave">{j.convocados} partidos convocado · {j.entrenos4} entrenos en 4 semanas{j.domingosFuera ? ` · ${j.domingosFuera} domingo${j.domingosFuera === 1 ? "" : "s"} disponible y fuera` : ""}.</span>
            </p>
            {hoja.tipo === "cambiar" && (
              <fieldset className="cv-opciones">
                <legend>Qué cambias</legend>
                <div className="ev-radios cv-radios-columna">
                  {dosPartidos && <label><input type="radio" name="cv-op" checked={opcion === "mover"} onChange={() => setOpcion("mover")} />Pasar al {otro(e)}</label>}
                  {dosPartidos && !yaEnOtro && <label><input type="radio" name="cv-op" checked={opcion === "doblar"} onChange={() => setOpcion("doblar")} disabled={mismaHora} />Que juegue en los dos (doblar){mismaHora ? " — misma hora: no se puede" : ""}</label>}
                  <label><input type="radio" name="cv-op" checked={opcion === "quitar"} onChange={() => setOpcion("quitar")} />Quitar de la convocatoria{yaEnOtro ? " (de los dos)" : ""}</label>
                  <label><input type="radio" name="cv-op" checked={opcion === "posicion"} onChange={() => setOpcion("posicion")} />Cambiar su posición solo para este partido</label>
                </div>
                {opcion === "posicion" && (
                  <select aria-label="Posición para este partido" value={posicion} onChange={(ev) => setPosicion(ev.target.value as Posicion)}>
                    <option value="">Elige posición</option>
                    {POSICIONES.map((x) => <option key={x} value={x}>{TEXTO_POSICION[x]}{x === j.privado?.posicion ? " (la suya)" : ""}</option>)}
                  </select>
                )}
              </fieldset>
            )}

            <fieldset className="cv-opciones">
              <legend>Motivo</legend>
              <div className="ev-radios">
                {MOTIVOS.map((m) => <label key={m.id}><input type="radio" name="cv-motivo" checked={motivo === m.id} onChange={() => setMotivo(m.id)} />{m.texto}</label>)}
              </div>
              <label htmlFor="cv-nota" className="pequeno">Nota (opcional)</label>
              <input id="cv-nota" type="text" value={nota} onChange={(ev) => setNota(ev.target.value)} maxLength={140} />
            </fieldset>

            {bloqueoMismaHora && <div className="aviso aviso-error" role="alert">Los dos partidos empiezan a la misma hora: nadie puede doblar (regla 1.4).</div>}
            {avisosPrevios.length > 0 && !bloqueoMismaHora && (
              <div className="aviso aviso-info" role="alert" data-testid="cv-aviso-previo">{avisosPrevios.map((t) => <div key={t}>{t}</div>)}<div>Puedes guardarlo igual: decides tú.</div></div>
            )}

            {revNueva && (
              <div className="cv-previa-lineas" data-testid="cv-vista-previa">
                <b className="pequeno">Así quedan las líneas</b>
                {juegan.map((x) => (
                  <div key={x}><span className={`chip-eq chip-${x.toUpperCase()}`}>{x}</span> <span className="pequeno suave">{revNueva.recuento[x]!.total} convocados</span><Casillas r={revNueva.recuento[x]!} /></div>
                ))}
              </div>
            )}
            {error && <div className="aviso aviso-error" role="alert">{error}</div>}
            <div className="botones">
              <button type="button" className="boton boton-amarillo" disabled={!puedeGuardar} onClick={() => accion && nueva && motivo && onGuardar(nueva, { accion, person_id: persona, equipo: destino ?? e, motivo, nota: nota || null })}>Guardar cambio</button>
              {hoja.tipo === "anadir" && !hoja.person_id && <button type="button" className="boton boton-claro" onClick={() => { setPersona(null); setMotivo(null); }}>Elegir a otro</button>}
              <button type="button" className="boton boton-claro" onClick={onCerrar}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

