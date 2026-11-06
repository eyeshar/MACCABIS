/** Cabecera del evento (D189): tipo, titulo y fecha; la quedada y la hora en grande; la pista con su direccion y «Cómo
 *  llegar» (D119: abre Google Maps, sin mapas incrustados); la linea amarilla si cambio algo. La comparten la vista del
 *  jugador y la de los gestores. */
export default function CabeceraEvento({ tipo, etiqueta, titulo, fecha, quedada, inicio, fin, pista, direccion, mapa, cambio, cancelado }: {
  tipo: string; etiqueta: string; titulo: string; fecha: string; quedada: string | null; inicio: string | null; fin: string | null;
  pista: string; direccion: string | null; mapa: string | null; cambio: string | null; cancelado: boolean;
}) {
  return (
    <>
      <header className="ev2-cab" data-tipo={tipo}>
        <span className="ev2-tipo">{etiqueta}</span>
        <h1>{titulo}</h1>
        <p className="ev2-fecha">{fecha}</p>
      </header>
      {cancelado && <p className="aviso aviso-error">Este evento está cancelado.</p>}
      {cambio && <p className="rw-cambio" role="note">{cambio}</p>}
      <section className="ev2-horas" aria-label="Horas" data-testid="horas-evento">
        <div className="ev2-hora ev2-quedada"><small>Quedada</small><b className="cifra">{quedada ?? "—"}</b></div>
        <div className="ev2-hora"><small>{tipo === "entreno" ? "Empieza" : "Hora"}</small><b className="cifra">{inicio ?? "—"}</b>{fin && <span className="tenue cifra">hasta {fin}</span>}</div>
      </section>
      <section className="tarjeta ev2-pista" aria-labelledby="t-pista">
        <h2 id="t-pista" className="solo-lectores">Pista</h2>
        <strong>{pista}</strong>
        {direccion && <span className="suave">{direccion}</span>}
        {mapa && <a className="boton boton-claro" href={mapa} target="_blank" rel="noopener noreferrer">Cómo llegar</a>}
      </section>
    </>
  );
}
