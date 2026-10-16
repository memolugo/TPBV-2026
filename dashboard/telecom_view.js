// ---------------------------------------------------------------------------
// Vista "Infraestructura de Telecomunicaciones": sitios (torres) de la red
// estatal, SOLO como referencia agregada por municipio y sector. Por
// seguridad no hay coordenadas ni nombres de sitio en el tablero: los datos
// (TPBV_TELECOM, telecom.js) ya llegan agregados desde
// scripts/build_telecom.py. El mapa colorea cada municipio según cuántos
// sitios tiene (coropleta) sobre la base "solo Morelos" (mapa_morelos.js).
// Se carga después de app.js; showView('telecom') llama a renderTelecomView().
// ---------------------------------------------------------------------------

const TELECOM = (typeof TPBV_TELECOM !== 'undefined') ? TPBV_TELECOM : { total: 0, porSector: {}, municipios: [] };

// Escala secuencial en verde Morelos (paleta ATD), de menos a más sitios.
const TELECOM_CLASES = [
    { min: 10, color: '#4A5039', etiqueta: '10 o más' },
    { min: 4, color: '#71785B', etiqueta: '4 a 9' },
    { min: 2, color: '#A7AD93', etiqueta: '2 a 3' },
    { min: 1, color: '#D3D6C6', etiqueta: '1' },
];
const TELECOM_SECTOR_ICONO = {
    'Gobierno del Estado': 'account_balance', 'Educación': 'school',
    'Salud': 'local_hospital', 'Seguridad y Protección Ciudadana': 'shield'
};

let telecomViewBuilt = false;
let telecomMap = null;

const telecomClase = (n) => TELECOM_CLASES.find((c) => n >= c.min) || null;
const telecomSitios = (n) => `${fmtInt(n)} ${n === 1 ? 'sitio' : 'sitios'}`;

function telecomDeMunicipio(nombreGeo) {
    return TELECOM.municipios.find((m) => mismoMunicipio(nombreGeo, m.municipio)) || null;
}

function telecomEstilo(feature) {
    const m = telecomDeMunicipio(feature.properties.NOMGEO);
    const clase = m ? telecomClase(m.total) : null;
    return clase ? { ...MUNICIPIO_BASE, fillColor: clase.color } : MUNICIPIO_BASE;
}

function telecomTooltip(nombre, m) {
    if (!m) return `${esc(nombre)} · sin sitios registrados`;
    const sectores = Object.entries(m.porSector).map(([s, n]) => `${esc(s)}: ${n}`).join('<br>');
    return `<b>${esc(nombre)}</b> · ${telecomSitios(m.total)}<br><span style="font-weight:400">${sectores}</span>`;
}

// Centroide (por area) del anillo exterior mas grande, calculado sobre la
// geometria: no depende de que el mapa ya tenga vista (Polygon.getCenter
// de Leaflet lo exige).
function telecomCentroide(geom) {
    const anillos = (geom.type === 'MultiPolygon' ? geom.coordinates.map((p) => p[0]) : [geom.coordinates[0]]);
    let mejor = null;
    anillos.forEach((ring) => {
        let a = 0, cx = 0, cy = 0;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
            a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
        }
        if (!mejor || Math.abs(a) > Math.abs(mejor.a)) mejor = { a, lon: cx / (3 * a), lat: cy / (3 * a) };
    });
    return [mejor.lat, mejor.lon];
}

function telecomLeyenda(leafletMap) {
    const control = L.control({ position: 'bottomright' });
    control.onAdd = () => {
        const div = L.DomUtil.create('div', 'atd-leyenda');
        div.innerHTML = `<h4>Sitios por municipio</h4>` +
            [...TELECOM_CLASES].reverse().map((c) => `<div class="fila"><span class="muestra" style="background:${c.color}"></span>${c.etiqueta}</div>`).join('') +
            `<div class="fila"><span class="muestra sin"></span>Sin sitios</div>`;
        L.DomEvent.disableClickPropagation(div);
        return div;
    };
    control.addTo(leafletMap);
}

function telecomBarrasSector() {
    const filas = Object.entries(TELECOM.porSector);
    const max = Math.max(1, ...filas.map(([, n]) => n));
    return `<div class="space-y-3">` + filas.map(([sector, n]) => `
        <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-secondary shrink-0" aria-hidden="true">${TELECOM_SECTOR_ICONO[sector] || 'cell_tower'}</span>
            <span class="w-44 sm:w-64 shrink-0 font-body-md text-body-md text-on-surface">${esc(sector)}</span>
            <div class="flex-1 h-2.5 rounded-full bg-surface-container-high overflow-hidden">
                <div class="h-full rounded-full bg-primary" style="width:${(n / max * 100).toFixed(1)}%"></div>
            </div>
            <span class="w-8 shrink-0 text-right font-data-display text-data-display text-on-surface">${n}</span>
        </div>`).join('') + `</div>`;
}

function telecomTablaMunicipios() {
    return `<div class="overflow-x-auto"><table class="w-full text-left min-w-[480px]">
        <thead><tr class="border-b-2 border-outline-variant font-label-bold text-label-bold text-on-surface-variant">
            <th class="py-2 pr-3">Municipio</th><th class="py-2 pr-3">Sectores</th><th class="py-2 text-right">Sitios</th></tr></thead>
        <tbody>${TELECOM.municipios.map((m) => `
            <tr class="border-b border-outline-variant">
                <td class="py-2 pr-3 font-body-md text-body-md text-on-surface font-semibold">${esc(m.municipio)}</td>
                <td class="py-2 pr-3"><div class="flex flex-wrap gap-1.5">${Object.entries(m.porSector).map(([s, n]) =>
                    `<span class="px-2 py-0.5 rounded-full bg-surface-container-high font-label-bold text-label-bold text-on-surface">${esc(s)} · ${n}</span>`).join('')}</div></td>
                <td class="py-2 text-right font-data-display text-data-display text-on-surface">${m.total}</td>
            </tr>`).join('')}</tbody></table></div>`;
}

function telecomVistaHtml() {
    const sectores = Object.keys(TELECOM.porSector).length;
    const principal = TELECOM.municipios[0];
    return `
    <div class="flex flex-col gap-4 max-w-5xl">
        <span class="font-label-bold text-label-bold uppercase tracking-wider text-secondary">Conectividad · Agencia de Transformación Digital</span>
        <h2 class="font-headline-xl text-headline-xl text-primary">Infraestructura de Telecomunicaciones</h2>
        <p class="font-body-lg text-body-lg text-on-surface-variant">
            Sitios y torres de telecomunicaciones de la red estatal (sitios REEM) que dan servicio a dependencias del Gobierno del
            Estado, planteles educativos, unidades de salud e instalaciones de seguridad en Morelos.
        </p>
        <div class="rounded-xl p-4 bg-surface-container-low border border-outline-variant font-body-md text-body-md text-on-surface-variant flex gap-3 items-start">
            <span class="material-symbols-outlined text-secondary shrink-0" aria-hidden="true">lock</span>
            <span>Por seguridad de la infraestructura, la información se presenta <b class="text-on-surface">agregada por municipio y sector</b>.
            No se publica la ubicación exacta ni el nombre de los sitios.</span>
        </div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-gutter-grid">
        ${kpiCount('cell_tower', 'Sitios de telecomunicaciones', TELECOM.total, 'primary')}
        ${kpiCount('location_city', 'Municipios con sitios', TELECOM.municipios.length, 'teal')}
        ${kpiCount('category', 'Sectores atendidos', sectores, 'blue')}
        ${principal ? kpiStatic('pin_drop', `Mayor concentración (${telecomSitios(principal.total)})`, principal.municipio, 'text-on-surface', 'warning') : ''}
    </div>
    <div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow flex flex-col">
        <div class="flex items-center justify-between gap-3 mb-stack-md pb-3 border-b-2 border-outline-variant flex-wrap">
            <div class="flex items-center gap-2.5">${iconChip('cell_tower')}<h2 class="font-headline-md text-headline-md text-on-surface">Sitios por municipio</h2></div>
            <span class="font-body-md text-body-md text-on-surface-variant">Pasa el cursor sobre un municipio para ver el desglose por sector.</span>
        </div>
        <div class="overflow-hidden relative w-full mx-auto" style="max-width:900px;aspect-ratio:1/0.9;max-height:78vh;min-height:340px;border-radius:16px;border:1px solid #CBCABE">
            <div id="telecom-map" style="position:absolute;inset:0"></div>
        </div>
    </div>
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-gutter-grid">
        ${card(`${cardHeader('category', 'Sitios por sector')}${telecomBarrasSector()}`)}
        ${card(`${cardHeader('location_city', 'Municipios con infraestructura')}${telecomTablaMunicipios()}`)}
    </div>
    <p class="font-body-md text-body-md text-on-surface-variant">Fuente: ATDEM, registro de sitios REEM. Municipio asignado con los límites municipales del INE.</p>`;
}

function renderTelecomView() {
    if (!telecomViewBuilt) {
        $('#telecom-view').innerHTML = telecomVistaHtml();
        telecomViewBuilt = true;
        animateEntrances($('#telecom-view'));
    }
    if (!telecomMap) {
        telecomMap = crearMapaMorelos('telecom-map');
        const base = agregarBaseMorelos(telecomMap, {
            estilo: telecomEstilo,
            onEachFeature: (f, layer) => {
                const m = telecomDeMunicipio(f.properties.NOMGEO);
                layer.bindTooltip(telecomTooltip(f.properties.NOMGEO, m), { sticky: true, className: 'atd-tooltip' });
                layer.on('mouseover', () => layer.setStyle({ weight: 2.2, color: ATD.verdeOscuro }));
                layer.on('mouseout', () => layer.setStyle(telecomEstilo(f)));
            }
        });
        // Numero de sitios al centro de cada municipio con infraestructura
        // (referencia agregada: la etiqueta va en el centroide del municipio,
        // no en la ubicacion de los sitios).
        if (base.municipios) {
            // Un municipio puede tener varios poligonos (p. ej. Cuernavaca):
            // la etiqueta va en el de mayor extension.
            const area = (l) => { const b = l.getBounds(); return (b.getNorth() - b.getSouth()) * (b.getEast() - b.getWest()); };
            const mayorPorMunicipio = new Map();
            base.municipios.getLayers().forEach((layer) => {
                const m = telecomDeMunicipio(layer.feature.properties.NOMGEO);
                if (!m) return;
                const actual = mayorPorMunicipio.get(m.municipio);
                if (!actual || area(layer) > area(actual.layer)) mayorPorMunicipio.set(m.municipio, { layer, m });
            });
            mayorPorMunicipio.forEach(({ layer, m }) => {
                L.marker(telecomCentroide(layer.feature.geometry), {
                    interactive: false,
                    icon: L.divIcon({
                        className: '',
                        html: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:999px;background:#773357;color:#fff;font-weight:700;font-size:13px;border:2px solid #fff;box-shadow:0 2px 6px rgba(46,59,43,.3)">${m.total}</span>`,
                        iconSize: [28, 28], iconAnchor: [14, 14]
                    })
                }).addTo(telecomMap);
            });
            telecomMap._contorno = base.contorno;
        }
        telecomLeyenda(telecomMap);
    }
    setTimeout(() => {
        if (!telecomMap) return;
        telecomMap.invalidateSize();
        if (!telecomMap._encuadrado && telecomMap._contorno) {
            telecomMap.fitBounds(telecomMap._contorno.getBounds(), { padding: [20, 20] });
            telecomMap._encuadrado = true;
        }
    }, 150);
}
