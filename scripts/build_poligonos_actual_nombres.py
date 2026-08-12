# -*- coding: utf-8 -*-
"""Convierte 'Lista Comunidades TPBV 2026 - Revisada.csv' (fuente autorizada
del nombre de cada uno de los 26 poligonos de la Propuesta Actual, columna
Nombre_Poligono) a dashboard/poligonos_actual_nombres.js: un simple mapeo
{numero de poligono: nombre}, usado por poligonoLabel() en app.js para
mostrar el nombre del poligono en vez de "Poligono N" en el selector de
"Filtrar por Poligono" (mismo tratamiento que ya tiene la Nueva Propuesta
Territorial via el campo nombrePoligono)."""
import csv
import json

BASE = r"C:\Users\gem_local\Documents\GitHub\TPBV 2026 -AGOSTO 26"

with open(BASE + r"\Lista Comunidades TPBV 2026 - Revisada.csv", encoding="utf-8-sig") as f:
    rows = list(csv.DictReader(f))

nombres = {}
inconsistentes = []
for r in rows:
    pol = r["#Polígono"].strip()
    nombre = r["Nombre_Poligono"].strip()
    if not pol:
        continue
    if pol in nombres and nombres[pol] != nombre:
        inconsistentes.append((pol, nombres[pol], nombre))
    nombres[int(pol)] = nombre

if inconsistentes:
    raise SystemExit(f"Nombres de poligono inconsistentes en el CSV: {inconsistentes}")

print(f"Poligonos con nombre: {len(nombres)}")
for k in sorted(nombres):
    print(f"  {k}: {nombres[k]}")

out_path = BASE + r"\dashboard\poligonos_actual_nombres.js"
with open(out_path, "w", encoding="utf-8") as f:
    f.write("// Generado desde 'Lista Comunidades TPBV 2026 - Revisada.csv'\n")
    f.write("// Mapeo numero de poligono -> Nombre_Poligono, para mostrar el nombre\n")
    f.write("// en el selector 'Filtrar por Poligono' de la Propuesta Actual (ver\n")
    f.write("// poligonoLabel() en app.js).\n")
    f.write("const TPBV_POLIGONOS_ACTUAL_NOMBRES = ")
    json.dump(nombres, f, ensure_ascii=False)
    f.write(";\n")
print("Guardado:", out_path)
