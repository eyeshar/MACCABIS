"use server";

import { redirect } from "next/navigation";
import { clienteSesion } from "@/lib/supabase";
import { destinoTrasEntrar } from "@/lib/sesion";

export type EstadoCodigo = { paso: "correo" | "codigo"; email: string; error?: string; aviso?: string } | null;

// Mismo mensaje tanto si el correo no esta en la lista blanca como si hay
// cualquier otro fallo al mandar el codigo: no se distingue para no dar pistas.
const ERROR_ENVIO = "No hemos podido mandar el código. Si tu correo no está dado de alta en Maccabis, habla con Iván, Carlos o Edu.";

export async function enviarCodigo(_prev: EstadoCodigo, form: FormData): Promise<EstadoCodigo> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { paso: "correo", email, error: "Escribe un correo válido." };
  const supabase = await clienteSesion();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) return { paso: "correo", email, error: ERROR_ENVIO };
  return { paso: "codigo", email, aviso: "Te hemos mandado un código a tu correo. Puede tardar un minuto; mira también en spam." };
}

export async function verificarCodigo(prev: EstadoCodigo, form: FormData): Promise<EstadoCodigo> {
  const email = String(form.get("email") ?? prev?.email ?? "").trim().toLowerCase();
  const codigo = String(form.get("codigo") ?? "").trim();
  if (!codigo) return { paso: "codigo", email, error: "Escribe el código que te hemos mandado." };
  const supabase = await clienteSesion();
  const { error } = await supabase.auth.verifyOtp({ email, token: codigo, type: "email" });
  if (error) return { paso: "codigo", email, error: "Código incorrecto o caducado. Pide uno nuevo." };
  redirect(await destinoTrasEntrar(supabase));
}

export async function salir() {
  const supabase = await clienteSesion();
  await supabase.auth.signOut();
  redirect("/entrar?salida=1");
}
