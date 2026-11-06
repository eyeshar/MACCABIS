"use client";

import Link from "next/link";
import { useRuta } from "@/components/nav/useRuta";
import { seccionesDe, seccionDe, TITULO_SECCION, type IdSeccion } from "@/lib/web";
import { useSesion } from "./Sesion";
import { Barras, Calendario, Candado, Casa, Club, Panel } from "@/components/Iconos";
import AsistenteFlotante from "@/components/asistente/AsistenteFlotante";

// Los enlaces de la cabecera, la barra y el pie no se precargan (prefetch={false}, D175): las paginas publicas son ya estaticas
// y se piden a la CDN al pulsar (≈ 60 ms); precargarlas en cada pantalla añadia ≈ 45 KB por visita y colgaba las peticiones.
//
// Navegacion de la estructura nueva (D189; sustituye a la de D89, D90 y D117). Barra inferior en el movil, segun quien mira:
//   - jugador: Semana · Calendario · Liga · Club;
//   - gestor (con o sin ficha): Semana · Calendario · Liga · Club · Gestión;
//   - sin sesion: Inicio · Liga · Club · Acceso.
// Cabecera en el movil: el titulo de la seccion en una linea, el icono del asistente (D142, mismas reglas) y el avatar con
// la inicial, que abre «Yo». En escritorio, la misma estructura en la cabecera. Sin hoja «Más», sin desplegables y sin la
// barra de Gestión: cada subpantalla tiene un unico «‹» a su seccion (Volver.tsx).
// La sesion llega del navegador (Sesion.tsx, D175): con cookie de sesion la cabecera se esconde hasta saber quien es,
// asi que tampoco hay parpadeos de «Acceso».

const ICONO: Record<IdSeccion, React.ReactNode> = {
  inicio: <Casa />, semana: <Casa />, calendario: <Calendario />, liga: <Barras />, club: <Club />, gestion: <Panel size={22} />, acceso: <Candado size={22} />,
};

export default function Navegacion({ escudo }: { escudo: React.ReactNode }) {
  const { usuario } = useSesion();
  const ruta = useRuta();
  const secciones = seccionesDe(usuario);
  const actual = seccionDe(ruta, Boolean(usuario));
  const titulo = TITULO_SECCION[actual ?? (usuario ? "semana" : "inicio")];
  const enYo = ruta === "/yo" || ruta.startsWith("/yo/") || ruta.startsWith("/avisos");
  const cur = (id: IdSeccion) => (actual === id ? ("page" as const) : undefined);
  return (
    <>
      <header className="nv-cab">
        <div className="w-dentro nv-cab-fila">
          <Link prefetch={false} href="/" className="nv-marca" aria-label="Maccabis, inicio">
            {escudo}
            <span>MACCABIS</span>
          </Link>
          <p className="nv-titulo" data-testid="titulo-seccion">{enYo ? "Yo" : titulo}</p>
          <nav aria-label="Principal" className="nv-menu">
            {secciones.map((s) => (
              <Link prefetch={false} key={s.id} href={s.href} aria-current={cur(s.id)} className={s.id === "acceso" ? "nv-acceso" : undefined}>
                {s.id === "acceso" && <Candado />}{s.texto}
              </Link>
            ))}
          </nav>
          <div className="nv-derecha">
            <AsistenteFlotante />
            {usuario && (
              <Link prefetch={false} href="/yo" className="nv-avatar" aria-label={`Yo: ${usuario.corto}`} aria-current={enYo ? "page" : undefined} data-testid="avatar">
                <i aria-hidden="true">{usuario.inicial}</i>
                <span className="nv-avatar-nombre">{usuario.corto}</span>
              </Link>
            )}
          </div>
        </div>
      </header>
      <nav aria-label="Secciones" className="nv-barra" data-n={secciones.length} data-testid="barra">
        {secciones.map((s) => (
          <Link prefetch={false} key={s.id} href={s.href} className="nv-barra-item" aria-current={cur(s.id)}>{ICONO[s.id]}{s.texto}</Link>
        ))}
      </nav>
    </>
  );
}
