"""
Actualiza dashboard/TPBV_2026_COMPLETO_PRO.html (version autocontenida que se
publica en GitHub Pages) con el contenido actual de los .js de dashboard/.

El HTML guarda cada archivo en un bloque:
    <script>
    /* EMBEBIDO: <archivo>.js */
    ...contenido...
    </script>
Este script reemplaza el contenido de cada bloque por el del archivo y, para
los archivos de NUEVOS_BLOQUES que aun no esten embebidos, inserta su bloque
despues del indicado. El markup (nav, contenedores de vistas, CSS) se edita a
mano en el HTML.

Ademas incrusta como data: URI los recursos del shell (tipografias de
@font-face y los logos <img> del encabezado), fuera de los bloques EMBEBIDO:
tpbv.morelos.gob.mx sirve este HTML a traves de un proxy que responde 400 a
archivos nuevos de assets/ (GitHub Pages si los sirve), asi que el HTML no
debe depender de ellos. La ruta original queda anotada (/*recurso:...*/ en
CSS, data-recurso="..." en <img>) para volver a incrustar si cambia el archivo.

Uso: python scripts/embed_dashboard.py [--check]
  --check  solo informa que bloques cambiarian, sin escribir.
"""
import base64
import re
import sys
from pathlib import Path

DASHBOARD = Path(__file__).resolve().parent.parent / "dashboard"
HTML = DASHBOARD / "TPBV_2026_COMPLETO_PRO.html"

# archivo nuevo -> bloque despues del cual se inserta (orden de carga)
NUEVOS_BLOQUES = {
    "aulas_tecnologicas.js": "banco_proyectos.js",
    "mapa_morelos.js": "app.js",
    "aulas_mapa.js": "mapa_morelos.js",
    "aulas_contexto.js": "aulas_mapa.js",
    "aulas_view.js": "aulas_contexto.js",
    "datos_abiertos.js": "aulas_view.js",
    "inicio_contexto.js": "mapa_morelos.js",
    "inicio_buscador.js": "inicio_contexto.js",
    "red_ltqnu.js": "aulas_tecnologicas.js",
    "red_view.js": "datos_abiertos.js",
    "telecom.js": "red_ltqnu.js",
    "telecom_view.js": "red_view.js",
    "traducciones_na.js": "telecom.js",
    "i18n.js": "telecom_view.js",
}

# Bloques que deben cargarse ANTES que otro porque app.js los usa ya al
# arrancar: mapa_morelos.js (crearMapaMorelos, mapa inicial de Analisis) e
# inicio_contexto.js / inicio_buscador.js (renderInicioView, Inicio es la vista inicial).
DEBE_IR_ANTES_DE = {"mapa_morelos.js": "app.js", "inicio_contexto.js": "app.js", "inicio_buscador.js": "app.js"}

# Bloques que NO deben ir en el HTML publicado. La Nueva Propuesta Territorial
# aun no es informacion oficial (2026-10-16): sus datos se retiran del HTML
# (no solo de la interfaz, para que no queden en el codigo fuente) y app.js
# oculta lo que depende de ellos (HAY_NUEVA_PROPUESTA). El tablero completo
# quedo en el tag git respaldo-2026-10-16-con-nueva-propuesta. Para volver a
# publicarla: quitar estos nombres de aqui y agregarlos a NUEVOS_BLOQUES.
# Banco de Proyectos: retirado igual el 2026-10-16 (HAY_BANCO_PROYECTOS en app.js).
BLOQUES_RETIRADOS = {"propuesta_nueva.js", "propuesta_2026.js", "data_propuesta_2026.js", "banco_proyectos.js"}

BLOQUE_RE = re.compile(r"(<script>\r\n/\* EMBEBIDO: ([\w.]+) \*/\r\n)(.*?)(\r\n</script>)", re.S)

MIME = {".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png"}
# CSS: url(assets/fonts/X.woff2) o /*recurso:assets/fonts/X.woff2*/url(data:...)
CSS_RECURSO_RE = re.compile(r"(?:/\*recurso:(assets/[^*]+)\*/url\([^)]*\)|url\((assets/fonts/[^)]+)\))")
# <img src="assets/logo-*.svg"> o <img data-recurso="assets/..." src="data:...">
IMG_RECURSO_RE = re.compile(r'(?:data-recurso="(assets/[^"]+)" src="[^"]*"|src="(assets/logo-[^"]+\.svg)")')


def contenido(nombre):
    texto = (DASHBOARD / nombre).read_text(encoding="utf-8")
    return texto.replace("\r\n", "\n").rstrip("\n").replace("\n", "\r\n")


def bloque(nombre):
    return f"<script>\r\n/* EMBEBIDO: {nombre} */\r\n{contenido(nombre)}\r\n</script>"


def data_uri(ruta):
    archivo = DASHBOARD / ruta
    datos = base64.b64encode(archivo.read_bytes()).decode("ascii")
    return f"data:{MIME[archivo.suffix]};base64,{datos}"


def incrustar_recursos(shell, cambios):
    """Recursos del shell (antes del primer bloque EMBEBIDO) -> data: URI."""
    def css(m):
        ruta = m.group(1) or m.group(2)
        nuevo = f"/*recurso:{ruta}*/url({data_uri(ruta)})"
        if nuevo != m.group(0):
            cambios.append(f"incrustado: {ruta}")
        return nuevo

    def img(m):
        ruta = m.group(1) or m.group(2)
        nuevo = f'data-recurso="{ruta}" src="{data_uri(ruta)}"'
        if nuevo != m.group(0):
            cambios.append(f"incrustado: {ruta}")
        return nuevo

    return IMG_RECURSO_RE.sub(img, CSS_RECURSO_RE.sub(css, shell))


def main():
    check = "--check" in sys.argv
    html = HTML.read_bytes().decode("utf-8")
    cambios = []

    inicio_bloques = html.find("<script>\r\n/* EMBEBIDO:")
    html = incrustar_recursos(html[:inicio_bloques], cambios) + html[inicio_bloques:]

    def reemplazar(m):
        nombre = m.group(2)
        nuevo = contenido(nombre)
        if nuevo == m.group(3).rstrip("\r\n"):
            return m.group(0)  # igual salvo saltos de linea finales: no tocar
        cambios.append(f"actualizado: {nombre}")
        return m.group(1) + nuevo + m.group(4)

    html = BLOQUE_RE.sub(reemplazar, html)

    def retirar(m):
        if m.group(2) not in BLOQUES_RETIRADOS:
            return m.group(0)
        cambios.append(f"retirado: {m.group(2)}")
        return ""

    # Mismo patron que BLOQUE_RE + el salto de linea previo, para no dejar
    # lineas vacias donde estaba el bloque (grupos 1-4 iguales).
    html = re.compile(r"(?:\r\n)?" + BLOQUE_RE.pattern, re.S).sub(retirar, html)

    embebidos = {m.group(2): m for m in BLOQUE_RE.finditer(html)}
    for nombre, despues_de in NUEVOS_BLOQUES.items():
        if nombre in embebidos:
            continue
        ancla = next((m for m in BLOQUE_RE.finditer(html) if m.group(2) == despues_de), None)
        if not ancla:
            raise SystemExit(f"No se encontro el bloque '{despues_de}' para insertar '{nombre}'")
        html = html[:ancla.end()] + "\r\n" + bloque(nombre) + html[ancla.end():]
        cambios.append(f"insertado: {nombre} (despues de {despues_de})")

    # Orden de carga obligatorio: si un bloque quedo despues del que lo
    # necesita al cargar, se mueve justo antes de el.
    for nombre, antes_de in DEBE_IR_ANTES_DE.items():
        bloques = {m.group(2): m for m in BLOQUE_RE.finditer(html)}
        if nombre not in bloques or antes_de not in bloques or bloques[nombre].start() < bloques[antes_de].start():
            continue
        m = bloques[nombre]
        texto = m.group(0)
        html = html[:m.start()].rstrip("\r\n") + "\r\n" + html[m.end():].lstrip("\r\n")
        ancla = next(x for x in BLOQUE_RE.finditer(html) if x.group(2) == antes_de)
        html = html[:ancla.start()] + texto + "\r\n" + html[ancla.start():]
        cambios.append(f"movido: {nombre} (antes de {antes_de})")

    print("\n".join(cambios) if cambios else "Sin cambios: el HTML ya esta al dia.")
    if not check and cambios:
        HTML.write_bytes(html.encode("utf-8"))


if __name__ == "__main__":
    main()
