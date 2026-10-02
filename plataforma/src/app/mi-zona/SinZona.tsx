import { salir } from "@/app/entrar/acciones";

export default function SinZona() {
  return (
    <>
      <header className="cabecera">
        <div className="dentro">
          <div className="marca">Maccabis</div>
          <h1>Sin zona de jugador</h1>
        </div>
      </header>
      <main className="pagina">
        <section className="tarjeta">
          <p>Tu cuenta ha entrado bien, pero no está vinculada a ningún jugador del club.</p>
          <p style={{ margin: 0 }}>Si crees que debería, habla con Iván, Carlos o Edu.</p>
        </section>
        <form action={salir}>
          <button className="boton boton-claro boton-bloque" type="submit">Salir</button>
        </form>
      </main>
    </>
  );
}
