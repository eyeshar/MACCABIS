import Link from "next/link";

/** «Gestión · N pendientes» (D189; antes la banda plegable «Gestión esta semana» de D117): en la Semana de un gestor, una
 *  línea que lleva a /gestion y, plegadas, las tareas de «Pendiente» del Panel, cada una enlazada. */
export default function BandaGestion({ pendientes }: { pendientes: { texto: string; href: string }[] }) {
  const n = pendientes.length;
  return (
    <section className="in-gestion sm-banda" aria-labelledby="t-gestion-semana" data-testid="banda-gestion">
      <h2 id="t-gestion-semana" className="sm-banda-cab">
        <Link href="/gestion"><span className="in-gestion-etq">Gestión</span> · {n === 0 ? "nada pendiente" : n === 1 ? "1 pendiente" : `${n} pendientes`} ›</Link>
      </h2>
      {n > 0 && (
        <details className="sm-banda-lista">
          <summary>Ver qué</summary>
          <ul className="in-gestion-lista">{pendientes.map((p) => <li key={p.texto}><Link href={p.href}>{p.texto}</Link></li>)}</ul>
        </details>
      )}
    </section>
  );
}
