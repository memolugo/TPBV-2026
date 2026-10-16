# Tablero TPBV 2026 — Territorios de Paz y Buen Vivir

Contexto para trabajar en este repositorio sin leer todo el código. Tablero
sociodemográfico y territorial del programa TPBV de la Agencia de
Transformación Digital (ATDEM) del Gobierno del Estado de Morelos.

- **Producción:** https://tpbv.morelos.gob.mx (proxy hacia GitHub Pages)
- **GitHub Pages:** https://memolugo.github.io/TPBV-2026/dashboard/TPBV_2026_COMPLETO_PRO.html
- **Repositorio:** `memolugo/TPBV-2026` (PÚBLICO), rama `main`
- **Idioma:** todo en español (interfaz, comentarios, commits).

---

## 1. Cómo está armado

### El archivo que se publica

`dashboard/TPBV_2026_COMPLETO_PRO.html` es **autocontenido**: el shell (HTML,
CSS, configuración de Tailwind) más cada `.js` de `dashboard/` incrustado en un
bloque:

```html
<script>
/* EMBEBIDO: archivo.js */
...contenido...
</script>
```

**Nunca editar el código dentro de esos bloques.** Se edita el `.js` fuente y
luego se corre:

```bash
python scripts/embed_dashboard.py           # actualiza el HTML
python scripts/embed_dashboard.py --check   # solo informa
```

`embed_dashboard.py` también:
- Inserta bloques nuevos según `NUEVOS_BLOQUES` (archivo → bloque tras el que va).
- Respeta `DEBE_IR_ANTES_DE` (orden de carga obligatorio).
- **Retira** los bloques de `BLOQUES_RETIRADOS` (ver §4).
- Incrusta como `data:` URI las tipografías (`@font-face`) y los logos `<img src="assets/logo-*.svg">` del shell, anotando la ruta original (`/*recurso:...*/`, `data-recurso="..."`) para volver a incrustarlos si cambian.

El shell (menú, contenedores de vistas, CSS) sí se edita a mano en el HTML.
El HTML usa saltos de línea **CRLF**.

`dashboard/index.html` es una versión vieja y **no se usa**.

### Por qué todo va incrustado

`tpbv.morelos.gob.mx` sirve el HTML a través de un proxy (openresty) que
responde **400** a archivos nuevos de `dashboard/assets/` (GitHub Pages sí los
sirve). Cualquier recurso nuevo (imagen, fuente, datos) debe ir **dentro del
HTML**, no como archivo suelto. El proxy cachea hasta 10 min (`max-age=600`):
tras publicar, el usuario debe recargar con Ctrl+F5.

### Orden de carga de bloques (actual)

```
data.js · poligonos.js · limites_municipales.js · poligonos_actual_nombres.js
aulas_tecnologicas.js · red_ltqnu.js · telecom.js        (datos)
traducciones_na.js                                       (diccionario náhuatl)
mapa_morelos.js · inicio_contexto.js · carrusel.js · inicio_buscador.js · inicio_encuentro.js (antes de app.js)
app.js
aulas_mapa.js · aulas_contexto.js · aulas_view.js
datos_abiertos.js · red_view.js · telecom_view.js
i18n.js                                                  (al final: traduce lo que ya está en el DOM)
```

Leaflet 1.9.4 y Tailwind (CDN) se cargan aparte. Las tipografías y logos van incrustados.

### Datos: de fuente → `.js`

Cada `scripts/build_*.py` lee una fuente (Excel/CSV/GeoJSON/KML) y escribe un
`dashboard/*.js` con una constante global. Luego `embed_dashboard.py`.

| Constante | `.js` | Script | Fuente |
|---|---|---|---|
| `TPBV_DATA` (132 localidades, Propuesta Actual) | `data.js` | `build_dashboard_data.py` | `ITER_2020.xlsx`, `BD JULIO TPBV.xlsx`, `Lista Comunidades TPBV 2026 - Revisada.csv` |
| `TPBV_POLIGONOS` (26 polígonos) | `poligonos.js` | — | `TPBV 2026.geojson` |
| `TPBV_POLIGONOS_ACTUAL_NOMBRES` | `poligonos_actual_nombres.js` | `build_poligonos_actual_nombres.py` | lista revisada |
| `TPBV_LIMITES_MUNICIPALES` (36 municipios) | `limites_municipales.js` | `build_limites_municipales.py` | límites INE |
| `TPBV_AULAS_TECNOLOGICAS`, `TPBV_AULAS_MOBILIARIO` (45 escuelas) | `aulas_tecnologicas.js` | `build_aulas_tecnologicas.py` | `Proyecto Escuelas entrega Computadoras.xlsx` (hoja Concentrado) |
| `TPBV_RED_LTQNU` (25 registros, 24 dependencias) | `red_ltqnu.js` | `build_red_ltqnu.py` | `Agentes_dependencias La Tierra Que Nos Une.xlsx` (no está en el repo) |
| `TPBV_TELECOM` (agregado) | `telecom.js` | `build_telecom.py` | `Sitios REEM.kml` (no está en el repo, ver §5) |
| `TPBV_TRADUCCIONES_NA` (español → náhuatl) | `traducciones_na.js` | `build_traducciones_na.py` | `traducciones/Traduccion_nahuatl_tablero.xlsx` (§2 bis) |
| *(retirados de producción)* `TPBV_DATA_PROPUESTA_2026`, `TPBV_PROPUESTA_NUEVA`, `TPBV_PROPUESTA_2026`, `TPBV_BANCO_PROYECTOS` | `data_propuesta_2026.js`, `propuesta_nueva.js`, `propuesta_2026.js`, `banco_proyectos.js` | varios | ver §4 |

Los scripts usan `openpyxl` (instalado en el Python de usuario; correr con
`python`, **no** con `python -I`, que no ve los paquetes de usuario).

---

## 2. Secciones (vistas)

Router simple en `app.js`: `showView(nombre)` muestra/oculta contenedores según
`VIEWS` / `VIEW_CONTAINERS` y marca la píldora activa. Cada vista nueva requiere:
contenedor `<div id="X-view">` en el shell, `<li>` en `#sidebar-nav`, entrada en
`VIEWS` y `VIEW_CONTAINERS`, llamada en `showView` y bloque en `NUEVOS_BLOQUES`.

| Vista | `showView` | Código | Notas |
|---|---|---|---|
| Inicio (landing) | `inicio` | `renderInicioView` (app.js) + `inicio_contexto.js` + `inicio_buscador.js` + `inicio_encuentro.js` | Presentación (boletín 01831) con fecha de corte de los datos, buscador ciudadano «¿Tu comunidad está en el programa?», cita de la Gobernadora, Segundo Encuentro Estatal (nota del 10/10/2026) con carrusel de 7 fotos, cómo funciona, cifras, hitos, gráfica de marginación agrupada, tarjetas de secciones, cómo empezar. Vista inicial. |
| Análisis Demográfico | `analisis` | app.js (`render`, `renderMap`, `renderAggregate*`) | Arranca en "Todos los Polígonos". Mapa solo Morelos con los 26 polígonos siempre encendidos y las localidades. |
| Aulas Tecnológicas | `aulas` | `aulas_contexto.js`, `aulas_view.js`, `aulas_mapa.js` | 45 escuelas ATDEM. Contexto del boletín 06206; entrega en la Primaria Miguel Hidalgo de Temixco (nota del 12/04/2026) con carrusel de 4 fotos y botón al mapa (por CCT `AULAS_TEMIXCO_CCT`). |
| Red La tierra que nos une | `red` | `red_view.js` | Wi-Fi pública ATDEM en dependencias. Mapa encuadrado en Cuernavaca. |
| Telecomunicaciones | `telecom` | `telecom_view.js` | Sitios REEM **agregados** por municipio (coropleta). |
| Datos Abiertos | `datos` | `datos_abiertos.js` | CSV/KML generados en el navegador desde los datos incrustados. Cada conjunto declara `disponible()`. |
| Reportes | `printReport()` | app.js | Documento formal para imprimir/PDF. |
| *(retiradas)* Propuesta Territorial, Banco de Proyectos | `propuesta`, `banco` | app.js | Redirigen a Inicio cuando no hay datos (§4). |

### Traducción al náhuatl (`i18n.js`)

Motor de traducción en el navegador, sin tocar el código de las vistas: recorre el
DOM (y lo que se pinte después, con un `MutationObserver`) y reemplaza cada texto
que esté en `TPBV_TRADUCCIONES_NA`. Volver a español restaura los originales.

- **Claves** = texto en español normalizado; los números van como `{n}` y los
  datos variables (nombre de escuela, localidad, dependencia) como `{d}`
  (`"Ver {d} en el mapa"`). Las claves con `{d}` se aplican como patrón.
- **Unidad de traducción**: un elemento cuyo contenido es solo texto y formato en
  línea (`b`, `strong`, `em`, `i`, `br`, `small`, `sup`, `sub`) se traduce
  completo. `span` NO cuenta (suele separar etiqueta y valor).
- Excluidos: `script`, `style`, `svg`, íconos `.material-symbols-outlined`,
  mosaicos/atribución de Leaflet y cualquier `[data-no-traducir]`.
- También traduce `placeholder`, `aria-label`, `title`, `alt` y el título de la pestaña.
- Activación: `?lang=na` o `localStorage['tpbv-idioma']`; pone `<html lang="nah">`.
- **Botón «Náhuatl»** (ícono `translate`) al extremo derecho de la barra de
  utilidad, como en morelos.gob.mx; cambia a «Español» al activarse. Visible
  (`MOSTRAR_SELECTOR_NAHUATL = true`, pedido del usuario).
- **Estado de la traducción (2026-10-16):** 287 de 299 textos. 4 del glosario
  oficial (verde en la plantilla) y 283 **borrador generado con IA** (amarillo,
  Fuente = "Borrador automático, ajustado a Hueyapan (revisar)"), pendiente de
  revisión por un traductor de náhuatl de Morelos. El borrador se ajustó a la
  variante de Hueyapan (Tetela del Volcán) con el diccionario de Montero Baeza
  (CDI, 2016; `diccionario_nahuatl_hueyapan_comunicadores_indigenas_v2016.pdf`,
  no está en el repo): ortografía con u (no w), -listle, g intervocálica
  (tlaga, teguitl, iga, ogachi) y su vocabulario; ese vocabulario está en
  `GLOSARIO_HUEYAPAN` (`build_plantilla_nahuatl.py`, hoja «Glosario»). Los 12 sin traducir son nombres propios
  (programa, ATDEM, secretarías) y préstamos (refrigerador, lavadora, automóvil).
  Términos del borrador: altepetl/altepemej = municipio(s), altepetsin/altepetsitsin
  = localidad(es), tlatlaga = población/habitantes, maseualmej = indígenas,
  kaltlamachtiloyan = escuela, tlamachtiloyan = aula, tepostlapoualli =
  computadora (neologismo), tlalamatl = mapa (neologismo), matlatl = red,
  Kaltlayekana = Gobierno, iknoyotl = marginación/pobreza, xikuiga = descargar.
- En náhuatl el menú usa píldoras a dos líneas (CSS `html[lang=nah] .nav-pill`)
  y oculta el nombre TPBV del encabezado hasta 1600 px.

Flujo con el traductor:

```bash
# 1. Extraer textos (servidor local en 8080 + playwright-core)
NODE_PATH=<pw>/node_modules node scripts/extraer_textos_nahuatl.js   # -> traducciones/textos_extraidos.json
# 2. Plantilla Excel para el traductor (conserva traducciones ya capturadas)
python scripts/build_plantilla_nahuatl.py                           # -> traducciones/Traduccion_nahuatl_tablero.xlsx
# 3. Con la plantilla traducida: diccionario (valida {n}/{d})
python scripts/build_traducciones_na.py                             # -> dashboard/traducciones_na.js
python scripts/embed_dashboard.py
```

Si cambian textos del tablero, repetir 1 y 2: las filas nuevas salen vacías y las
traducidas se conservan. Los nombres propios, siglas y listas de campos se
excluyen en `NO_TRADUCIR` (`build_plantilla_nahuatl.py`); los términos que son
dato y prosa a la vez van en `NO_ES_DATO` (`extraer_textos_nahuatl.js`). El
glosario oficial (Inicio→Pehua, Gobierno→Kaltlayekana, Prensa→Tlatolnonotza…)
sale de `Traducción transformación digital.docx`.

### Mapas

`mapa_morelos.js` es la base compartida "solo Morelos": sin mosaicos de
calles/satélite, silueta del estado (contorno verde oscuro grueso), municipios
blancos con división oro, fondo piedra, encuadre y paneo limitados al estado.

- `crearMapaMorelos(id)` → mapa Leaflet con estilos ATD.
- `agregarBaseMorelos(mapa, { estilo, onEachFeature })` → `{ contorno, municipios }`.
- Estilos compartidos: `.atd-popup`, `.atd-tooltip`, `.atd-leyenda`.
- `mismoMunicipio(nombreGeo, nombreCorto)` empareja nombres sin acentos y por prefijo.

Todas las vistas con mapa la usan. Gotchas:
- Un mapa creado con el contenedor oculto mide 0×0. En Análisis, `renderMap` pone una vista provisional y deja `map._encuadrePendiente`, que `showView('analisis')` aplica. En las demás, `invalidateSize` + `fitBounds` en un `setTimeout` al mostrarse.
- `Polygon.getCenter()` de Leaflet falla si el mapa aún no tiene vista: calcular el centroide desde la geometría (ver `telecomCentroide`).
- El contenedor `#map` de Análisis se recrea en cada render (la base de Morelos va con cada mapa).

---

## 3. Diseño

Réplica del sistema de **digital.morelos.gob.mx** (mismo Figma) + paleta del
Manual de Marca Morelos 2024-2030 / skill `skillatd`.

- **Tipografías:** igual que morelos.gob.mx (tokens morv3, medidos el 2026-10-16 en una nota de Prensa): **Twogether Sans en títulos y texto**, con pesos ligeros (h1 400 48/57.6 px, títulos de sección 400, texto destacado 300 20/28 px, menú 400); **Karol Sans SemiBold solo para cifras** (`kpi-value`) y el nombre del encabezado. Copiadas del portal a `dashboard/assets/fonts/` e incrustadas en el HTML. Son del Gobierno; confirmar con Comunicación Social antes de otros usos.
- **Colores** (tokens Tailwind redefinidos en el shell): verde bosque `#2E3B2B` (texto/títulos), verde Morelos `#71785B`, oro `#BC9B73`, vino `#773357` (acción/CTA), piedra `#CBCABE`, superficies `#F5F4F2` / `#EBEADE` / `#E4E3D6`.
- **Componentes:** encabezado blanco con barra de utilidad piedra, menú de píldoras (activa en `#DFE6C3`; drawer debajo de 1280 px, `NAV_BREAKPOINT`), tarjetas con borde fino y radio 24 px sin sombra, botones píldora vino, campos píldora, íconos en círculo rosa (`bg-primary-fixed`).
- **Footer:** igual al de morelos.gob.mx (logo blanco `assets/logo-morelos-footer.svg` incrustado, atención ciudadana, Recursos / Actividad del gobierno / Enlaces de interés / redes) + línea con atribución del tablero y fuente INEGI.
- **Compartir y buscadores:** `<head>` con título «Territorios de Paz y Buen Vivir · Gobierno de Morelos», descripción, canonical, Open Graph y Twitter Card. La imagen de vista previa (1200×630) y el ícono de iPhone se generan con `scripts/build_imagen_compartir.js` en `dashboard/assets/compartir/` y se referencian con **URL absoluta de GitHub Pages** (el proxy no sirve archivos nuevos de `assets/`); el favicon va incrustado como `data:` URI. Si cambian las cifras (132/26/22/45), regenerar la imagen y actualizar el texto de la descripción y `og:image:alt`.
- **Carruseles de fotos:** módulo `carrusel.js` (`carruselHtml({id, etiqueta, carpeta, fotos})` + `iniciarCarrusel(id)`), estilos `.carrusel*` en el shell. Fotos de notas oficiales de Prensa (crédito «Fotos: Gobierno del Estado de Morelos») en `dashboard/assets/<carpeta>/`: `encuentro/` (Inicio, `ENCUENTRO_FOTOS`) y `aulas-temixco/` (Aulas, `AULAS_TEMIXCO_FOTOS`). Se cargan con URL absoluta de GitHub Pages salvo en local (`carruselBase`). Para agregar uno: copiar fotos a una carpeta nueva, llamar `carruselHtml` en la vista e `iniciarCarrusel` después de pintarla, y volver a extraer textos para la traducción.
- **Encabezado a 7 píldoras:** el nombre "Territorios de Paz" junto a los logos solo aparece desde 1600 px; entre 1280 y 1439 px se oculta el logo TPBV y se compactan las píldoras. Al agregar otra píldora, medir que no se encime.

---

## 4. Reglas de producción

### Contenido retirado (no oficial)

| Qué | Desde | Cómo |
|---|---|---|
| Nueva Propuesta Territorial | 2026-10-16 | `BLOQUES_RETIRADOS` quita `propuesta_nueva.js`, `propuesta_2026.js`, `data_propuesta_2026.js`; `HAY_NUEVA_PROPUESTA` (app.js) oculta interruptor de Análisis, vista Propuesta Territorial, bloques de Inicio y conjuntos de Datos Abiertos. |
| Banco de Proyectos | 2026-10-16 | Igual con `banco_proyectos.js` y `HAY_BANCO_PROYECTOS`. |

Los datos se retiran **del HTML**, no solo de la interfaz. Para volver a
publicar: quitar el archivo de `BLOQUES_RETIRADOS` y agregarlo a
`NUEVOS_BLOQUES`; el código detecta los datos y muestra todo.

**Respaldo** del tablero completo (con Nueva Propuesta y Banco): tag git
`respaldo-2026-10-16-con-nueva-propuesta` (commit `941b87b`) y copia local en
`respaldos/` (ignorada por git).

### Seguridad y datos personales (repo PÚBLICO)

- **Telecomunicaciones:** `build_telecom.py` agrega los sitios por municipio/sector **antes** de escribir el `.js`. Nunca exportar coordenadas ni nombres de sitio (los nombres revelan el lugar). `Sitios REEM.kml` está en `.gitignore`.
- **No publicar** nombres de agentes, titulares, promotores ni coordinadores, ni notas técnicas internas (firewall, VPN, pendientes). `Agentes_dependencias…xlsx` no está en el repo.
- `Proyecto Escuelas entrega Computadoras.xlsx` sí está en el repo (autorizado por el usuario como información pública).
- **Pendiente sin resolver:** los archivos originales de la Nueva Propuesta y del Banco de Proyectos siguen descargables desde github.io/historial (repo público). Opciones: hacer privado el repo o borrarlos.

### Publicar

```bash
python scripts/embed_dashboard.py
git add <archivos> && git commit
# La cuenta activa de gh (guillermolugomor-a11y) NO tiene permiso: push con memolugo
export GHTOK=$(gh auth token --user memolugo)
git -c credential.helper= -c 'credential.helper=!f() { echo username=memolugo; echo "password=$GHTOK"; }; f' push origin main
```

Esperar el build de Pages (`gh api repos/memolugo/TPBV-2026/pages/builds/latest`)
y verificar en tpbv.morelos.gob.mx. Subir solo cuando el usuario lo pida.

### Probar

No hay suite de pruebas en el repo. Se prueba con Chrome headless
(`playwright-core`, canal `chrome`) contra un servidor local:

```bash
python -m http.server 8080 --bind 127.0.0.1 --directory dashboard
```

Comprobaciones habituales: cada vista abre sin errores de consola; los mapas
llenan su contenedor (`map.getSize()` vs. contenedor); el menú no se encima
de 1920 a 390 px y no hay scroll horizontal; producción no contiene datos ni
textos de lo retirado; las descargas de Datos Abiertos son válidas; el HTML
funciona servido **sin** la carpeta `assets/` (simula el proxy).

---

## 5. Decisiones de datos que hay que conocer

- **Fecha de corte:** `TPBV_FECHA_DATOS` en `inicio_contexto.js` (héroe de Inicio y pie de página). **Actualizarla** cada vez que se regeneren datos. Al cambiar de mes, la clave de traducción «Datos actualizados al {n} de octubre de {n}» cambia: volver a extraer textos y traducir la nueva.

- **Localidades (132):** 9 no estaban en `ITER_2020.xlsx`; sus coordenadas salen del CSV completo del censo (`iter_17_cpv2020/`) → `MANUAL_COORDS` en `build_dashboard_data.py`. Iztaccíhuatl es aproximada (OSM); "Tres de mayo" queda 0.4 km fuera del polígono 19.
- **Grado de marginación:** 9 de las 10 localidades sin `GM_2020` en la lista se completaron con CONAPO 2020 (índice por colonia IMC, o por localidad IML para Loma Bonita) → `MARGINACION_COMPLEMENTO` + campo `fuenteMarginacion`; `imMarginacion` se deja vacío para no mezclar escalas. Colonia Las Rosas (Temixco, 6 hab.) sigue sin grado. Copia usada: github.com/IndiceMx/IM_2020 (los enlaces oficiales de CONAPO dan 404), validada contra la lista (92 coincidencias).
- **Gráfica de Inicio:** Medio + Bajo + Muy bajo = "Comunidades prioritarias" (pedido del usuario); suma las 132 con barra "Sin grado de marginación".
- **Aulas (45):** coordenadas resueltas de los links de Google Maps y cacheadas en `scripts/aulas_tecnologicas_coords.json`; `COORDENADAS_CORREGIDAS` por CCT (Mártir de Chinameca). El boletín decía 42; la hoja tiene 45 (3 "Conflicto de turno"). La fase no se muestra (pedido del usuario). KPI "Escuelas dentro de un polígono" = 33 (no son polígonos).
- **Red LTQNU:** solo `Red_la_tierra_que_nos_une = SI`, más el Instituto de Servicios Registrales (columna vacía, confirmado por el usuario). Coordenadas del Excel vienen sin punto decimal (se reinserta tras 2 dígitos). Ubicadas por dirección en OSM: Servicios de Salud, Instituto de Crédito, Movilidad, ISRyC. Pendientes de revisar en el Excel: coordenada de ICATMOR, PROPAEM duplicada (SI/NO), "Secretaría de Administración" vs "… y Finanzas".
- **Telecom:** 47 sitios, 13 municipios, 4 sectores (carpetas del KML). Pendiente de decidir si el sector Seguridad se desglosa por municipio.

---

## 6. Historial de cambios

| Fecha | Commit | Cambio |
|---|---|---|
| 2026-08-12 → 08-17 | `ebb5d0a` … `05b1179` | Tablero original: Análisis Demográfico, Propuesta Territorial, Banco de Proyectos, reportes. |
| 2026-10-12 | `afa3755` | Coordenadas de las 9 localidades sin ubicación (CSV completo del censo). |
| 2026-10-15 | `a08658b` | Sección Aulas Tecnológicas; todo el tablero al estilo digital.morelos (menú superior de píldoras, Karol/Twogether, tokens del portal); base `mapa_morelos.js`; Propuesta Territorial solo Morelos; `embed_dashboard.py`. |
| 2026-10-15 | `2024f95` | Tipografías y logos incrustados en el HTML (el proxy de tpbv.morelos.gob.mx bloqueaba `assets/` nuevos). |
| 2026-10-15 | `941b87b` | Sección Datos Abiertos (CSV/KML en el navegador). **Tag de respaldo** sobre este commit. |
| 2026-10-16 | `f613831` | Nueva Propuesta Territorial retirada de producción (`BLOQUES_RETIRADOS`, `HAY_NUEVA_PROPUESTA`). |
| 2026-10-16 | `e993620` | Inicio como landing (`inicio_contexto.js`); mapa de Análisis solo Morelos con todo el estado al inicio; Banco de Proyectos retirado (`HAY_BANCO_PROYECTOS`); `DEBE_IR_ANTES_DE`. |
| 2026-10-16 | `fe42f06` | Footer de morelos.gob.mx; marginación agrupada en Inicio; etiqueta de KPI de Aulas. |
| 2026-10-16 | `b95b9a0` | Sección Red La tierra que nos une; grados de marginación faltantes (CONAPO). |
| 2026-10-16 | `b286188` | Sección Infraestructura de Telecomunicaciones (agregada por municipio); `Sitios REEM.kml` en `.gitignore`. |
| 2026-10-16 | `b286188` | Infraestructura de traducción al náhuatl (`i18n.js`, botón «Náhuatl» en la barra superior) y plantilla para el traductor (299 textos); borrador de traducción con IA pendiente de revisión. |
| 2026-10-16 | `ba89b0e` | Vista previa para redes (Open Graph/Twitter), favicon, ícono de iPhone, título y descripción para buscadores. |
| 2026-10-16 | `ba89b0e` | Tipografía alineada a morelos.gob.mx (Twogether ligera; Karol solo en cifras); fecha de corte de datos; buscador «¿Tu comunidad está en el programa?». |
| 2026-10-16 | `836bbae` | Sección Segundo Encuentro Estatal con carrusel de fotos; cita con barra dorada (el ícono de comillas se leía como «99»). |
| 2026-10-16 | `0d01cd2` | Carrusel reutilizable (`carrusel.js`); sección de entrega en Temixco con fotos en Aulas Tecnológicas; cita de Aulas con barra dorada. |

Mantener esta tabla al día al publicar cambios.
