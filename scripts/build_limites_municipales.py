# -*- coding: utf-8 -*-
"""Convierte 'Limites_municipales_ine.geojson' (limites municipales oficiales
del INE, version mas reciente) a dashboard/limites_municipales.js (GeoJSON
embebido) para usarlo como capa de referencia en el mapa Leaflet.

Reemplaza a la fuente anterior ('Limites Municipales Morelos 2025.kml',
2026-08-15: "la vamos a cambiar por Limites_municipales_ine.geojson, esa es
mas reciente y es del ine"). Dos detalles de la fuente del INE:

  - Los nombres de municipio (columna 'nombre') vienen en MAYUSCULAS y sin
    acentos ("COATLAN DEL RIO", "TLALTIZAPAN DE ZAPATA"). Los nombres
    correctos (con acentos) se toman del KML anterior, cruzando por codigo
    de municipio INEGI (CVE_MUN / 'municipio' -- el mismo codigo de 3 digitos
    en ambas fuentes, verificado 1:1 para los 36 municipios de Morelos).
  - La geometria viene en UTM zona 14N (EPSG:32614, ver 'crs' del geojson),
    no en lon/lat (EPSG:4326, lo que espera Leaflet), asi que se reproyecta
    con pyproj antes de simplificar/embeber.
"""
import json
import xml.etree.ElementTree as ET
from pyproj import Transformer
from shapely.geometry import shape, mapping
from shapely.ops import transform as shapely_transform

BASE = r"C:\Users\gem_local\Documents\GitHub\TPBV 2026 -AGOSTO 26"
NS = {"kml": "http://www.opengis.net/kml/2.2"}

# Tolerancia de simplificacion (grados, en WGS84 tras reproyectar). ~0.0002
# grados equivale a ~20 metros en esta latitud: imperceptible para una capa
# de referencia (no es la fuente de verdad de limites legales), pero reduce
# drasticamente la cantidad de puntos que Leaflet tiene que repintar en cada
# scroll/zoom/pan del mapa. Misma tolerancia que se usaba con el KML.
SIMPLIFY_TOLERANCE = 0.0002


def count_points(geometry_mapping):
    """Cuenta puntos totales de un dict de geometria (Polygon o MultiPolygon)."""
    coords = geometry_mapping["coordinates"]
    rings = coords if geometry_mapping["type"] == "Polygon" else [r for poly in coords for r in poly]
    return sum(len(r) for r in rings)


# --- Nombres correctos (con acentos) por codigo de municipio, desde el KML ---
tree = ET.parse(BASE + r"\Limites Municipales Morelos 2025.kml")
root = tree.getroot()
nombres_por_codigo = {}
for pm in root.findall(".//kml:Placemark", NS):
    data = {sd.get("name"): sd.text for sd in pm.findall(".//kml:SimpleData", NS)}
    if data.get("CVE_MUN"):
        nombres_por_codigo[int(data["CVE_MUN"])] = data["NOMGEO"]

# --- Geometria del INE (mas reciente), reproyectada de UTM 14N a WGS84 ---
with open(BASE + r"\Limites_municipales_ine.geojson", encoding="utf-8") as f:
    ine = json.load(f)

transformer = Transformer.from_crs("EPSG:32614", "EPSG:4326", always_xy=True)

features = []
faltantes = []
for feat in ine["features"]:
    p = feat["properties"]
    codigo = int(p["municipio"])
    nombre = nombres_por_codigo.get(codigo)
    if nombre is None:
        faltantes.append((codigo, p.get("nombre")))
        nombre = (p.get("nombre") or "").title()

    geom = shape(feat["geometry"])
    geom = shapely_transform(transformer.transform, geom)
    geom = geom.simplify(SIMPLIFY_TOLERANCE, preserve_topology=True)

    features.append({
        "type": "Feature",
        "properties": {
            "CVEGEO": f"17{codigo:03d}",
            "CVE_MUN": f"{codigo:03d}",
            "NOMGEO": nombre,
        },
        "geometry": mapping(geom),
    })

if faltantes:
    print(f"AVISO: {len(faltantes)} municipios sin nombre acentuado en el KML (se uso el nombre del INE tal cual):")
    for codigo, nombre in faltantes:
        print(f"  {codigo}: {nombre}")

geojson = {"type": "FeatureCollection", "features": features}

n_pts = sum(count_points(f["geometry"]) for f in features)
print(f"Municipios convertidos: {len(features)} | puntos totales tras simplificar: {n_pts}")
for f in sorted(features, key=lambda x: x["properties"]["CVE_MUN"]):
    print(" -", f["properties"]["NOMGEO"], f["properties"]["CVEGEO"])

out_path = BASE + r"\dashboard\limites_municipales.js"
with open(out_path, "w", encoding="utf-8") as f:
    f.write("// Generado desde 'Limites_municipales_ine.geojson' (INE, reproyectado de\n")
    f.write("// UTM 14N a WGS84) + nombres acentuados del KML anterior (ver\n")
    f.write("// scripts/build_limites_municipales.py).\n")
    f.write("const TPBV_LIMITES_MUNICIPALES = ")
    json.dump(geojson, f, ensure_ascii=False)
    f.write(";\n")
print("Guardado:", out_path)
