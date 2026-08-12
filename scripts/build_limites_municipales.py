# -*- coding: utf-8 -*-
"""Convierte 'Limites Municipales Morelos 2025.kml' a dashboard/limites_municipales.js
(GeoJSON embebido) para usarlo como capa de referencia en el mapa Leaflet."""
import json
import xml.etree.ElementTree as ET
from shapely.geometry import shape, mapping

BASE = r"C:\Users\gem_local\Documents\GitHub\TPBV 2026 -AGOSTO 26"
NS = {"kml": "http://www.opengis.net/kml/2.2"}

# Tolerancia de simplificacion (grados). ~0.0002 grados equivale a ~20 metros
# en esta latitud: imperceptible para una capa de referencia (no es la fuente
# de verdad de limites legales), pero reduce drasticamente la cantidad de
# puntos que Leaflet tiene que repintar en cada scroll/zoom/pan del mapa.
SIMPLIFY_TOLERANCE = 0.0002


def parse_coords(text):
    """'lon,lat[,alt] lon,lat[,alt] ...' -> [[lon,lat], ...]"""
    pts = []
    for tok in text.split():
        parts = tok.split(",")
        pts.append([float(parts[0]), float(parts[1])])
    return pts


def parse_polygon(poly_el):
    outer = poly_el.find(".//kml:outerBoundaryIs/kml:LinearRing/kml:coordinates", NS)
    rings = [parse_coords(outer.text.strip())]
    for inner in poly_el.findall(".//kml:innerBoundaryIs/kml:LinearRing/kml:coordinates", NS):
        rings.append(parse_coords(inner.text.strip()))
    return rings


tree = ET.parse(BASE + r"\Limites Municipales Morelos 2025.kml")
root = tree.getroot()

features = []
for pm in root.findall(".//kml:Placemark", NS):
    data = {}
    for sd in pm.findall(".//kml:SimpleData", NS):
        data[sd.get("name")] = sd.text

    polygons = []
    for poly_el in pm.findall(".//kml:Polygon", NS):
        polygons.append(parse_polygon(poly_el))

    if not polygons:
        continue

    geom = shape({"type": "MultiPolygon", "coordinates": polygons})
    geom = geom.simplify(SIMPLIFY_TOLERANCE, preserve_topology=True)

    features.append({
        "type": "Feature",
        "properties": {
            "CVEGEO": data.get("CVEGEO"),
            "CVE_MUN": data.get("CVE_MUN"),
            "NOMGEO": data.get("NOMGEO"),
        },
        "geometry": mapping(geom),
    })

geojson = {"type": "FeatureCollection", "features": features}


def count_points(geom):
    coords = geom["coordinates"]
    kind = geom["type"]
    rings = coords if kind == "Polygon" else [r for poly in coords for r in poly]
    return sum(len(r) for r in rings)


n_pts = sum(count_points(f["geometry"]) for f in features)
print(f"Municipios convertidos: {len(features)} | puntos totales tras simplificar: {n_pts}")
for f in features:
    print(" -", f["properties"]["NOMGEO"], f["properties"]["CVEGEO"])

out_path = BASE + r"\dashboard\limites_municipales.js"
with open(out_path, "w", encoding="utf-8") as f:
    f.write("// Generado desde 'Limites Municipales Morelos 2025.kml'\n")
    f.write("const TPBV_LIMITES_MUNICIPALES = ")
    json.dump(geojson, f, ensure_ascii=False)
    f.write(";\n")
print("Guardado:", out_path)
