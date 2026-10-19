// ---------------------------------------------------------------------------
// Vista "Datos Abiertos": catálogo de los conjuntos de datos del tablero con
// descarga en CSV y KML. Los archivos se GENERAN EN EL NAVEGADOR a partir de
// los datos ya embebidos (TPBV_DATA, TPBV_POLIGONOS, ...): no hay archivos
// sueltos que publicar (tpbv.morelos.gob.mx responde 400 a archivos nuevos
// de assets/, ver scripts/embed_dashboard.py) y lo descargado siempre
// coincide con lo que muestra el tablero.
//   - CSV: UTF-8 con BOM (Excel respeta acentos), separador coma, una fila por
//     registro; la piramide poblacional se aplana en columnas.
//   - KML: puntos/polígonos con todos los atributos en ExtendedData (Google
//     Earth y My Maps los muestran como columnas), una sola capa, colores ATD.
// Se carga después de mapa_morelos.js (usa ATD) y app.js (esc, fmtInt, card,
// iconChip...). showView('datos') en app.js llama a renderDatosAbiertosView().
// ---------------------------------------------------------------------------

const DA_PREFIJO = 'tpbv2026_';

function daValor(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'si' : 'no';
    return String(v);
}

// Aplana un registro: escalares tal cual; la piramide ([{label,f,m}]) en
// columnas piramide_<rango>_mujeres / _hombres; otros objetos se omiten.
function daAplanar(r) {
    const out = {};
    Object.entries(r).forEach(([k, v]) => {
        if (Array.isArray(v) && v.every((x) => x && 'label' in x && 'f' in x && 'm' in x)) {
            v.forEach((x) => {
                out[`${k}_${x.label}_mujeres`] = x.f;
                out[`${k}_${x.label}_hombres`] = x.m;
            });
        } else if (v === null || typeof v !== 'object') {
            out[k] = v;
        }
    });
    return out;
}

function daColumnas(filas) {
    const cols = [];
    filas.forEach((f) => Object.keys(f).forEach((k) => { if (!cols.includes(k)) cols.push(k); }));
    return cols;
}

function daCsv(filas) {
    const cols = daColumnas(filas);
    const celda = (v) => {
        const s = daValor(v);
        return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lineas = [cols.join(','), ...filas.map((f) => cols.map((c) => celda(f[c])).join(','))];
    return '﻿' + lineas.join('\r\n') + '\r\n';
}

const daXml = (s) => daValor(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// KML usa aabbggrr; los colores ATD vienen como #rrggbb.
function daKmlColor(hex, alpha = 'ff') {
    const h = hex.replace('#', '');
    return alpha + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2);
}

function daExtendedData(props) {
    return '<ExtendedData>' + Object.entries(props)
        .map(([k, v]) => `<Data name="${daXml(k)}"><value>${daXml(v)}</value></Data>`).join('') + '</ExtendedData>';
}

function daAnillo(coords) {
    return coords.map(([x, y]) => `${x.toFixed(6)},${y.toFixed(6)},0`).join(' ');
}

function daPoligonoKml(poly) {
    const [exterior, ...huecos] = poly;
    return '<Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing><coordinates>' + daAnillo(exterior) +
        '</coordinates></LinearRing></outerBoundaryIs>' +
        huecos.map((h) => `<innerBoundaryIs><LinearRing><coordinates>${daAnillo(h)}</coordinates></LinearRing></innerBoundaryIs>`).join('') +
        '</Polygon>';
}

function daGeometriaKml(geom) {
    if (geom.type === 'Polygon') return daPoligonoKml(geom.coordinates);
    if (geom.type === 'MultiPolygon') {
        return geom.coordinates.length === 1 ? daPoligonoKml(geom.coordinates[0])
            : '<MultiGeometry>' + geom.coordinates.map(daPoligonoKml).join('') + '</MultiGeometry>';
    }
    return '';
}

function daKmlDocumento(nombre, descripcion, estilo, placemarks) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document>' +
        `<name>${daXml(nombre)}</name><description>${daXml(descripcion)}</description>` +
        estilo + placemarks.join('\n') + '</Document></kml>\n';
}

// Puntos: icono en blanco de My Maps teñido (Google Earth y My Maps respetan
// el color con este icono).
function daKmlPuntos(nombre, descripcion, registros, { titulo, color = ATD.vino }) {
    const estilo = `<Style id="p"><IconStyle><color>${daKmlColor(color)}</color><scale>1</scale>` +
        '<Icon><href>https://www.gstatic.com/mapspro/images/stock/503-wht-blank_maps.png</href></Icon></IconStyle>' +
        '<LabelStyle><scale>0.75</scale></LabelStyle></Style>';
    const pm = registros.map(({ props, lat, lon }) =>
        `<Placemark><name>${daXml(titulo(props))}</name><styleUrl>#p</styleUrl>${daExtendedData(props)}` +
        `<Point><coordinates>${lon},${lat},0</coordinates></Point></Placemark>`);
    return daKmlDocumento(nombre, descripcion, estilo, pm);
}

function daKmlPoligonos(nombre, descripcion, features, { titulo, props = (f) => f.properties, color = ATD.verde, dashed = false }) {
    const estilo = `<Style id="g"><LineStyle><color>${daKmlColor(dashed ? ATD.terracota : color)}</color><width>2</width></LineStyle>` +
        `<PolyStyle><color>${daKmlColor(dashed ? ATD.terracota : color, '55')}</color></PolyStyle></Style>`;
    const pm = features.map((f) => {
        const p = props(f);
        return `<Placemark><name>${daXml(titulo(p))}</name><styleUrl>#g</styleUrl>${daExtendedData(p)}${daGeometriaKml(f.geometry)}</Placemark>`;
    });
    return daKmlDocumento(nombre, descripcion, estilo, pm);
}

// ---------------------------------------------------------------------------
// Catálogo. Cada conjunto declara cómo producir sus filas (CSV) y, si tiene
// geometría, su KML. Se evalúa al descargar (perezoso).
// ---------------------------------------------------------------------------
function daPropsPoligonoActual(f) {
    const pol = f.properties.Pol;
    const locs = TPBV_DATA.filter((r) => String(r.poligono) === String(pol));
    return {
        poligono: pol,
        nombre: (typeof TPBV_POLIGONOS_ACTUAL_NOMBRES !== 'undefined' && TPBV_POLIGONOS_ACTUAL_NOMBRES[pol]) || f.properties.Nom_pol,
        region: f.properties.Region,
        num_localidades: locs.length,
        poblacion_total: locs.reduce((s, r) => s + (r.pobTotal ?? r.pobTotLista ?? 0), 0),
        localidades: locs.map((r) => r.localidad).join('; ')
    };
}

// Nueva Propuesta: 3 localidades no traen coordenada en la hoja; se toma la
// de la capa del mapa (TPBV_PROPUESTA_2026) para que el KML tenga las mismas
// 68 que el mapa de Propuesta Territorial.
function daLocalidadesNueva() {
    return TPBV_DATA_PROPUESTA_2026.map((r) => {
        const punto = (typeof TPBV_PROPUESTA_2026 !== 'undefined')
            ? TPBV_PROPUESTA_2026.find((p) => p.localidad === r.localidad && p.municipio === r.municipio) : null;
        const lat = r.latitud ?? (punto ? punto.lat : null);
        const lon = r.longitud ?? (punto ? punto.lon : null);
        return { ...daAplanar(r), latitud: lat, longitud: lon };
    });
}

const DA_CONJUNTOS = [
    {
        id: 'localidades', icono: 'location_on', titulo: 'Localidades TPBV 2026',
        descripcion: 'Las localidades de los 26 polígonos vigentes con sus indicadores de población, vivienda, salud, educación, economía y marginación.',
        fuente: 'INEGI, Censo 2020 (ITER Morelos) y Lista de Comunidades TPBV 2026', disponible: () => typeof TPBV_DATA !== 'undefined',
        filas: () => TPBV_DATA.map(daAplanar),
        kml: () => daKmlPuntos('Localidades TPBV 2026', 'Fuente: INEGI ITER 2020 / Lista Comunidades TPBV 2026',
            TPBV_DATA.filter((r) => r.latitud != null).map((r) => ({ props: daAplanar(r), lat: r.latitud, lon: r.longitud })),
            { titulo: (p) => p.localidad })
    },
    {
        id: 'poligonos', icono: 'map', titulo: 'Polígonos TPBV 2026',
        descripcion: 'Contorno de los 26 polígonos vigentes de Territorios de Paz y Buen Vivir, con número de localidades y población.',
        fuente: 'TPBV 2026.geojson', disponible: () => typeof TPBV_POLIGONOS !== 'undefined',
        filas: () => TPBV_POLIGONOS.features.map(daPropsPoligonoActual),
        kml: () => daKmlPoligonos('Polígonos TPBV 2026', 'Fuente: TPBV 2026.geojson',
            [...TPBV_POLIGONOS.features].sort((a, b) => a.properties.Pol - b.properties.Pol),
            { titulo: (p) => `${String(p.poligono).padStart(2, '0')} - ${p.nombre}`, props: daPropsPoligonoActual })
    },
    {
        id: 'localidades_nueva_propuesta', icono: 'add_location_alt', titulo: 'Localidades · Nueva Propuesta',
        descripcion: 'Las localidades que se incorporarían con la Nueva Propuesta Territorial, con los mismos indicadores sociodemográficos.',
        fuente: 'Hoja de trabajo TPBV 2026 (hoja PROPUESTA 2026) e INEGI ITER 2020', disponible: () => typeof TPBV_DATA_PROPUESTA_2026 !== 'undefined',
        filas: daLocalidadesNueva,
        kml: () => daKmlPuntos('TPBV 2026 · Localidades Nueva Propuesta', 'Fuente: Hoja de trabajo TPBV 2026 / INEGI ITER 2020',
            daLocalidadesNueva().filter((r) => r.latitud != null).map((r) => ({ props: r, lat: r.latitud, lon: r.longitud })),
            { titulo: (p) => p.localidad, color: ATD.terracota })
    },
    {
        id: 'poligonos_nueva_propuesta', icono: 'layers', titulo: 'Polígonos · Nueva Propuesta',
        descripcion: 'Contorno de los 20 polígonos de la Nueva Propuesta Territorial, con superficie, municipio y región.',
        fuente: 'TPBV_nueva_propuesta ok.geojson', disponible: () => typeof TPBV_PROPUESTA_NUEVA !== 'undefined',
        filas: () => TPBV_PROPUESTA_NUEVA.features.map((f) => ({ ...f.properties })),
        kml: () => daKmlPoligonos('TPBV 2026 · Polígonos Nueva Propuesta', 'Fuente: TPBV_nueva_propuesta ok.geojson',
            TPBV_PROPUESTA_NUEVA.features, { titulo: (p) => `${p.POLIGONO} - ${p.NOMBRE}`, dashed: true })
    },
    {
        id: 'aulas_tecnologicas', icono: 'computer', titulo: 'Aulas Tecnológicas',
        descripcion: 'Escuelas donde ATDEM instaló aulas de cómputo: CCT, nivel, computadoras, fecha de instalación y polígono TPBV.',
        fuente: 'ATDEM, Proyecto Escuelas entrega Computadoras', disponible: () => typeof TPBV_AULAS_TECNOLOGICAS !== 'undefined',
        filas: () => TPBV_AULAS_TECNOLOGICAS.map(daAplanar),
        kml: () => daKmlPuntos('TPBV 2026 · Aulas Tecnológicas', 'Fuente: ATDEM, Proyecto Escuelas entrega Computadoras',
            TPBV_AULAS_TECNOLOGICAS.filter((a) => a.lat != null).map((a) => ({ props: daAplanar(a), lat: a.lat, lon: a.lon })),
            { titulo: (p) => p.escuela })
    },
    {
        id: 'red_la_tierra_que_nos_une', icono: 'wifi', titulo: 'Red La tierra que nos une',
        descripcion: 'Dependencias estatales con la red Wi-Fi pública de la ATDEM: secretaría, sede, coordenadas y puntos de acceso.',
        fuente: 'ATDEM, Agentes_dependencias La Tierra Que Nos Une', disponible: () => typeof TPBV_RED_LTQNU !== 'undefined',
        filas: () => TPBV_RED_LTQNU.map(daAplanar),
        kml: () => daKmlPuntos('Red La tierra que nos une', 'Fuente: ATDEM',
            TPBV_RED_LTQNU.filter((r) => r.lat != null).map((r) => ({ props: daAplanar(r), lat: r.lat, lon: r.lon })),
            { titulo: (p) => p.dependencia })
    },
    {
        id: 'red_la_tierra_que_nos_une_comunidades', icono: 'location_on', titulo: 'Red La tierra que nos une · Comunidades',
        descripcion: 'Comunidades con WiFi gratuito de la ATDEM instalado o en proceso: localidad, municipio, coordenadas, estatus y polígono TPBV.',
        fuente: 'ATDEM, registro de instalaciones en comunidades', disponible: () => typeof TPBV_RED_COMUNIDADES !== 'undefined',
        filas: () => TPBV_RED_COMUNIDADES.map(daAplanar),
        kml: () => daKmlPuntos('Red La tierra que nos une · Comunidades', 'Fuente: ATDEM',
            TPBV_RED_COMUNIDADES.map((r) => ({ props: daAplanar(r), lat: r.lat, lon: r.lon })),
            { titulo: (p) => `${p.localidad} (${p.estatus})` })
    },
    {
        id: 'banco_proyectos', icono: 'inventory_2', titulo: 'Banco de Proyectos',
        descripcion: 'Proyectos y obras del Banco de Proyectos PP TPBV por municipio y localidad, con categoría, tipo de obra, estatus y año.',
        fuente: 'BANCO DE PROYECTOS PP TPBV (08/07/2026)', disponible: () => typeof TPBV_BANCO_PROYECTOS !== 'undefined',
        sinKml: 'Los proyectos no tienen coordenadas; se identifican por clave de localidad INEGI.',
        filas: () => TPBV_BANCO_PROYECTOS.map(daAplanar)
    },
    {
        id: 'limites_municipales', icono: 'border_outer', titulo: 'Límites municipales de Morelos',
        descripcion: 'Contorno de los 36 municipios del estado, con clave geoestadística (CVEGEO) y nombre.',
        fuente: 'INE, límites municipales', disponible: () => typeof TPBV_LIMITES_MUNICIPALES !== 'undefined',
        filas: () => TPBV_LIMITES_MUNICIPALES.features.map((f) => ({ ...f.properties })),
        kml: () => daKmlPoligonos('Límites municipales de Morelos', 'Fuente: INE', TPBV_LIMITES_MUNICIPALES.features,
            { titulo: (p) => p.NOMGEO, color: ATD.oro })
    },
];

function daDescargar(nombreArchivo, contenido, mime) {
    const url = URL.createObjectURL(new Blob([contenido], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function daDescargarConjunto(id, formato) {
    const c = DA_CONJUNTOS.find((x) => x.id === id);
    if (!c) return;
    try {
        if (formato === 'csv') daDescargar(`${DA_PREFIJO}${c.id}.csv`, daCsv(c.filas()), 'text/csv;charset=utf-8');
        else if (formato === 'kml' && c.kml) daDescargar(`${DA_PREFIJO}${c.id}.kml`, c.kml(), 'application/vnd.google-earth.kml+xml');
    } catch (error) {
        console.error('No se pudo generar la descarga', id, formato, error);
        alert('No se pudo generar el archivo. Recarga la página e inténtalo de nuevo.');
    }
}

function daTarjeta(c) {
    const filas = c.filas();
    const columnas = daColumnas(filas);
    // Botones con contorno (tipo Secondary del Morelos DS): el botón vino
    // relleno se reserva para la acción principal de la vista, que debe ser única.
    const btn = (formato, etiqueta) => `<button type="button" data-descarga="${c.id}" data-formato="${formato}"
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-label-bold text-label-bold transition-colors border border-outline text-on-surface hover:bg-surface-container-high"
        aria-label="Descargar ${esc(c.titulo)} en ${etiqueta}">
        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">download</span>${etiqueta}</button>`;
    return `<article class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow flex flex-col gap-3">
        <div class="flex items-start gap-3">
            <span class="w-12 h-12 shrink-0 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center">
                <span class="material-symbols-outlined text-[24px]" aria-hidden="true">${c.icono}</span>
            </span>
            <div class="min-w-0">
                <h3 class="font-headline-md text-headline-md text-on-surface">${esc(c.titulo)}</h3>
                <p class="font-label-bold text-label-bold text-secondary">${fmtInt(filas.length)} registros · ${columnas.length} campos</p>
            </div>
        </div>
        <p class="font-body-md text-body-md text-on-surface-variant flex-1">${esc(c.descripcion)}</p>
        <p class="font-body-md text-body-md text-on-surface-variant"><b class="text-on-surface">Fuente:</b> ${esc(c.fuente)}</p>
        <details class="font-body-md text-body-md text-on-surface-variant">
            <summary class="cursor-pointer font-label-bold text-label-bold text-on-surface">Ver campos</summary>
            <p class="mt-2 break-words">${columnas.map(esc).join(', ')}</p>
        </details>
        <div class="flex flex-wrap items-center gap-2 pt-1">
            ${btn('csv', 'CSV')}
            ${c.kml ? btn('kml', 'KML') : `<span class="font-body-md text-body-md text-on-surface-variant">${esc(c.sinKml || '')}</span>`}
        </div>
    </article>`;
}

let datosAbiertosViewBuilt = false;

function renderDatosAbiertosView() {
    if (datosAbiertosViewBuilt) return;
    const disponibles = DA_CONJUNTOS.filter((c) => c.disponible());
    $('#datos-view').innerHTML = `
    <div class="flex flex-col gap-4 max-w-5xl">
        <span class="font-label-bold text-label-bold uppercase tracking-wider text-secondary">Territorios de Paz y Buen Vivir · Transparencia</span>
        <h2 class="font-headline-xl text-headline-xl text-primary">Datos Abiertos</h2>
        <p class="font-body-lg text-body-lg text-on-surface-variant">
            Descarga las bases de datos que alimentan este tablero. Cada conjunto está disponible en
            <b class="text-on-surface">CSV</b>, para abrirlo en Excel o cualquier herramienta de análisis, y en
            <b class="text-on-surface">KML</b>, para verlo en Google Earth o Google My Maps.
        </p>
        <div class="flex flex-wrap gap-2">
            <span class="px-3 py-1.5 rounded-full bg-surface-container-high font-label-bold text-label-bold text-on-surface">${disponibles.length} conjuntos de datos</span>
            <span class="px-3 py-1.5 rounded-full bg-surface-container-high font-label-bold text-label-bold text-on-surface">CSV · UTF-8, separado por comas</span>
            <span class="px-3 py-1.5 rounded-full bg-surface-container-high font-label-bold text-label-bold text-on-surface">KML · una sola capa</span>
        </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter-grid">
        ${disponibles.map(daTarjeta).join('')}
    </div>
    <div class="rounded-xl p-card-padding bg-surface-container-low border border-outline-variant font-body-md text-body-md text-on-surface-variant flex gap-3">
        <span class="material-symbols-outlined text-secondary shrink-0" aria-hidden="true">info</span>
        <div>
            Los archivos se generan en tu navegador con la misma información que muestra el tablero.
            Para Google My Maps importa el KML en una capa nueva y usa <b class="text-on-surface">"Aplicar estilo por columna de datos"</b>
            para colorear por municipio, polígono u otro campo.
        </div>
    </div>`;
    datosAbiertosViewBuilt = true;
    animateEntrances($('#datos-view'));
}

$('#datos-view').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-descarga]');
    if (btn) daDescargarConjunto(btn.dataset.descarga, btn.dataset.formato);
});
