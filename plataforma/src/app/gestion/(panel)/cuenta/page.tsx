import { exigirGestor } from "@/lib/sesion";

export const metadata = { title: "Mi cuenta · Gestión Maccabis" };

export default async function Cuenta() {
  const { user, nombre } = await exigirGestor();
  return (
    <>
      <h1>Mi cuenta</h1>
      <section className="tarjeta">
        <p style={{ margin: 0 }}><strong>{nombre}</strong> · {user.email}</p>
        <p className="suave pequeno" style={{ marginTop: 10 }}>
          Entras con Google o con un código a este correo (D68): ya no hay contraseña que cambiar.
        </p>
      </section>
    </>
  );
}
