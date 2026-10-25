import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { exigirSesion } from "@/lib/sesion";
import { madrid } from "@/lib/avisos/horario";
import { hoyMadrid } from "@/lib/dias";
import { cargarPlan, quienVaPlan } from "@/lib/planes/datos";
import { cargarMisRespuestas } from "@/lib/respuestas/jugador";
import { enlaceLugar, fechaTitular, hhmm, restar20, TEXTO_TIPO } from "@/lib/respuestas/dominio";
import { AccionesGestor, CancelarPlan, ResponderPlan } from "./AccionesPlan";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plan · Maccabis" };

const PARA = { ambos: "toda la plantilla", MdA: "los del MdA", MdL: "los del MdL" } as const;

// Ficha de un plan no oficial (D118, lienzo «Inicio personal»): etiquetas, titulo, quien lo organiza y para quien, fecha
// en titular, casillas Quedada / Empieza, donde con «Cómo llegar», nota, «¿Te apuntas?» y «Quién va» (solo nombres). Al
// organizador, Editar y Cancelar; a los gestores, «Como gestor»: Editar · Hacer oficial · Borrar.
export default async function FichaPlan({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nuevo?: string; guardado?: string }> }) {
  const { id } = await params;
  const { nuevo, guardado } = await searchParams;
  await exigirSesion();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const v = await cargarPlan(id);
  if (!v || v.borrado) notFound();
  const e = v.evento;
  if (e.oficial !== false) redirect(`/mi-zona/evento/${id}`);
  const hoy = hoyMadrid();
  const [respuestas, quien] = await Promise.all([v.invitado ? cargarMisRespuestas() : Promise.resolve([]), quienVaPlan(v)]);
  const mia = respuestas.find((r) => r.evento_id === e.id);
  const actual = mia && mia.respuesta !== "sin_responder" ? mia.respuesta : null;
  const abierto = e.estado === "programado" && madrid(e.fecha, hhmm(e.inicio) ?? "00:00") > new Date();
  const completo = e.plazas != null && quien.va.length >= e.plazas;
  const mapa = enlaceLugar(e);
  const inicio = hhmm(e.inicio);
  const quedada = hhmm(e.quedada) ?? (inicio ? restar20(inicio) : null);
  const esOrganizador = Boolean(e.es_mio);

  return (
    <main className="pagina pl-pagina pl-ficha" data-testid="ficha-plan">
      <p className="rw-volver"><Link href="/agenda">← Agenda</Link></p>
      {nuevo && <div className="aviso aviso-ok" role="status">Plan publicado. Ya lo ven los invitados en su agenda.</div>}
      {guardado && <div className="aviso aviso-ok" role="status">Cambios guardados.</div>}
      <div className="pl-etiquetas"><span className="pl-etq-plan">Plan no oficial</span><span className="pl-etq-tipo">{TEXTO_TIPO[e.tipo]}</span>{e.estado === "cancelado" && <span className="pastilla pastilla-cancelado">Cancelado</span>}</div>
      <h1>{e.titulo}</h1>
      <p className="suave pl-organiza">Lo organiza {e.organizador ?? "un jugador"}. Para {PARA[e.equipo]}{e.plazas ? ` · ${e.plazas} plazas` : ""}.</p>
      <p className="in-titular">{fechaTitular(e.fecha, hoy)}</p>
      <div className="in-casillas">
        {quedada && <div className="in-casilla in-casilla-quedada"><small>Quedada</small><b className="cifra">{quedada}</b></div>}
        <div className="in-casilla"><small>Empieza</small><b className="cifra">{inicio ?? "—"}</b></div>
      </div>
      {e.estado === "cancelado" && <p className="aviso aviso-error">Este plan está cancelado.</p>}

      <section className="tarjeta pl-donde" aria-labelledby="t-donde">
        <h2 id="t-donde" className="solo-lectores">Dónde</h2>
        <span className="mono tenue">Dónde</span>
        <strong>{e.lugar_nombre ?? (e.lugar_enlace ? "Ubicación en el mapa" : "Sitio por decidir")}</strong>
        {e.lugar_direccion && <span className="suave">{e.lugar_direccion}</span>}
        {mapa && <a className="boton boton-claro" href={mapa} target="_blank" rel="noopener noreferrer">Cómo llegar</a>}
        {e.tipo === "amistoso" && e.rival_texto && <span>Contra <b>{e.rival_texto}</b></span>}
        {e.notas && <p className="pl-notas">{e.notas}</p>}
      </section>

      {v.invitado && (
        <section className="tarjeta rw-vas" aria-labelledby="t-apuntas">
          <div className="mz-sec-cab"><h2 id="t-apuntas">¿Te apuntas?</h2>{completo && <span className="pastilla">Completo</span>}</div>
          {abierto ? <ResponderPlan id={e.id} actual={actual} completo={completo} nombre={e.titulo ?? "el plan"} />
            : <p className="suave" style={{ margin: 0 }}>{e.estado === "cancelado" ? "No hace falta que hagas nada." : "El plan ya empezó: no se puede cambiar la respuesta."}</p>}
          <p className="suave pequeno" style={{ margin: 0 }}>Se responde aquí, en la web. «No voy» no pide motivo.</p>
        </section>
      )}

      <section className="tarjeta rw-quien" aria-labelledby="t-quien" data-testid="quien-va">
        <h2 id="t-quien">Quién va</h2>
        <dl>
          <div><dt className="rw-q-va">Van · {quien.va.length}{e.plazas ? ` de ${e.plazas}` : ""}</dt><dd>{quien.va.join(", ") || "—"}</dd></div>
          <div><dt className="rw-q-duda">Dudan · {quien.duda.length}</dt><dd>{quien.duda.join(", ") || "—"}</dd></div>
          <div><dt className="rw-q-no">No van · {quien.no.length}</dt><dd>{quien.no.join(", ") || "—"}</dd></div>
        </dl>
        <p className="suave pequeno" style={{ margin: 0 }}>{quien.sin_responder === 1 ? "1 sin responder" : `${quien.sin_responder} sin responder`}</p>
      </section>

      {esOrganizador && (
        <section className="tarjeta pl-organizador" aria-label="Tu plan">
          <h2 style={{ fontSize: 20 }}>Tu plan</h2>
          <div className="botones" style={{ marginTop: 0 }}>
            <Link className="boton boton-claro" href={`/planes/${e.id}/editar`}>Editar</Link>
            <CancelarPlan id={e.id} cancelado={e.estado === "cancelado"} />
          </div>
        </section>
      )}
      {v.esGestor && (
        <section className="tarjeta pl-gestor" aria-labelledby="t-gestor" data-testid="como-gestor">
          <h2 id="t-gestor" style={{ fontSize: 20 }}>Como gestor</h2>
          <p className="suave pequeno" style={{ margin: 0 }}>Puedes cambiar o borrar cualquier plan (a quien lo organiza le llega un aviso) o hacerlo oficial.</p>
          <div className="botones" style={{ marginTop: 0 }}>
            <Link className="boton boton-claro" href={`/planes/${e.id}/editar`}>Editar</Link>
            {!esOrganizador && <CancelarPlan id={e.id} cancelado={e.estado === "cancelado"} />}
            <AccionesGestor id={e.id} />
          </div>
        </section>
      )}
    </main>
  );
}
