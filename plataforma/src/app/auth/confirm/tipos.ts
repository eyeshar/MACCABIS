import type { EmailOtpType } from "@supabase/supabase-js";

// Tipos de enlace del correo que /auth/confirm acepta (D157): el de entrar (`email`/`magiclink`) y el de alta (`signup`).
const PERMITIDOS: EmailOtpType[] = ["email", "magiclink", "signup"];

export const tipoDeEnlace = (t: string | null | undefined): EmailOtpType | null => (PERMITIDOS.find((p) => p === t) ?? null);
