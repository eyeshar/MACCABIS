import type { Metadata } from "next";
import Link from "next/link";
import { entrenoHabitual, eventosEntrenos, resumenHistoria } from "@/lib/publico";
import { diaLargo, hoyMadrid } from "@/lib/dias";
import { FUNDACION } from "@/lib/web";
import { cargarFuente } from "@/lib/eventos/fuente";

// Club › El club (bloque 6; antes /club, D86): compacto. Qué es Maccabis, desde 2013, MdA y MdL, cifras de historia (las
// mismas de la portada, de los datos) y las DOS instalaciones sin mezclar (D88): los entrenos en un sitio y los partidos en
// otro. Sin datos personales.
export const metadata: Metadata = {
  title: "El club · Maccabis",
  description: `Maccabis, club de baloncesto amateur de Madrid desde ${FUNDACION}: MdA y MdL en la Liga Municipal de Moratalaz, una sola plantilla.`,
  alternates: { canonical: "/club/el-club" },
};
// D175: ya hecha, desde la cache (se rehace como mucho cada minuto y cuando un gestor toca el calendario).
export const revalidate = 60;

export default async function ElClub() {
  const h = resumenHistoria();
  const fuente = await cargarFuente();
  const habitual = entrenoHabitual(fuente);
  const proximo = eventosEntrenos(fuente).find((e) => e.fecha >= hoyMadrid());
  return (
    <>
      <div className="e-club">
        <section className="e-club-tarjeta" aria-labelledby="t-club">
          <span className="w-eyebrow">Desde {FUNDACION}</span>
          <h2 id="t-club">Baloncesto amateur en Madrid</h2>
          <p>Un solo equipo humano con dos fichas para que juegue todo el mundo, en la Liga Municipal de Moratalaz (sénior masculino).</p>
        </section>
        <section className="e-club-tarjeta" aria-labelledby="t-equipos">
          <h2 id="t-equipos">Dos equipos, una plantilla</h2>
          <p data-equipo="MDL"><span className="chip-eq chip-MDL">MdL · Grupo 2</span> <b>Maccabi de Levantar</b>, el equipo original.</p>
          <p data-equipo="MDA"><span className="chip-eq chip-MDA">MdA · Grupo 1</span> <b>Maccabi de Acostar</b>, la segunda ficha.</p>
          <p>Equipación: negra la primera y amarilla la segunda.</p>
        </section>
        <section className="e-club-tarjeta" aria-labelledby="t-historia-club">
          <h2 id="t-historia-club">En cifras</h2>
          <div className="e-club-cifras" data-testid="cifras-historia">
            <div><b>{h.partidos_con_estadisticas}</b><span>partidos con estadísticas</span></div>
            <div><b className="w-verde">{h.victorias}</b><span>victorias</span></div>
            <div><b>{h.jugadores_en_la_historia}</b><span>jugadores en la historia</span></div>
          </div>
          <Link href="/club/historia" prefetch={false}>Historia del club ›</Link>
        </section>
      </div>

      <div className="e-club">
        <section className="e-club-tarjeta" data-testid="club-entrenos" aria-labelledby="t-entrenos">
          <span className="chip-eq chip-entreno" style={{ justifySelf: "start" }}>Entrenos</span>
          <h3 id="t-entrenos">Miércoles, {habitual.inicio}–{habitual.fin}</h3>
          <p>
            <b>{habitual.pista}</b>.{habitual.enObras ? <> Ahora <b className="w-confirmar">en obras</b>: la pista de cada semana, en el calendario.</> : null}
          </p>
          <p className="w-nota">No es la instalación de los partidos: son dos sitios distintos.</p>
          {proximo && (
            <p>Próximo: {diaLargo(proximo.fecha)}, {proximo.inicio}–{proximo.fin} · {proximo.pistaPorConfirmar ? "pista por confirmar" : proximo.lugar}.</p>
          )}
        </section>
        <section className="e-club-tarjeta" data-testid="club-partidos" aria-labelledby="t-partidos">
          <span className="chip-eq chip-MDA" style={{ justifySelf: "start" }}>Partidos</span>
          <h3 id="t-partidos">Domingos por la mañana</h3>
          <p data-testid="club-instalacion-partidos">
            <b>Centro Deportivo Municipal Moratalaz</b><br />
            Calle de Valdebernardo, 2, 28030 Madrid<br />
            Metro: Pavones (L9)
          </p>
          <Link href="/liga" prefetch={false}>Clasificación y resultados ›</Link>
        </section>
      </div>

      <p className="w-nota">
        Los jugadores entran con su correo dado de alta. <Link href="/entrar" prefetch={false}>Acceso</Link> · <Link href="/privacidad" prefetch={false}>Privacidad</Link>
      </p>
    </>
  );
}
