import type { Metadata } from "next";
import Link from "next/link";
import MarcoPublico from "@/components/web/Marco";
import { entrenoHabitual, eventosEntrenos, resumenHistoria } from "@/lib/publico";
import { diaLargo, hoyMadrid } from "@/lib/dias";
import { FUNDACION } from "@/lib/web";

// "El club" (D86): que es Maccabis, desde 2013, MdA y MdL, cifras de historia (las mismas de la portada, de los datos),
// entrenos y donde jugamos. Sin datos personales. La rejilla completa de la Historia sigue en GitHub Pages.
export const metadata: Metadata = {
  title: "El club · Maccabis",
  description: `Maccabis, club de baloncesto amateur de Madrid desde ${FUNDACION}: MdA y MdL en la Liga Municipal de Moratalaz, una sola plantilla.`,
  alternates: { canonical: "/club" },
};
export const dynamic = "force-dynamic";

export default function Club() {
  const h = resumenHistoria();
  const habitual = entrenoHabitual();
  const proximo = eventosEntrenos().find((e) => e.fecha >= hoyMadrid());
  return (
    <MarcoPublico actual="club">
      <section className="w-dentro w-heroe" style={{ paddingBottom: 8 }}>
        <div className="w-heroe-texto">
          <div className="w-eyebrow">El club · Desde {FUNDACION}</div>
          <h1 className="w-h1">Maccabis.<br /><span>Baloncesto en Madrid.</span></h1>
          <p className="w-lead">
            Club de baloncesto amateur, nacido en la temporada {FUNDACION}/{String(FUNDACION + 1).slice(2)}. Somos un solo equipo humano
            dividido en dos fichas para que pueda jugar todo el mundo: MdA y MdL, en la Liga Municipal de Moratalaz (Juegos
            Deportivos Municipales, sénior masculino).
          </p>
        </div>
      </section>

      <section className="w-dentro w-seccion" aria-labelledby="t-equipos">
        <div className="w-seccion-cab"><h2 id="t-equipos">Dos equipos, una plantilla</h2></div>
        <div className="w-clas">
          <article className="w-panel w-partido" data-equipo="MDL">
            <div className="w-partido-cab"><span className="chip-eq chip-MDL">MdL · Grupo 2</span><span className="cifra">26/27</span></div>
            <h3 style={{ margin: 0, fontSize: 30, textTransform: "uppercase" }}>Maccabi de Levantar</h3>
            <p className="suave" style={{ margin: 0 }}>El equipo original del club. En 2026/27 juega en el grupo 2 de la liga de Moratalaz.</p>
          </article>
          <article className="w-panel w-partido" data-equipo="MDA">
            <div className="w-partido-cab"><span className="chip-eq chip-MDA">MdA · Grupo 1</span><span className="cifra">26/27</span></div>
            <h3 style={{ margin: 0, fontSize: 30, textTransform: "uppercase" }}>Maccabi de Acostar</h3>
            <p className="suave" style={{ margin: 0 }}>La segunda ficha, creada después. En 2026/27 juega en el grupo 1.</p>
          </article>
        </div>
        <p className="w-nota">
          Muchos jugadores tienen ficha en los dos equipos y pueden jugar con ambos el mismo domingo si los horarios no se
          solapan. Equipación: negra la primera y amarilla la segunda.
        </p>
      </section>

      <section className="w-dentro w-seccion" aria-labelledby="t-historia-club">
        <div className="w-historia">
          <div className="w-historia-texto">
            <span className="w-eyebrow w-naranja">Desde {FUNDACION}</span>
            <h2 id="t-historia-club">En cifras</h2>
            <p>{h.temporadas_con_datos} temporadas con estadísticas, de todas las que tenemos datos.</p>
            <Link className="w-mas" href="/historia">Ver la rejilla completa de la historia →</Link>
          </div>
          <div className="w-cifras" data-testid="cifras-historia">
            <div><b>{h.partidos_con_estadisticas}</b><span>partidos con estadísticas</span></div>
            <div><b className="w-verde">{h.victorias}</b><span>victorias</span></div>
            <div><b>{h.jugadores_en_la_historia}</b><span>jugadores en la historia</span></div>
          </div>
        </div>
      </section>

      <section className="w-dentro w-seccion" aria-labelledby="t-donde">
        <div className="w-seccion-cab"><h2 id="t-donde">Entrenos y partidos</h2></div>
        <div className="w-clas">
          <div className="w-panel w-partido" data-testid="club-entrenos">
            <span className="chip-eq chip-entreno" style={{ alignSelf: "flex-start" }}>ENTRENO</span>
            <h3 style={{ margin: 0, fontSize: 26, textTransform: "uppercase" }}>Miércoles, {habitual.inicio}–{habitual.fin}</h3>
            <p className="suave" style={{ margin: 0 }}>
              Dónde se entrena: <b>{habitual.pista}</b>.{habitual.enObras ? <> Ahora está <b className="w-confirmar">en obras</b>: la pista de cada semana se confirma en el calendario.</> : null}
            </p>
            <p className="w-nota" style={{ margin: 0 }}>No es la instalación de los partidos: son dos sitios distintos.</p>
            {proximo && (
              <p style={{ margin: 0 }}>
                Próximo: {diaLargo(proximo.fecha)}, {proximo.inicio}–{proximo.fin} · {proximo.pistaPorConfirmar ? "pista por confirmar" : proximo.lugar}.
              </p>
            )}
            <Link className="w-mas" href="/#calendario">Calendario de entrenos y partidos →</Link>
          </div>
          <div className="w-panel w-partido" data-testid="club-partidos">
            <span className="chip-eq chip-MDA" style={{ alignSelf: "flex-start" }}>LIGA</span>
            <h3 style={{ margin: 0, fontSize: 26, textTransform: "uppercase" }}>Domingos por la mañana</h3>
            <p className="suave" style={{ margin: 0 }}>
              Liga Municipal de Moratalaz (JDM). Hora y pista de cada partido, en el calendario oficial que revisamos cada jueves.
            </p>
            <p style={{ margin: 0 }} data-testid="club-instalacion-partidos">
              <b>Centro Deportivo Municipal Moratalaz</b><br />
              Calle de Valdebernardo, 2, 28030 Madrid<br />
              Metro: Pavones (L9)
            </p>
            <Link className="w-mas" href="/liga">Clasificación y resultados →</Link>
          </div>
        </div>
      </section>

      <section className="w-dentro w-seccion" aria-labelledby="t-unete">
        <div className="w-seccion-cab"><h2 id="t-unete">Jugadores y gestores</h2></div>
        <p className="suave" style={{ margin: 0, maxWidth: 680 }}>
          Los jugadores del club entran en su zona con el correo que tienen dado de alta: su agenda, sus estadísticas y el
          pedido de ropa. <Link href="/entrar">Acceso</Link> · <Link href="/privacidad">Privacidad</Link>
        </p>
      </section>
    </MarcoPublico>
  );
}
