# -*- coding: utf-8 -*-
"""Convierte 'TPBV_nueva_propuesta ok.geojson' (version final/limpia de la
propuesta de ampliacion territorial) a dashboard/propuesta_nueva.js (GeoJSON
embebido) para usarla como capa de comparacion en el mapa Leaflet, junto a la
capa de poligonos actual (TPBV_POLIGONOS, ver poligonos.js).

Excluye los poligonos de Tlaquiltenango: ese municipio ya esta cubierto por
la propuesta actual (poligonos 14-18, ver TPBV_POLIGONOS/poligonos.js), asi
que los 5 poligonos de Tlaquiltenango en la nueva propuesta son un duplicado,
no territorio nuevo (decision del 2026-08-12)."""
import json

BASE = r"C:\Users\gem_local\Documents\GitHub\TPBV 2026 -AGOSTO 26"
MUNICIPIOS_EXCLUIDOS = {"Tlaquiltenango"}

with open(BASE + r"\TPBV_nueva_propuesta ok.geojson", encoding="utf-8") as f:
    geojson = json.load(f)

feats_todos = geojson["features"]
feats = [f for f in feats_todos if f["properties"]["MUNICIPIO"] not in MUNICIPIOS_EXCLUIDOS]
excluidos = [f for f in feats_todos if f["properties"]["MUNICIPIO"] in MUNICIPIOS_EXCLUIDOS]
geojson["features"] = feats

print(f"Poligonos en el geojson original: {len(feats_todos)}")
print(f"Excluidos ({', '.join(MUNICIPIOS_EXCLUIDOS)}): {len(excluidos)}")
for feat in excluidos:
    p = feat["properties"]
    print(f"  EXCLUIDO {p.get('POLIGONO')}: {p.get('NOMBRE')} ({p.get('MUNICIPIO')})")
print(f"Poligonos en nueva propuesta (tras exclusion): {len(feats)}")
for feat in sorted(feats, key=lambda x: x["properties"].get("POLIGONO", 0)):
    p = feat["properties"]
    print(f"  {p.get('POLIGONO')}: {p.get('NOMBRE')} ({p.get('MUNICIPIO')}, {p.get('REGION')})")

out_path = BASE + r"\dashboard\propuesta_nueva.js"
with open(out_path, "w", encoding="utf-8") as f:
    f.write("// Generado desde 'TPBV_nueva_propuesta ok.geojson'\n")
    f.write("const TPBV_PROPUESTA_NUEVA = ")
    json.dump(geojson, f, ensure_ascii=False)
    f.write(";\n")
print("Guardado:", out_path)
