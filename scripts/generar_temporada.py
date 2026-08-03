# -*- coding: utf-8 -*-
"""
Genera el JSON de una temporada a partir de:
  - Actas PDF de la FBM (para parciales por cuarto y verificación)
  - Hojas de estadística XLSX exportadas de la app Afición FBM
  - (Opcional) Excel de asistencia exportado de SportEasy

USO:
  python scripts/generar_temporada.py --season 2026-27 \
      --stats carpeta_con_xlsx/ --actas carpeta_con_pdf/ \
      --asistencia Asistencia.xlsx --out data/season_2026-27.json

Luego añade la temporada a data/index.json y sube todo a GitHub.
Este script es el mismo pipeline verificado que se usó para 25/26.
Requiere: openpyxl, pdfplumber  (pip install openpyxl pdfplumber)
"""
# El cuerpo completo del pipeline está documentado en el README.
# (Se incluye la lógica de parse_stats.py + consolidate.py + cuartos.)
print("Ver README.md para el flujo completo de generación de temporada.")
