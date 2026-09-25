import Image from "next/image";

export const metadata = { title: "Guía de tallas · Maccabis" };

const TABLAS = [
  { src: "/ropa/tallas-camiseta.webp", titulo: "Camiseta de juego y cubre", texto: "En centímetros. Las letras corresponden a las medidas del dibujo." },
  { src: "/ropa/tallas-pantalon.webp", titulo: "Pantalón", texto: "En centímetros. Las letras corresponden a las medidas del dibujo." },
  { src: "/ropa/tallas-sudadera.webp", titulo: "Sudadera / chaqueta", texto: "En centímetros. Las letras corresponden a las medidas del dibujo." },
];

export default function GuiaTallas() {
  return (
    <>
      <header className="cabecera">
        <div className="dentro">
          <div className="marca">Maccabis · ropa VIVE</div>
          <h1>Guía de tallas</h1>
        </div>
      </header>
      <main className="pagina">
        <p>Medidas de la prenda (no del cuerpo) según VIVE. Lo más fiable: coge una camiseta tuya que te quede bien, mídela en plano y compárala con la tabla. Las medidas pueden variar un 2-3 % por la fabricación.</p>
        {TABLAS.map((t) => (
          <section className="tarjeta" key={t.src}>
            <h2>{t.titulo}</h2>
            <p className="suave pequeno">{t.texto}</p>
            <div className="tabla-desplazable">
              <Image src={t.src} alt={`Tabla de medidas de VIVE: ${t.titulo}`} width={928} height={265} style={{ minWidth: 640 }} />
            </div>
          </section>
        ))}
        <p className="pie">Tallas disponibles: 3, 4, 6, 8, 10, 12 (niños), XS, S, M, L, XL, XXL, 3XL, 5XL y 7XL.</p>
      </main>
    </>
  );
}
