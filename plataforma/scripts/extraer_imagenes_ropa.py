"""Extrae del PDF de VIVE (privado/, fuera de git) una imagen por prenda y las
tablas de medidas, para la zona personal. Las imagenes SI se publican; el PDF, nunca.

    npm run imagenes:ropa        (requiere: pip install pymupdf pillow)

Los numeros de objeto (xref) salen de inspeccionar el PDF "Proyecto MACCABIS 23-24":
pagina 2 camiseta, 3 pantalon, 4 cubre, 5 sudadera/chaqueta.
"""
import io
import sys
from pathlib import Path

import pymupdf
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
PDF = RAIZ / "privado" / "Proyecto MACCABIS 23-24(4) (1).pdf"
SALIDA = RAIZ / "plataforma" / "public" / "ropa"

PRENDAS = {
    "camiseta": 10,  # pagina 2, vista de espaldas (nombre + dorsal)
    "pantalon": 15,  # pagina 3, vista de frente
    "cubre": 34,     # pagina 4, vista de espaldas
    "sudadera": 39,  # pagina 5, vista de frente
}
TABLAS = {
    "tallas-camiseta": 57,  # tabla "Camiseta basket fit evolution" (tambien la del cubre)
    "tallas-pantalon": 23,  # tabla "Short basket fit evolution"
    "tallas-sudadera": 47,  # tabla "Chaquetas y sudaderas tech"
}


def imagen(doc, xref):
    pix = pymupdf.Pixmap(doc, xref)
    base = doc.extract_image(xref)
    if base.get("smask"):
        mask = pymupdf.Pixmap(doc, base["smask"])
        pix = pymupdf.Pixmap(pix, mask)
    if pix.n - pix.alpha > 3:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    return Image.open(io.BytesIO(pix.tobytes("png")))


def main():
    if not PDF.exists():
        sys.exit(f"No encuentro el PDF de VIVE en {PDF}")
    SALIDA.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(PDF)
    for nombre, xref in PRENDAS.items():
        img = imagen(doc, xref)
        img.thumbnail((600, 900))
        img.save(SALIDA / f"{nombre}.webp", "WEBP", quality=82, method=6)
        print(f"  {nombre}.webp  {img.size}")
    for nombre, xref in TABLAS.items():
        img = imagen(doc, xref).convert("RGBA")
        fondo = Image.new("RGBA", img.size, (255, 255, 255, 255))
        fondo.alpha_composite(img)
        img = fondo.convert("RGB")
        img.save(SALIDA / f"{nombre}.webp", "WEBP", quality=90, method=6)
        print(f"  {nombre}.webp  {img.size}")


if __name__ == "__main__":
    main()
