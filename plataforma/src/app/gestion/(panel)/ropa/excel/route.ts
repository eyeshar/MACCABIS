import { NextResponse, type NextRequest } from "next/server";
import { clienteGestor, configurado } from "@/lib/supabase";
import { excelVive, type FilaPedido } from "@/lib/excel";

export const dynamic = "force-dynamic";

// Descarga el Excel para VIVE de una campana. Solo gestores (sesion + RLS).
export async function GET(request: NextRequest) {
  if (!configurado()) return new NextResponse("Sin configurar", { status: 503 });
  const supabase = await clienteGestor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("No autorizado", { status: 401 });
  const { data: esGestor } = await supabase.rpc("is_gestor");
  if (!esGestor) return new NextResponse("No autorizado", { status: 403 });

  const c = request.nextUrl.searchParams.get("c");
  if (!c) return new NextResponse("Falta la campaña", { status: 400 });
  const { data: campana } = await supabase.from("campanas_ropa").select("nombre").eq("id", c).maybeSingle();
  if (!campana) return new NextResponse("Campaña no encontrada", { status: 404 });
  const { data, error } = await supabase
    .from("pedidos_ropa")
    .select("nombre_ropa, dorsal, talla_camiseta, talla_pantalon, talla_cubre, talla_sudadera")
    .eq("campana_id", c);
  if (error) return new NextResponse(error.message, { status: 500 });

  const buffer = await excelVive((data ?? []) as FilaPedido[]);
  const nombre = `LISTADO MACCABIS ${campana.nombre}`.replace(/[^\w .-]+/g, "-") + ".xlsx";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${nombre}"`,
      "cache-control": "private, no-store",
    },
  });
}
