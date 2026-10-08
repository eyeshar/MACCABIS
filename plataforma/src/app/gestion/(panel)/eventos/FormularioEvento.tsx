"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { hhmm, nombreSerie, quedadaPorDefecto, TIPOS, TEXTO_ESTADO_PISTA, type EventoFila, type Pista, type TipoEvento } from "@/lib/eventos/dominio";
import { TEXTO_HUECO } from "@/lib/avisos/planificador";
import { textoCambio } from "@/lib/avisos/textos";
import { crearEvento, guardarEvento } from "./acciones";

type Props = {
  evento: EventoFila | null;       // null = evento nuevo
  pistas: Pista[];
  nSiguientes: number;             // eventos de su serie desde este (inclusive)
  alcanceInicial: "este" | "siguientes";
  tipoInicial?: TipoEvento;
  volver: string;
  /** Paso 3 (D99): «respuestas en la web» encendido y cuántos invitados hay según el tipo y el equipo. */
  encendido?: boolean;
  invitadosPor?: { entreno: number; MdA: number; MdL: number; ambos: number };
};

const HUECOS: Record<TipoEvento, (keyof typeof TEXTO_HUECO)[]> = { entreno: ["lunes", "dia"], liga: ["lunes", "martes"], amistoso: ["creado", "24h"], torneo: ["creado", "24h"], interno: ["creado", "24h"] };

/** Crear y editar un evento (maqueta EventoEditar, D99 4.3). Un partido del Ayuntamiento solo cambia las notas (el
 *  encuentro es siempre 20 minutos antes, D98). Con «respuestas en la web» encendido: recordatorios, vista previa del
 *  aviso de cambio y «Guardar sin avisar» / «Guardar y avisar». */
export default function FormularioEvento({ evento, pistas, nSiguientes, alcanceInicial, tipoInicial, volver, encendido = false, invitadosPor }: Props) {
  const [error, accion, enviando] = useActionState(evento ? guardarEvento.bind(null, evento.id) : crearEvento, null);
  const delAyuntamiento = evento?.tipo === "liga" && evento.origen === "ayuntamiento";
  const [tipo, setTipo] = useState<TipoEvento>(evento?.tipo ?? tipoInicial ?? "amistoso");
  const [pistaId, setPistaId] = useState(evento?.pista_id ?? "");
  const [equipo, setEquipo] = useState(evento?.equipo ?? "ambos");
  const [fecha, setFecha] = useState(evento?.fecha ?? "");
  const [inicio, setInicio] = useState(hhmm(evento?.inicio) ?? "");
  const [fin, setFin] = useState(hhmm(evento?.fin) ?? "");
  const [numero, setNumero] = useState(evento?.numero_pista ? String(evento.numero_pista) : "");
  const pista = pistas.find((p) => p.id === pistaId);
  const serie = pistas.find((p) => p.es_de_serie && p.uso === "entreno");
  const bloqueado = delAyuntamiento; // solo notas
  const enSerie = Boolean(evento?.serie);
  const deLaSerieSinPista = tipo === "entreno" && !pistaId;
  const aviso = deLaSerieSinPista && serie?.estado === "en_obras"
    ? `${serie.nombre.split(" (")[0]} sigue en obras: mientras no elijas pista, el entreno sale como «Pista por confirmar».` : null;

  // Cambios que avisan a los jugadores (D99.9): fecha, hora, pista o encuentro (el encuentro va con la hora). Notas y
  // erratas no avisan.
  const cambiaDia = !!evento && fecha !== evento.fecha;
  const cambiaHora = !!evento && (inicio !== (hhmm(evento.inicio) ?? "") || fin !== (hhmm(evento.fin) ?? ""));
  const cambiaPista = !!evento && (pistaId !== (evento.pista_id ?? "") || numero !== (evento.numero_pista ? String(evento.numero_pista) : ""));
  const avisable = cambiaDia || cambiaHora || cambiaPista;
  const encuentro = quedadaPorDefecto(inicio || null);
  const sitioPista = pista ?? (tipo === "entreno" && serie?.estado === "habitual" ? serie : null);
  const sitio = sitioPista ? `${sitioPista.nombre_corto ?? sitioPista.nombre}${numero && pista ? `, pista ${numero}` : ""}` : "pista por confirmar";
  const preview = evento && avisable ? textoCambio({ id: evento.id, tipo, equipo, fecha, inicio: inicio || null, fin: fin || null, quedada: encuentro, titulo: evento.titulo, sitio }, "va", cambiaDia) : null;
  const nInvitados = invitadosPor ? (tipo === "entreno" || tipo === "interno" ? invitadosPor.entreno : invitadosPor[equipo as "MdA" | "MdL" | "ambos"]) : null;
  const [sinRec, setSinRec] = useState(Boolean(evento?.sin_recordatorios));

  return (
    <form action={accion} className="gs-izq" style={{ maxWidth: 960 }}>
      {error?.error && <div className="aviso aviso-error" role="alert">{error.error}</div>}

      <section className="gs-bloque" aria-labelledby="t-datos">
        <h2 id="t-datos" className="solo-lectores">Datos del evento</h2>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }} disabled={bloqueado}>
          <legend style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Tipo</legend>
          <div className="ev-radios" role="radiogroup" aria-label="Tipo de evento">
            {TIPOS.map((t) => (
              <label key={t.id}><input type="radio" name="tipo" value={t.id} checked={tipo === t.id} onChange={() => setTipo(t.id)} />{t.texto}</label>
            ))}
          </div>
        </fieldset>
        {bloqueado && <input type="hidden" name="tipo" value="liga" />}

        {bloqueado && (
          <div className="aviso aviso-info" style={{ margin: 0 }}>
            Partido de liga del Ayuntamiento: fecha, hora, rival y pista vienen de Deportes/web y se cambian con <Link href="/gestion/eventos/importar">Importar</Link>. Aquí solo se editan las <b>notas</b> (el encuentro es siempre 20 minutos antes).
          </div>
        )}

        <div className="ev-cuatro">
          <div className="campo" style={{ margin: 0 }}><label htmlFor="fecha">Fecha</label><input id="fecha" name="fecha" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={bloqueado} /></div>
          <div className="campo" style={{ margin: 0 }}><label htmlFor="inicio">Empieza</label><input id="inicio" name="inicio" type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} disabled={bloqueado} /></div>
          <div className="campo" style={{ margin: 0 }}><label htmlFor="fin">Termina</label><input id="fin" name="fin" type="time" value={fin} onChange={(e) => setFin(e.target.value)} disabled={bloqueado} /></div>
          <div className="campo" style={{ margin: 0 }}>
            <span id="l-encuentro" style={{ fontWeight: 700, fontSize: 14 }}>Encuentro</span>
            <div className="ev-encuentro" aria-labelledby="l-encuentro" data-testid="encuentro">{encuentro ?? "—"}</div>
            <div className="ayuda">Siempre 20 minutos antes (D98).</div>
            <input type="hidden" name="quedada" value="" />
          </div>
        </div>

        {(tipo === "liga" || tipo === "amistoso" || tipo === "torneo") && (
          <div className="ev-cuatro">
            <div className="campo" style={{ margin: 0 }}><label htmlFor="rival">Rival</label><input id="rival" name="rival" type="text" defaultValue={evento?.rival ?? ""} disabled={bloqueado} /></div>
            <div className="campo" style={{ margin: 0 }}>
              <label htmlFor="local">Local o visitante</label>
              <select id="local" name="local" defaultValue={evento?.es_local == null ? "" : evento.es_local ? "local" : "visitante"} disabled={bloqueado}>
                <option value="">—</option><option value="local">Local</option><option value="visitante">Visitante</option>
              </select>
            </div>
            {tipo === "liga" && <div className="campo" style={{ margin: 0 }}><label htmlFor="jornada">Jornada</label><input id="jornada" name="jornada" type="number" min={1} defaultValue={evento?.jornada ?? ""} disabled={bloqueado} /></div>}
          </div>
        )}
        {(tipo === "amistoso" || tipo === "torneo" || tipo === "interno") && (
          <div className="campo" style={{ margin: 0 }}><label htmlFor="titulo">Título</label><input id="titulo" name="titulo" type="text" maxLength={80} defaultValue={evento?.titulo ?? ""} placeholder="Torneo de Tres Cantos" /></div>
        )}
        {tipo === "entreno" && <input type="hidden" name="titulo" value={evento?.titulo ?? "Entrenamiento"} />}

        <div className="campo" style={{ margin: 0 }}>
          <label htmlFor="pista">Pista</label>
          <div className="ev-selector">
            <select id="pista" name="pista" value={pistaId} onChange={(e) => setPistaId(e.target.value)} disabled={bloqueado} className={deLaSerieSinPista && serie?.estado === "en_obras" ? "ev-campo-pista" : undefined} style={{ flex: "1 1 280px" }}>
              <option value="">{tipo === "entreno" ? `La de la serie${serie ? ` (${serie.nombre.split(" (")[0]}${serie.estado === "habitual" ? "" : `, ${TEXTO_ESTADO_PISTA[serie.estado].toLowerCase()}`})` : ""} · o por confirmar` : "Pista por confirmar"}</option>
              {pistas.filter((p) => p.estado !== "cerrada" || p.id === pistaId).map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.estado === "habitual" ? "" : ` · ${TEXTO_ESTADO_PISTA[p.estado].toLowerCase()}`}</option>)}
            </select>
            {pista && (pista.num_pistas ?? 0) > 1 && (
              <select name="numero_pista" aria-label="Número de pista" value={numero} onChange={(e) => setNumero(e.target.value)} disabled={bloqueado} style={{ width: 150 }}>
                <option value="">Nº de pista</option>
                {Array.from({ length: pista.num_pistas! }, (_, i) => <option key={i} value={i + 1}>Pista {i + 1}</option>)}
              </select>
            )}
            {!bloqueado && <Link className="boton boton-claro" href={`/gestion/eventos/pistas?volver=${encodeURIComponent(volver)}`}>Nueva pista</Link>}
          </div>
          {aviso && <div className="ayuda" style={{ color: "var(--amarillo-tinta)" }}>{aviso}</div>}
        </div>
        {bloqueado && <><input type="hidden" name="pista" value={evento?.pista_id ?? ""} /><input type="hidden" name="numero_pista" value={evento?.numero_pista ?? ""} /></>}
      </section>

      {evento && enSerie && (
        <section className="gs-bloque" aria-labelledby="t-serie">
          <h2 id="t-serie" style={{ fontSize: 24 }}>Entreno semanal</h2>
          <p style={{ margin: 0 }} className="suave">Este evento es parte de la {nombreSerie(evento)} ({nSiguientes} {nSiguientes === 1 ? "sesión" : "sesiones"} desde esta fecha). ¿A qué aplicas el cambio?</p>
          <div className="ev-radios" role="radiogroup" aria-label="Alcance del cambio">
            <label><input type="radio" name="alcance" value="este" defaultChecked={alcanceInicial === "este"} />Solo a este miércoles <span className="suave" style={{ fontWeight: 400 }}>(lo normal mientras dure la obra)</span></label>
            <label><input type="radio" name="alcance" value="siguientes" defaultChecked={alcanceInicial === "siguientes"} />A este y a todos los siguientes</label>
          </div>
          <p className="pequeno suave" style={{ margin: 0 }}>«Este y los siguientes» solo aplica lo que cambies aquí (hora, pista, notas), sin tocar la fecha ni las excepciones de cada semana. El aviso al móvil sale solo para los de las dos próximas semanas.</p>
        </section>
      )}

      <section className="gs-bloque" aria-labelledby="t-quien">
        <h2 id="t-quien" style={{ fontSize: 24 }}>Quién y notas</h2>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }} disabled={bloqueado}>
          <legend className="solo-lectores">Invitados</legend>
          <div className="ev-radios" role="radiogroup" aria-label="Invitados">
            <label><input type="radio" name="equipo" value="ambos" checked={equipo === "ambos"} onChange={() => setEquipo("ambos")} />Toda la plantilla</label>
            <label><input type="radio" name="equipo" value="MdA" checked={equipo === "MdA"} onChange={() => setEquipo("MdA")} />Solo MdA</label>
            <label><input type="radio" name="equipo" value="MdL" checked={equipo === "MdL"} onChange={() => setEquipo("MdL")} />Solo MdL</label>
          </div>
        </fieldset>
        {bloqueado && <input type="hidden" name="equipo" value={evento?.equipo ?? "ambos"} />}
        <div className="campo" style={{ margin: 0 }}>
          <label htmlFor="notas">Notas públicas</label>
          <textarea id="notas" name="notas" rows={2} maxLength={200} defaultValue={evento?.notas ?? ""} />
          <div className="ayuda">Se ven en el calendario público y en el .ics: sin nombres ni datos personales. Cambiar las notas no avisa a nadie.</div>
        </div>
      </section>

      <section className="gs-bloque" aria-labelledby="t-recs" data-testid="bloque-recordatorios">
        <h2 id="t-recs" style={{ fontSize: 24 }}>Recordatorios</h2>
        <ul className="ev-pasos-activar">
          {HUECOS[tipo].map((h) => <li key={h}>{TEXTO_HUECO[h]}</li>)}
        </ul>
        <p className="pequeno suave" style={{ margin: 0 }}>Solo a quien no ha respondido (una ausencia cuenta como respondido) y nunca de 22:30 a 8:30.{encendido ? "" : " Se activan cuando se encienda «respuestas en la web»."}</p>
        <label className="ev-radios" style={{ margin: 0 }}><input type="checkbox" name="sin_recordatorios" checked={sinRec} onChange={(e) => setSinRec(e.target.checked)} />Sin recordatorios para este evento</label>
      </section>

      {encendido && evento && avisable && preview && (
        <section className="ev-aviso-cambio" aria-labelledby="t-aviso" data-testid="vista-previa-aviso">
          <h2 id="t-aviso" style={{ fontSize: 20, margin: 0 }}>Este cambio avisa a {nInvitados ?? "los"} invitados</h2>
          <div className="ev-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/iconos/icono-192.png" alt="" width={36} height={36} />
            <div><b>{preview.titulo}</b><div className="pequeno">{preview.cuerpo}</div></div>
          </div>
          {cambiaDia && <p className="pequeno" style={{ margin: 0 }}><b>Cambia el día:</b> todas las respuestas vuelven a «sin responder» y se pregunta de nuevo (las ausencias del nuevo día se aplican solas).</p>}
          <p className="pequeno suave" style={{ margin: 0 }}>Si es una errata, usa «Guardar sin avisar».</p>
        </section>
      )}

      <div className="botones" style={{ justifyContent: "flex-end" }}>
        <Link className="boton boton-claro" href={volver}>Volver</Link>
        {encendido && evento ? (
          <>
            <button className={`boton ${avisable ? "boton-claro" : "boton-amarillo"}`} type="submit" name="avisar" value="0" disabled={enviando}>Guardar sin avisar</button>
            <button className={`boton ${avisable ? "boton-amarillo" : "boton-claro"}`} type="submit" name="avisar" value="1" disabled={enviando || !avisable}>Guardar y avisar</button>
          </>
        ) : (
          <button className="boton boton-amarillo" type="submit" disabled={enviando}>{enviando ? "Guardando…" : evento ? "Guardar y preparar mensaje" : "Crear evento"}</button>
        )}
      </div>
      {!encendido && (
        <p className="pequeno suave" style={{ margin: 0 }}>Fase puente: al guardar, el evento queda «pendiente de copiar» y se prepara el mensaje de WhatsApp. No sale ningún aviso a los móviles hasta que se encienda «respuestas en la web».</p>
      )}
    </form>
  );
}
