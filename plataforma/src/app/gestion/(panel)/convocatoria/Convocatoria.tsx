"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  LINEA_DE, POSICIONES, REGLAS, TEXTO_DIFICULTAD, TEXTO_POSICION, proponer, revisar, textoNivelMedio,
  type Aviso, type Convocatoria as Conv, type Dificultad, type Equipo, type Posicion, type Recuento,
} from "@/lib/convocatoria/motor";
import { entradaDe, moverRapido, validarDestino, type Contexto, type JugadorVista, type PartidoVista, type Zona } from "@/lib/convocatoria/vista";
import { proyeccionDe, textoBajoMinimo, textoCorreccion, textoFactor, textoProyeccion, textoRival, type Proyeccion } from "@/lib/convocatoria/proyeccion";
import { cruce, diaTexto } from "@/lib/convocatoria/mensajes";
import { enMadrid } from "@/lib/avisos/horario";
import { diaCorto } from "@/lib/eventos/dominio";
import Numeros, { type GrupoNum, type PersonaNum } from "@/components/numeros/Numeros";
import { ajusteRapido, aprobar, cambiarDificultad, deshacerRapido, empezar, guardarCambio, type Accion, type Motivo } from "./acciones";

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
/** "martes 27/10 a las 20:00" */
const textoLimiteGestor = (iso: string) => { const l = enMadrid(new Date(iso)); return `${diaCorto(l.fecha)} a las ${l.hora}`; };
const ids = (c: Conv, e: Equipo) => new Set((c[e] ?? []).map((x) => x.person_id));

function Casillas({ r, testid, personas }: { r: Recuento; testid?: string; personas?: Record<"bases" | "exteriores" | "interiores", PersonaNum[]> }) {
  // Con nombres (D139): cada casilla es un contador desplegable; sin ellos (vista previa del cambio), solo las cifras.
  if (personas) {
    const g = (k: "bases" | "exteriores" | "interiores", etiqueta: string): GrupoNum => ({ k, etiqueta, n: personas[k].length, valor: r[k].texto, clase: `cv-casilla cv-${r[k].estado}`, personas: personas[k] });
    return <Numeros prueba={testid ?? "cv-casillas"} etiqueta="Líneas del equipo" contenedor="cv-casillas" grupos={[g("bases", "bases"), g("exteriores", "exteriores"), g("interiores", "interiores")]} />;
  }
  return (
    <div className="cv-casillas" data-testid={testid}>
      <div className={`cv-casilla cv-${r.bases.estado}`}><b>{r.bases.texto}</b><span>bases</span></div>
      <div className={`cv-casilla cv-${r.exteriores.estado}`}><b>{r.exteriores.texto}</b><span>exteriores</span></div>
      <div className={`cv-casilla cv-${r.interiores.estado}`}><b>{r.interiores.texto}</b><span>interiores</span></div>
    </div>
  );
}

/** Nombre de la lista como enlace a su ficha (D139); sin arrastrar el enlace, para que la fila siga siendo arrastrable. */
function NombreCv({ id, nombre, enlaces }: { id: string; nombre: string; enlaces: Record<string, string> }) {
  const h = enlaces[id];
  return h ? <Link href={h} className="num-nombre" draggable={false}>{nombre}</Link> : <>{nombre}</>;
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

/** Los tres contadores del domingo con sus nombres: se clasifican igual que ctx.contadores (datos.ts). */
function gruposDomingo(jugadores: JugadorVista[], enlaces: Record<string, string>, dudan: number): GrupoNum[] {
  const g: Record<"va" | "sin" | "no", PersonaNum[]> = { va: [], sin: [], no: [] };
  for (const j of jugadores.filter((x) => x.invitado)) {
    const v = j.invitadoA.map((e) => j.respuesta[e] ?? "sin_responder");
    const base = { nombre: j.nombre, href: enlaces[j.person_id] ?? null };
    if (v.includes("va")) g.va.push({ ...base, nota: j.invitadoA.length === 2 && v.some((x) => x !== "va") ? `solo ${j.invitadoA.filter((_, i) => v[i] === "va").join(" y ")}` : null });
    else if (v.length && v.every((x) => x === "no")) {
      const m = j.invitadoA.map((e) => j.motivoNo[e]).find(Boolean);
      g.no.push({ ...base, nota: m ? (TEXTO_MOTIVO_NO[m] ?? m) : null });
    } else g.sin.push({ ...base, nota: v.includes("duda") ? "duda" : null });
  }
  const orden = (a: PersonaNum, b: PersonaNum) => a.nombre.localeCompare(b.nombre, "es");
  return [
    { k: "van", etiqueta: "van", n: g.va.length, tono: "ok", personas: g.va.sort(orden) },
    { k: "sin", etiqueta: `sin responder${dudan ? ` (${dudan} duda${dudan === 1 ? "" : "n"})` : ""}`, n: g.sin.length, personas: g.sin.sort(orden) },
    { k: "no", etiqueta: "no van", n: g.no.length, tono: "no", personas: g.no.sort(orden) },
  ];
}

type Hoja = { tipo: "cambiar"; person_id: string; equipo: Equipo } | { tipo: "anadir"; equipo: Equipo; person_id?: string } | null;

export default function Convocatoria({ ctx, enlaces = {} }: { ctx: Contexto; enlaces?: Record<string, string> }) {
  const router = useRouter();
  const [pendiente, empezarTransicion] = useTransition();
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [hoja, setHoja] = useState<Hoja>(null);
  const entrada = useMemo(() => entradaDe(ctx), [ctx]);
  const propuesta = useMemo(() => proponer(entrada), [entrada]);
  const fila = ctx.convocatoria;
  const empezada = !!fila?.origen;
  // Modo rapido (D125): la convocatoria se pinta desde aqui para que cada movimiento se vea al momento; se guarda en la
  // base enseguida y, al volver los datos del servidor, se sincroniza.
  const [local, setLocal] = useState<Conv | null>(fila?.origen ? fila.equipos : null);
  useEffect(() => { setLocal(fila?.origen ? fila.equipos : null); }, [fila?.origen, fila?.equipos]);
  const conv: Conv = empezada ? local ?? fila!.equipos : propuesta.convocatoria;
  const [sel, setSel] = useState<{ ids: Set<string>; desde: Zona | null }>({ ids: new Set(), desde: null });
  const [arrastre, setArrastre] = useState<{ ids: string[]; desde: Zona } | null>(null);
  const [ultimo, setUltimo] = useState<{ antes: Conv; texto: string } | null>(null);
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
  // Contadores de la cabecera (D139): quien va a alguno, quien no ha respondido (o duda) y quien no va a ninguno, con su motivo (solo gestores).
  const gruposCabecera = useMemo(() => gruposDomingo(ctx.jugadores, enlaces, ctx.contadores.dudan), [ctx.jugadores, enlaces, ctx.contadores.dudan]);
  const juegan = ctx.partidos.map((p) => p.equipo);
  // Proyeccion de anotacion de cada equipo (D124, D133), con los convocados de ahora y la dificultad marcada.
  const proyecciones = useMemo(() => Object.fromEntries(ctx.partidos.map((p) => [p.equipo, proyeccionDe(ctx.proyeccion, p.equipo, (conv[p.equipo] ?? []).map((c) => ({ person_id: c.person_id, nombre: nombre(c.person_id) })), p.dificultad.valor)])) as Partial<Record<Equipo, Proyeccion | null>>,
    [ctx.proyeccion, ctx.partidos, conv]);
  const avisosDe = (e: Equipo): Aviso[] => {
    const pr = proyecciones[e];
    const base = rev.avisos.filter((a) => a.equipo === e);
    return pr?.bajoMinimo && !base.some((a) => a.regla === "0.1" && a.texto.startsWith("Todavía no hay disponibles")) ? [...base, { regla: "3.3", gravedad: "aviso", equipo: e, texto: textoBajoMinimo(pr) }] : base;
  };

  // ------------------------------------------------------------ modo rapido: mover sin preguntar (D125)
  const mover = (ids: string[], desde: Zona | null, destino: Zona) => {
    if (!ids.length || bloqueado) return;
    const v = validarDestino(ids, destino, ctx.jugadores);
    if (!v.valido) { setMensaje({ ok: false, texto: `${v.motivo}: no se puede convocar con un equipo del que no tiene ficha (regla 1.5).` }); return; }
    const antes = conv;
    const r = moverRapido(conv, ids, desde, destino, juegan);
    if (mismaHora && (r.conv.MdA ?? []).some((c) => (r.conv.MdL ?? []).some((x) => x.person_id === c.person_id))) { setMensaje({ ok: false, texto: "Los dos partidos empiezan a la misma hora: nadie puede doblar (regla 1.4)." }); return; }
    if (JSON.stringify(r.conv) === JSON.stringify(Object.fromEntries(juegan.map((e) => [e, antes[e] ?? []])))) return;
    setLocal(r.conv);
    setSel({ ids: new Set(), desde: null });
    const quien = ids.map(nombre).join(", ");
    const texto = destino === "sin" ? `${quien} a «sin convocar»` : `${quien} al ${destino}`;
    empezarTransicion(async () => {
      const res = await ajusteRapido(ctx.fecha, r.conv, { accion: r.accion, personas: ids, equipo: destino === "sin" ? null : destino });
      if (!res.ok) { setLocal(antes); setMensaje({ ok: false, texto: res.error }); return; }
      setUltimo({ antes, texto });
      setMensaje({ ok: true, texto: `Guardado (ajuste manual): ${texto}.${v.avisos.length ? ` Ojo: ${v.avisos.join(" ")}` : ""}` });
      router.refresh();
    });
  };
  const deshacer = () => {
    if (!ultimo) return;
    const u = ultimo;
    setLocal(u.antes);
    empezarTransicion(async () => {
      const res = await deshacerRapido(ctx.fecha, u.antes);
      if (!res.ok) { setMensaje({ ok: false, texto: res.error }); return; }
      setUltimo(null);
      setMensaje({ ok: true, texto: `Deshecho: ${u.texto}.` });
      router.refresh();
    });
  };
  const alternar = (id: string, zona: Zona) => setSel((s) => {
    const ids = new Set(s.ids);
    if (ids.has(id)) ids.delete(id); else ids.add(id);
    return { ids, desde: ids.size === 0 ? null : s.ids.size === 0 || s.desde === zona ? zona : null };
  });
  const rapido = empezada && !bloqueado ? { sel: sel.ids, alternar, arrastre, setArrastre, mover } : null;
  const zonaProps = (z: Zona) => {
    if (!empezada) return {};
    const v = arrastre ? validarDestino(arrastre.ids, z, ctx.jugadores) : null;
    const clase = arrastre && arrastre.desde !== z ? (v?.valido ? " cv-zona cv-zona-ok" : " cv-zona cv-zona-no") : "";
    return {
      clase, motivoNo: arrastre && v && !v.valido ? v.motivo : null,
      eventos: {
        onDragOver: (e: React.DragEvent) => { if (arrastre && v?.valido) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } },
        onDrop: (e: React.DragEvent) => { e.preventDefault(); const a = arrastre; setArrastre(null); if (a && a.desde !== z) mover(a.ids, a.desde, z); },
      },
    };
  };
  const selIds = [...sel.ids];
  const barra = empezada && selIds.length > 0 && (
    <div className="tb-barra cv-barra" role="region" aria-label="Mover la selección" data-testid="cv-barra">
      <span className="tb-n"><b className="cifra">{selIds.length}</b> {selIds.length === 1 ? "seleccionado" : "seleccionados"} · Mover a…</span>
      {juegan.map((e) => {
        const v = validarDestino(selIds, e, ctx.jugadores);
        return <button key={e} type="button" className={`boton tb-al tb-al-${e}`} disabled={pendiente || !v.valido} title={v.motivo ?? undefined} onClick={() => mover(selIds, sel.desde, e)}>Al {e}</button>;
      })}
      <button type="button" className="boton boton-claro" disabled={pendiente} onClick={() => mover(selIds, sel.desde, "sin")}>Sin convocar</button>
      <button type="button" className="boton boton-claro" onClick={() => setSel({ ids: new Set(), desde: null })}>Quitar selección</button>
      {juegan.some((e) => !validarDestino(selIds, e, ctx.jugadores).valido) && <small className="cv-barra-nota">{juegan.map((e) => validarDestino(selIds, e, ctx.jugadores).motivo).filter(Boolean).join(" · ")}</small>}
    </div>
  );

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
      {mensaje && !hoja && (
        <div className={`aviso ${mensaje.ok ? "aviso-ok" : "aviso-error"} cv-mensaje`} role={mensaje.ok ? "status" : "alert"} style={{ marginBottom: 16 }} data-testid="cv-mensaje">
          <span>{mensaje.texto}</span>
          {mensaje.ok && ultimo && <button type="button" className="boton boton-claro" onClick={deshacer} disabled={pendiente}>Deshacer</button>}
        </div>
      )}

      <section className="gs-bloque cv-cab" aria-label="Respuestas del domingo">
        <Numeros prueba="cv-contadores" etiqueta="Respuestas del domingo" contenedor="gs-cifras cv-contadores num-cajas" grupos={gruposCabecera} />
        {!ctx.encendido && (
          <div className="cv-apagado" data-testid="cv-respuestas-apagadas">
            <p className="pequeno" style={{ margin: 0 }}>Las respuestas en la web están desactivadas.{ctx.respuestasDelDomingo === 0 && " Para este domingo todavía no hay ninguna respuesta."}</p>
          </div>
        )}
        {ctx.proyeccion.calibracion && <p className="pequeno suave" style={{ margin: 0 }} data-testid="cv-acierto" title={ctx.proyeccion.calibracion.puntos.map((x) => `J${x.jornada} ${x.equipo}: ${x.proyeccion} (real ${x.real})`).join(" · ")}>{ctx.proyeccion.calibracion.texto}.</p>}
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
          <>
            <div className="botones" style={{ margin: 0 }}>
              <button type="button" className="boton boton-claro" disabled={bloqueado} onClick={() => { if (window.confirm("¿Rehacer la convocatoria con la propuesta del motor? Se pierden los cambios a mano (quedan en el historial).")) correr(() => empezar(ctx.fecha, "recalcular")); }}>Recalcular propuesta</button>
            </div>
            <p className="pequeno suave" style={{ margin: 0 }} data-testid="cv-ayuda-rapido">Modo rápido: arrastra a los jugadores entre equipos y «Disponibles sin convocar», o márcalos y usa «Mover a…». Cada movimiento se guarda al momento como «ajuste manual». Para dejar otro motivo, «Cambiar».</p>
          </>
        )}
      </section>

      {generales.length > 0 && <section className="gs-bloque" aria-label="Avisos del domingo" style={{ marginBottom: 16 }}><ListaAvisos avisos={generales} /></section>}

      <div className="cv-equipos">
        {ctx.partidos.map((p) => (
          <TarjetaEquipo key={p.equipo} p={p} conv={conv} r={rev.recuento[p.equipo]!} maximo={rev.maximo} avisos={avisosDe(p.equipo)}
            previa={!empezada} bloqueado={bloqueado} nombre={nombre} porId={porId} enlaces={enlaces} proy={proyecciones[p.equipo] ?? null} rapido={rapido} zona={zonaProps(p.equipo)}
            onDificultad={(v) => correr(() => cambiarDificultad(ctx.fecha, p.equipo, v))}
            onCambiar={(id) => setHoja({ tipo: "cambiar", person_id: id, equipo: p.equipo })}
            onAnadir={() => setHoja({ tipo: "anadir", equipo: p.equipo })} />
        ))}
      </div>

      <section className={`gs-bloque${zonaProps("sin").clase ?? ""}`} aria-labelledby="t-sinconv" data-testid="cv-sin-convocar" data-zona="sin" style={{ marginTop: 16 }} {...(zonaProps("sin").eventos ?? {})}>
        <h2 id="t-sinconv">Disponibles sin convocar · {sinConvocar.length}</h2>
        {arrastre && arrastre.desde !== "sin" && <p className="cv-soltar">Suelta aquí para dejarlo sin convocar</p>}
        {sinConvocar.length ? (
          <ul className="cv-lista">
            {sinConvocar.map((s) => {
              const j = porId.get(s.person_id);
              return (
                <li key={s.person_id} className={`cv-fila${rapido?.sel.has(s.person_id) ? " cv-sel" : ""}`} data-person={s.person_id} draggable={!!rapido}
                  onDragStart={rapido ? (e) => { const ids = rapido.sel.has(s.person_id) && sel.desde === "sin" ? [...rapido.sel] : [s.person_id]; e.dataTransfer.setData("text/plain", ids.join(",")); e.dataTransfer.effectAllowed = "move"; rapido.setArrastre({ ids, desde: "sin" }); } : undefined}
                  onDragEnd={rapido ? () => rapido.setArrastre(null) : undefined}>
                  {rapido && <label className="cv-casilla-sel"><input type="checkbox" checked={rapido.sel.has(s.person_id)} onChange={() => rapido.alternar(s.person_id, "sin")} aria-label={`Seleccionar a ${j?.nombre ?? s.person_id}`} /></label>}
                  <div className="cv-fila-nombre"><b><NombreCv id={s.person_id} nombre={j?.nombre ?? s.person_id} enlaces={enlaces} /></b><small>{s.motivo} · regla {s.regla}</small></div>
                  {empezada && <button type="button" className="boton boton-contorno cv-boton" disabled={bloqueado} onClick={() => setHoja({ tipo: "anadir", equipo: ctx.partidos.find((x) => j?.respuesta[x.equipo] === "va" && j.ficha[x.equipo])?.equipo ?? ctx.partidos[0].equipo, person_id: s.person_id })}>Añadir</button>}
                </li>
              );
            })}
          </ul>
        ) : <p className="suave" style={{ margin: 0 }}>Todos los disponibles están convocados.</p>}
      </section>

      {(rev.posibles.length > 0 || ctx.dudasAbiertas) && (
        <section className="gs-bloque" aria-labelledby="t-posibles" data-testid="cv-posibles" style={{ marginTop: 16 }}>
          <h2 id="t-posibles">Posibles (dudas) · {rev.posibles.length}</h2>
          {ctx.dudasAbiertas && ctx.limiteDudas && (
            <p className="pequeno suave" style={{ margin: 0 }} data-testid="cv-posibles-nota">
              Propuesta provisional: las dudas no se convocan. Tienen hasta el {textoLimiteGestor(ctx.limiteDudas)} para confirmar; quien siga en «duda» pasa a «no va». La propuesta definitiva se hace después.
            </p>
          )}
          {rev.posibles.length ? (
            <ul className="cv-lista">
              {rev.posibles.map((p) => {
                const j = porId.get(p.person_id);
                return (
                  <li key={p.person_id} className="cv-fila" data-person={p.person_id}>
                    <div className="cv-fila-nombre"><b><NombreCv id={p.person_id} nombre={j?.nombre ?? p.person_id} enlaces={enlaces} /></b><small>Duda al {p.equipos.join(" y al ")}</small></div>
                  </li>
                );
              })}
            </ul>
          ) : <p className="suave" style={{ margin: 0 }}>Nadie en duda.</p>}
        </section>
      )}

      {empezada && (
        <section className="gs-bloque cv-aprobar" aria-label="Aprobar">
          {fila!.estado === "aprobada" ? (
            <>
              <p style={{ margin: 0 }}>Aprobada{fila!.aprobada_por_nombre ? ` por ${fila!.aprobada_por_nombre}` : ""}. {fila!.whatsapp_estado === "pendiente" ? "WhatsApp pendiente." : "WhatsApp al día."}</p>
              <div className="botones" style={{ margin: 0 }}>
                <Link className="boton boton-amarillo" href={`/gestion/convocatoria/salida?fecha=${ctx.fecha}`}>Ver salida (WhatsApp y aviso)</Link>
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
      {barra}
    </>
  );
}

const TEXTO_ACCION: Record<string, string> = {
  propuesta: "usa la propuesta", blanco: "empieza en blanco", recalcular: "recalcula la propuesta", mover: "cambia de equipo a", doblar: "hace doblar a",
  quitar: "quita a", anadir: "añade a", posicion: "cambia la posición de", dificultad: "cambia la dificultad", aprobar: "aprueba la convocatoria",
  whatsapp: "copia el mensaje a WhatsApp", aviso: "aviso de la web",
};
function textoCambio(c: Contexto["cambios"][number], nombre: (id: string) => string) {
  const motivo = MOTIVOS.find((m) => m.id === c.motivo)?.texto;
  return `${TEXTO_ACCION[c.accion] ?? c.accion}${c.person_id ? ` ${nombre(c.person_id)}` : ""}${c.equipo ? ` (${c.equipo})` : ""}${motivo ? ` · ${motivo}` : ""}${c.nota ? ` · «${c.nota}»` : ""}`;
}

type Rapido = {
  sel: Set<string>; alternar: (id: string, zona: Zona) => void; arrastre: { ids: string[]; desde: Zona } | null;
  setArrastre: (a: { ids: string[]; desde: Zona } | null) => void; mover: (ids: string[], desde: Zona | null, destino: Zona) => void;
} | null;
type ZonaProps = { clase?: string; motivoNo?: string | null; eventos?: { onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void } };

/** «Proyección ≈ N puntos (entre A y B)», «Quién aporta» y el rival (D124). Solo gestores. */
function BloqueProyeccion({ pr, equipo }: { pr: Proyeccion; equipo: Equipo }) {
  const notas = [pr.notaRival, pr.pocosDatos ? `${pr.pocosDatos} con pocos datos` : null].filter(Boolean);
  return (
    <div className="cv-proyeccion" data-testid={`cv-proyeccion-${equipo}`}>
      <p className="cv-proy-cifra"><b>{textoProyeccion(pr)}</b>{notas.length > 0 && <small> · {notas.join(" · ")}</small>}</p>
      <p className="pequeno suave" style={{ margin: 0 }} data-testid={`cv-rival-${equipo}`}>{textoRival(pr)}.</p>
      {pr.aportes.length > 0 && (
        <details className="cv-aportan">
          <summary>Quién aporta</summary>
          <p className="pequeno suave" style={{ margin: "4px 0" }} data-testid={`cv-factor-${equipo}`}>{textoFactor(pr)}{textoCorreccion(pr) ? ` · ${textoCorreccion(pr)}` : ""}.</p>
          <ul className="cv-lista">
            {pr.aportes.map((a) => (
              <li key={a.person_id} className="cv-aporte"><span>{a.nombre}{a.pocosDatos && <span className="cv-etq cv-etq-no">pocos datos</span>}</span><span className="cifra">{a.puntos.toLocaleString("es-ES")} pts <small className="suave">· {Math.round(a.minutos)} min</small></span></li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function TarjetaEquipo({ p, conv, r, maximo, avisos, previa, bloqueado, nombre, porId, enlaces, proy, rapido, zona, onDificultad, onCambiar, onAnadir }: {
  p: PartidoVista; conv: Conv; r: Recuento; maximo: number; avisos: Aviso[]; previa: boolean; bloqueado: boolean; enlaces: Record<string, string>;
  nombre: (id: string) => string; porId: Map<string, JugadorVista>; proy: Proyeccion | null; rapido: Rapido; zona: ZonaProps;
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
  // Quienes forman cada linea (D139): los mismos que cuenta el motor, con los bases de reserva y los que cuentan de exterior marcados.
  const persona = (id: string, nota?: string | null): PersonaNum => ({ nombre: nombre(id), href: enlaces[id] ?? null, nota });
  const lineaDe = (f: (typeof filas)[number]) => { const pos = f.c.posicion ?? f.j?.privado?.posicion; return pos ? LINEA_DE[pos] : "exterior"; };
  const personasLinea = {
    bases: [...filas.filter((f) => lineaDe(f) === "base" && !r.basesComoExteriores.includes(f.c.person_id)).map((f) => persona(f.c.person_id)), ...r.basesDeReserva.map((id) => persona(id, "hace de base"))],
    exteriores: [...filas.filter((f) => lineaDe(f) === "exterior" && !r.basesDeReserva.includes(f.c.person_id)).map((f) => persona(f.c.person_id)), ...r.basesComoExteriores.map((id) => persona(id, "base que cuenta de exterior"))],
    interiores: filas.filter((f) => lineaDe(f) === "interior").map((f) => persona(f.c.person_id)),
  };
  const convocados: GrupoNum[] = [{ k: "convocados", etiqueta: "convocados", n: r.total, personas: filas.map((f) => persona(f.c.person_id, `${(f.c.posicion ?? f.j?.privado?.posicion) ? TEXTO_POSICION[(f.c.posicion ?? f.j?.privado?.posicion)!] : "sin posición"}${delOtro.has(f.c.person_id) ? " · dobla" : ""}`)) }];
  return (
    <section className={`gs-bloque cv-equipo cv-equipo-${p.equipo}${zona.clase ?? ""}`} aria-labelledby={`t-${p.equipo}`} data-testid={`cv-equipo-${p.equipo}`} data-zona={p.equipo} {...(zona.eventos ?? {})}>
      <div className="cv-equipo-cab">
        <span className={`chip-eq chip-${p.equipo.toUpperCase()}`}>{p.equipo}</span>
        <h2 id={`t-${p.equipo}`}>{cruce(p)}</h2>
      </div>
      {rapido?.arrastre && rapido.arrastre.desde !== p.equipo && <p className={`cv-soltar${zona.motivoNo ? " cv-soltar-no" : ""}`}>{zona.motivoNo ? `${zona.motivoNo}: no se puede soltar aquí` : `Suelta aquí para convocar al ${p.equipo}`}</p>}
      {proy && <BloqueProyeccion pr={proy} equipo={p.equipo} />}
      <p className="cv-datos">
        <b className="cifra">{p.inicio ?? "hora por confirmar"}</b> · {p.sitio}<br />
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

      <Casillas r={r} testid={`cv-casillas-${p.equipo}`} personas={personasLinea} />
      <div className="cv-total" data-testid={`cv-total-${p.equipo}`}>
        <Numeros variante="linea" prueba={`cv-convocados-${p.equipo}`} etiqueta={`Convocados del ${p.equipo}`} grupos={convocados} />
        <span className="pequeno suave">(máximo {maximo}) · nivel medio {textoNivelMedio(r.nivelMedio)}</span>
      </div>
      <ListaAvisos avisos={avisos} nombre={p.equipo} />

      {previa && <p className="pequeno cv-previa">Vista previa de la propuesta: elige «Usar propuesta» para editarla.</p>}
      <ul className="cv-lista" aria-label={`Convocados del ${p.equipo}`}>
        {filas.map(({ c, j }) => {
          const pos = c.posicion ?? j?.privado?.posicion ?? null;
          const dobla = delOtro.has(c.person_id);
          const reserva = r.basesDeReserva.includes(c.person_id);
          return (
            <li key={c.person_id} className={`cv-fila${rapido?.sel.has(c.person_id) ? " cv-sel" : ""}`} data-person={c.person_id} draggable={!!rapido}
              onDragStart={rapido ? (e) => { const ids = rapido.sel.has(c.person_id) ? [...rapido.sel].filter((x) => lista.some((y) => y.person_id === x)) : [c.person_id]; e.dataTransfer.setData("text/plain", ids.join(",")); e.dataTransfer.effectAllowed = "move"; rapido.setArrastre({ ids, desde: p.equipo }); } : undefined}
              onDragEnd={rapido ? () => rapido.setArrastre(null) : undefined}>
              {rapido && <label className="cv-casilla-sel"><input type="checkbox" checked={rapido.sel.has(c.person_id)} onChange={() => rapido.alternar(c.person_id, p.equipo)} aria-label={`Seleccionar a ${nombre(c.person_id)} (${p.equipo})`} /></label>}
              <div className="cv-fila-nombre">
                <b><NombreCv id={c.person_id} nombre={nombre(c.person_id)} enlaces={enlaces} /></b>
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

