import Link from "next/link";
import { exigirGestor } from "@/lib/sesion";
import { AvisoCaja } from "@/components/ProximoPartido";
import { bonito, cargarLiga, type DatosLiga } from "@/lib/liga";
import { clave } from "@/data/avisosEquipacion";
import {
  chipEquipacion, entrenoHabitual, estadoClasificacion, eventosEntrenos, proximosPartidos, ultimosResultados, type Evento,
} from "@/lib/publico";
import { diaMes, diaSemanaCorto, hoyMadrid, textoSemana } from "@/lib/dias";
import { fechaCorta } from "@/lib/fechas";
import { NOMBRE_EQUIPO } from "@/lib/web";

export const metadata = { title: "Gestión · Maccabis" };

const cruce = (e: Evento) => { const n = NOMBRE_EQUIPO[e.equipo!]; return e.local ? `${n} – ${e.rival}` : `${e.rival} – ${n}`; };

/** Tarjeta de scouting del proximo rival: puesto y sus 3 maximos anotadores (datos de terceros: solo gestores, D73). */
function scoutingDe(liga: DatosLiga | null, e: Evento) {
  if (!liga || !e.rival) return null;
  const fila = liga.clasificacion.find((c) => clave(c.equipo) === clave(e.rival));
  if (!fila) return null;
  const top = liga.jugadores.filter((j) => j.grupo === fila.grupo && j.equipo === fila.equipo).sort((a, b) => b.pts - a.pts).slice(0, 3);
  const apellido = (n: string) => bonito(n).split(",")[0].split(" ")[0];
  return {
    equipo: fila.equipo,
    texto: `${fila.equipo} · ${fila.pos}.º ${fila.grupo}`,
    detalle: top.length ? top.map((j) => `${apellido(j.nombre)} ${j.pts}`).join(" · ") : "Aún sin partidos en las hojas de esta temporada",
  };
}

// Panel de la semana (maqueta Gestion, D76): rutinas, partidos del domingo y pendientes. El recuadro del entreno con las
// respuestas de SportEasy queda como hueco hasta el paso 2.
export default async function InicioGestion() {
  const { supabase } = await exigirGestor();
  const [{ count: jugadores }, { count: conCorreo }, { data: campanas }, liga] = await Promise.all([
    supabase.from("jugadores").select("id", { count: "exact", head: true }).eq("activo", true),
    supabase.from("jugadores").select("id", { count: "exact", head: true }).eq("activo", true).not("email", "is", null),
    supabase.from("campanas_ropa").select("id, nombre, estado, fecha_limite").order("creado_en", { ascending: false }).limit(1),
    cargarLiga(supabase).catch(() => null),
  ]);
  const campana = campanas?.[0];
  const { count: pedidos } = campana
    ? await supabase.from("pedidos_ropa").select("id", { count: "exact", head: true }).eq("campana_id", campana.id)
    : { count: 0 };

  const hoy = hoyMadrid();
  const proximos = proximosPartidos(hoy);
  const fecha = proximos.map((p) => p.evento.fecha).sort()[0];
  const delDomingo = proximos.filter((p) => p.evento.fecha === fecha).map((p) => p.evento);
  const jornada = delDomingo[0]?.jornada;
  const mismaHora = delDomingo.length === 2 && delDomingo[0].inicio && delDomingo[0].inicio === delDomingo[1].inicio;
  const conAviso = delDomingo.filter((e) => e.aviso?.hay);
  const resultados = ultimosResultados(hoy);
  const sinActa = resultados.filter((r) => r.pendienteActa);
  const entreno = eventosEntrenos().find((e) => e.fecha >= hoy);
  const habitual = entrenoHabitual();
  const sinCorreo = (jugadores ?? 0) - (conCorreo ?? 0);

  const pendientes: string[] = [];
  if (entreno?.pistaPorConfirmar) pendientes.push(`Fijar la pista del entreno del ${diaSemanaCorto(entreno.fecha)} ${diaMes(entreno.fecha)} (${entreno.nota ?? "pista por confirmar"}).`);
  if (jornada) pendientes.push(`Convocatoria de la J${jornada}: reparto MdA / MdL y aviso de equipación (rutina C, lunes y martes).`);
  if (sinActa.length) pendientes.push(`J${sinActa[0].jornada ?? "?"} publicada sin acta: completarla cuando la FBM suba las actas (rutina A).`);
  if (/pendiente de contrastar/i.test(estadoClasificacion())) pendientes.push("Contrastar la clasificación calculada con la oficial (rutina B, jueves).");
  if (sinCorreo > 0) pendientes.push(`${sinCorreo} ${sinCorreo === 1 ? "jugador sin correo: no puede" : "jugadores sin correo: no pueden"} entrar.`);
  if (campana?.estado === "abierta") pendientes.push(`Pedido de ropa abierto${campana.fecha_limite ? ` hasta el ${fechaCorta(campana.fecha_limite)}` : ""}: ${pedidos ?? 0} pedidos.`);

  return (
    <>
      <div className="gs-titulo">
        <div>
          <div className="gs-eyebrow">Panel de gestión{fecha ? ` · ${textoSemana(fecha)}` : ""}</div>
          <h1>{jornada ? `Jornada ${jornada}` : "Temporada terminada"}</h1>
        </div>
        <span className="pastilla pastilla-pendiente" title="Llega en el paso 2">Preparar convocatoria: llega en el paso 2</span>
      </div>

      <section aria-label="Rutinas semanales" className="gs-rutinas">
        <div className="gs-caja">
          <div className="gs-caja-cab"><span className="gs-eyebrow">A · Actas y estadísticas</span>
            {sinActa.length ? <span className="pastilla etiqueta-aviso">Esperando FBM</span> : <span className="pastilla pastilla-ok">Al día</span>}</div>
          <strong>{resultados.length ? `J${resultados[0].jornada ?? "?"} publicada${sinActa.length ? " sin acta" : ""}` : "Sin partidos jugados"}</strong>
          <span>{sinActa.length ? "Cuando la FBM suba las actas, se completan cuartos, hora y pista." : "Cada lunes, hojas de la FBM de los dos grupos."}</span>
        </div>
        <div className="gs-caja">
          <div className="gs-caja-cab"><span className="gs-eyebrow">B · Calendario</span><span className="pastilla">Jue 20:15</span></div>
          <strong>Revisión oficial del jueves</strong>
          <span>Horarios, pistas, clasificación oficial y colores de los rivales.</span>
        </div>
        <div className="gs-caja">
          <div className="gs-caja-cab"><span className="gs-eyebrow">C · Convocatoria</span><span className="pastilla">Lun–Mar</span></div>
          <strong>Reparto MdA / MdL</strong>
          <span>
            {mismaHora ? "Misma hora los dos: sin dobladores esta jornada." : delDomingo.length === 2 ? `MdA a las ${delDomingo.find((e) => e.equipo === "MDA")?.inicio ?? "?"} y MdL a las ${delDomingo.find((e) => e.equipo === "MDL")?.inicio ?? "?"}.` : delDomingo.length === 1 ? `Solo juega ${NOMBRE_EQUIPO[delDomingo[0].equipo!]}.` : "Sin partidos."}
            {conAviso.length ? ` Equipación: ${conAviso.length === 1 ? "1 aviso" : `${conAviso.length} avisos`}.` : ""}
          </span>
        </div>
      </section>

      <div className="gs-dos">
        <div className="gs-izq">
          <section className="gs-bloque" aria-labelledby="t-prox">
            <div className="gs-bloque-cab">
              <h2 id="t-prox">Partidos del domingo</h2>
              {fecha && <span className="gs-eyebrow">{diaSemanaCorto(fecha)} {diaMes(fecha)}</span>}
            </div>
            {delDomingo.length ? (
              <div className="tabla-desplazable">
                <table className="gs-tabla">
                  <thead><tr><th>Equipo</th><th>Partido</th><th>Hora · pista</th><th>Equipación</th><th>Convocados</th></tr></thead>
                  <tbody>
                    {delDomingo.map((e) => {
                      const chip = chipEquipacion(e.aviso);
                      return (
                        <tr key={e.id} className="eq-partido" data-equipo={e.equipo}>
                          <td><span className={`chip-eq chip-${e.equipo}`}>{NOMBRE_EQUIPO[e.equipo!]}</span></td>
                          <td style={{ fontWeight: 600 }}>{cruce(e)}</td>
                          <td className="cifra" style={{ whiteSpace: "nowrap" }}>{e.inicio ?? "¿?"} · P{e.partido?.campo ?? "?"}</td>
                          <td>{chip ? <span className={`pastilla pastilla-${chip.tipo}`}>{chip.texto}</span> : <span className="pastilla">Negra</span>}</td>
                          <td className="tenue">Pendiente</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="suave" style={{ margin: 0 }}>No quedan partidos de liga en el calendario.</p>}
            {conAviso.map((e) => (
              <div key={e.id}>
                <p className="pequeno" style={{ margin: "0 0 4px", fontWeight: 600 }}>{cruce(e)}</p>
                <AvisoCaja a={e.aviso!} />
              </div>
            ))}
            {delDomingo.length > 0 && (
              <div className="gs-scouting">
                {delDomingo.map((e) => {
                  const s = scoutingDe(liga, e);
                  return (
                    <Link key={e.id} href={s ? `/gestion/scouting?e=${encodeURIComponent(s.equipo)}${e.equipo === "MDL" ? "&v=mdl" : ""}` : "/gestion/scouting"}>
                      <small>Scouting · próximo rival {NOMBRE_EQUIPO[e.equipo!]}</small>
                      <strong>{s?.texto ?? e.rival}</strong>
                      <span>{s?.detalle ?? "Sin datos de liga cargados"}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="gs-der">
          <section className="gs-bloque" aria-labelledby="t-entreno">
            <div className="gs-bloque-cab">
              <h2 id="t-entreno">Entreno del miércoles</h2>
              {entreno && <span className="gs-eyebrow">{diaSemanaCorto(entreno.fecha)} {+entreno.fecha.slice(8)} · {entreno.inicio}</span>}
            </div>
            {entreno ? (
              <span className="pequeno suave">
                {entreno.inicio}–{entreno.fin} · {entreno.pistaPorConfirmar ? <b>pista por confirmar ({entreno.nota})</b> : <>{entreno.lugar}{entreno.nota ? `, ${entreno.nota.replace(/\.$/, "").toLowerCase()}` : ""}</>}
                {" "}(lo habitual: miércoles {habitual.inicio}–{habitual.fin} en {habitual.pista}{habitual.enObras ? ", en obras" : ""})
              </span>
            ) : <span className="suave">No quedan entrenos en el calendario.</span>}
            <div className="hueco" data-testid="hueco-sporteasy">
              Respuestas al entreno (van, sin responder, no van): llegan en el paso 2, leídas de SportEasy. El recordatorio lo propondrá Claude y lo enviarás tú.
            </div>
          </section>

          <section className="gs-bloque" aria-labelledby="t-pendiente">
            <h2 id="t-pendiente">Pendiente esta semana</h2>
            {pendientes.length ? <ul className="gs-pendientes">{pendientes.map((p) => <li key={p}>{p}</li>)}</ul> : <p className="suave" style={{ margin: 0 }}>Nada pendiente.</p>}
          </section>

          <section className="gs-bloque" aria-labelledby="t-plantilla">
            <h2 id="t-plantilla">Plantilla</h2>
            <div className="gs-cifras">
              <div><b>{jugadores ?? 0}</b><span>personas activas</span></div>
              <div><b>{conCorreo ?? 0}</b><span>con correo dado de alta (pueden entrar)</span></div>
            </div>
            <Link href="/gestion/jugadores" style={{ fontWeight: 600 }}>Gestionar jugadores y correos →</Link>
          </section>

          <section className="gs-bloque" aria-labelledby="t-ropa">
            <h2 id="t-ropa">Pedido de ropa</h2>
            {campana ? (
              <p style={{ margin: 0 }}>{campana.nombre}: <span className={`etiqueta ${campana.estado === "abierta" ? "etiqueta-abierta" : "etiqueta-cerrada"}`}>{campana.estado === "abierta" ? "Abierta" : "Cerrada"}</span> · {pedidos ?? 0} pedidos.</p>
            ) : <p style={{ margin: 0 }}>No hay ninguna campaña.</p>}
            <Link href="/gestion/ropa" style={{ fontWeight: 600 }}>Ver pedido de ropa →</Link>
          </section>
        </div>
      </div>
    </>
  );
}
