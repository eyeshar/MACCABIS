import type { Metadata } from "next";
import MarcoPublico from "@/components/web/Marco";
import AvisoTarjeta from "@/components/AvisoTarjeta";
import Clasificacion, { type GrupoClas } from "@/components/web/Clasificacion";
import CalendarioPublico, { type EventoPublico } from "@/components/web/CalendarioPublico";
import { CalendarioMas } from "@/components/Iconos";
import {
  chipEquipacion, clasificaciones, estadoClasificacion, eventosTemporada, lideres, proximosPartidos, resumenHistoria,
  top, ultimosResultados, type Proximo, type Resultado,
} from "@/lib/publico";
import { diaLargo, diaMes, diaMesLargo, hoyMadrid } from "@/lib/dias";
import { FUNDACION, GRUPO_EQUIPO, NOMBRE_EQUIPO, estadisticas } from "@/lib/web";
import { origen } from "@/lib/sesion";

// Portada publica (D76, maquetas Main y PortadaMovil): sin login, solo datos publicos (lib/publico.ts).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Maccabis · Baloncesto en Madrid" };

const TEMPORADA = "26/27";

function TarjetaPartido({ p }: { p: Proximo }) {
  const e = p.evento;
  const nuestro = NOMBRE_EQUIPO[p.equipo];
  const local = e.local ? nuestro : e.rival!;
  const visitante = e.local ? e.rival! : nuestro;
  return (
    <article className="w-panel w-partido" data-equipo={p.equipo} aria-label={`${nuestro}: ${e.titulo}`}>
      <div className="w-partido-cab">
        <span className={`chip-eq chip-${p.equipo}`}>{nuestro} · {GRUPO_EQUIPO[p.equipo]}</span>
        <span className="cifra">
          {diaMes(e.fecha)} · {e.inicio ?? "hora por confirmar"} · {e.partido?.campo ? `Pista ${e.partido.campo}` : "pista por confirmar"} · {e.local ? "En casa" : "Fuera"}
        </span>
      </div>
      <div className="w-vs">
        <div className={`w-local${e.local ? " w-nuestro" : ""}`}>{local}</div>
        <div className="w-contra">vs</div>
        <div className={`w-visit${!e.local ? " w-nuestro" : ""}`}>{visitante}</div>
      </div>
      <AvisoTarjeta aviso={e.aviso} />
      {p.descansaAntes.length > 0 && <p className="w-descansa">{nuestro} descansa antes en la J{p.descansaAntes.join(", J")}.</p>}
    </article>
  );
}

function Marcador({ r }: { r: Resultado }) {
  const nuestro = NOMBRE_EQUIPO[r.equipo];
  const [izq, der, pi, pd] = r.local === false ? [r.rival, nuestro, r.pc, r.pf] : [nuestro, r.rival, r.pf, r.pc];
  return (
    <div className="w-resultado" data-equipo={r.equipo}>
      <span className={`w-gp w-gp-${r.gano ? "G" : "P"}`} aria-label={r.gano ? "Ganado" : "Perdido"}>{r.gano ? "G" : "P"}</span>
      <span className="w-rival">
        <span className={izq === nuestro ? "" : "suave"} style={izq === nuestro ? { fontWeight: 700 } : undefined}>{izq}</span>
        {" – "}
        <span className={der === nuestro ? "" : "suave"} style={der === nuestro ? { fontWeight: 700 } : undefined}>{der}</span>
      </span>
      <span className="w-marcador">{pi} – {pd}</span>
    </div>
  );
}

export default async function Portada({ searchParams }: { searchParams: Promise<{ hoy?: string }> }) {
  const { hoy: hoyPrueba } = await searchParams;
  // ?hoy=AAAA-MM-DD fija la fecha (solo para pruebas y revisiones; los datos son publicos igualmente).
  const hoy = hoyPrueba && /^\d{4}-\d{2}-\d{2}$/.test(hoyPrueba) ? hoyPrueba : hoyMadrid();

  const proximos = proximosPartidos(hoy);
  const mismaFecha = proximos.length > 1 && proximos.every((p) => p.evento.fecha === proximos[0].evento.fecha && p.evento.jornada === proximos[0].evento.jornada);
  const resultados = ultimosResultados(hoy);
  const grupos: GrupoClas[] = clasificaciones().map((g) => {
    const t = top(g.filas);
    return { grupo: g.grupo, equipo: g.equipo, nombre: NOMBRE_EQUIPO[g.equipo], tras: g.tras, filas: t.arriba, nuestroAbajo: t.nuestroAbajo };
  });
  const lid = lideres();
  const historia = resumenHistoria();
  const todos = eventosTemporada();
  const eventos: EventoPublico[] = todos.filter((e) => e.fecha >= hoy).map((e) => ({
    id: e.id, tipo: e.tipo, fecha: e.fecha, inicio: e.inicio, fin: e.fin, titulo: e.titulo, lugar: e.lugar,
    pistaPorConfirmar: e.pistaPorConfirmar, nota: e.nota, equipo: e.equipo, campo: e.partido?.campo ?? null, chip: chipEquipacion(e.aviso),
  }));
  const ultimoDia = todos.at(-1)?.fecha;
  const base = await origen();
  const feed = `${base}/calendario.ics`;
  const webcal = feed.replace(/^https?:/, "webcal:");

  return (
    <MarcoPublico actual="inicio">
      <section className="w-dentro w-heroe">
        <div className="w-heroe-texto">
          <div className="w-eyebrow">Liga Municipal Moratalaz · Temporada {TEMPORADA}</div>
          <h1 className="w-h1">Dos equipos.<br /><span>Una plantilla.</span></h1>
          <p className="w-lead">
            Maccabis juega en Madrid desde {FUNDACION}. MdA en el grupo 1 y MdL en el grupo 2, con jugadores que doblan en los
            dos. Resultados, estadísticas e historia del club, al día después de cada jornada.
          </p>
          <div className="w-ctas">
            <a className="w-cta w-cta-claro" href="#calendario">Ver calendario</a>
            <a className="w-cta w-cta-linea" href="#liga">Clasificación</a>
          </div>
        </div>

        <div id="partidos" className="w-proxima" aria-labelledby="t-proxima">
          <div className="w-proxima-cab">
            <h2 id="t-proxima">{proximos.length ? "Próxima jornada" : "Temporada terminada"}</h2>
            {mismaFecha && <span className="w-meta">J{proximos[0].evento.jornada} · {diaLargo(proximos[0].evento.fecha)}</span>}
          </div>
          {proximos.map((p) => <TarjetaPartido key={p.equipo} p={p} />)}
          {!proximos.length && <p className="w-nota">No quedan partidos de liga en el calendario.</p>}
        </div>
      </section>

      {resultados.length > 0 && (
        <section aria-label="Últimos resultados" className="w-banda">
          <div className="w-dentro w-banda-fila">
            <span className="w-meta">{resultados[0].jornada ? `J${resultados[0].jornada} · ` : ""}{diaMes(resultados[0].fecha)}</span>
            {resultados.map((r) => <Marcador key={r.equipo} r={r} />)}
            {resultados.some((r) => r.pendienteActa) && <span className="w-banda-nota">Pendiente de acta oficial</span>}
          </div>
        </section>
      )}

      <section id="liga" className="w-dentro w-seccion" aria-labelledby="t-liga">
        <div className="w-seccion-cab">
          <h2 id="t-liga">Clasificación</h2>
          <a className="w-mas" href={estadisticas("liga")}>Clasificación completa y resultados →</a>
        </div>
        <Clasificacion grupos={grupos} />
        <p className="w-nota">{estadoClasificacion()}</p>
      </section>

      <section id="plantilla" className="w-dentro w-seccion" aria-labelledby="t-lideres">
        <div className="w-seccion-cab">
          <h2 id="t-lideres">Líderes Maccabis</h2>
          <a className="w-mas" href={estadisticas("jugadores")}>Estadísticas de toda la plantilla →</a>
        </div>
        {lid.length ? (
          <div className="w-lideres">
            {lid.map((l) => (
              <div key={l.clave} className="w-panel w-lider" data-lider={l.clave}>
                <span className="mono" style={{ color: "var(--c-amarillo)" }}>{l.titulo}</span>
                <span className="w-lider-n">{l.valor}</span>
                <span className="w-lider-nom">{l.nombre}</span>
                <span className="w-lider-det">{l.detalle}</span>
              </div>
            ))}
          </div>
        ) : <p className="w-nota">Aún no hay partidos con estadísticas esta temporada.</p>}
      </section>

      <section id="calendario" className="w-dentro w-seccion" aria-labelledby="t-calendario">
        <div className="w-cal-cab">
          <div>
            <h2 id="t-calendario">Calendario</h2>
            <span className="suave">Partidos de MdA y MdL y entrenamientos del club. Se actualiza cada jueves con la programación oficial.</span>
          </div>
          <details className="w-anadir">
            <summary><CalendarioMas />Añadir a mi calendario</summary>
            <div className="w-anadir-menu">
              <a href={webcal}>iPhone, iPad o Mac<small>Se suscribe y se actualiza solo</small></a>
              <a href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`}>Google Calendar<small>Android o web; se actualiza solo</small></a>
              <a href="/calendario.ics" download="maccabis.ics">Descargar el archivo (.ics)<small>Para Outlook u otros; no se actualiza</small></a>
            </div>
          </details>
        </div>
        <CalendarioPublico eventos={eventos} ultimoDia={ultimoDia ? diaMesLargo(ultimoDia) : ""} />
        <p className="w-nota">Solo partidos y entrenos: el calendario no lleva ningún dato personal.</p>
      </section>

      <section id="historia" className="w-dentro w-seccion" aria-labelledby="t-historia">
        <div className="w-historia">
          <div className="w-historia-texto">
            <span className="w-eyebrow w-naranja">Desde {FUNDACION}</span>
            <h2 id="t-historia">La historia del club</h2>
            <p>Cada temporada, cada partido con estadísticas y todos los que han vestido la camiseta.</p>
            <a className="w-mas" href={estadisticas("historia")}>Explorar la historia →</a>
          </div>
          <div className="w-cifras" data-testid="cifras-historia">
            <div><b>{historia.partidos_con_estadisticas}</b><span>partidos con estadísticas</span></div>
            <div><b className="w-verde">{historia.victorias}</b><span>victorias</span></div>
            <div><b>{historia.jugadores_en_la_historia}</b><span>jugadores en la historia</span></div>
          </div>
        </div>
      </section>
    </MarcoPublico>
  );
}
