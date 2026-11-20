import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Volver from "@/components/nav/Volver";
import { exigirSesion } from "@/lib/sesion";
import { cargarFantasy, esFantasy } from "@/lib/fantasy/datos";
import "../fantasy.css";
// Las capturas que ilustran la página (las mismas pantallas del manual, con NOMBRES INVENTADOS: el repositorio es público).
// Se regeneran con `npm run fantasy:manual` (scripts/fantasy/manual.mjs).
import imgCrear from "./imagenes/manual_01_crear.png";
import imgPlantilla from "./imagenes/manual_02_plantilla.png";
import imgMercado from "./imagenes/manual_03_mercado.png";
import imgClausulazo from "./imagenes/manual_04_clausulazo.png";
import imgJornada from "./imagenes/manual_05_jornada.png";
import imgRanking from "./imagenes/manual_06_ranking.png";
import imgCarta from "./imagenes/manual_07_carta.png";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cómo se juega · MdFantasy", robots: { index: false, follow: false } };

// «Cómo se juega» (D196): las reglas en lenguaje llano. TODAS las cifras salen de los parámetros vigentes (Ajustes): si un
// gestor cambia uno, esta página cambia sola. Ninguna cifra del juego se escribe a mano aquí.
const num = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 2 });
const signo = (n: number) => (n > 0 ? `+${num(n)}` : n < 0 ? `−${num(-n)}` : "0");

const SECCIONES = [
  { id: "en-30-segundos", texto: "En 30 segundos" }, { id: "tu-plantilla", texto: "Tu plantilla" }, { id: "capitan", texto: "Capitán y vicecapitán" },
  { id: "puntos", texto: "Cómo puntúa un jugador" }, { id: "mercado", texto: "El mercado" }, { id: "semana", texto: "La semana" },
  { id: "duelos", texto: "Duelos, porra y premios" }, { id: "preguntas", texto: "Preguntas frecuentes" },
] as const;

function Figura({ img, alt, pie }: { img: { src: string; width: number; height: number }; alt: string; pie: string }) {
  return (
    <figure className="fz-como-fig">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.src} width={img.width} height={img.height} alt={alt} loading="lazy" decoding="async" />
      <figcaption>{pie}</figcaption>
    </figure>
  );
}

export default async function ComoSeJuega() {
  const { supabase } = await exigirSesion();
  const f = await cargarFantasy(supabase);
  if (!esFantasy(f)) redirect("/mdfantasy");
  const P = f.P;
  const D = ({ k, children }: { k: string; children: React.ReactNode }) => <b data-p={k}>{children}</b>;

  return (
    <main className="pagina fz fz-como" data-testid="fz-como">
      <Volver defecto="/mdfantasy" etiqueta="MdFantasy" />
      <h1 className="fz-h1">Cómo se juega</h1>
      <nav className="fz-chips fz-como-indice" aria-label="En esta página" data-testid="fz-como-indice">
        {SECCIONES.map((s) => <a key={s.id} href={`#${s.id}`}>{s.texto}</a>)}
      </nav>
      <p className="tenue pequeno" data-testid="fz-como-nota">Las imágenes son de ejemplo: los nombres son inventados.</p>

      <section className="gs-bloque" id="en-30-segundos" aria-labelledby="t-30">
        <h2 id="t-30" className="fz-h2">En 30 segundos</h2>
        <p>MdFantasy es un fantasy en el que los jugadores somos nosotros. Tienes una plantilla de <D k="plantilla">{num(P.plantilla)}</D> compañeros, alineas a <D k="alineados">{num(P.alineados)}</D> cada domingo y sumas lo que hagan de verdad. Gana quien más puntos acumule en la temporada.</p>
        <Figura img={imgCrear} alt="Pantalla de Inicio de quien aún no tiene equipo: la tarjeta «Hazte mánager» con los botones «Cómo se juega» y «Crear mi equipo»." pie="Así empiezas: «Crear mi equipo»." />
      </section>

      <section className="gs-bloque" id="tu-plantilla" aria-labelledby="t-plantilla">
        <h2 id="t-plantilla" className="fz-h2">Tu plantilla</h2>
        <ul className="fz-reglas">
          <li>Al crear tu equipo te tocan <D k="plantilla">{num(P.plantilla)}</D> jugadores al azar, de valor parecido para todos, y <D k="cajaInicial">{num(P.cajaInicial)} M</D> en caja.</li>
          <li>No puedes tenerte a ti mismo.</li>
          <li>Cada jornada alineas a <D k="alineados">{num(P.alineados)}</D>. Solo puntúan por rendimiento los que están convocados; verás la marca en cada jugador.</li>
          <li>Si no cambias nada, tu alineación se mantiene.</li>
        </ul>
        <p className="fz-como-ir"><Link href="/mdfantasy?tab=plantilla">Ir a Plantilla ›</Link></p>
        <Figura img={imgPlantilla} alt="Pestaña Plantilla: caja, valor de plantilla y jugadores arriba; debajo, la pista con los cinco alineados, cada uno con su marca de convocado y los botones C, V y bajar al banquillo; al final, el banquillo con el botón «Alinear»." pie="Plantilla: tus cinco alineados en la pista y el banquillo debajo." />
      </section>

      <section className="gs-bloque" id="capitan" aria-labelledby="t-capitan">
        <h2 id="t-capitan" className="fz-h2">Capitán y vicecapitán</h2>
        <ul className="fz-reglas">
          <li>El capitán dobla su rendimiento.</li>
          <li>No puede ser el mismo dos jornadas seguidas.</li>
          <li>Si el capitán no juega, dobla el vicecapitán.</li>
        </ul>
        <Figura img={imgJornada} alt="Pestaña Jornada: tu total frente a la media de la liga con una barra, y la tabla «Tu alineación» con rendimiento, compromiso, el extra del capitán (marcado con una C) y el total de cada jugador." pie="Jornada: el capitán (C) suma su rendimiento dos veces." />
      </section>

      <section className="gs-bloque" id="puntos" aria-labelledby="t-puntos">
        <h2 id="t-puntos" className="fz-h2">Cómo puntúa un jugador</h2>
        <h3 className="fz-h3">Rendimiento (lo que hace en el partido)</h3>
        <ul className="fz-reglas">
          <li><D k="puntoPorPunto">{num(P.puntoPorPunto)}</D> por cada punto anotado.</li>
          <li>Su +/- comparado con el del equipo en sus minutos, hasta <D k="masMenosTope">±{num(P.masMenosTope)}</D>.</li>
          <li>Si juega dos partidos el mismo domingo: la media de los dos más <D k="bonusDoblete">{num(P.bonusDoblete)}</D>.</li>
          <li>Nunca menos de 0.</li>
        </ul>
        <h3 className="fz-h3">Compromiso (lo que hace durante la semana)</h3>
        <ul className="fz-reglas">
          <li>Contestar en la web en menos de <D k="horasRapida">{num(P.horasRapida)} h</D>: <D k="respuestaRapida">{signo(P.respuestaRapida)}</D>.</li>
          <li>Contestar antes del plazo: <D k="respuestaATiempo">{signo(P.respuestaATiempo)}</D>.</li>
          <li>No contestar: <D k="sinRespuesta">{signo(P.sinRespuesta)}</D>.</li>
          <li>Ir al entreno: <D k="entrenoAsistido">{signo(P.entrenoAsistido)}</D>.</li>
          <li>Decir «voy» y no aparecer: <D k="planton">{signo(P.planton)}</D>.</li>
          <li>Máximo <D k="topeCompromiso">{num(P.topeCompromiso)}</D> por semana.</li>
        </ul>
        <p>Un jugador no convocado solo suma compromiso.</p>
        <Figura img={imgCarta} alt="Carta de un jugador: su valor, su media de las últimas jornadas y de la temporada, una barra que reparte sus puntos entre rendimiento y compromiso, y sus últimas jornadas una a una." pie="La carta de cada jugador: de dónde salen sus puntos." />
      </section>

      <section className="gs-bloque" id="mercado" aria-labelledby="t-mercado">
        <h2 id="t-mercado" className="fz-h2">El mercado</h2>
        <ul className="fz-reglas">
          <li>El valor de cada jugador es su media de las últimas <D k="jornadasValor">{num(P.jornadasValor)}</D> jornadas, en millones. Sube y baja solo.</li>
          <li>Cada jugador tiene un número limitado de copias.</li>
          <li>Si queda una copia libre, la fichas por su valor.</li>
          <li>Si no queda ninguna, puedes pagar la cláusula (valor × <D k="clausula">{num(P.clausula)}</D>) y quitársela al mánager que elijas. Él cobra ese dinero. Un clausulazo por jornada.</li>
          <li>Vender devuelve el valor actual del jugador.</li>
          <li>Cada jornada cobras dinero según tus puntos.</li>
        </ul>
        <p className="fz-como-ir"><Link href="/mdfantasy?tab=mercado">Ir a Mercado ›</Link></p>
        <Figura img={imgMercado} alt="Pestaña Mercado: lista de jugadores con su valor, copias libres y marca de convocado. Uno se puede fichar, dos solo con clausulazo y otro ya lo tienes." pie="Mercado: «Fichar» si queda copia libre, «Clausulazo» si no, «Lo tienes» si ya es tuyo." />
        <Figura img={imgClausulazo} alt="El cuadro del clausulazo abierto en un jugador: la pregunta «¿A quién se lo quitas?» con un desplegable de mánagers y los botones «Pagar» y «No»." pie="El clausulazo: eliges a qué mánager se lo quitas y pagas." />
      </section>

      <section className="gs-bloque" id="semana" aria-labelledby="t-semana">
        <h2 id="t-semana" className="fz-h2">La semana</h2>
        <ul className="fz-reglas">
          <li>Al publicarse las estadísticas: se reparten puntos y dinero y abre el mercado.</li>
          <li>Al publicarse la convocatoria: ya sabes quién juega; ajusta tu equipo.</li>
          <li>Sábado a las 20:00: se cierran los clausulazos.</li>
          <li>Domingo, a la hora del primer partido: se cierra todo.</li>
        </ul>
        <p className="fz-como-ir"><Link href="/mdfantasy?tab=jornada">Ir a Jornada ›</Link></p>
      </section>

      <section className="gs-bloque" id="duelos" aria-labelledby="t-duelos">
        <h2 id="t-duelos" className="fz-h2">Duelos, porra y premios</h2>
        <ul className="fz-reglas">
          <li>Cada jornada te enfrentas a otro mánager. Los duelos tienen su propia clasificación.</li>
          <li>Porra: acierta si gana o pierde cada equipo, <D k="porraAcierto">{signo(P.porraAcierto)}</D> por acierto.</li>
          <li>Hay logros, quinteto ideal de cada jornada y premios del mes.</li>
        </ul>
        <p className="fz-como-ir"><Link href="/mdfantasy?tab=ranking">Ir a Ranking ›</Link></p>
        <Figura img={imgRanking} alt="Pestaña Ranking: el podio con tres escalones para los tres primeros mánagers y, debajo, la lista de todos con sus puntos." pie="Ranking: el podio y la clasificación de mánagers." />
      </section>

      <section className="gs-bloque" id="preguntas" aria-labelledby="t-preguntas">
        <h2 id="t-preguntas" className="fz-h2">Preguntas frecuentes</h2>
        <dl className="fz-faq">
          <dt>¿Ven los demás mi alineación?</dt><dd>No hasta el cierre. Tu plantilla sí.</dd>
          <dt>¿Se ve si doy plantón?</dt><dd>Sí, aparece como «no vino». El motivo de una ausencia solo lo ven los gestores.</dd>
          <dt>¿Qué pasa si no me convocan?</dt><dd>Sigues sumando compromiso para quien te tenga.</dd>
          <dt>¿Y si me quitan un jugador con un clausulazo?</dt><dd>Cobras la cláusula y te queda un hueco para fichar.</dd>
          <dt>¿Puedo apuntarme más tarde?</dt><dd>Sí, recibes tu plantilla en ese momento.</dd>
          <dt>¿Los gestores juegan con ventaja?</dt><dd>No pueden comprar ni vender mientras preparan la convocatoria.</dd>
        </dl>
      </section>
      <p><Link href="/mdfantasy" className="boton boton-amarillo boton-bloque" data-testid="fz-como-volver">Ir a MdFantasy</Link></p>
    </main>
  );
}
