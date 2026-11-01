"use client";

import { useState } from "react";
import { contrastar, textoInforme, type Contraste, type GrupoCalculado } from "@/lib/contrasteClasificacion";

export default function ContrastarClasificacion({ calculada }: { calculada: Record<string, GrupoCalculado> }) {
  const [texto, setTexto] = useState("");
  const [r, setR] = useState<Contraste | null>(null);
  return (
    <section className="gs-bloque" aria-labelledby="t-oficial">
      <h2 id="t-oficial" style={{ fontSize: 22 }}>Clasificación oficial</h2>
      <label htmlFor="oficial" className="solo-lectores">Líneas de la clasificación oficial</label>
      <textarea id="oficial" name="oficial" rows={12} value={texto} onChange={(e) => { setTexto(e.target.value); setR(null); }}
        placeholder={"G1;MACCABI DE ACOSTAR;6;3;3;0;192;71;0\nG1;NABUCO TD;6;3;3;0;181;96;0\n…"} style={{ width: "100%", fontFamily: "monospace" }} />
      <div className="botones" style={{ marginTop: 8 }}>
        <button className="boton" type="button" onClick={() => setR(contrastar(calculada, texto))} disabled={!texto.trim()}>Contrastar</button>
      </div>
      {r && (
        <div className={`aviso ${r.coincide ? "aviso-ok" : "aviso-error"}`} role="status" data-testid="contraste-resultado" style={{ marginTop: 12 }}>
          <b>{r.coincide ? "Coincide" : "DIFIERE"}</b>{r.conocidas.length > 0 && <span className="pequeno" data-testid="contraste-conocidas"> · {r.conocidas.length === 1 ? "1 diferencia conocida" : `${r.conocidas.length} diferencias conocidas`} (no avisan)</span>}
          <pre style={{ whiteSpace: "pre-wrap", margin: "8px 0 0", fontFamily: "inherit" }}>{textoInforme(r)}</pre>
        </div>
      )}
    </section>
  );
}
