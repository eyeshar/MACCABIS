import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Icono sencillo del club (M sobre amarillo) para la pantalla de inicio del movil.
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#F2C200", color: "#16150F", fontSize: 360, fontWeight: 800, fontFamily: "sans-serif" }}>
        M
      </div>
    ),
    size,
  );
}
