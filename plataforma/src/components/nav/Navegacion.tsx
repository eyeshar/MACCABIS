"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { salir } from "@/app/entrar/acciones";
import { MENU, MENU_GESTION, RUTA_CUENTA, type GrupoGestion, type Seccion } from "@/lib/web";
import type { Usuario } from "@/lib/usuario";
import { Barras, Calendario, Candado, Casa, Mas, Persona } from "@/components/Iconos";
import { useDesplegable } from "./useDesplegable";

// Navegacion unica de toda la web (D89, maquetas NavCabecera y NavMovil): cabecera con menu, "Mi zona", menu de
// Gestion (D90) y menu de usuario; en movil, barra inferior de 5 y la hoja "Mas". La sesion la lee el servidor
// (Cabecera.tsx) y llega aqui ya resuelta: nada de parpadeos de "Acceso" con la sesion iniciada.

type Zona = "inicio" | "club" | "mizona" | "gestion" | "cuenta" | "acceso" | null;

function zonaDe(ruta: string): Zona {
  if (ruta === "/") return "inicio";
  if (ruta === "/club" || ruta === "/privacidad") return "club";
  if (ruta.startsWith("/mi-zona") || ruta.startsWith("/guia-tallas")) return "mizona";
  if (ruta.startsWith("/gestion")) return "gestion";
  if (ruta.startsWith(RUTA_CUENTA)) return "cuenta";
  if (ruta.startsWith("/entrar")) return "acceso";
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
          <Link href={`${RUTA_CUENTA}#instalar`} className="nv-entrada"><b>Instalar en el móvil</b></Link>
        </nav>
        <form action={salir}><button type="submit" className="nv-entrada nv-salir"><b>Salir</b></button></form>
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
function HojaMas({ usuario, ruta }: { usuario: Usuario | null; ruta: string }) {
  const { abierto, cerrar, propsBoton, propsPanel } = useDesplegable({ modal: true });
  const resto = MENU.filter((s) => ["plantilla", "historia", "club"].includes(s.id));
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
            {resto.map((s) => <Enlace key={s.id} s={s} actual={zonaDe(ruta) === s.id} className="nv-entrada"><b>{s.texto}</b></Enlace>)}
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
              <Link href={RUTA_CUENTA} className="nv-entrada" aria-current={zonaDe(ruta) === "cuenta" ? "page" : undefined}><b>Mi cuenta</b></Link>
            </div>
          )}
        </nav>
        {usuario && <form action={salir}><button type="submit" className="nv-entrada nv-salir"><b>Salir</b></button></form>}
      </div>
    </>
  );
}

export default function Navegacion({ usuario, escudo }: { usuario: Usuario | null; escudo: React.ReactNode }) {
  const ruta = usePathname();
  const zona = zonaDe(ruta);
  const liga = MENU.find((s) => s.id === "liga")!;
  return (
    <>
      <header className="nv-cab">
        <div className="w-dentro nv-cab-fila">
          <Link href="/" className="nv-marca" aria-label="Maccabis, inicio">
            {escudo}
            <span>MACCABIS</span>
          </Link>
          <nav aria-label="Principal" className="nv-menu">
            {MENU.map((s) => <Enlace key={s.id} s={s} actual={zona === s.id} />)}
            {usuario?.esJugador && (
              <>
                <span className="nv-sep" aria-hidden="true" />
                <Link href="/mi-zona" className="nv-mizona" aria-current={zona === "mizona" ? "page" : undefined}><Persona size={18} />Mi zona</Link>
              </>
            )}
          </nav>
          <div className="nv-derecha">
            {usuario?.esGestor && <MenuGestion ruta={ruta} dentro={zona === "gestion"} />}
            {usuario ? (
              <MenuUsuario usuario={usuario} actual={zona === "cuenta"} />
            ) : (
              <Link href="/entrar" className="nv-acceso" aria-current={zona === "acceso" ? "page" : undefined}><Candado />Acceso</Link>
            )}
          </div>
        </div>
      </header>
      <nav aria-label="Secciones" className="nv-barra">
        <Link href="/" className="nv-barra-item" aria-current={zona === "inicio" ? "page" : undefined}><Casa />Inicio</Link>
        <Link href="/#calendario" className="nv-barra-item"><Calendario />Partidos</Link>
        <a href={liga.href} className="nv-barra-item"><Barras />Liga</a>
        {usuario?.esJugador ? (
          <Link href="/mi-zona" className="nv-barra-item" aria-current={zona === "mizona" ? "page" : undefined}><Persona />Mi zona</Link>
        ) : usuario?.esGestor ? (
          <Link href="/gestion" className="nv-barra-item" aria-current={zona === "gestion" ? "page" : undefined}><Persona />Gestión</Link>
        ) : (
          <Link href="/entrar" className="nv-barra-item" aria-current={zona === "acceso" ? "page" : undefined}><Candado size={22} />Acceso</Link>
        )}
        <HojaMas usuario={usuario} ruta={ruta} />
      </nav>
    </>
  );
}
