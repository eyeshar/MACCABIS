import { exigirGestor } from "@/lib/gestor";
import FormularioContrasena from "./FormularioContrasena";

export const metadata = { title: "Mi cuenta · Gestión Maccabis" };

export default async function Cuenta({ searchParams }: { searchParams: Promise<{ nueva?: string }> }) {
  const { nueva } = await searchParams;
  const { user, nombre } = await exigirGestor();
  return (
    <>
      <h1>Mi cuenta</h1>
      {nueva && <div className="aviso aviso-info">Pon ahora una contraseña nueva para tu cuenta.</div>}
      <section className="tarjeta">
        <p><strong>{nombre}</strong> · {user.email}</p>
        <h2>Cambiar contraseña</h2>
        <FormularioContrasena />
      </section>
    </>
  );
}
