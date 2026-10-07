import { redirect } from "next/navigation";

// /liga/2023-24 -> su primera pestaña (como la web anterior, que abría Equipo).
export default async function Temporada({ params }: { params: Promise<{ temporada: string }> }) {
  const { temporada } = await params;
  redirect(`/liga/${temporada}/equipo`);
}
