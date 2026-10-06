import Image from "next/image";
import Link from "next/link";
import escudo from "../../../public/escudo.png";
import { MENU, FUNDACION, estadisticas } from "@/lib/web";
import { Barras, Calendario, Candado, Casa, Externo, Menu, Personas, Reloj } from "@/components/Iconos";

// Marco de la web publica (maquetas Main y PortadaMovil): cabecera con escudo y menu, pie, y en movil la barra
// inferior de secciones. Tema oscuro.

export function Escudo({ className, decorativo = false }: { className?: string; decorativo?: boolean }) {
  return <Image src={escudo} alt={decorativo ? "" : "Escudo de Maccabis"} className={className} priority sizes="132px" />;
}

function Enlace({ href, externo, children, actual, ...resto }: { href: string; externo: boolean; children: React.ReactNode; actual?: boolean; className?: string }) {
  if (externo) return <a href={href} {...resto}>{children}</a>;
  return <Link href={href} aria-current={actual ? "page" : undefined} {...resto}>{children}</Link>;
}

export function CabeceraPublica({ actual = "inicio" }: { actual?: string }) {
  return (
    <header className="w-cab">
      <div className="w-dentro w-cab-fila">
        <Link href="/" className="w-marca" aria-label="Maccabis, inicio">
          <Escudo decorativo />
          <span>MACCABIS</span>
        </Link>
        <nav aria-label="Principal" className="w-menu">
          {MENU.map((s) => (
            <Enlace key={s.id} href={s.href} externo={s.externo} actual={s.id === actual}>
              {s.texto}
              {s.externo && <span className="w-externo"><Externo size={13} /><span className="solo-lectores"> (web de estadísticas)</span></span>}
            </Enlace>
          ))}
        </nav>
        <Link href="/entrar" className="w-acceso"><Candado />Acceso</Link>
        <details className="w-menu-movil">
          <summary aria-label="Abrir menú"><Menu /></summary>
          <nav aria-label="Menú">
            {MENU.map((s) => (
              <Enlace key={s.id} href={s.href} externo={s.externo} actual={s.id === actual}>
                {s.texto}
                {s.externo && <Externo size={14} />}
              </Enlace>
            ))}
            <a href={estadisticas()}>Todas las estadísticas <Externo size={14} /></a>
          </nav>
        </details>
      </div>
    </header>
  );
}

const ICONOS: Record<string, React.ReactNode> = { inicio: <Casa />, partidos: <Calendario />, liga: <Barras />, plantilla: <Personas />, historia: <Reloj /> };
const BARRA = MENU.filter((s) => ICONOS[s.id]).map((s) => ({ ...s, icono: ICONOS[s.id] }));

/** Barra inferior de secciones (solo movil, maqueta PortadaMovil). */
export function BarraSecciones({ actual = "inicio" }: { actual?: string }) {
  return (
    <nav aria-label="Secciones" className="w-barra">
      {BARRA.map((s) => (
        <Enlace key={s.id} href={s.href} externo={s.externo} actual={s.id === actual}>
          {s.icono}
          {s.texto}
        </Enlace>
      ))}
    </nav>
  );
}

export function PiePublico() {
  return (
    <footer id="pie" className="w-pie">
      <div className="w-dentro w-pie-fila">
        <Escudo decorativo />
        <span>Maccabis · Baloncesto en Madrid desde {FUNDACION}</span>
        <span>Fuente: actas y hojas oficiales de la FBM</span>
        <Link href="/club">El club</Link>
        <a href={estadisticas()}>Todas las estadísticas</a>
        <Link href="/privacidad">Privacidad</Link>
        <Link href="/entrar" className="w-pie-acceso">Acceso jugadores y gestores</Link>
      </div>
    </footer>
  );
}

/** Pagina publica completa: cabecera, contenido, pie y barra inferior. */
export default function MarcoPublico({ actual, children }: { actual?: string; children: React.ReactNode }) {
  return (
    <div className="tema-oscuro w-publica">
      <CabeceraPublica actual={actual} />
      <main>{children}</main>
      <PiePublico />
      <BarraSecciones actual={actual} />
    </div>
  );
}
