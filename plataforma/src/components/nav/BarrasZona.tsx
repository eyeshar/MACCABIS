"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MENU_GESTION, MENU_MI_ZONA } from "@/lib/web";

/** Barra de Gestion (D90): fondo #2A2410, etiqueta GESTIÓN y los submenus en tres grupos; lo que aun no existe, en gris
 *  con "paso 2". En movil, una fila con scroll horizontal. */
export function BarraGestion() {
  const ruta = usePathname();
  const actual = (href: string) => (href === "/gestion" ? ruta === href : ruta.startsWith(href));
  return (
    <nav aria-label="Gestión" className="zb zb-gestion">
      <div className="w-dentro zb-fila">
        <span className="zb-etq" aria-hidden="true">GESTIÓN</span>
        {MENU_GESTION.map((g) => (
          <div key={g.grupo} className="zb-grupo" role="group" aria-label={g.grupo}>
            {g.entradas.map((e) =>
              e.href ? (
                <Link key={e.texto} href={e.href} aria-current={actual(e.href) ? "page" : undefined}>{e.corto}</Link>
              ) : (
                <span key={e.texto} className="zb-paso2" aria-disabled="true">{e.corto} <small>paso 2</small></span>
              ),
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}

/** Barra de Mi zona (D99): Resumen, Mi agenda, Ausencias y Estadisticas. Resumen, agenda y estadisticas son anclas de la
 *  misma pagina y se marca la que se esta viendo; Ausencias es su pagina y solo sale con «respuestas en la web»
 *  encendido. Desde el evento o el domingo se marca Mi agenda. */
export function BarraMiZona({ conAusencias = false }: { conAusencias?: boolean }) {
  const ruta = usePathname();
  const [visible, setVisible] = useState("inicio");
  const pulsada = useRef<string | null>(null);
  const menu = MENU_MI_ZONA.filter((s) => conAusencias || !s.soloEncendido);
  useEffect(() => {
    if (ruta !== "/mi-zona") return;
    const ids = MENU_MI_ZONA.filter((s) => !s.soloEncendido).map((s) => s.id);
    const elegir = () => {
      // La seccion cuyo principio ha pasado bajo la barra mas recientemente (en escritorio hay dos columnas: no vale
      // el orden del documento).
      let id = "inicio", mejor = -Infinity;
      for (const s of ids) {
        const top = document.getElementById(s)?.getBoundingClientRect().top;
        if (top !== undefined && top < 140 && top > mejor) { mejor = top; id = s; }
      }
      // Al final de la pagina una seccion corta no llega arriba: vale la que se acaba de pulsar en la barra.
      const alFinal = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (alFinal && pulsada.current) id = pulsada.current;
      else if (!alFinal && window.scrollY > 0) pulsada.current = null;
      setVisible(id);
    };
    elegir();
    window.addEventListener("scroll", elegir, { passive: true });
    window.addEventListener("resize", elegir);
    return () => { window.removeEventListener("scroll", elegir); window.removeEventListener("resize", elegir); };
  }, [ruta]);
  const marcada = ruta === "/mi-zona" ? visible : ruta.startsWith("/mi-zona/ausencias") ? "ausencias"
    : ruta.startsWith("/mi-zona/evento") || ruta.startsWith("/mi-zona/domingo") ? "agenda" : null;
  return (
    <nav aria-label="Mi zona" className="zb">
      <div className="w-dentro zb-fila">
        {menu.map((s) => (
          <Link key={s.id} href={s.href} onClick={() => { pulsada.current = s.id; setVisible(s.id); }} aria-current={marcada === s.id ? (ruta === "/mi-zona" ? "location" : "page") : undefined}>{s.texto}</Link>
        ))}
      </div>
    </nav>
  );
}
