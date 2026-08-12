# -*- coding: utf-8 -*-
"""Convierte 'TPBV_nueva_propuesta_Localidades.csv' (localidades censales que
quedan dentro de los poligonos de la nueva propuesta de ampliacion
territorial) a dashboard/nuevas_localidades.js: un array compacto (solo los
campos que se usan en el mapa) en vez del CSV completo de ~230 columnas del
censo, que no hace falta embeber entero para un marcador + popup.

Excluye las localidades de los poligonos de Tlaquiltenango (ver
build_propuesta_nueva.py: ese municipio ya esta cubierto por la propuesta
actual, es un duplicado, no territorio nuevo)."""
import csv
import json

BASE = r"C:\Users\gem_local\Documents\GitHub\TPBV 2026 -AGOSTO 26"
MUNICIPIOS_EXCLUIDOS = {"Tlaquiltenango"}

with open(BASE + r"\TPBV_nueva_propuesta_Localidades.csv", encoding="utf-8-sig") as f:
    rows_todas = list(csv.DictReader(f))

rows = [r for r in rows_todas if r["MUNICIPIO_POLIGONO_TPBV"].strip() not in MUNICIPIOS_EXCLUIDOS]
print(f"Localidades en el CSV: {len(rows_todas)} | excluidas ({', '.join(MUNICIPIOS_EXCLUIDOS)}): {len(rows_todas) - len(rows)} | restantes: {len(rows)}")


def to_int(v):
    v = (v or "").strip()
    if not v:
        return None
    try:
        return int(float(v))
    except ValueError:
        return None


def to_float(v):
    v = (v or "").strip()
    if not v:
        return None
    try:
        return float(v)
    except ValueError:
        return None


localidades = []
sin_coords = 0
for r in rows:
    lat = to_float(r["LATITUD_DECIMAL"])
    lon = to_float(r["LONGITUD_DECIMAL"])
    if lat is None or lon is None:
        sin_coords += 1
        continue
    localidades.append({
        "poligono": to_int(r["POLIGONO_TPBV"]),
        "nombrePoligono": r["NOMBRE_POLIGONO_TPBV"].strip(),
        "region": r["REGION_TPBV"].strip(),
        "municipioPoligono": r["MUNICIPIO_POLIGONO_TPBV"].strip(),
        "municipio": r["Municipio o demarcaci\u00f3n territorial"].strip(),
        "localidad": r["Localidad"].strip(),
        "pobTotal": to_int(r["Poblaci\u00f3n total"]),
        "pobMujeres": to_int(r["Poblaci\u00f3n femenina"]),
        "pobHombres": to_int(r["Poblaci\u00f3n masculina"]),
        "totalViviendas": to_int(r["Total de viviendas habitadas"]),
        "lat": lat,
        "lon": lon,
    })

print(f"Localidades con coordenadas validas: {len(localidades)} (sin coordenadas: {sin_coords})")

out_path = BASE + r"\dashboard\nuevas_localidades.js"
with open(out_path, "w", encoding="utf-8") as f:
    f.write("// Generado desde 'TPBV_nueva_propuesta_Localidades.csv'\n")
    f.write("// Localidades censales que quedan dentro de los poligonos de la nueva\n")
    f.write("// propuesta de ampliacion territorial (ver TPBV_PROPUESTA_NUEVA en\n")
    f.write("// propuesta_nueva.js). Campos reducidos a los que usa el mapa/popup.\n")
    f.write("const TPBV_NUEVAS_LOCALIDADES = ")
    json.dump(localidades, f, ensure_ascii=False)
    f.write(";\n")
print("Guardado:", out_path)
