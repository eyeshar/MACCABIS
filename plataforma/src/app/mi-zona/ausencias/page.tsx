import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirSesion } from "@/lib/sesion";
import AccionesAusencia from "@/components/respuestas/AccionesAusencia";
import { cargarMisAusencias, respuestasWebEncendido } from "@/lib/respuestas/jugador";
import { diaCorto, TEXTO_MOTIVO_TODO } from "@/lib/respuestas/dominio";
import { hoyMadrid } from "@/lib/dias";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mis ausencias · Maccabis", robots: { index: false, follow: false } };

const mes = (f: string) => ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][+f.slice(5, 7) - 1];
const dia = (f: string) => `${diaCorto(f)} ${mes(f)}`;

// Mis ausencias (D99, 3.6). Con «respuestas en la web» apagado no aparece (3.7).
export default async function MisAusencias({ searchParams }: { searchParams: Promise<{ guardada?: string }> }) {
  await exigirSesion();
  if (!(await respuestasWebEncendido())) redirect("/mi-zona");
  const { guardada } = await searchParams;
  const hoy = hoyMadrid();
  const lista = (await cargarMisAusencias()).filter((a) => a.hasta == null || a.hasta >= hoy);
  return (
    <main className="pagina rw-ausencias">
      <p className="rw-volver"><Link href="/mi-zona">← Mi zona</Link></p>
      <h1>Mis ausencias</h1>
      <p className="suave">Los días que marques no te preguntaremos: tus eventos quedan en «no voy» con el motivo (solo lo ven los gestores).</p>
      {guardada && <p className="aviso aviso-ok" role="status">Ausencia guardada.</p>}
      <Link href="/mi-zona/ausencias/nueva" className="boton boton-amarillo boton-bloque">Nueva ausencia</Link>
      <div className="rw-aus-lista">
        {lista.map((a) => (
          <article key={a.id} className="tarjeta rw-aus" data-abierta={a.hasta == null}>
            <strong>{a.hasta == null ? `Desde el ${dia(a.desde)} · sin fecha de vuelta` : a.desde === a.hasta ? `El ${dia(a.desde)}` : `Del ${dia(a.desde)} al ${dia(a.hasta)}`}</strong>
            <span className="suave">{TEXTO_MOTIVO_TODO[a.motivo]}{a.detalle ? ` · ${a.detalle}` : ""}{a.origen === "gestor" ? " · puesta por un gestor" : a.origen === "sporteasy" ? " · leída de SportEasy" : ""}</span>
            <AccionesAusencia id={a.id} abierta={a.hasta == null} />
          </article>
        ))}
        {!lista.length && <p className="suave">No tienes ninguna ausencia marcada.</p>}
      </div>
      <p className="suave pequeno">Si borras una ausencia, esos eventos vuelven a «sin responder».</p>
    </main>
  );
}
