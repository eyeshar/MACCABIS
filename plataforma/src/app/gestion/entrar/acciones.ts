"use server";

import { redirect } from "next/navigation";
import { clienteGestor } from "@/lib/supabase";
import { origen } from "@/lib/gestor";

export type EstadoEntrar = { error: string; email: string } | null;

export async function entrar(_prev: EstadoEntrar, form: FormData): Promise<EstadoEntrar> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Escribe tu correo y tu contraseña.", email };
  const supabase = await clienteGestor();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Correo o contraseña incorrectos.", email };
  redirect("/gestion");
}

export async function salir() {
  const supabase = await clienteGestor();
  await supabase.auth.signOut();
  redirect("/gestion/entrar?salir=1");
}

export async function recuperar(_prev: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") ?? "").trim();
  if (!email) return "Escribe tu correo.";
  const supabase = await clienteGestor();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await origen()}/auth/confirm` });
  return "Si ese correo es de un gestor, te llegará un enlace para poner una contraseña nueva.";
}
