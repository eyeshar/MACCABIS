import type { Metadata } from "next";
import Link from "next/link";
import { exigirSesion, origen } from "@/lib/sesion";
import { miEnlace } from "@/lib/calendario/enlace";
import { usuarioActual } from "@/lib/usuario";
import { cargarMiZona } from "@/app/mi-zona/datos";
import { salir } from "@/app/entrar/acciones";
import { temporadaDe } from "@/lib/publico";
import { fichaEstadisticas } from "@/lib/mensajes";
import { TEXTO_POSICION, type Posicion } from "@/lib/convocatoria/motor";
import { Flecha } from "@/components/Iconos";
import CalendarioMovil from "@/components/inicio/CalendarioMovil";
import { cifrasTemporada } from "@/components/inicio/TuTemporada";
import Instalar from "./Instalar";
import "@/components/inicio/inicio.css";
import "./yo.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Yo · Maccabis", robots: { index: false, follow: false } };

// «Yo» (D189, estructura nueva): lo de cada persona, desde el avatar de la cabecera. Sustituye a Mi cuenta (D90, /cuenta) y a
// Mis números (D117, /mis-numeros), que redirigen aqui. Sin pedido de ropa (va en la Semana cuando un gestor lo abre).
export default async function Yo() {
  const { user, supabase } = await exigirSesion();
  const [u, zona] = await Promise.all([usuarioActual(), cargarMiZona().catch(() => null)]);
  const jugador = zona?.jugador ?? null;
  const [enlace, posicion] = await Promise.all([
    jugador ? miEnlace(supabase, jugador.person_id, await origen()).catch(() => null) : Promise.resolve(null),
    jugador ? supabase.rpc("mi_posicion").then((r) => (r.data as Posicion | null) ?? null, () => null) : Promise.resolve(null),
  ]);
  const temporada = jugador ? temporadaDe(jugador.person_id) : null;
  const equipos = jugador ? (["MdA", "MdL"] as const).filter((e) => (e === "MdA" ? jugador.ficha_mda : jugador.ficha_mdl)) : [];
  const linea = [posicion ? TEXTO_POSICION[posicion] : null, equipos.length ? equipos.join(" y ") : null, temporada?.dorsales.length ? `#${temporada.dorsales.join(" · #")}` : null, u?.esGestor ? "gestor" : null].filter(Boolean).join(" · ");
  const cifras = temporada && temporada.pj > 0 ? cifrasTemporada(temporada) : null;

  return (
    <main className="pagina yo" data-testid="yo">
      <section className="yo-quien" aria-label="Quién eres">
        <i aria-hidden="true">{u?.inicial ?? "?"}</i>
        <div>
          <h1>{jugador?.nombre_visible ?? u?.completo ?? user.email}</h1>
          {linea && <p className="suave" data-testid="yo-linea">{linea}</p>}
        </div>
      </section>

      {jugador && (
        <section className="tarjeta yo-temporada" aria-labelledby="t-yo-temporada" data-testid="yo-temporada">
          <div className="yo-cab"><h2 id="t-yo-temporada">Tu temporada</h2>{temporada && temporada.pj > 0 && <span className="mono tenue">tras {temporada.pj} {temporada.pj === 1 ? "partido" : "partidos"}</span>}</div>
          {cifras ? (
            <div className="in-cifras">
              {cifras.map((c) => <div key={c.k} className="in-cifra"><b className="cifra">{c.valor}</b><span>{c.texto}</span></div>)}
            </div>
          ) : <p className="suave" style={{ margin: 0 }}>Aún no has jugado esta temporada.</p>}
          <Link href={fichaEstadisticas(jugador.person_id)} className="in-mas">Tu ficha completa <Flecha size={16} /></Link>
        </section>
      )}

      <nav className="yo-lista" aria-label="Lo tuyo">
        {jugador && <Link href="/mi-zona/ausencias" className="yo-fila"><b>Días que no estoy</b><Flecha size={16} /></Link>}
        <Link href="/avisos" className="yo-fila"><b>Avisos en este móvil</b><Flecha size={16} /></Link>
        {u?.esGestor && <Link href="/gestion" className="yo-fila"><b>Gestión</b><Flecha size={16} /></Link>}
      </nav>

      {jugador && <CalendarioMovil enlace={enlace} />}

      <section className="tarjeta" id="instalar" aria-labelledby="t-instalar">
        <h2 id="t-instalar">Instalar en el móvil</h2>
        <Instalar />
        <ul className="yo-pasos">
          <li><strong>iPhone (Safari):</strong> Compartir → «Añadir a pantalla de inicio».</li>
          <li><strong>Android (Chrome):</strong> menú ⋮ → «Instalar aplicación».</li>
        </ul>
      </section>

      <section className="tarjeta" aria-labelledby="t-cuenta" data-testid="mi-cuenta">
        <h2 id="t-cuenta">Mi cuenta</h2>
        <p style={{ margin: 0 }}>Entras con <strong>{user.email}</strong>, con Google o con un código a este correo: no hay contraseña.</p>
        {u?.papel && <p className="suave pequeno" style={{ margin: 0 }}>{u.papel}</p>}
        <form action={salir}><button className="boton boton-claro yo-salir" type="submit">Salir</button></form>
      </section>
      <p className="pie">¿Algo no cuadra? Habla con Iván, Carlos o Edu. · <Link href="/privacidad">Privacidad</Link></p>
    </main>
  );
}
