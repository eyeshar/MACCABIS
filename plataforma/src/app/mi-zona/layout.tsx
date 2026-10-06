// Toda la zona del jugador (Mi zona, pedido de ropa) va en el tema oscuro del redisenio (D76).
export default function LayoutMiZona({ children }: { children: React.ReactNode }) {
  return <div className="tema-oscuro">{children}</div>;
}
