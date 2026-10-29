"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { salir } from "@/app/entrar/acciones";
import { MENU, MENU_GESTION, MENU_SESION, RUTA_CUENTA, type GrupoGestion, type Seccion } from "@/lib/web";
import type { Usuario } from "@/lib/usuario";
import { Barras, Calendario, Candado, Casa, Mas, Panel, Tendencia } from "@/components/Iconos";
import { borrarConversacion } from "@/components/asistente/conversacion";
import { useDesplegable } from "./useDesplegable";

// Navegacion unica de toda la web (D89, maquetas NavCabecera y NavMovil; D117 con sesion). Sin sesion: la de siempre
// (Inicio · Partidos · Liga · Plantilla · Historia · El club). Con sesion, lo de cada persona primero: en escritorio
// Inicio · Agenda · Mis números · Liga · Historia (y el menu GESTIÓN de los gestores); en el movil, barra de 5: jugador
// Inicio · Agenda · Mis números · Liga · Más; gestor Inicio · Agenda · Mis números · Gestión · Más (Liga pasa a «Más»).
// La sesion la lee el servidor (Cabecera.tsx) y llega aqui ya resuelta: nada de parpadeos de "Acceso".

type Zona = "inicio" | "agenda" | "numeros" | "club" | "gestion" | "cuenta" | "acceso" | "liga" | "historia" | "plantilla" | null;

function zonaDe(ruta: string, personId: string | null): Zona {
  if (ruta === "/") return "inicio";
  if (ruta === "/club" || ruta === "/privacidad") return "club";
  if (ruta.startsWith("/agenda") || ruta.startsWith("/planes") || ruta.startsWith("/mi-zona") || ruta.startsWith("/guia-tallas")) return "agenda";
  if (ruta === "/mis-numeros" || (personId && ruta === `/jugador/${personId}`)) return "numeros";
  if (ruta.startsWith("/gestion")) return "gestion";
  if (ruta.startsWith(RUTA_CUENTA)) return "cuenta";
  if (ruta.startsWith("/entrar")) return "acceso";
  if (ruta.startsWith("/liga")) return "liga";
  if (ruta.startsWith("/historia")) return "historia";
  if (ruta.startsWith("/plantilla") || ruta.startsWith("/jugador")) return "plantilla";
  return null;
}

/** Enlace del menu: los de la web de estadisticas (GitHub Pages) son <a> normales, en la misma pestaña. */
function Enlace({ s, actual, className, children }: { s: Seccion; actual: boolean; className?: string; children?: React.ReactNode }) {
  const contenido = children ?? s.texto;
  if (s.externo) return <a href={s.href} className={className}>{contenido}</a>;
  return <Link href={s.href} className={className} aria-current={actual ? "page" : undefined}>{contenido}</Link>;
}

/** Entradas de Gestion por grupos. Lo que aun no existe sale en gris con "paso 2", sin enlace. */
function EntradasGestion({ grupos, ruta, conDescripcion }: { grupos: GrupoGestion[]; ruta: string; conDescripcion: boolean }) {
  const actual = (href: string) => (href === "/gestion" ? ruta === href : ruta.startsWith(href));
  return (
    <>
      {grupos.map((g) => (
        <div key={g.grupo} className="nv-grupo" role="group" aria-labelledby={`nv-g-${conDescripcion ? "d" : "h"}-${g.grupo}`}>
          <div className="nv-grupo-titulo" id={`nv-g-${conDescripcion ? "d" : "h"}-${g.grupo}`}>{g.grupo}</div>
          {g.entradas.map((e) =>
            e.href ? (
              <Link key={e.texto} href={e.href} className="nv-entrada" aria-current={actual(e.href) ? "page" : undefined}>
                <b>{e.texto}</b>
                {conDescripcion && <span>{e.descripcion}</span>}
              </Link>
            ) : (
              <span key={e.texto} className="nv-entrada nv-paso2" aria-disabled="true">
                <b>{e.texto} <small className="nv-etq-paso2">paso 2</small></b>
                {conDescripcion && <span>{e.descripcion}</span>}
              </span>
            ),
          )}
        </div>
      ))}
    </>
  );
}

function MenuUsuario({ usuario, actual }: { usuario: Usuario; actual: boolean }) {
  const { propsBoton, propsPanel } = useDesplegable();
  return (
    <div className="nv-desplegable nv-usuario">
      <button {...propsBoton} className="nv-avatar" aria-controls="nv-menu-usuario" aria-label={`Menú de ${usuario.corto}`} data-actual={actual || undefined}>
        <i aria-hidden="true">{usuario.inicial}</i>
        <span className="nv-avatar-nombre">{usuario.corto}</span>
        <span className="nv-flecha" aria-hidden="true">▾</span>
      </button>
      <div {...propsPanel} id="nv-menu-usuario" className="nv-panel nv-panel-usuario">
        <div className="nv-usuario-cab">
          <i aria-hidden="true">{usuario.inicial}</i>
          <div>
            <b>{usuario.completo}</b>
            <span>{usuario.papel}</span>
          </div>
        </div>
        <nav aria-label="Tu cuenta">
          <Link href={RUTA_CUENTA} className="nv-entrada" aria-current={actual ? "page" : undefined}><b>Mi cuenta</b></Link>
          <Link href="/avisos" className="nv-entrada"><b>Instalar en el móvil</b></Link>
        </nav>
        <form action={salir} onSubmit={borrarConversacion}><button type="submit" className="nv-entrada nv-salir"><b>Salir</b></button></form>
      </div>
    </div>
  );
}

function MenuGestion({ ruta, dentro }: { ruta: string; dentro: boolean }) {
  const { propsBoton, propsPanel } = useDesplegable();
  return (
    <div className="nv-desplegable nv-gestion">
      <button {...propsBoton} className="nv-boton-gestion" aria-controls="nv-menu-gestion" data-dentro={dentro || undefined}>
        GESTIÓN <span className="nv-flecha" aria-hidden="true">▾</span>
      </button>
      <div {...propsPanel} id="nv-menu-gestion" className="nv-panel nv-panel-gestion">
        <nav aria-label="Menú de gestión" className="nv-gestion-cols">
          <EntradasGestion grupos={MENU_GESTION} ruta={ruta} conDescripcion />
        </nav>
      </div>
    </div>
  );
}

/** Hoja "Mas" del movil: el resto de la web, Gestion (gestores), Mi cuenta y Salir. */
function HojaMas({ usuario, ruta, zona }: { usuario: Usuario | null; ruta: string; zona: Zona }) {
  const { abierto, cerrar, propsBoton, propsPanel } = useDesplegable({ modal: true });
  // Con sesion de jugador y gestor, Liga sale de la barra y pasa aqui (D117).
  const ids = usuario?.esJugador && usuario.esGestor ? ["liga", "plantilla", "historia", "club"] : ["plantilla", "historia", "club"];
  const resto = MENU.filter((s) => ids.includes(s.id));
  return (
    <>
      <button {...propsBoton} className="nv-barra-item" aria-controls="nv-hoja-mas" aria-haspopup="dialog">
        <Mas />Más
      </button>
      {abierto && <div className="nv-velo" aria-hidden="true" onClick={() => cerrar()} />}
      <div {...propsPanel} id="nv-hoja-mas" className="nv-hoja" role="dialog" aria-modal="true" aria-labelledby="nv-hoja-titulo">
        <div className="nv-hoja-asa" aria-hidden="true" />
        <div className="nv-hoja-cab">
          <p id="nv-hoja-titulo" className="nv-hoja-titulo">Más</p>
          <button type="button" className="nv-cerrar" onClick={() => cerrar(true)} aria-label="Cerrar">×</button>
        </div>
        <nav aria-label="Menú">
          <div className="nv-grupo">
            <div className="nv-grupo-titulo">La web</div>
            {resto.map((s) => <Enlace key={s.id} s={s} actual={zona === s.id} className="nv-entrada"><b>{s.texto}</b></Enlace>)}
          </div>
          {usuario?.esGestor && (
            <div className="nv-hoja-gestion">
              <div className="nv-grupo-titulo nv-grupo-titulo-gestion">Gestión</div>
              <EntradasGestion grupos={MENU_GESTION} ruta={ruta} conDescripcion={false} />
            </div>
          )}
          {usuario && (
            <div className="nv-grupo">
              <div className="nv-grupo-titulo">{usuario.completo}</div>
              <Link href={RUTA_CUENTA} className="nv-entrada" aria-current={zona === "cuenta" ? "page" : undefined}><b>Mi cuenta</b></Link>
            </div>
          )}
        </nav>
        {usuario && <form action={salir} onSubmit={borrarConversacion}><button type="submit" className="nv-entrada nv-salir"><b>Salir</b></button></form>}
      </div>
    </>
  );
}

export default function Navegacion({ usuario, escudo }: { usuario: Usuario | null; escudo: React.ReactNode }) {
  const ruta = usePathname();
  const zona = zonaDe(ruta, usuario?.personId ?? null);
  const liga = MENU.find((s) => s.id === "liga")!;
  // Con ficha de jugador, el menu de cada persona (D117); sin sesion o gestor sin ficha, el de la web publica.
  const personal = Boolean(usuario?.esJugador);
  const menu = personal ? MENU_SESION : MENU;
  const actual = (s: Seccion) => zona === s.id;
  const cur = (z: Zona) => (zona === z ? ("page" as const) : undefined);
  return (
    <>
      <header className="nv-cab">
        <div className="w-dentro nv-cab-fila">
          <Link href="/" className="nv-marca" aria-label="Maccabis, inicio">
            {escudo}
            <span>MACCABIS</span>
          </Link>
          <nav aria-label="Principal" className="nv-menu">
            {menu.map((s) => <Enlace key={s.id} s={s} actual={actual(s)} />)}
          </nav>
          <div className="nv-derecha">
            {usuario?.esGestor && <MenuGestion ruta={ruta} dentro={zona === "gestion"} />}
            {usuario ? (
              <MenuUsuario usuario={usuario} actual={zona === "cuenta"} />
            ) : (
              <Link href="/entrar" className="nv-acceso" aria-current={cur("acceso")}><Candado />Acceso</Link>
            )}
          </div>
        </div>
      </header>
      <nav aria-label="Secciones" className="nv-barra">
        <Link href="/" className="nv-barra-item" aria-current={cur("inicio")}><Casa />Inicio</Link>
        {personal ? (
          <>
            <Link href="/agenda" className="nv-barra-item" aria-current={cur("agenda")}><Calendario />Agenda</Link>
            <Link href="/mis-numeros" className="nv-barra-item" aria-current={cur("numeros")}><Tendencia />Mis números</Link>
            {usuario?.esGestor
              ? <Link href="/gestion" className="nv-barra-item" aria-current={cur("gestion")}><Panel size={22} />Gestión</Link>
              : <Link href={liga.href} className="nv-barra-item" aria-current={cur("liga")}><Barras />Liga</Link>}
          </>
        ) : (
          <>
            <Link href="/#calendario" className="nv-barra-item"><Calendario />Partidos</Link>
            <a href={liga.href} className="nv-barra-item"><Barras />Liga</a>
            {usuario?.esGestor ? (
              <Link href="/gestion" className="nv-barra-item" aria-current={cur("gestion")}><Panel size={22} />Gestión</Link>
            ) : (
              <Link href="/entrar" className="nv-barra-item" aria-current={cur("acceso")}><Candado size={22} />Acceso</Link>
            )}
          </>
        )}
        <HojaMas usuario={usuario} ruta={ruta} zona={zona} />
      </nav>
    </>
  );
}
