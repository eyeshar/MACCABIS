// D198: lo que se ve AL MOMENTO al tocar un enlace a una pantalla que tarda (el domingo, un evento): unos bloques grises
// con la forma de la página y «Cargando…» para los lectores de pantalla. Sin datos ni consultas: lo sirve Next en el
// prefetch y lo pinta en cuanto se toca, mientras llega la página de verdad.
export default function Esqueleto({ prueba, titulo, bloques = 3 }: { prueba: string; titulo: string; bloques?: number }) {
  return (
    <main className="pagina esq" data-testid={prueba} aria-busy="true">
      <p className="solo-lectores" role="status">Cargando {titulo}…</p>
      <span className="esq-linea esq-corta" aria-hidden="true" />
      <span className="esq-linea esq-titulo" aria-hidden="true" />
      <span className="esq-linea esq-media" aria-hidden="true" />
      {Array.from({ length: bloques }, (_, i) => <span key={i} className="esq-bloque" aria-hidden="true" />)}
    </main>
  );
}
