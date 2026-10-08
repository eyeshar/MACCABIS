"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { hhmm, TIPOS, TEXTO_ESTADO_PISTA, type EventoFila, type Pista, type TipoEvento } from "@/lib/eventos/dominio";
import { crearEvento, guardarEvento } from "./acciones";

type Props = {
  evento: EventoFila | null;       // null = evento nuevo
  pistas: Pista[];
  nSiguientes: number;             // eventos de su serie desde este (inclusive)
  alcanceInicial: "este" | "siguientes";
  tipoInicial?: TipoEvento;
  volver: string;
};

/** Crear y editar un evento (maqueta EventoEditar). Un partido del Ayuntamiento solo cambia quedada y notas. */
export default function FormularioEvento({ evento, pistas, nSiguientes, alcanceInicial, tipoInicial, volver }: Props) {
  const [error, accion, enviando] = useActionState(evento ? guardarEvento.bind(null, evento.id) : crearEvento, null);
  const delAyuntamiento = evento?.tipo === "liga" && evento.origen === "ayuntamiento";
  const [tipo, setTipo] = useState<TipoEvento>(evento?.tipo ?? tipoInicial ?? "amistoso");
  const [pistaId, setPistaId] = useState(evento?.pista_id ?? "");
  const [equipo, setEquipo] = useState(evento?.equipo ?? (tipoInicial === "entreno" ? "ambos" : "ambos"));
  const pista = pistas.find((p) => p.id === pistaId);
  const serie = pistas.find((p) => p.es_de_serie && p.uso === "entreno");
  const bloqueado = delAyuntamiento; // solo quedada y notas
  const enSerie = Boolean(evento?.serie);
  const deLaSerieSinPista = tipo === "entreno" && !pistaId;
  const aviso = deLaSerieSinPista && serie?.estado === "en_obras"
    ? `${serie.nombre.split(" (")[0]} sigue en obras: mientras no elijas pista, el entreno sale como «Pista por confirmar».` : null;

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
            Partido de liga del Ayuntamiento: fecha, hora, rival y pista vienen de Deportes/web y se cambian con <Link href="/gestion/eventos/importar">Importar</Link>. Aquí solo se editan la <b>quedada</b> y las <b>notas</b>.
          </div>
        )}

        <div className="ev-cuatro">
          <div className="campo" style={{ margin: 0 }}><label htmlFor="fecha">Fecha</label><input id="fecha" name="fecha" type="date" required defaultValue={evento?.fecha ?? ""} disabled={bloqueado} /></div>
          <div className="campo" style={{ margin: 0 }}><label htmlFor="inicio">Empieza</label><input id="inicio" name="inicio" type="time" defaultValue={hhmm(evento?.inicio) ?? ""} disabled={bloqueado} /></div>
          <div className="campo" style={{ margin: 0 }}><label htmlFor="fin">Termina</label><input id="fin" name="fin" type="time" defaultValue={hhmm(evento?.fin) ?? ""} disabled={bloqueado} /></div>
          <div className="campo" style={{ margin: 0 }}><label htmlFor="quedada">Quedada</label><input id="quedada" name="quedada" type="time" defaultValue={hhmm(evento?.quedada) ?? ""} aria-describedby="ayuda-quedada" /><div id="ayuda-quedada" className="ayuda">Vacía = 20 minutos antes.</div></div>
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
              <select name="numero_pista" aria-label="Número de pista" defaultValue={evento?.numero_pista ?? ""} disabled={bloqueado} style={{ width: 150 }}>
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
          <p style={{ margin: 0 }} className="suave">Este evento es parte de la serie «{evento.serie}» ({nSiguientes} {nSiguientes === 1 ? "sesión" : "sesiones"} desde esta fecha). ¿A qué aplicas el cambio?</p>
          <div className="ev-radios" role="radiogroup" aria-label="Alcance del cambio">
            <label><input type="radio" name="alcance" value="este" defaultChecked={alcanceInicial === "este"} />Solo a este miércoles <span className="suave" style={{ fontWeight: 400 }}>(lo normal mientras dure la obra)</span></label>
            <label><input type="radio" name="alcance" value="siguientes" defaultChecked={alcanceInicial === "siguientes"} />A este y a todos los siguientes</label>
          </div>
          <p className="pequeno suave" style={{ margin: 0 }}>«Este y los siguientes» solo aplica lo que cambies aquí (hora, pista, quedada, notas), sin tocar la fecha ni las excepciones de cada semana.</p>
        </section>
      )}

      <section className="gs-bloque" aria-labelledby="t-quien">
        <h2 id="t-quien" style={{ fontSize: 24 }}>Quién y notas</h2>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }} disabled={bloqueado}>
          <legend className="solo-lectores">Convocados</legend>
          <div className="ev-radios" role="radiogroup" aria-label="Convocados">
            <label><input type="radio" name="equipo" value="ambos" checked={equipo === "ambos"} onChange={() => setEquipo("ambos")} />Toda la plantilla</label>
            <label><input type="radio" name="equipo" value="MdA" checked={equipo === "MdA"} onChange={() => setEquipo("MdA")} />Solo MdA</label>
            <label><input type="radio" name="equipo" value="MdL" checked={equipo === "MdL"} onChange={() => setEquipo("MdL")} />Solo MdL</label>
          </div>
        </fieldset>
        {bloqueado && <input type="hidden" name="equipo" value={evento?.equipo ?? "ambos"} />}
        <div className="campo" style={{ margin: 0 }}>
          <label htmlFor="notas">Notas públicas</label>
          <textarea id="notas" name="notas" rows={2} maxLength={200} defaultValue={evento?.notas ?? ""} />
          <div className="ayuda">Se ven en el calendario público y en el .ics: sin nombres ni datos personales.</div>
        </div>
        <div className="hueco">
          Fase puente: al guardar, el evento queda «pendiente de copiar» y aquí se prepara el mensaje de WhatsApp. Claude lo copia a SportEasy con tu OK; allí los jugadores siguen respondiendo. Los avisos al móvil y los recordatorios automáticos llegan en el paso 3: mientras tanto, Claude propone los recordatorios (lunes y martes) y los envías tú.
        </div>
      </section>

      <div className="botones" style={{ justifyContent: "flex-end" }}>
        <Link className="boton boton-claro" href={volver}>Volver</Link>
        <button className="boton boton-amarillo" type="submit" disabled={enviando}>{enviando ? "Guardando…" : evento ? "Guardar y preparar mensaje" : "Crear evento"}</button>
      </div>
    </form>
  );
}
