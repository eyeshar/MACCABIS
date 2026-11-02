"use client";

import Link from "next/link";
import { LINEA_DE, TEXTO_DIFICULTAD, faltasMinimo, type Aviso, type Convocatoria as Conv, type Dificultad, type Equipo, type Recuento, type SinConvocar } from "@/lib/convocatoria/motor";
import { mensajeFaltan } from "@/lib/convocatoria/mensajes";
import { textoProyeccion, type Proyeccion } from "@/lib/convocatoria/proyeccion";
import { riesgos } from "@/lib/convocatoria/riesgo";
import type { Contexto, JugadorVista } from "@/lib/convocatoria/vista";
import { enMadrid } from "@/lib/avisos/horario";
import CopiarTexto from "../eventos/CopiarTexto";

// Revisión de un vistazo para aprobar desde el móvil (D173, diseñada para 375 px): por equipo, convocados por línea, avisos
// (rojo / ámbar), proyección, rival y dificultad (editable) y quién se queda fuera y por qué; un botón grande «Aprobar y
// avisar». Para ajustar, las herramientas de siempre, debajo («Mover a…», «Deshacer», «Cambiar»). Solo gestores.

type Props = {
  ctx: Contexto; conv: Conv; recuento: Partial<Record<Equipo, Recuento>>; avisosDe: (e: Equipo) => Aviso[];
  proyecciones: Partial<Record<Equipo, Proyeccion | null>>; sinConvocar: SinConvocar[]; nombre: (id: string) => string;
  enlaces: Record<string, string>; empezada: boolean; bloqueado: boolean; cambiadaTrasAviso: boolean;
  onAprobar: () => void; onAvisarCambio: () => void; onRehacer: () => void; onDificultad: (e: Equipo, d: Dificultad) => void;
};

const LINEAS = [["base", "Bases"], ["exterior", "Exteriores"], ["interior", "Interiores"]] as const;
const ESTADO_LINEA = { base: "bases", exterior: "exteriores", interior: "interiores" } as const;
const ddmmHora = (iso: string) => { const m = enMadrid(new Date(iso)); return `${m.fecha.slice(8, 10)}/${m.fecha.slice(5, 7)} a las ${m.hora}`; };

function Nombre({ id, nombre, enlaces }: { id: string; nombre: string; enlaces: Record<string, string> }) {
  return enlaces[id] ? <Link href={enlaces[id]}>{nombre}</Link> : <>{nombre}</>;
}

export default function Revision(p: Props) {
  const { ctx, conv, nombre, enlaces } = p;
  const fila = ctx.convocatoria;
  const aprobada = fila?.estado === "aprobada";
  const porId = new Map(ctx.jugadores.map((j) => [j.person_id, j]));
  const dentro = new Set(Object.values(conv).flat().map((c) => c!.person_id));
  // Por debajo de un mínimo: lista de quién no ha respondido o dijo «duda» a ese partido, y un WhatsApp para escribirles.
  const bajos = ctx.partidos.filter((x) => p.recuento[x.equipo] && faltasMinimo(p.recuento[x.equipo]!).alguno && (conv[x.equipo]?.length ?? 0) > 0);
  const faltan: JugadorVista[] = ctx.jugadores.filter((j) => j.invitado && !dentro.has(j.person_id) && !j.sancionado
    && bajos.some((b) => j.invitadoA.includes(b.equipo) && j.ficha[b.equipo] && ["sin_responder", "duda"].includes(j.respuesta[b.equipo] ?? "sin_responder")))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  // D173: riesgo por equipo (solo gestores), recalculado con cada cambio; cambiar la dificultad no rehace la propuesta.
  const listaRiesgos = riesgos(ctx.partidos.map((x) => ({ equipo: x.equipo, dificultad: x.dificultad.valor })),
    Object.fromEntries(ctx.partidos.map((x) => [x.equipo, p.recuento[x.equipo]?.nivelMedio ?? null])),
    Object.fromEntries(ctx.partidos.map((x) => [x.equipo, p.proyecciones[x.equipo] ?? null])),
    Object.fromEntries(ctx.partidos.map((x) => [x.equipo, conv[x.equipo]?.length ?? 0])));
  const tardios = ctx.jugadores.filter((j) => j.respondioTarde && !dentro.has(j.person_id)).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return (
    <section className="gs-bloque cv-revision" aria-label="Revisión para aprobar" data-testid="cv-revision">
      {fila?.automatica_en && !aprobada && (
        <p className="cv-auto" data-testid="cv-automatica">Propuesta automática del {ddmmHora(fila.automatica_en)}, tras el cierre. Revísala y apruébala: nada sale hasta que pulses «Aprobar y avisar».</p>
      )}
      {!p.empezada && <p className="pequeno suave" style={{ margin: 0 }}>Vista previa de la propuesta del motor: elige «Usar propuesta» (o apruébala tal cual) para guardarla.</p>}
      <div className="cv-rev-equipos">
        {ctx.partidos.map((x) => {
          const r = p.recuento[x.equipo];
          if (!r) return null;
          const lista = conv[x.equipo] ?? [];
          const lineaDe = (id: string, pos?: string) => { const j = porId.get(id); const q = (pos ?? j?.privado?.posicion) as keyof typeof LINEA_DE | undefined; return q ? LINEA_DE[q] : "exterior"; };
          const avisos = p.avisosDe(x.equipo).filter((a) => a.gravedad !== "info");
          const rojos = avisos.filter((a) => a.gravedad === "error").length, ambar = avisos.length - rojos;
          const pr = p.proyecciones[x.equipo];
          return (
            <div key={x.equipo} className={`cv-rev cv-equipo-${x.equipo}`} data-testid={`cv-rev-${x.equipo}`}>
              <div className="cv-rev-cab">
                <span className={`chip-eq chip-${x.equipo.toUpperCase()}`}>{x.equipo}</span>
                <b className="cifra">{lista.length}</b><span className="suave">convocados · {x.inicio ?? "hora ?"}</span>
              </div>
              <p className="cv-rev-rival">vs {x.rival ?? "rival por confirmar"}</p>
              <label className="cv-rev-dif">Dificultad
                <select value={x.dificultad.valor} disabled={p.bloqueado} onChange={(e) => p.onDificultad(x.equipo, e.target.value as Dificultad)} aria-label={`Dificultad del rival del ${x.equipo}`}>
                  {(["alta", "media", "baja"] as Dificultad[]).map((d) => <option key={d} value={d}>{TEXTO_DIFICULTAD[d]}</option>)}
                </select>
              </label>
              <ul className="cv-rev-lineas">
                {LINEAS.map(([l, t]) => {
                  const ids = lista.filter((c) => (l === "base" ? lineaDe(c.person_id, c.posicion) === "base" || r.basesDeReserva.includes(c.person_id) : l === "exterior" ? lineaDe(c.person_id, c.posicion) === "exterior" && !r.basesDeReserva.includes(c.person_id) : lineaDe(c.person_id, c.posicion) === "interior"));
                  const est = l === "base" ? r.bases.estado : l === "exterior" ? r.exteriores.estado : r.interiores.estado;
                  return (
                    <li key={l} className={`cv-rev-linea cv-${est}`} data-linea={ESTADO_LINEA[l]}>
                      <b>{t} {l === "base" ? r.bases.texto : l === "exterior" ? r.exteriores.texto : r.interiores.texto}</b>
                      <span>{ids.length ? ids.map((c, i) => <span key={c.person_id}>{i ? ", " : ""}<Nombre id={c.person_id} nombre={nombre(c.person_id)} enlaces={enlaces} /></span>) : "—"}</span>
                    </li>
                  );
                })}
              </ul>
              {avisos.length > 0 ? (
                <details className="cv-rev-avisos" open={rojos > 0}>
                  <summary>{rojos ? <span className="cv-etq cv-etq-no">{rojos} en rojo</span> : null}{ambar ? <span className="cv-etq cv-etq-ambar">{ambar} en ámbar</span> : null}</summary>
                  <ul>{avisos.map((a, i) => <li key={i} className={`cv-aviso cv-aviso-${a.gravedad}`}>{a.texto}</li>)}</ul>
                </details>
              ) : <p className="pequeno suave" style={{ margin: 0 }}>Sin avisos.</p>}
              {pr && <p className="pequeno" style={{ margin: 0 }}>{textoProyeccion(pr)}</p>}
              {listaRiesgos.filter((r) => r.equipo === x.equipo).map((r, i) => (
                <p key={i} className={`cv-riesgo cv-riesgo-${r.gravedad}`} data-testid={`cv-riesgo-${x.equipo}`} data-gravedad={r.gravedad}>{r.texto}</p>
              ))}
            </div>
          );
        })}
      </div>

      {p.sinConvocar.length > 0 && (
        <div data-testid="cv-rev-fuera">
          <b>Se quedan fuera ({p.sinConvocar.length})</b>
          <ul className="cv-rev-fuera">{p.sinConvocar.map((s) => <li key={s.person_id}><Nombre id={s.person_id} nombre={nombre(s.person_id)} enlaces={enlaces} /> · <span className="suave">{s.motivo}</span></li>)}</ul>
        </div>
      )}

      {tardios.length > 0 && (
        <div className="cv-rev-tarde" data-testid="cv-tardios">
          <b>Respondió después de la propuesta</b>
          <p className="pequeno" style={{ margin: 0 }}>{tardios.map((j) => j.nombre).join(", ")} {tardios.length === 1 ? "dijo" : "dijeron"} «voy» después. No {tardios.length === 1 ? "entra" : "entran"} solo{tardios.length === 1 ? "" : "s"}: están en «Disponibles sin convocar».</p>
          {!aprobada && <button type="button" className="boton boton-contorno" disabled={p.bloqueado} onClick={p.onRehacer}>Rehacer propuesta</button>}
        </div>
      )}

      {bajos.length > 0 && (
        <div className="cv-rev-faltan" data-testid="cv-faltan">
          <b>No se llega al mínimo en el {bajos.map((b) => b.equipo).join(" y el ")}</b>
          {faltan.length ? (
            <>
              <p className="pequeno" style={{ margin: 0 }}>Sin responder o en «duda»: {faltan.map((j) => `${j.nombre}${bajos.some((b) => j.respuesta[b.equipo] === "duda") ? " (duda)" : ""}`).join(", ")}.</p>
              <CopiarTexto texto={mensajeFaltan(ctx.fecha, faltan.map((j) => j.nombre))} etiqueta="Copiar mensaje para ellos" id="cv-msg-faltan" />
            </>
          ) : <p className="pequeno" style={{ margin: 0 }}>No queda nadie sin responder: decide tú (doblar a mano o jugar con menos).</p>}
        </div>
      )}

      <div className="cv-rev-accion">
        {!aprobada && <button type="button" className="boton boton-amarillo boton-bloque cv-aprobar-grande" data-testid="cv-aprobar" disabled={p.bloqueado} onClick={p.onAprobar}>Aprobar y avisar</button>}
        {aprobada && p.cambiadaTrasAviso && <button type="button" className="boton boton-amarillo boton-bloque" data-testid="cv-avisar-cambio" disabled={p.bloqueado} onClick={p.onAvisarCambio}>Avisar del cambio</button>}
        {aprobada && <Link className="boton boton-contorno boton-bloque" href={`/gestion/convocatoria/salida?fecha=${ctx.fecha}`}>Ver salida (avisados y WhatsApp)</Link>}
        {!aprobada && ctx.partidos.some((x) => p.avisosDe(x.equipo).some((a) => a.gravedad === "error")) && <p className="pequeno ev-no" style={{ margin: 0 }}>Hay avisos en rojo: puedes aprobar igual, decides tú.</p>}
        {!aprobada && <p className="pequeno suave" style={{ margin: 0 }}>Al aprobar sale ya un aviso a cada jugador: convocado, convocado con un equipo (y no con el otro) o «esta vez no entras». Nunca de 22:30 a 08:00.</p>}
      </div>
    </section>
  );
}
