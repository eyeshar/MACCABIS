import MarcoPublico from "@/components/web/Marco";

export const metadata = { title: "Privacidad · Maccabis" };

export default function Privacidad() {
  return (
    <MarcoPublico actual="club">
      <div className="pagina">
        <h1 style={{ fontSize: 48, textTransform: "uppercase", marginTop: 24 }}>Privacidad</h1>
        <section className="tarjeta">
          <h2>La web pública</h2>
          <p style={{ margin: 0 }}>La portada, el calendario y las estadísticas solo muestran datos del equipo y estadísticas de juego de los jugadores de Maccabis. El calendario que puedes añadir a tu móvil lleva solo partidos y entrenos, sin ningún dato personal. Esta web no usa cookies de publicidad ni de seguimiento.</p>
        </section>
        <section className="tarjeta">
          <h2>Qué datos guardamos</h2>
          <p>De cada jugador: nombre, correo (para que puedas entrar) y, si lo das, tu teléfono. Si haces un pedido de ropa: el nombre que va en la prenda, el dorsal, la talla y para quién es (tú o un familiar).</p>
        </section>
        <section className="tarjeta">
          <h2>Para qué los usamos</h2>
          <p>Para que puedas entrar en tu zona personal, para tramitar el pedido de ropa del equipo y, cuando esté activo, para la disponibilidad y las convocatorias.</p>
        </section>
        <section className="tarjeta">
          <h2>Quién los ve</h2>
          <p>Tú ves tus propios datos. Los tres gestores del club (Iván, Carlos y Edu) ven los datos de todos los jugadores, porque gestionan el equipo. Nadie más tiene acceso.</p>
        </section>
        <section className="tarjeta">
          <h2>A quién se los cedemos</h2>
          <p>A nadie, salvo al proveedor de la ropa (VIVE), y solo el nombre que va impreso en la prenda, el dorsal y la talla. No le damos tu correo ni tu teléfono.</p>
        </section>
        <section className="tarjeta">
          <h2>Cómo pedir que borremos tus datos</h2>
          <p style={{ margin: 0 }}>Escribe al club (a Iván, Carlos o Edu) y te los borramos.</p>
        </section>
      </div>
    </MarcoPublico>
  );
}
