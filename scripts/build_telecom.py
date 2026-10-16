"""
Genera dashboard/telecom.js a partir de 'Sitios REEM.kml' (infraestructura de
telecomunicaciones: torres y sitios de la red estatal).

SEGURIDAD: el tablero es publico. Este script AGREGA los sitios por
municipio y por sector antes de escribir el .js: NO se exportan coordenadas,
nombres de sitio ni descripciones (los nombres identifican el lugar, p. ej.
"Torre de SSPC - C4 ..."). El KML original no se publica en el repositorio.

  - Sector = carpeta del KML (GEM, Educacion, SSPC, S. Salud).
  - Municipio = punto-en-poligono contra dashboard/limites_municipales.js
    (limites INE, los mismos del mapa del tablero).
"""
import json
import re
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
KML = BASE / "Sitios REEM.kml"
LIMITES = BASE / "dashboard" / "limites_municipales.js"
OUT = BASE / "dashboard" / "telecom.js"

NS = "{http://www.opengis.net/kml/2.2}"
SECTORES = {
    "GEM": "Gobierno del Estado",
    "Educacion": "Educación",
    "SSPC": "Seguridad y Protección Ciudadana",
    "S. Salud": "Salud",
}


def dentro_de_anillo(anillo, lon, lat):
    dentro = False
    j = len(anillo) - 1
    for i in range(len(anillo)):
        xi, yi = anillo[i][:2]
        xj, yj = anillo[j][:2]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            dentro = not dentro
        j = i
    return dentro


def poligonos(geom):
    return geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]


def municipio_de(municipios, lon, lat):
    for nombre, cve, geom in municipios:
        for poly in poligonos(geom):
            exterior, *huecos = poly
            if dentro_de_anillo(exterior, lon, lat) and not any(dentro_de_anillo(h, lon, lat) for h in huecos):
                return nombre, cve
    return None, None


def main():
    src = LIMITES.read_text(encoding="utf-8")
    gj = json.loads(re.search(r"= (\{.*\});", src, re.S).group(1))
    municipios = [(f["properties"]["NOMGEO"], f["properties"]["CVEGEO"], f["geometry"]) for f in gj["features"]]

    raiz = ET.parse(KML).getroot()
    por_municipio = defaultdict(Counter)
    por_sector = Counter()
    fuera = 0
    for carpeta in raiz.iter(NS + "Folder"):
        sector = SECTORES.get((carpeta.findtext(NS + "name") or "").strip(), (carpeta.findtext(NS + "name") or "Otro").strip())
        for pm in carpeta.findall(NS + "Placemark"):
            coords = pm.find(f".//{NS}Point/{NS}coordinates")
            if coords is None:
                continue
            lon, lat = (float(v) for v in coords.text.strip().split(",")[:2])
            nombre, cve = municipio_de(municipios, lon, lat)
            if not nombre:
                fuera += 1
                continue
            por_municipio[(nombre, cve)][sector] += 1
            por_sector[sector] += 1

    datos = {
        "total": sum(por_sector.values()),
        "porSector": dict(por_sector.most_common()),
        "municipios": sorted(
            ({"municipio": n, "cvegeo": c, "total": sum(cnt.values()), "porSector": dict(cnt.most_common())}
             for (n, c), cnt in por_municipio.items()),
            key=lambda m: (-m["total"], m["municipio"])),
    }
    OUT.write_text(
        "// Generado automaticamente por scripts/build_telecom.py a partir de 'Sitios REEM.kml'.\n"
        "// SEGURIDAD: solo conteos por municipio y sector; sin coordenadas ni nombres de sitio.\n"
        f"const TPBV_TELECOM = {json.dumps(datos, ensure_ascii=False)};\n", encoding="utf-8")

    print(f"Sitios: {datos['total']} | municipios con sitios: {len(datos['municipios'])} | fuera de Morelos: {fuera}")
    print("Por sector:", datos["porSector"])
    for m in datos["municipios"]:
        print(f"  {m['municipio']:<28} {m['total']:>3}  {m['porSector']}")


if __name__ == "__main__":
    main()
