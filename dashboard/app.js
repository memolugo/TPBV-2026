// Dashboard TPBV 2026 - logica de render, filtros y mapa.
// Consume TPBV_DATA (definido en data.js), generado por scripts/build_dashboard_data.py

const $ = (sel) => document.querySelector(sel);
const canvas = $('#canvas');
const selPoligono = $('#sel-poligono');
const selLocalidad = $('#sel-localidad');

// Conjunto de datos activo en "Análisis Demográfico": 'actual' (TPBV_DATA,
// 132 localidades / 26 poligonos vigentes) o 'nueva' (TPBV_DATA_NUEVA, 162
// localidades / 25 poligonos de la Nueva Propuesta Territorial). Ver
// activeData()/activePoligonosGeoJSON() mas abajo y setDatasetMode().
let DATASET_MODE = 'actual';

let map = null;
let marker = null;
let polygonLayer = null;
let markersLayer = null;
let municipiosLayer = null;
let showMunicipios = true;
// Capas de comparacion territorial: ver seccion dedicada "Propuesta
// Territorial" (renderPropuestaView), con su propio mapa independiente del
// mapa de "Análisis Demográfico". Ambas visibles por defecto porque el
// proposito unico de esa vista es comparar.
let propuestaMap = null;
let propuestaActualLayer = null;
let propuestaNuevaLayer = null;
let showPropuestaActual = true;
let showPropuestaNueva = true;
// Instancia propia (no se comparte con municipiosLayer del mapa de Analisis
// Demografico): un mismo objeto L.geoJSON solo puede pertenecer a un mapa
// Leaflet a la vez, y aqui conviven dos mapas independientes.
let municipiosLayerPropuesta = null;
let showMunicipiosPropuesta = true;
// Localidades censales que quedan dentro de los poligonos de la nueva
// propuesta (ver TPBV_NUEVAS_LOCALIDADES en nuevas_localidades.js).
let nuevasLocalidadesLayer = null;
let showNuevasLocalidades = true;
let lastMapRec = null;
let lastMapMode = null;

// El mapa es "sticky" (ver CSS .map-sticky): se queda fijo en pantalla
// mientras se hace scroll por las tarjetas vecinas, en vez de moverse con el
// documento. Esto evita por completo el bug de Chrome/Leaflet donde el mapa
// no se repinta correctamente al hacer scroll de la pagina (invalidateSize()
// y hasta recrear el mapa desde cero no lo resolvian de forma confiable).
// El offset "top" se calcula segun la altura real del header sticky, para
// que el mapa quede pegado justo debajo sin importar cuantas lineas ocupen
// los filtros en pantallas angostas.
function updateHeaderHeightVar() {
    const header = document.querySelector('header');
    if (header) {
        document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
    }
}
window.addEventListener('resize', updateHeaderHeightVar);
if (window.ResizeObserver) {
    new ResizeObserver(updateHeaderHeightVar).observe(document.querySelector('header'));
} else {
    updateHeaderHeightVar();
}

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------
function fmtInt(n) {
    if (n === null || n === undefined || n === '') return '—';
    return Math.round(n).toLocaleString('es-MX');
}

function pct(part, base) {
    if (part === null || part === undefined || !base) return null;
    return (part / base) * 100;
}

function pctLabel(part, base) {
    const p = pct(part, base);
    return p === null ? '' : `(${p.toFixed(1)}%)`;
}

function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------------------
// Construccion de filas de datos (replican el patron "data-row" del diseño)
// ---------------------------------------------------------------------------
function dataRow({ label, value, base = null, colorClass = 'text-on-surface', colorStyle = '', indent = false, bar = false, barColor = 'bg-primary', asterisk = false, suffix = '' }) {
    const p = base !== null ? pct(value, base) : null;
    const pctHtml = base !== null ? `<span class="font-body-md text-body-md text-secondary">${p === null ? '—' : '(' + p.toFixed(1) + '%)'}</span>` : '';
    const labelClasses = indent ? 'font-body-md text-body-md text-on-surface-variant pl-4 border-l-2 border-primary-container' : 'font-body-md text-body-md text-on-surface-variant';
    const displayVal = suffix ? (value === null || value === undefined ? '—' : `${(Math.round(value * 10) / 10).toLocaleString('es-MX')}${suffix}`) : fmtInt(value);
    const valueHtml = `<span class="font-data-display text-data-display ${colorClass} min-w-[5rem] whitespace-nowrap text-right" style="${colorStyle}">${displayVal}${asterisk ? '<span class=\"text-warning\">*</span>' : ''}</span>`;

    if (bar) {
        const width = p === null ? 0 : Math.min(100, p).toFixed(1);
        return `
        <div class="data-row"><div class="flex flex-col w-full">
            <div class="flex justify-between items-center w-full">
                <span class="${labelClasses}">${esc(label)}</span>
                <div class="flex items-center gap-4">${pctHtml}${valueHtml}</div>
            </div>
            <div class="progress-bar-bg"><div class="progress-bar-fill ${barColor}" style="--fill-w:${width}%"></div></div>
        </div></div>`;
    }
    return `
    <div class="data-row">
        <span class="${labelClasses}">${esc(label)}</span>
        <div class="flex items-center gap-4">${pctHtml}${valueHtml}</div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Piramide poblacional (grupos irregulares disponibles en ITER Morelos; ver
// nota en scripts/build_dashboard_data.py junto a AGE_BINS)
// ---------------------------------------------------------------------------
function renderPyramid(rec) {
    if (!rec.piramide) {
        return `<p class="font-body-md text-body-md text-on-surface-variant">Sin datos de estructura de edad para esta localidad.</p>`;
    }
    const maxVal = Math.max(1, ...rec.piramide.flatMap((b) => [b.f || 0, b.m || 0]));
    const rows = rec.piramide.slice().reverse().map((b) => {
        const wF = ((b.f || 0) / maxVal * 100).toFixed(1);
        const wM = ((b.m || 0) / maxVal * 100).toFixed(1);
        return `
        <div class="pyramid-row" title="${esc(b.label)} años · Mujeres: ${fmtInt(b.f)} · Hombres: ${fmtInt(b.m)}">
            <div class="flex-1 flex justify-end"><div class="pyramid-bar pyramid-bar-f" style="width:${wF}%"></div></div>
            <div class="w-14 shrink-0 text-center font-label-bold text-label-bold text-on-surface-variant border-x border-outline-variant/60">${esc(b.label)}</div>
            <div class="flex-1 flex justify-start"><div class="pyramid-bar pyramid-bar-m" style="width:${wM}%"></div></div>
        </div>`;
    }).join('');

    let dependenciaHtml = '';
    if (rec.pob0a14 !== null && rec.pob65mas !== null && rec.pob15a64) {
        const razon = ((rec.pob0a14 + rec.pob65mas) / rec.pob15a64 * 100);
        dependenciaHtml = `
        <div class="mt-4 pt-3 border-t border-outline-variant flex items-center justify-between">
            <span class="font-body-md text-body-md text-on-surface-variant">Razón de dependencia demográfica</span>
            <span class="font-data-display text-data-display text-on-surface">${razon.toFixed(1)}</span>
        </div>
        <p class="font-body-md text-body-md text-secondary mt-1">Personas dependientes (0-14 y 65+) por cada 100 en edad de trabajar (15-64: ${fmtInt(rec.pob15a64)})</p>`;
    }

    return `
    <div class="flex items-center justify-center gap-6 mb-3">
        <span class="flex items-center gap-2 font-label-bold text-label-bold" style="color:var(--series-f)"><span class="inline-block w-3 h-3 rounded" style="background:var(--series-f)"></span>Mujeres</span>
        <span class="flex items-center gap-2 font-label-bold text-label-bold" style="color:var(--series-m)"><span class="inline-block w-3 h-3 rounded" style="background:var(--series-m)"></span>Hombres</span>
    </div>
    <div class="space-y-1.5">${rows}</div>
    ${dependenciaHtml}`;
}

function iconChip(icon, size = 'w-8 h-8', textSize = 'text-[20px]') {
    return `<span class="${size} shrink-0 rounded-lg bg-surface-container-high text-secondary flex items-center justify-center">
        <span class="material-symbols-outlined ${textSize}">${icon}</span>
    </span>`;
}

function cardHeader(icon, title, borderClass = 'border-outline-variant') {
    return `<div class="flex items-center gap-2.5 mb-stack-md pb-3 border-b-2 ${borderClass}">
        ${iconChip(icon)}
        <h2 class="font-headline-md text-headline-md text-on-surface">${esc(title)}</h2>
    </div>`;
}

// Colores fijos de la comparacion territorial (ver seccion dedicada
// "Propuesta Territorial" / renderPropuestaView), compartidos entre el
// checkbox/legend y el estilo real de las capas en ensurePropuestaLayers.
const COLOR_PROPUESTA_ACTUAL = '#154212';
const COLOR_PROPUESTA_NUEVA = '#a6337a';
const COLOR_NUEVAS_LOCALIDADES = '#d97706';

function mapCardHeader() {
    return `<div class="flex items-center justify-between gap-2 mb-stack-md pb-3 border-b-2 border-secondary-container flex-wrap">
        <div class="flex items-center gap-2.5">
            ${iconChip('map')}
            <h2 class="font-headline-md text-headline-md text-on-surface">Ubicación Geográfica</h2>
        </div>
        <label class="flex items-center gap-1.5 font-body-md text-body-md text-on-surface-variant cursor-pointer select-none">
            <input type="checkbox" id="chk-municipios" ${showMunicipios ? 'checked' : ''} class="rounded border-outline-variant text-primary focus:ring-primary" />
            Límites municipales
        </label>
    </div>`;
}

function card(innerHtml, extraClasses = '') {
    return `<div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow ${extraClasses}">${innerHtml}</div>`;
}

// Etiqueta de agrupacion visual entre clusters de tarjetas tematicas. Es un
// rotulo puramente visual (no un encabezado real: cada tarjeta ya tiene su
// propio h2, y anadir h2/h3 aqui rompería la jerarquia de encabezados que
// usan los lectores de pantalla para saltar entre secciones). Cada cluster
// tiene su propio icono + color de acento para que sea mas facil ubicarse
// durante el scroll largo del dashboard.
function sectionLabel(title, icon, accentKey = 'primary') {
    const a = KPI_ACCENTS[accentKey] || KPI_ACCENTS.primary;
    return `<div class="md:col-span-2 flex items-center gap-3 pt-2 ${a.chipText}">
        <span class="flex items-center gap-2 shrink-0">
            <span class="material-symbols-outlined text-[20px]">${icon}</span>
            <span class="font-label-bold text-label-bold uppercase tracking-wider whitespace-nowrap">${esc(title)}</span>
        </span>
        <div class="h-px flex-1" style="background:linear-gradient(to right, currentColor, transparent); opacity:0.35;"></div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Franja de KPIs: 4 indicadores clave a todo lo ancho, arriba de las tarjetas
// de detalle. Los conteos (poblacion/viviendas) animan de 0 al valor final
// (data-target) via animateEntrances(); los demas se muestran ya resueltos.
// ---------------------------------------------------------------------------
const MARGINACION_COLOR = {
    'Muy alto': 'text-error', 'Alto': 'text-warning', 'Medio': 'text-on-surface',
    'Bajo': 'text-primary', 'Muy bajo': 'text-primary', 'ZAP Urbana': 'text-on-surface-variant'
};

// Acento por tile: cada metrica clave tiene una identidad de color propia
// (borde superior + chip de icono) en vez del gris neutro plano, para que la
// franja de KPI se lea de un vistazo como "lo mas importante de la pagina".
// Los tokens accent-blue/accent-teal se definen en el config de Tailwind
// (ver dashboard/design-tokens.md para la capa semantica completa).
const KPI_ACCENTS = {
    primary: { border: 'border-primary', chipBg: 'bg-primary-container', chipText: 'text-on-primary-container' },
    blue: { border: 'border-accent-blue', chipBg: 'bg-accent-blue/10', chipText: 'text-accent-blue' },
    teal: { border: 'border-accent-teal', chipBg: 'bg-accent-teal/10', chipText: 'text-accent-teal' },
    warning: { border: 'border-warning', chipBg: 'bg-warning/10', chipText: 'text-warning' },
    error: { border: 'border-error', chipBg: 'bg-error-container', chipText: 'text-error' },
    neutral: { border: 'border-outline-variant', chipBg: 'bg-surface-container-high', chipText: 'text-secondary' },
};
const MARGINACION_ACCENT = {
    'Muy alto': 'error', 'Alto': 'warning', 'Medio': 'neutral',
    'Bajo': 'primary', 'Muy bajo': 'primary', 'ZAP Urbana': 'neutral'
};

function kpiTile(icon, label, valueHtml, accentKey = 'neutral') {
    const a = KPI_ACCENTS[accentKey] || KPI_ACCENTS.neutral;
    return `<div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow border-t-4 ${a.border} flex items-center gap-4">
        <span class="w-12 h-12 shrink-0 rounded-lg ${a.chipBg} ${a.chipText} flex items-center justify-center">
            <span class="material-symbols-outlined text-[26px]">${icon}</span>
        </span>
        <div class="min-w-0">
            <p class="font-label-bold text-label-bold text-on-surface-variant truncate">${esc(label)}</p>
            ${valueHtml}
        </div>
    </div>`;
}

function kpiCount(icon, label, value, accentKey) {
    return kpiTile(icon, label, `<p class="font-kpi-value text-kpi-value text-on-surface leading-none kpi-value" data-target="${value || 0}">0</p>`, accentKey);
}

function kpiStatic(icon, label, text, colorClass = 'text-on-surface', accentKey) {
    return kpiTile(icon, label, `<p class="font-kpi-value text-kpi-value ${colorClass} leading-none truncate">${esc(text)}</p>`, accentKey);
}

function renderKpiStrip(rec) {
    const tasa = pct(rec.afiliada, rec.pobTotal);
    const margAccent = MARGINACION_ACCENT[rec.gmMarginacion] || 'neutral';
    const cuartaTile = rec.gmMarginacion
        ? kpiStatic('signal_cellular_alt', 'Grado de Marginación', rec.gmMarginacion, MARGINACION_COLOR[rec.gmMarginacion] || 'text-on-surface', margAccent)
        : kpiCount('location_city', 'Localidades en el Polígono', rec.nLocalidades ?? 1, 'primary');

    return `<div class="col-span-1 md:col-span-2 xl:col-span-12 grid grid-cols-2 lg:grid-cols-4 gap-gutter-grid">
        ${kpiCount('groups', 'Población Total', rec.pobTotal, 'primary')}
        ${kpiCount('home', 'Viviendas Totales', rec.totalViviendas, 'blue')}
        ${kpiStatic('health_and_safety', 'Afiliación a Salud', tasa === null ? '—' : `${tasa.toFixed(1)}%`, 'text-on-surface', 'teal')}
        ${cuartaTile}
    </div>`;
}

// ---------------------------------------------------------------------------
// Anima el conteo de las tarjetas KPI y el relleno de las barras de progreso
// despues de cada re-render del canvas (ver render()/renderAggregate()).
// ---------------------------------------------------------------------------
const REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function animateEntrances() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
        canvas.querySelectorAll('.progress-bar-fill').forEach((el) => el.classList.add('fill-in'));
    }));

    canvas.querySelectorAll('.kpi-value[data-target]').forEach((el) => {
        const target = parseFloat(el.dataset.target);
        if (!isFinite(target)) return;
        if (REDUCED_MOTION) { el.textContent = fmtInt(target); return; }
        const duration = 900;
        const start = performance.now();
        function tick(now) {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            el.textContent = fmtInt(target * eased);
            if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    });
}

// ---------------------------------------------------------------------------
// Poblado de selects
// ---------------------------------------------------------------------------
// El numero de poligono es solo un id interno sin significado para el
// usuario; el select "Filtrar por Poligono" muestra el nombre real del
// poligono en ambos datasets:
//  - 'actual': TPBV_POLIGONOS_ACTUAL_NOMBRES (ver poligonos_actual_nombres.js),
//    generado desde "Lista Comunidades TPBV 2026 - Revisada.csv" (columna
//    Nombre_Poligono).
//  - 'nueva': campo "nombrePoligono" de cada registro (NOMBRE_POLIGONO_TPBV).
function poligonoLabel(p) {
    if (DATASET_MODE === 'nueva') {
        const rec = activeData().find((r) => r.poligono === p);
        return rec ? rec.nombrePoligono : `Polígono ${p}`;
    }
    const nombre = (typeof TPBV_POLIGONOS_ACTUAL_NOMBRES !== 'undefined') ? TPBV_POLIGONOS_ACTUAL_NOMBRES[p] : null;
    return nombre || `Polígono ${p}`;
}

function buildPoligonoOptions() {
    const poligonos = [...new Set(activeData().map((r) => r.poligono))].sort((a, b) => a - b);
    selPoligono.innerHTML = '<option value="all">Todos los Polígonos</option>' +
        poligonos.map((p) => `<option value="${p}">${esc(poligonoLabel(p))}</option>`).join('');
}

function buildLocalidadOptions(poligonoFilter) {
    const items = activeData()
        .map((r, idx) => ({ ...r, idx }))
        .filter((r) => poligonoFilter === 'all' || String(r.poligono) === String(poligonoFilter))
        .sort((a, b) => (a.municipio + a.localidad).localeCompare(b.municipio + b.localidad, 'es'));
    selLocalidad.innerHTML = '<option value="" disabled>Selecciona una localidad…</option>' +
        items.map((r) => `<option value="${r.idx}">${esc(r.municipio)} — ${esc(r.localidad)}</option>`).join('');
    return items;
}

// ---------------------------------------------------------------------------
// Conjunto de datos activo (ver DATASET_MODE / setDatasetMode). El geojson de
// la nueva propuesta (TPBV_PROPUESTA_NUEVA) usa nombres de propiedad
// distintos (POLIGONO/NOMBRE/REGION) a los del actual (Pol/Nom_pol/Region);
// se normaliza una sola vez aqui para que el resto del codigo del mapa
// (findPoligonoFeature, renderMap) no necesite saber cual esta activo.
// ---------------------------------------------------------------------------
const TPBV_POLIGONOS_NUEVA_NORM = (typeof TPBV_PROPUESTA_NUEVA !== 'undefined') ? {
    type: 'FeatureCollection',
    features: TPBV_PROPUESTA_NUEVA.features.map((f) => ({
        type: 'Feature',
        properties: { Pol: f.properties.POLIGONO, Nom_pol: f.properties.NOMBRE, Region: f.properties.REGION },
        geometry: f.geometry
    }))
} : null;

function activeData() {
    return DATASET_MODE === 'nueva' && typeof TPBV_DATA_NUEVA !== 'undefined' ? TPBV_DATA_NUEVA : TPBV_DATA;
}

function activePoligonosGeoJSON() {
    return DATASET_MODE === 'nueva' ? TPBV_POLIGONOS_NUEVA_NORM : (typeof TPBV_POLIGONOS !== 'undefined' ? TPBV_POLIGONOS : null);
}

// ---------------------------------------------------------------------------
// Mapa
// ---------------------------------------------------------------------------
function findPoligonoFeature(polNum) {
    const fc = activePoligonosGeoJSON();
    if (!fc) return null;
    return fc.features.find((f) => f.properties.Pol === Number(polNum)) || null;
}

const REGION_COLORS = {
    'Altos': '#1b9e77',
    'Centro': '#d95f02',
    'Oriente': '#7570b3',
    'Sur': '#e7298a',
    'Tlaquiltenango': '#66a61e',
    // Regiones de la Nueva Propuesta Territorial (TPBV_DATA_NUEVA / TPBV_PROPUESTA_NUEVA)
    'Oeste': '#e6ab02',
    'Suroeste': '#a6761d',
    'Este': '#666666',
    'Norte': '#1f78b4',
    'Noreste': '#984ea3'
};
const REGION_COLOR_DEFAULT = '#575f67';

// Estilo compartido de la capa "Limites municipales" (usada tanto en el mapa
// de Analisis Demografico como en el de Propuesta Territorial, cada uno con
// su propia instancia de L.geoJSON: ver comentario junto a
// municipiosLayerPropuesta sobre por que no se comparte el mismo objeto).
const MUNICIPIOS_STYLE = { color: '#575f67', weight: 1.5, dashArray: '5,4', fill: false, interactive: true };

// Agrega las capas base (Calles/Satelite + su selector) a un mapa Leaflet.
// Se usa tanto para el mapa de Analisis Demografico como para el de
// Propuesta Territorial: mismas fuentes de tiles, mismo control, sin
// duplicar la configuracion en los dos sitios.
function addBaseLayers(leafletMap) {
    const calles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(leafletMap);
    const satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
    });
    // Etiquetas (calles, poblados) sobre la vista satelital: sin esto la
    // capa de imagenes queda muda (sin nombres de localidades/calles).
    const etiquetasSatelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
    const satConLabels = L.layerGroup([satelite, etiquetasSatelite]);
    L.control.layers({ 'Calles': calles, 'Satélite': satConLabels }, null, { position: 'topright', collapsed: true }).addTo(leafletMap);
}

function ensureMunicipiosLayer() {
    if (municipiosLayer || typeof TPBV_LIMITES_MUNICIPALES === 'undefined') return;
    municipiosLayer = L.geoJSON(TPBV_LIMITES_MUNICIPALES, {
        style: MUNICIPIOS_STYLE,
        onEachFeature: (f, layer) => {
            layer.bindTooltip(esc(f.properties.NOMGEO), { sticky: true });
        }
    });
}

// Capas de comparacion territorial (checkboxes en mapCardHeader): se
// construyen una sola vez (igual que municipiosLayer) y se agregan/quitan
// del mapa sin re-renderizar nada mas, para poder superponerlas sobre
// cualquier vista (localidad, poligono o "Todos los Poligonos"). El color
// discontinuo (dashArray) en la nueva propuesta ademas de su color propio
// evita depender solo del color para distinguirlas (accesible a daltonismo
// y se mantiene legible en una impresion en blanco y negro).
function ensurePropuestaLayers() {
    if (!propuestaActualLayer && typeof TPBV_POLIGONOS !== 'undefined') {
        propuestaActualLayer = L.geoJSON(TPBV_POLIGONOS, {
            style: { color: COLOR_PROPUESTA_ACTUAL, weight: 3, fillColor: COLOR_PROPUESTA_ACTUAL, fillOpacity: 0.06 },
            onEachFeature: (f, layer) => {
                layer.bindTooltip(`Actual · Polígono ${esc(f.properties.Pol)} — ${esc(f.properties.Nom_pol)}`, { sticky: true });
            }
        });
    }
    if (!propuestaNuevaLayer && typeof TPBV_PROPUESTA_NUEVA !== 'undefined') {
        propuestaNuevaLayer = L.geoJSON(TPBV_PROPUESTA_NUEVA, {
            style: { color: COLOR_PROPUESTA_NUEVA, weight: 3, dashArray: '8,5', fillColor: COLOR_PROPUESTA_NUEVA, fillOpacity: 0.06 },
            onEachFeature: (f, layer) => {
                const p = f.properties;
                layer.bindTooltip(`Nueva Propuesta · Polígono ${esc(p.POLIGONO)} — ${esc(p.NOMBRE)} (${esc(p.MUNICIPIO)})`, { sticky: true });
            }
        });
    }
    if (!municipiosLayerPropuesta && typeof TPBV_LIMITES_MUNICIPALES !== 'undefined') {
        municipiosLayerPropuesta = L.geoJSON(TPBV_LIMITES_MUNICIPALES, {
            style: MUNICIPIOS_STYLE,
            onEachFeature: (f, layer) => {
                layer.bindTooltip(esc(f.properties.NOMGEO), { sticky: true });
            }
        });
    }
    if (!nuevasLocalidadesLayer && typeof TPBV_NUEVAS_LOCALIDADES !== 'undefined') {
        nuevasLocalidadesLayer = L.layerGroup(TPBV_NUEVAS_LOCALIDADES.map((loc) => {
            const m = L.circleMarker([loc.lat, loc.lon], {
                radius: 5,
                color: '#fff',
                weight: 1,
                fillColor: COLOR_NUEVAS_LOCALIDADES,
                fillOpacity: 0.9
            });
            m.bindTooltip(`<b>${esc(loc.localidad)}</b><br>${esc(loc.municipio)} · Polígono ${esc(loc.poligono)} (${esc(loc.nombrePoligono)})<br>Población: ${fmtInt(loc.pobTotal)}`, { sticky: true });
            return m;
        }));
    }
}

function propuestaControlsHTML() {
    const nActual = (typeof TPBV_POLIGONOS !== 'undefined') ? TPBV_POLIGONOS.features.length : 0;
    const nNueva = (typeof TPBV_PROPUESTA_NUEVA !== 'undefined') ? TPBV_PROPUESTA_NUEVA.features.length : 0;
    const nLocalidades = (typeof TPBV_NUEVAS_LOCALIDADES !== 'undefined') ? TPBV_NUEVAS_LOCALIDADES.length : 0;
    return `<div class="flex items-center flex-wrap gap-x-5 gap-y-2">
        <label class="flex items-center gap-2 font-body-md text-body-md text-on-surface cursor-pointer select-none">
            <input type="checkbox" id="chk-propuesta-actual" ${showPropuestaActual ? 'checked' : ''} class="rounded border-outline-variant focus:ring-primary" style="accent-color:${COLOR_PROPUESTA_ACTUAL}" />
            <span class="inline-block w-3.5 h-3.5 rounded-sm shrink-0" style="background:${COLOR_PROPUESTA_ACTUAL}"></span>
            Propuesta Actual (${nActual} polígonos)
        </label>
        <label class="flex items-center gap-2 font-body-md text-body-md text-on-surface cursor-pointer select-none">
            <input type="checkbox" id="chk-propuesta-nueva" ${showPropuestaNueva ? 'checked' : ''} class="rounded border-outline-variant focus:ring-primary" style="accent-color:${COLOR_PROPUESTA_NUEVA}" />
            <span class="inline-block w-3.5 h-3.5 rounded-sm shrink-0" style="background:${COLOR_PROPUESTA_NUEVA}; border:1.5px dashed #fff"></span>
            Nueva Propuesta (${nNueva} polígonos)
        </label>
        <label class="flex items-center gap-2 font-body-md text-body-md text-on-surface cursor-pointer select-none">
            <input type="checkbox" id="chk-nuevas-localidades" ${showNuevasLocalidades ? 'checked' : ''} class="rounded border-outline-variant focus:ring-primary" style="accent-color:${COLOR_NUEVAS_LOCALIDADES}" />
            <span class="inline-block w-3.5 h-3.5 rounded-full shrink-0" style="background:${COLOR_NUEVAS_LOCALIDADES}; border:1.5px solid #fff; box-shadow:0 0 0 1px ${COLOR_NUEVAS_LOCALIDADES}"></span>
            Nuevas Localidades (${nLocalidades})
        </label>
        <label class="flex items-center gap-2 font-body-md text-body-md text-on-surface-variant cursor-pointer select-none">
            <input type="checkbox" id="chk-municipios-propuesta" ${showMunicipiosPropuesta ? 'checked' : ''} class="rounded border-outline-variant text-primary focus:ring-primary" />
            Límites municipales
        </label>
    </div>`;
}

// Vista dedicada "Propuesta Territorial" (ver nav lateral): mapa
// independiente del de "Análisis Demográfico", enfocado unicamente en
// comparar la delimitacion actual de los poligonos TPBV contra la nueva
// propuesta de ampliacion. El HTML de la tarjeta se construye una sola vez
// (propuestaViewBuilt); en cada visita solo se refrescan los checkboxes y
// las capas, para no perder el zoom/paneo que el usuario ya tenia.
let propuestaViewBuilt = false;

function renderPropuestaView() {
    const view = $('#propuesta-view');
    if (!propuestaViewBuilt) {
        view.innerHTML = `
        <div>
            <h2 class="font-headline-lg text-headline-lg text-primary">Propuesta Territorial 2026</h2>
            <p class="font-body-lg text-body-lg text-on-surface-variant mt-1">Compara la delimitación vigente de los polígonos TPBV contra la nueva propuesta de ampliación territorial. Activa o desactiva cada capa para verlas por separado o superpuestas.</p>
        </div>
        <div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow border-t-4 border-secondary-container flex flex-col flex-1" style="min-height:88vh">
            <div class="flex items-center justify-between gap-3 mb-stack-md pb-3 border-b-2 border-secondary-container flex-wrap">
                <div class="flex items-center gap-2.5">
                    ${iconChip('layers')}
                    <h2 class="font-headline-md text-headline-md text-on-surface">Comparación de Polígonos</h2>
                </div>
                <div id="propuesta-controls"></div>
            </div>
            <div class="flex-1 rounded-lg overflow-hidden border border-outline-variant bg-surface-container-low relative" id="propuesta-map-container">
                <div id="propuesta-map"></div>
            </div>
        </div>`;
        propuestaViewBuilt = true;
    }
    $('#propuesta-controls').innerHTML = propuestaControlsHTML();

    if (!propuestaMap) {
        propuestaMap = L.map('propuesta-map', { attributionControl: true });
        addBaseLayers(propuestaMap);
    }

    ensurePropuestaLayers();
    if (propuestaActualLayer) {
        if (showPropuestaActual && !propuestaMap.hasLayer(propuestaActualLayer)) propuestaActualLayer.addTo(propuestaMap);
        else if (!showPropuestaActual && propuestaMap.hasLayer(propuestaActualLayer)) propuestaMap.removeLayer(propuestaActualLayer);
    }
    if (propuestaNuevaLayer) {
        if (showPropuestaNueva && !propuestaMap.hasLayer(propuestaNuevaLayer)) propuestaNuevaLayer.addTo(propuestaMap);
        else if (!showPropuestaNueva && propuestaMap.hasLayer(propuestaNuevaLayer)) propuestaMap.removeLayer(propuestaNuevaLayer);
    }
    if (municipiosLayerPropuesta) {
        if (showMunicipiosPropuesta && !propuestaMap.hasLayer(municipiosLayerPropuesta)) municipiosLayerPropuesta.addTo(propuestaMap);
        else if (!showMunicipiosPropuesta && propuestaMap.hasLayer(municipiosLayerPropuesta)) propuestaMap.removeLayer(municipiosLayerPropuesta);
    }
    if (nuevasLocalidadesLayer) {
        if (showNuevasLocalidades && !propuestaMap.hasLayer(nuevasLocalidadesLayer)) nuevasLocalidadesLayer.addTo(propuestaMap);
        else if (!showNuevasLocalidades && propuestaMap.hasLayer(nuevasLocalidadesLayer)) propuestaMap.removeLayer(nuevasLocalidadesLayer);
    }

    // invalidateSize primero: el contenedor pudo estar oculto (display:none,
    // sin layout) hasta este mismo momento. El encuadre solo se recalcula la
    // primera vez que se abre la vista (evita saltos de zoom si el usuario ya
    // habia paneado/hecho zoom manualmente y vuelve a esta pestana).
    const isFirstOpen = !propuestaMap._tpbvFitted;
    setTimeout(() => {
        if (!propuestaMap) return;
        propuestaMap.invalidateSize();
        if (!isFirstOpen) return;
        const boundsList = [];
        if (propuestaActualLayer && propuestaMap.hasLayer(propuestaActualLayer)) boundsList.push(propuestaActualLayer.getBounds());
        if (propuestaNuevaLayer && propuestaMap.hasLayer(propuestaNuevaLayer)) boundsList.push(propuestaNuevaLayer.getBounds());
        if (boundsList.length) {
            let combined = boundsList[0];
            boundsList.slice(1).forEach((b) => { combined = combined.extend(b); });
            propuestaMap.fitBounds(combined, { padding: [24, 24] });
            propuestaMap._tpbvFitted = true;
        } else {
            propuestaMap.setView([18.75, -99.15], 9);
        }
    }, 150);
}

// ---------------------------------------------------------------------------
// Vista "Inicio": bienvenida + guia rapida del tablero. Se reconstruye cada
// vez que se abre (es barata: no toca mapas ni Leaflet) para que las cifras
// resumen siempre reflejen los datos embebidos actuales.
// ---------------------------------------------------------------------------
function homeStepItem(n, title, desc) {
    return `<li class="flex gap-4">
        <span class="w-9 h-9 shrink-0 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-headline-md text-headline-md">${n}</span>
        <div class="pt-1">
            <p class="font-label-bold text-label-bold text-on-surface">${esc(title)}</p>
            <p class="font-body-md text-body-md text-on-surface-variant mt-0.5">${desc}</p>
        </div>
    </li>`;
}

function homeSectionCard(icon, title, desc, ctaLabel, ctaView) {
    return card(`
        ${cardHeader(icon, title)}
        <p class="font-body-md text-body-md text-on-surface-variant mb-4">${desc}</p>
        <button onclick="showView('${ctaView}')" class="font-label-bold text-label-bold text-primary hover:underline inline-flex items-center gap-1">
            ${esc(ctaLabel)} <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
    `);
}

function renderInicioView() {
    const view = $('#inicio-view');

    const nLocActual = TPBV_DATA.length;
    const nPolActual = new Set(TPBV_DATA.map((r) => r.poligono)).size;
    const pobActual = TPBV_DATA.reduce((s, r) => s + (r.pobTotal || 0), 0);
    const nPolNueva = (typeof TPBV_PROPUESTA_NUEVA !== 'undefined') ? TPBV_PROPUESTA_NUEVA.features.length : 0;
    const nLocNueva = (typeof TPBV_DATA_NUEVA !== 'undefined') ? TPBV_DATA_NUEVA.length : 0;

    view.innerHTML = `
    <div class="text-center w-full py-10 px-4 rounded-2xl bg-gradient-to-br from-primary-container/10 via-transparent to-secondary-container/25">
        <span class="material-symbols-outlined text-primary" style="font-size:44px">waving_hand</span>
        <h1 class="font-headline-xl text-headline-xl text-primary mt-2">Bienvenido al Dashboard de TPBV</h1>
        <p class="font-body-lg text-body-lg text-on-surface-variant mt-2 max-w-2xl mx-auto">
            Territorios de Paz y Buen Vivir 2026 — la herramienta de análisis sociodemográfico y planeación
            territorial de la Agencia de Transformación Digital del Gobierno del Estado de Morelos.
        </p>
        <button onclick="showView('analisis')" class="mt-6 bg-primary-container text-on-primary-container px-6 py-2.5 rounded-lg font-headline-md text-headline-md hover:opacity-90 transition-opacity inline-flex items-center gap-2">
            <span class="material-symbols-outlined">analytics</span> Comenzar el análisis
        </button>
    </div>

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-gutter-grid">
        ${kpiTile('groups', 'Localidades (Actual)', `<p class="font-kpi-value text-kpi-value text-on-surface leading-none">${fmtInt(nLocActual)}</p>`, 'primary')}
        ${kpiTile('map', 'Polígonos Vigentes', `<p class="font-kpi-value text-kpi-value text-on-surface leading-none">${fmtInt(nPolActual)}</p>`, 'blue')}
        ${kpiTile('layers', 'Polígonos (Nueva)', `<p class="font-kpi-value text-kpi-value text-on-surface leading-none">${fmtInt(nPolNueva)}</p>`, 'teal')}
        ${kpiTile('groups', 'Población Analizada', `<p class="font-kpi-value text-kpi-value text-on-surface leading-none">${fmtInt(pobActual)}</p>`, 'warning')}
    </div>

    <div>
        ${sectionLabel('¿Qué encontrarás en este tablero?', 'explore', 'primary')}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-gutter-grid mt-3">
            ${homeSectionCard('analytics', 'Análisis Demográfico',
                `Indicadores de población, vivienda, tecnologías de la información, salud, educación y economía por localidad o por polígono completo. Alterna entre la <b>Propuesta Actual</b> (${fmtInt(nLocActual)} localidades) y la <b>Nueva Propuesta Territorial</b> (${fmtInt(nLocNueva)} localidades) con un solo clic.`,
                'Ir a Análisis Demográfico', 'analisis')}
            ${homeSectionCard('layers', 'Propuesta Territorial',
                `Compara la delimitación vigente de los polígonos TPBV contra la nueva propuesta de ampliación: polígonos, límites municipales y localidades nuevas, todo superponible en un mismo mapa interactivo.`,
                'Ir a Propuesta Territorial', 'propuesta')}
            ${homeSectionCard('description', 'Reportes Institucionales',
                `Genera, para la localidad o el polígono que estés viendo, un documento formal con portada y todas las tablas de indicadores, listo para imprimir o exportar a PDF.`,
                'Ir a generar un reporte', 'analisis')}
        </div>
    </div>

    <div>
        ${sectionLabel('Cómo empezar', 'checklist', 'blue')}
        ${card(`
            <ol class="space-y-5">
                ${homeStepItem(1, 'Elige el conjunto de datos', 'En Análisis Demográfico, usa el interruptor "Propuesta Actual / Nueva Propuesta Territorial" para decidir qué delimitación quieres explorar.')}
                ${homeStepItem(2, 'Filtra por polígono o localidad', 'Usa los selectores de la parte superior, o entra directo a un polígono desde el mapa o la lista de localidades.')}
                ${homeStepItem(3, 'Explora los indicadores', 'Revisa las tarjetas de población, vivienda, salud, educación, economía y la pirámide poblacional, además del mapa de ubicación.')}
                ${homeStepItem(4, 'Compara ambas propuestas', 'Ve a "Propuesta Territorial" para ver la delimitación actual y la nueva superpuestas, con las localidades que se incorporarían.')}
                ${homeStepItem(5, 'Genera tu reporte', 'Usa el botón "Reporte Institucional" para exportar un documento formal en PDF de lo que estés viendo.')}
            </ol>
        `, 'mt-3')}
    </div>`;
}

function renderMap(rec, mapMode) {
    lastMapRec = rec;
    lastMapMode = mapMode;
    const container = $('#map-container');
    const feature = findPoligonoFeature(rec.poligono);
    const hasPoint = rec.latitud !== null && rec.longitud !== null;
    const showAll = selPoligono.value === 'all';
    const overview = mapMode === 'overview' && !showAll;

    if (!feature && !hasPoint && !showAll) {
        container.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-on-surface-variant flex-col gap-2">
            <span class="material-symbols-outlined text-4xl opacity-50">location_off</span>
            <span class="font-body-md text-center px-4">No hay datos geográficos disponibles para esta localidad</span>
        </div>`;
        map = null;
        return;
    }

    if (!$('#map')) {
        container.innerHTML = '<div id="map"></div>';
        map = null;
    }
    if (!map) {
        map = L.map('map', { attributionControl: true });
        addBaseLayers(map);
    }

    ensureMunicipiosLayer();
    if (municipiosLayer) {
        if (showMunicipios && !map.hasLayer(municipiosLayer)) municipiosLayer.addTo(map);
        else if (!showMunicipios && map.hasLayer(municipiosLayer)) map.removeLayer(municipiosLayer);
    }

    if (marker) { marker.remove(); marker = null; }
    if (polygonLayer) { polygonLayer.remove(); polygonLayer = null; }
    if (markersLayer) { markersLayer.remove(); markersLayer = null; }

    const bounds = [];

    if (overview && feature) {
        // Vista del poligono seleccionado con TODAS sus localidades marcadas;
        // solo se hace zoom a una localidad especifica cuando el usuario la
        // selecciona explicitamente (ver mapMode 'zoom').
        polygonLayer = L.geoJSON(feature, {
            style: { color: '#154212', weight: 3, fillColor: '#3b6934', fillOpacity: 0.18 }
        }).addTo(map);
        polygonLayer.bindTooltip(`Polígono ${feature.properties.Pol} — ${esc(feature.properties.Nom_pol)}`, { sticky: true });
        bounds.push(polygonLayer.getBounds());

        const data = activeData();
        const hermanas = data
            .map((r, idx) => ({ ...r, idx }))
            .filter((r) => r.poligono === rec.poligono && r.latitud !== null && r.longitud !== null);

        markersLayer = L.layerGroup().addTo(map);
        hermanas.forEach((r) => {
            const isActive = r.idx === data.indexOf(rec);
            const m = L.circleMarker([r.latitud, r.longitud], {
                radius: isActive ? 9 : 6,
                color: '#154212',
                weight: isActive ? 3 : 1.5,
                fillColor: isActive ? '#a1d494' : '#3b6934',
                fillOpacity: isActive ? 1 : 0.7
            }).addTo(markersLayer);
            const nota = r.coordManual ? '<br><span class="text-warning">Coordenada capturada manualmente</span>' : '';
            m.bindPopup(`<b>${esc(r.localidad)}</b><br>${esc(r.municipio)}, Morelos${nota}
                <br><a href="#" onclick="selectLocalidad(${r.idx}); return false;" class="text-primary font-semibold">Ver detalle &rarr;</a>`);
            bounds.push(L.latLngBounds([[r.latitud, r.longitud]]));
        });
    } else if (showAll && activePoligonosGeoJSON()) {
        // Vista de conjunto: todos los poligonos del dataset activo,
        // coloreados por region, con el de la localidad actual resaltado en
        // verde primario.
        polygonLayer = L.geoJSON(activePoligonosGeoJSON(), {
            style: (f) => {
                const isActive = f.properties.Pol === Number(rec.poligono);
                const base = REGION_COLORS[f.properties.Region] || REGION_COLOR_DEFAULT;
                return isActive
                    ? { color: '#154212', weight: 4, fillColor: '#3b6934', fillOpacity: 0.35 }
                    : { color: base, weight: 1.5, fillColor: base, fillOpacity: 0.12 };
            },
            onEachFeature: (f, layer) => {
                layer.bindTooltip(`Polígono ${f.properties.Pol} — ${esc(f.properties.Nom_pol)} (${esc(f.properties.Region)})`, { sticky: true });
            }
        }).addTo(map);
        bounds.push(polygonLayer.getBounds());
    } else if (feature) {
        // Modo zoom: se dibuja el poligono solo como contexto visual, pero el
        // encuadre (bounds) se basa unicamente en la localidad seleccionada,
        // no en la extension completa del poligono (que puede ser mucho mas
        // grande que la localidad).
        polygonLayer = L.geoJSON(feature, {
            style: { color: '#154212', weight: 3, fillColor: '#3b6934', fillOpacity: 0.22 }
        }).addTo(map);
        polygonLayer.bindTooltip(`Polígono ${feature.properties.Pol} — ${esc(feature.properties.Nom_pol)}`, { sticky: true });
        if (!hasPoint) bounds.push(polygonLayer.getBounds());
    }

    if (hasPoint && !overview) {
        marker = L.marker([rec.latitud, rec.longitud]).addTo(map);
        const nota = rec.coordManual ? '<br><span class="text-warning">Coordenada capturada manualmente (sin match censal)</span>' : '';
        marker.bindPopup(`<b>${esc(rec.localidad)}</b><br>${esc(rec.municipio)}, Morelos${nota}`).openPopup();
        bounds.push(L.latLngBounds([[rec.latitud, rec.longitud]]));
    }

    // invalidateSize primero: el contenedor #map recien insertado puede no
    // tener aun sus dimensiones finales de layout (flex) en este mismo tick,
    // lo que hace que fitBounds calcule un zoom incorrecto si se llama antes.
    setTimeout(() => {
        if (!map) return;
        map.invalidateSize();
        if (bounds.length) {
            let combined = bounds[0];
            bounds.slice(1).forEach((b) => { combined = combined.extend(b); });
            map.fitBounds(combined, { padding: [20, 20], maxZoom: hasPoint ? 15 : 14 });
        }
    }, 150);
}

// ---------------------------------------------------------------------------
// Estado "sin seleccion": se muestra cuando el filtro esta en "Todos los
// Poligonos" y aun no se ha elegido una localidad especifica.
// ---------------------------------------------------------------------------
function renderNoSelection() {
    canvas.innerHTML = `
    <div class="col-span-1 md:col-span-2 xl:col-span-12">
        <div id="map-card" class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow border-t-4 border-secondary-container flex flex-col h-full min-h-[500px]">
            ${mapCardHeader()}
            <div class="flex-1 rounded-lg overflow-hidden border border-outline-variant bg-surface-container-low relative" id="map-container"></div>
        </div>
    </div>
    <div class="col-span-1 md:col-span-2 xl:col-span-12">` + card(`
        <div class="flex items-center gap-4 text-on-surface-variant py-1">
            ${iconChip('touch_app', 'w-11 h-11', 'text-2xl')}
            <p class="font-body-lg text-body-lg">Selecciona un <b>polígono</b> o una <b>localidad</b> en los filtros de arriba para ver su información sociodemográfica detallada.</p>
        </div>
    `) + `</div>`;
    renderMap({ poligono: -1, latitud: null, longitud: null, localidad: '', municipio: '' }, 'all');
}

// ---------------------------------------------------------------------------
// Render principal
// ---------------------------------------------------------------------------
function render(idx, mapMode) {
    const rec = activeData()[idx];

    if (rec.fuente === 'SIN DATOS') {
        canvas.innerHTML = `<div class="col-span-1 md:col-span-2 xl:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-gutter-grid items-start">` +
            `<div class="flex flex-col gap-gutter-grid">` + renderInfoCard(rec) + renderLocalidadesCard(rec) + `</div>` +
            `<div id="map-card" class="map-sticky bg-surface-container-lowest rounded-xl p-card-padding card-shadow border-t-4 border-secondary-container flex flex-col min-h-[400px]">
                ${mapCardHeader()}
                <div class="flex-1 rounded-lg overflow-hidden border border-outline-variant bg-surface-container-low relative" id="map-container"></div>
            </div>` +
            `</div>` +
            `<div class="col-span-1 md:col-span-2 xl:col-span-12">` + card(`
            ${cardHeader('report', 'Sin Datos Censales Disponibles', 'border-error')}
            <p class="font-body-md text-body-md text-on-surface-variant">
                No se encontró una coincidencia confiable para <b>${esc(rec.localidad)}</b> en el Censo INEGI 2020 (ITER Morelos).
                Esto ocurre principalmente con colonias/barrios urbanos que no se registran como localidad censal independiente.
                ${rec.latitud !== null
                    ? 'El mapa muestra su ubicación (coordenada capturada manualmente) dentro del polígono ' + esc(rec.poligono) + '.'
                    : 'El mapa muestra el polígono ' + esc(rec.poligono) + ' al que pertenece, pero no la ubicación exacta de la localidad.'}
            </p>
            <div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Población reportada (Lista TPBV 2026)</span>
            <span class="font-data-display text-data-display text-on-surface">${fmtInt(rec.pobTotLista)}</span></div>
        `) + `</div>`;
        renderMap(rec, mapMode);
        return;
    }

    const parts = [];

    parts.push(renderKpiStrip(rec));

    // Fila de contexto: Info General + Localidades (apiladas) + Mapa (sticky)
    parts.push(`<div class="col-span-1 md:col-span-2 xl:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-gutter-grid items-start">`);
    parts.push(`<div class="flex flex-col gap-gutter-grid">` + renderInfoCard(rec) + renderLocalidadesCard(rec) + `</div>`);
    parts.push(`<div id="map-card" class="map-sticky bg-surface-container-lowest rounded-xl p-card-padding card-shadow border-t-4 border-secondary-container flex flex-col min-h-[400px]">
        ${mapCardHeader()}
        <div class="flex-1 rounded-lg overflow-hidden border border-outline-variant bg-surface-container-low relative" id="map-container"></div>
    </div>`);
    parts.push(`</div>`);

    parts.push(renderDataCards(rec));

    canvas.innerHTML = parts.join('');
    renderMap(rec, mapMode);
    animateEntrances();
}

// Tarjetas de indicadores (Poblacion, Piramide, Vivienda, ...). Se usa tanto
// para una localidad individual como para el agregado de un poligono
// completo (renderAggregate) porque ambos son objetos con las mismas claves.
//
// Agrupadas en 4 clusters tematicos (Demografia / Vivienda / Salud /
// Educacion y Economia) en vez de una secuencia plana: las tarjetas que se
// leen juntas (p.ej. Vivienda + Bienes y Servicios en la Vivienda) quedan
// contiguas, y cada fila del grid de 2 columnas se llena por completo (sin
// huecos accidentales que dejaba el orden anterior al intercalar tarjetas
// de 1 y 2 columnas).
function renderDataCards(rec) {
    const parts = [];

    parts.push(`<div class="col-span-1 md:col-span-2 xl:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-gutter-grid">`);

    // ---- Demografía --------------------------------------------------
    parts.push(sectionLabel('Demografía', 'groups', 'primary'));

    const pMuj = pct(rec.pobMujeres, rec.pobTotal) ?? 0;
    const pHom = pct(rec.pobHombres, rec.pobTotal) ?? 0;
    parts.push(card(`
        ${cardHeader('group', 'Población')}
        <div class="space-y-1">
        ${dataRow({ label: 'Población Total', value: rec.pobTotal, base: rec.pobTotal })}
        ${dataRow({ label: 'Mujeres', value: rec.pobMujeres, base: rec.pobTotal, colorStyle: 'color:var(--series-f)' })}
        ${dataRow({ label: 'Hombres', value: rec.pobHombres, base: rec.pobTotal, colorStyle: 'color:var(--series-m)' })}
        <div class="pt-2">
            <div class="flex h-4 rounded-full overflow-hidden w-full bg-surface-container-high">
                <div style="width:${pMuj.toFixed(1)}%; background:var(--series-f)"></div>
                <div style="width:${pHom.toFixed(1)}%; background:var(--series-m)"></div>
            </div>
            <div class="flex justify-between mt-1 px-1">
                <span class="font-label-bold text-label-bold" style="color:var(--series-f)">Mujeres</span>
                <span class="font-label-bold text-label-bold" style="color:var(--series-m)">Hombres</span>
            </div>
        </div>
        </div>`));

    parts.push(card(`
        ${cardHeader('diversity_1', 'Población Indígena y Afromexicana')}
        <div class="space-y-1">
        ${dataRow({ label: 'Habla Lengua Indígena', value: rec.hablaLenguaIndigena, base: rec.pobTotal })}
        ${dataRow({ label: 'Monolingüe (no habla español)', value: rec.indigenaMonolingue, base: rec.hablaLenguaIndigena, colorClass: 'text-warning', indent: true })}
        ${dataRow({ label: 'Hogares Censales Indígenas', value: rec.hogaresIndigenas })}
        ${dataRow({ label: 'Pob. Afromexicana', value: rec.afromexicana })}
        </div>`));

    // Piramide poblacional (a todo lo ancho por la cantidad de filas/etiquetas)
    parts.push(card(`
        ${cardHeader('bar_chart', 'Estructura de Población por Edad y Sexo')}
        ${renderPyramid(rec)}
        `, 'md:col-span-2'));

    // ---- Vivienda y Servicios -----------------------------------------
    parts.push(sectionLabel('Vivienda y Servicios', 'home_work', 'blue'));

    parts.push(card(`
        ${cardHeader('home', 'Vivienda')}
        <div class="space-y-1">
        ${dataRow({ label: 'Total Viviendas', value: rec.totalViviendas, base: rec.totalViviendas })}
        ${dataRow({ label: 'Piso de Tierra', value: rec.pisoTierra, base: rec.totalViviendas, colorClass: 'text-error', bar: true, barColor: 'bg-error' })}
        ${dataRow({ label: 'Un Solo Cuarto', value: rec.unSoloCuarto, base: rec.totalViviendas, colorClass: 'text-warning', bar: true, barColor: 'bg-warning' })}
        ${dataRow({ label: 'Con Hacinamiento', value: rec.hacinamiento, base: rec.totalViviendas, colorClass: 'text-error', bar: true, barColor: 'bg-error' })}
        </div>`));

    parts.push(card(`
        ${cardHeader('devices', 'Tecnologías de Información (TIC)')}
        <div class="space-y-1">
        ${dataRow({ label: 'Con Celular', value: rec.celular, base: rec.totalViviendas, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Con Computadora', value: rec.computadora, base: rec.totalViviendas, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Con Internet', value: rec.internet, base: rec.totalViviendas, bar: true, barColor: 'bg-primary-fixed-dim' })}
        </div>`));

    parts.push(card(`
        ${cardHeader('kitchen', 'Bienes y Servicios en la Vivienda')}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-gutter-grid gap-y-1">
        ${dataRow({ label: 'Refrigerador', value: rec.refrigerador, base: rec.totalViviendas, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Lavadora', value: rec.lavadora, base: rec.totalViviendas, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Automóvil', value: rec.automovil, base: rec.totalViviendas, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Agua Entubada', value: rec.aguaEntubada, base: rec.totalViviendas, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Drenaje', value: rec.drenaje, base: rec.totalViviendas, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Energía Eléctrica', value: rec.electricidad, base: rec.totalViviendas, bar: true, barColor: 'bg-primary-fixed-dim' })}
        </div>`, 'md:col-span-2'));

    // ---- Salud y Bienestar ----------------------------------------------
    parts.push(sectionLabel('Salud y Bienestar', 'health_and_safety', 'teal'));

    parts.push(card(`
        ${cardHeader('local_hospital', 'Servicios de Salud')}
        <div class="space-y-1">
        ${dataRow({ label: 'Total Afiliados', value: rec.afiliada, base: rec.pobTotal, colorClass: 'text-primary', bar: true, barColor: 'bg-primary' })}
        ${dataRow({ label: 'Sin Afiliación', value: rec.sinAfiliacion, base: rec.pobTotal, colorClass: 'text-error', bar: true, barColor: 'bg-error' })}
        ${dataRow({ label: 'Afiliados al IMSS', value: rec.imss, base: rec.pobTotal, indent: true, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Afiliados al ISSSTE', value: rec.issste, base: rec.pobTotal, indent: true, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Otros Servicios de Salud', value: rec.otrosSalud, base: rec.pobTotal, indent: true, bar: true, barColor: 'bg-primary-fixed-dim' })}
        </div>`));

    parts.push(card(`
        ${cardHeader('diversity_3', 'Discapacidad y Condiciones de Salud')}
        <div class="space-y-1">
        ${dataRow({ label: 'Con Discapacidad', value: rec.conDiscapacidad, base: rec.pobTotal, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Con Limitación', value: rec.conLimitacion, base: rec.pobTotal, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Con Problema o Condición Mental', value: rec.conProblemaMental, base: rec.pobTotal, bar: true, barColor: 'bg-primary-fixed-dim' })}
        </div>`));

    // ---- Educación y Economía -------------------------------------------
    parts.push(sectionLabel('Educación y Economía', 'school', 'warning'));

    // Base de poblacion 15+ (pobTotal menos 0-14) para los indicadores de
    // Educacion que se definen sobre esa poblacion (analfabetismo, rezago
    // educativo); si falta pob0a14 se omite el % en vez de usar pobTotal,
    // que sobrestimaria el denominador.
    const base15Mas = (rec.pobTotal !== null && rec.pob0a14 !== null && rec.pobTotal !== undefined && rec.pob0a14 !== undefined)
        ? rec.pobTotal - rec.pob0a14
        : null;

    parts.push(card(`
        ${cardHeader('school', 'Educación')}
        <div class="space-y-1">
        ${dataRow({ label: 'Grado Promedio de Escolaridad', value: rec.gradoEscolaridad, suffix: ' años', colorClass: 'text-primary' })}
        ${dataRow({ label: 'Analfabetas (15+)', value: rec.analfabetas, base: base15Mas, colorClass: 'text-error', bar: true, barColor: 'bg-error' })}
        ${dataRow({ label: 'Sin Educación Básica Completa (15+)', value: rec.sinBasicaCompleta, base: base15Mas, colorClass: 'text-error', bar: true, barColor: 'bg-error' })}
        ${dataRow({ label: 'Niñas/os 6-11 años sin asistir a la escuela', value: rec.ninos6a11NoAsisten, colorClass: 'text-error', indent: true })}
        ${dataRow({ label: 'Adolescentes 12-14 años sin asistir a la escuela', value: rec.ninos12a14NoAsisten, colorClass: 'text-error', indent: true })}
        </div>`));

    parts.push(card(`
        ${cardHeader('work', 'Economía')}
        <div class="space-y-1">
        ${dataRow({ label: 'Económicamente Activa (PEA)', value: rec.pea, base: rec.pobTotal, colorClass: 'text-primary', bar: true, barColor: 'bg-primary' })}
        ${dataRow({ label: 'Ocupada', value: rec.ocupada, base: rec.pea, indent: true, bar: true, barColor: 'bg-primary-fixed-dim' })}
        ${dataRow({ label: 'Desocupada', value: rec.desocupada, base: rec.pea, colorClass: 'text-error', indent: true, bar: true, barColor: 'bg-error' })}
        ${dataRow({ label: 'Ocupada en Sector Primario', value: rec.ocupadaPrimario, base: rec.ocupada, indent: true, bar: true, barColor: 'bg-primary-fixed-dim' })}
        </div>`));

    parts.push(`</div>`);
    return parts.join('');
}

function renderInfoCard(rec) {
    return `<div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow border-t-4 border-primary">
        ${cardHeader('info', 'Información General')}
        <div class="space-y-1">
        <div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Municipio</span><span class="font-data-display text-data-display text-on-surface">${esc(rec.municipio)}</span></div>
        <div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Región</span><span class="font-data-display text-data-display text-on-surface">${esc(rec.region || '—')}</span></div>
        <div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Polígono</span><span class="font-data-display text-data-display text-on-surface">${esc(rec.poligono)}</span></div>
        <div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Grado de Marginación</span><span class="font-data-display text-data-display text-on-surface">${esc(rec.gmMarginacion || '—')}</span></div>
        </div>
    </div>`;
}

function renderLocalidadesCard(rec) {
    const hermanos = activeData()
        .map((r, idx) => ({ ...r, idx }))
        .filter((r) => r.poligono === rec.poligono)
        .sort((a, b) => a.localidad.localeCompare(b.localidad, 'es'));

    const listItems = hermanos.map((r) => {
        const isActive = r.localidad === rec.localidad && r.municipio === rec.municipio;
        return `<li class="loc-item px-3 py-2.5 rounded-lg font-body-md text-body-md transition-colors ${isActive ? 'active' : 'text-on-surface-variant hover:bg-surface-container-low'}" data-idx="${r.idx}" role="button" tabindex="0" aria-current="${isActive ? 'true' : 'false'}">${esc(r.localidad)}</li>`;
    }).join('');

    return `<div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow border-t-4 border-secondary-container flex flex-col">
        <div class="flex items-center gap-2 mb-stack-md pb-2 border-b-2 border-secondary-container">
            <span class="material-symbols-outlined text-secondary">location_city</span>
            <h2 class="font-headline-md text-headline-md text-on-surface">Localidades en este Polígono</h2>
            <span class="ml-auto font-label-bold text-label-bold text-on-surface-variant bg-surface-container-high px-2.5 py-1 rounded-full">${hermanos.length}</span>
        </div>
        <ul class="space-y-1 max-h-[420px] overflow-y-auto pr-1">${listItems}</ul>
    </div>`;
}

// ---------------------------------------------------------------------------
// Agregado por poligono: suma los indicadores de todas sus localidades para
// dar un analisis conjunto, en vez de mostrar solo la primera localidad.
// ---------------------------------------------------------------------------
const AGG_SUM_FIELDS = [
    'pobTotal', 'pobMujeres', 'pobHombres', 'analfabetas', 'pea', 'desocupada', 'ocupada',
    'afromexicana', 'conDiscapacidad', 'conLimitacion', 'conProblemaMental', 'afiliada', 'sinAfiliacion',
    'imss', 'issste', 'otrosSalud', 'totalViviendas', 'pisoTierra', 'unSoloCuarto', 'aguaEntubada', 'drenaje',
    'electricidad', 'refrigerador', 'lavadora', 'automovil', 'computadora', 'internet', 'celular',
    'hablaLenguaIndigena', 'indigenaMonolingue', 'hogaresIndigenas', 'ninos6a11NoAsisten', 'ninos12a14NoAsisten',
    'pob0a14', 'pob15a64', 'pob65mas', 'sinBasicaCompleta', 'ocupadaPrimario', 'hacinamiento'
];

function aggregatePoligono(polNum) {
    const todas = activeData().map((r, idx) => ({ ...r, idx })).filter((r) => r.poligono === polNum);
    const conDatos = todas.filter((r) => r.fuente !== 'SIN DATOS');

    const agg = {};
    AGG_SUM_FIELDS.forEach((f) => {
        const vals = conDatos.map((r) => r[f]).filter((v) => v !== null && v !== undefined);
        agg[f] = vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    });

    // Grado de escolaridad: promedio ponderado por poblacion (no se puede sumar)
    const escVals = conDatos.filter((r) => r.gradoEscolaridad !== null && r.pobTotal);
    agg.gradoEscolaridad = escVals.length
        ? Math.round(escVals.reduce((s, r) => s + r.gradoEscolaridad * r.pobTotal, 0) / escVals.reduce((s, r) => s + r.pobTotal, 0) * 10) / 10
        : null;

    // Piramide: suma bin a bin
    const conPiramide = conDatos.filter((r) => r.piramide);
    agg.piramide = conPiramide.length
        ? conPiramide[0].piramide.map((bin, i) => ({
            label: bin.label,
            f: conPiramide.reduce((s, r) => s + (r.piramide[i].f || 0), 0),
            m: conPiramide.reduce((s, r) => s + (r.piramide[i].m || 0), 0),
        }))
        : null;

    agg.region = todas.length ? todas[0].region : null;
    agg.municipio = todas.length ? todas[0].municipio : null;
    agg.poligono = polNum;
    agg.localidad = `Polígono ${polNum} — todas las localidades`;
    agg.pobTotLista = todas.reduce((s, r) => s + (r.pobTotLista || 0), 0);
    agg.latitud = null;
    agg.longitud = null;
    agg.fuente = 'AGREGADO';
    agg.nLocalidades = todas.length;
    agg.nConDatos = conDatos.length;
    agg.nSinDatos = todas.length - conDatos.length;
    agg.gmMarginacion = null;
    return agg;
}

function renderAggregateInfoCard(agg) {
    const grados = activeData()
        .filter((r) => r.poligono === agg.poligono && r.gmMarginacion)
        .reduce((acc, r) => { acc[r.gmMarginacion] = (acc[r.gmMarginacion] || 0) + 1; return acc; }, {});
    const gradosHtml = Object.entries(grados)
        .map(([g, n]) => `${esc(g)} (${n})`)
        .join(', ') || '—';

    return `<div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow border-t-4 border-primary">
        ${cardHeader('info', 'Información General')}
        <div class="space-y-1">
        <div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Municipio</span><span class="font-data-display text-data-display text-on-surface">${esc(agg.municipio)}</span></div>
        <div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Región</span><span class="font-data-display text-data-display text-on-surface">${esc(agg.region || '—')}</span></div>
        <div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Polígono</span><span class="font-data-display text-data-display text-on-surface">${esc(agg.poligono)}</span></div>
        <div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Localidades incluidas</span><span class="font-data-display text-data-display text-on-surface">${agg.nConDatos} de ${agg.nLocalidades}</span></div>
        <div class="data-row"><span class="font-body-md text-body-md text-on-surface-variant">Grados de Marginación</span><span class="font-data-display text-data-display text-on-surface text-right">${gradosHtml}</span></div>
        </div>
    </div>`;
}

function renderAggregate(polNum) {
    const agg = aggregatePoligono(polNum);

    const parts = [];
    parts.push(renderKpiStrip(agg));
    parts.push(`<div class="col-span-1 md:col-span-2 xl:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-gutter-grid items-start">`);
    parts.push(`<div class="flex flex-col gap-gutter-grid">` + renderAggregateInfoCard(agg) + renderLocalidadesCard(agg) + `</div>`);
    parts.push(`<div id="map-card" class="map-sticky bg-surface-container-lowest rounded-xl p-card-padding card-shadow border-t-4 border-secondary-container flex flex-col min-h-[400px]">
        ${mapCardHeader()}
        <div class="flex-1 rounded-lg overflow-hidden border border-outline-variant bg-surface-container-low relative" id="map-container"></div>
    </div>`);
    parts.push(`</div>`);

    if (agg.nSinDatos > 0) {
        parts.push(`<div class="col-span-1 md:col-span-2 xl:col-span-12">` + card(`
            <div class="flex items-center gap-3 text-on-surface-variant">
                <span class="material-symbols-outlined text-2xl text-warning">info</span>
                <p class="font-body-md text-body-md">
                    <b>${agg.nSinDatos} de ${agg.nLocalidades}</b> localidades de este polígono no tienen coincidencia en el Censo INEGI 2020 y
                    <b>no están incluidas</b> en los totales de abajo (suelen ser colonias/barrios dentro de una cabecera urbana). Revísalas en la lista de localidades.
                </p>
            </div>
        `) + `</div>`);
    }

    parts.push(renderDataCards(agg));

    canvas.innerHTML = parts.join('');
    renderMap(agg, 'overview');
    animateEntrances();
}

// ---------------------------------------------------------------------------
// Reporte institucional: documento formal (portada + secciones en tablas)
// para imprimir/exportar a PDF, separado del tablero interactivo. Se arma
// sobre lo que este visible en ese momento (localidad individual o agregado
// de poligono, via lastMapRec).
// ---------------------------------------------------------------------------
function reportRow(label, value, base, indent, formatter) {
    const v = formatter ? formatter(value) : fmtInt(value);
    const pctStr = base ? pctLabel(value, base) : '';
    return `<tr><td${indent ? ' class="indent"' : ''}>${esc(label)}</td><td class="num">${v}</td><td class="num">${esc(pctStr)}</td></tr>`;
}

function reportTable(rowsHtml) {
    return `<table class="report-table"><tbody>${rowsHtml}</tbody></table>`;
}

function reportFooter(fecha) {
    return `<div class="report-footer">
        <span>Fuente: INEGI, Censo de Población y Vivienda 2020 (ITER Morelos).</span>
        <span>Generado el ${esc(fecha)} — Dashboard TPBV 2026</span>
    </div>`;
}

function buildReportHTML(rec) {
    const isAgg = rec.fuente === 'AGREGADO';
    const fecha = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    const titulo = isAgg ? `Polígono ${rec.poligono} — Todas las localidades` : rec.localidad;

    let metaHtml = `
        <div>Localidad / Ámbito: <b>${esc(titulo)}</b></div>
        <div>Municipio: <b>${esc(rec.municipio)}</b></div>
        <div>Región: <b>${esc(rec.region || '—')}</b></div>
        <div>Polígono: <b>${esc(rec.poligono)}</b></div>`;
    metaHtml += isAgg
        ? `<div>Localidades incluidas: <b>${rec.nConDatos} de ${rec.nLocalidades}</b></div>`
        : `<div>Grado de Marginación: <b>${esc(rec.gmMarginacion || '—')}</b></div>`;
    metaHtml += `<div>Fecha de generación: <b>${esc(fecha)}</b></div>`;

    let html = `<div class="report-page">
        <div class="report-cover">
            <div class="report-logos">
                <img class="report-logo-gob" src="assets/logo-gobierno-morelos-print.svg" alt="Gobierno del Estado de Morelos" />
                <img class="report-logo-tpbv" src="assets/logo-tpbv.svg" alt="Territorios de Paz y Buen Vivir" />
            </div>
            <div class="report-eyebrow">Gobierno del Estado de Morelos &middot; Agencia de Transformación Digital</div>
            <h1>Reporte de Análisis Sociodemográfico</h1>
            <h2>Territorios de Paz y Buen Vivir 2026</h2>
            <div class="report-meta">${metaHtml}</div>
        </div>`;

    if (rec.fuente === 'SIN DATOS') {
        html += `<div class="report-warn-box">No se encontró una coincidencia confiable para <b>${esc(rec.localidad)}</b> en el Censo INEGI 2020 (ITER Morelos).
            No hay indicadores estadísticos disponibles para esta localidad. Población reportada en la Lista TPBV 2026: <b>${fmtInt(rec.pobTotLista)}</b>.</div>`;
        html += reportFooter(fecha) + `</div>`;
        return html;
    }

    if (isAgg && rec.nSinDatos > 0) {
        html += `<div class="report-warn-box"><b>${rec.nSinDatos} de ${rec.nLocalidades}</b> localidades de este polígono no tienen coincidencia en el Censo INEGI 2020
            y no están incluidas en los totales de este reporte.</div>`;
    }

    html += `<div class="report-section-title">Población</div>` + reportTable(
        reportRow('Población Total', rec.pobTotal, rec.pobTotal) +
        reportRow('Mujeres', rec.pobMujeres, rec.pobTotal) +
        reportRow('Hombres', rec.pobHombres, rec.pobTotal)
    );

    if (rec.piramide) {
        html += `<div class="report-section-title">Estructura de Población por Edad y Sexo</div>`;
        const rows = rec.piramide.slice().reverse().map((b) =>
            `<tr><td>${esc(b.label)} años</td><td class="num">${fmtInt(b.f)}</td><td class="num">${fmtInt(b.m)}</td><td class="num">${fmtInt((b.f || 0) + (b.m || 0))}</td></tr>`
        ).join('');
        html += `<table class="report-table"><thead><tr><th>Grupo de edad</th><th class="num">Mujeres</th><th class="num">Hombres</th><th class="num">Total</th></tr></thead><tbody>${rows}</tbody></table>`;
        if (rec.pob0a14 !== null && rec.pob65mas !== null && rec.pob15a64) {
            const razon = ((rec.pob0a14 + rec.pob65mas) / rec.pob15a64 * 100).toFixed(1);
            html += `<p class="report-note">Razón de dependencia demográfica: ${razon} personas dependientes (0-14 y 65+) por cada 100 en edad de trabajar (15-64: ${fmtInt(rec.pob15a64)}).</p>`;
        }
    }

    html += `<div class="report-two-col">
        <div><div class="report-section-title">Vivienda</div>` + reportTable(
            reportRow('Total Viviendas', rec.totalViviendas, rec.totalViviendas) +
            reportRow('Piso de Tierra', rec.pisoTierra, rec.totalViviendas) +
            reportRow('Un Solo Cuarto', rec.unSoloCuarto, rec.totalViviendas) +
            reportRow('Con Hacinamiento', rec.hacinamiento, rec.totalViviendas)
        ) + `</div>
        <div><div class="report-section-title">Discapacidad y Grupos Vulnerables</div>` + reportTable(
            reportRow('Pob. Afromexicana', rec.afromexicana) +
            reportRow('Con Discapacidad', rec.conDiscapacidad, null, true) +
            reportRow('Con Limitación', rec.conLimitacion, null, true) +
            reportRow('Con Problema o Condición Mental', rec.conProblemaMental, null, true)
        ) + `</div>
    </div>`;

    html += `<div class="report-two-col">
        <div><div class="report-section-title">Servicios de Salud</div>` + reportTable(
            reportRow('Total Afiliados', rec.afiliada, rec.pobTotal) +
            reportRow('Sin Afiliación', rec.sinAfiliacion, rec.pobTotal) +
            reportRow('Afiliados al IMSS', rec.imss, rec.pobTotal, true) +
            reportRow('Afiliados al ISSSTE', rec.issste, rec.pobTotal, true) +
            reportRow('Otros Servicios de Salud', rec.otrosSalud, rec.pobTotal, true)
        ) + `</div>
        <div><div class="report-section-title">Educación</div>` + reportTable(
            reportRow('Grado Promedio de Escolaridad', rec.gradoEscolaridad, null, false, (v) => v === null ? '—' : v.toFixed(1) + ' años') +
            reportRow('Analfabetas (15+)', rec.analfabetas) +
            reportRow('Sin Educación Básica Completa (15+)', rec.sinBasicaCompleta) +
            reportRow('Niñas/os 6-11 sin asistir a la escuela', rec.ninos6a11NoAsisten, null, true) +
            reportRow('Adolescentes 12-14 sin asistir a la escuela', rec.ninos12a14NoAsisten, null, true)
        ) + `</div>
    </div>`;

    html += `<div class="report-two-col">
        <div><div class="report-section-title">Población Indígena</div>` + reportTable(
            reportRow('Habla Lengua Indígena', rec.hablaLenguaIndigena, rec.pobTotal) +
            reportRow('Monolingüe (no habla español)', rec.indigenaMonolingue, rec.hablaLenguaIndigena, true) +
            reportRow('Hogares Censales Indígenas', rec.hogaresIndigenas)
        ) + `</div>
        <div><div class="report-section-title">Economía</div>` + reportTable(
            reportRow('Económicamente Activa (PEA)', rec.pea, rec.pobTotal) +
            reportRow('Ocupada', rec.ocupada, rec.pea, true) +
            reportRow('Desocupada', rec.desocupada, rec.pea, true) +
            reportRow('Ocupada en Sector Primario', rec.ocupadaPrimario, rec.ocupada, true)
        ) + `</div>
    </div>`;

    html += `<div class="report-two-col">
        <div><div class="report-section-title">Tecnologías de Información</div>` + reportTable(
            reportRow('Con Celular', rec.celular, rec.totalViviendas) +
            reportRow('Con Computadora', rec.computadora, rec.totalViviendas) +
            reportRow('Con Internet', rec.internet, rec.totalViviendas)
        ) + `</div>
        <div><div class="report-section-title">Bienes y Servicios en la Vivienda</div>` + reportTable(
            reportRow('Refrigerador', rec.refrigerador, rec.totalViviendas) +
            reportRow('Lavadora', rec.lavadora, rec.totalViviendas) +
            reportRow('Automóvil', rec.automovil, rec.totalViviendas) +
            reportRow('Agua Entubada', rec.aguaEntubada, rec.totalViviendas) +
            reportRow('Drenaje', rec.drenaje, rec.totalViviendas) +
            reportRow('Energía Eléctrica', rec.electricidad, rec.totalViviendas)
        ) + `</div>
    </div>`;

    html += reportFooter(fecha);
    html += `</div>`;
    return html;
}

function printReport() {
    if (!lastMapRec || lastMapRec.poligono === -1) {
        alert('Selecciona un polígono o una localidad antes de generar el reporte.');
        return;
    }
    const reportView = document.getElementById('report-view');
    reportView.innerHTML = buildReportHTML(lastMapRec);

    // Los logos de la portada no siempre estan precargados/cacheados (a
    // diferencia de los que ya se muestran en el sidebar/header): si se
    // llama a print() antes de que terminen de cargar, Chrome genera la
    // vista de impresion sin ellos. Se espera a que carguen (o fallen, con
    // un tope de 1.5s) antes de abrir el dialogo de impresion.
    const images = Array.from(reportView.querySelectorAll('img'));
    const whenReady = Promise.all(images.map((img) => img.complete
        ? Promise.resolve()
        : new Promise((resolve) => { img.addEventListener('load', resolve, { once: true }); img.addEventListener('error', resolve, { once: true }); })
    ));
    const timeout = new Promise((resolve) => setTimeout(resolve, 1500));

    Promise.race([whenReady, timeout]).then(() => window.print());
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------
function selectLocalidad(idx) {
    selPoligono.value = String(activeData()[idx].poligono);
    buildLocalidadOptions(selPoligono.value);
    selLocalidad.value = String(idx);
    render(idx, 'zoom');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

canvas.addEventListener('click', (e) => {
    const item = e.target.closest('.loc-item');
    if (item) selectLocalidad(parseInt(item.dataset.idx, 10));
});

// La lista de localidades vive dentro de <li> clicables (role="button"); sin
// esto, seleccionar una localidad hermana no seria posible desde el teclado.
canvas.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const item = e.target.closest('.loc-item');
    if (!item) return;
    e.preventDefault();
    selectLocalidad(parseInt(item.dataset.idx, 10));
});

// ---------------------------------------------------------------------------
// Menu lateral en movil/tablet (drawer fuera de pantalla via transform, ver
// #sidebar-nav en index.html). En escritorio (lg+) el nav queda siempre
// visible por CSS (lg:translate-x-0) y estos controles quedan ocultos.
// ---------------------------------------------------------------------------
function openNav() {
    const nav = $('#sidebar-nav');
    const backdrop = $('#nav-backdrop');
    const toggleBtn = $('#nav-toggle-btn');
    nav.classList.remove('-translate-x-full');
    backdrop.classList.remove('opacity-0', 'pointer-events-none');
    toggleBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    const firstFocusable = nav.querySelector('a, button');
    if (firstFocusable) firstFocusable.focus();
}

function closeNav() {
    const nav = $('#sidebar-nav');
    const backdrop = $('#nav-backdrop');
    const toggleBtn = $('#nav-toggle-btn');
    nav.classList.add('-translate-x-full');
    backdrop.classList.add('opacity-0', 'pointer-events-none');
    toggleBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    toggleBtn.focus();
}

function toggleNav() {
    const nav = $('#sidebar-nav');
    if (nav.classList.contains('-translate-x-full')) openNav(); else closeNav();
}

// ---------------------------------------------------------------------------
// Cambio entre las dos "vistas" del nav lateral: Analisis Demografico (el
// dashboard de siempre, con filtros + tarjetas) y Propuesta Territorial (el
// mapa de comparacion dedicado). No es un router real: solo oculta/muestra
// los contenedores correspondientes y actualiza el estado activo del nav.
// ---------------------------------------------------------------------------
const NAV_LINK_ACTIVE = 'flex items-center gap-3 p-3 bg-primary-container text-on-primary-container rounded-lg font-bold transition-all duration-300 font-body-md text-body-md';
const NAV_LINK_INACTIVE = 'flex items-center gap-3 p-3 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface rounded-lg transition-all duration-300 hover:translate-x-1 font-body-md text-body-md';

// Cada vista declara que contenedores le pertenecen (el resto se oculta) y
// que enlace del nav queda activo. La carga inicial de la pagina sigue
// aterrizando en 'analisis' (ver Init al final del archivo); 'inicio' solo
// se muestra si el usuario hace clic en el nav.
const VIEW_CONTAINERS = ['#inicio-view', '#hero-analisis', '#global-filters', '#canvas', '#propuesta-view'];
const VIEWS = {
    inicio: { shown: ['#inicio-view'], navId: 'nav-inicio' },
    analisis: { shown: ['#hero-analisis', '#global-filters', '#canvas'], navId: 'nav-analisis' },
    propuesta: { shown: ['#propuesta-view'], navId: 'nav-propuesta' }
};

function showView(view) {
    const target = VIEWS[view] || VIEWS.analisis;

    VIEW_CONTAINERS.forEach((sel) => {
        const el = $(sel);
        if (!el) return;
        el.classList.toggle('hidden', !target.shown.includes(sel));
    });

    Object.values(VIEWS).forEach(({ navId }) => {
        const link = $('#' + navId);
        if (!link) return;
        const isActive = navId === target.navId;
        link.className = isActive ? NAV_LINK_ACTIVE : NAV_LINK_INACTIVE;
        if (isActive) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });

    if (view === 'inicio') renderInicioView();
    if (view === 'propuesta') renderPropuestaView();
    if (view === 'analisis' && map) {
        // El mapa de Analisis Demografico pudo quedar con tamano 0 mientras
        // #canvas estaba oculto (display:none no tiene layout).
        setTimeout(() => map.invalidateSize(), 50);
    }
    if (window.innerWidth < 1024) closeNav();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------------------------------------------------------------------------
// Switch "Conjunto de datos" en Analisis Demografico: alterna entre
// TPBV_DATA (Propuesta Actual, 132 localidades / 26 poligonos vigentes) y
// TPBV_DATA_NUEVA (Nueva Propuesta Territorial, 162 localidades / 25
// poligonos), ver activeData()/activePoligonosGeoJSON() y DATASET_MODE. Al
// cambiar se reconstruyen los selects y se vuelve al estado "sin seleccion"
// en vez de intentar preservar la localidad elegida: los dos datasets no
// comparten indices ni, en general, las mismas localidades/poligonos.
// ---------------------------------------------------------------------------
const DATASET_BTN_ACTIVE = 'px-4 py-1.5 rounded-full font-label-bold text-label-bold transition-colors bg-primary text-on-primary';
const DATASET_BTN_INACTIVE = 'px-4 py-1.5 rounded-full font-label-bold text-label-bold transition-colors text-on-surface-variant hover:bg-surface-container-highest';

function updateDatasetToggleUI() {
    const btnActual = $('#btn-dataset-actual');
    const btnNueva = $('#btn-dataset-nueva');
    if (!btnActual || !btnNueva) return;
    const isNueva = DATASET_MODE === 'nueva';
    btnActual.className = isNueva ? DATASET_BTN_INACTIVE : DATASET_BTN_ACTIVE;
    btnActual.setAttribute('aria-pressed', String(!isNueva));
    btnNueva.className = isNueva ? DATASET_BTN_ACTIVE : DATASET_BTN_INACTIVE;
    btnNueva.setAttribute('aria-pressed', String(isNueva));
}

function setDatasetMode(mode) {
    if (DATASET_MODE === mode) return;
    DATASET_MODE = mode;
    updateDatasetToggleUI();
    buildPoligonoOptions();
    buildLocalidadOptions('all');
    selPoligono.value = 'all';
    selLocalidad.value = '';
    renderNoSelection();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const nav = $('#sidebar-nav');
    if (nav && !nav.classList.contains('-translate-x-full') && window.innerWidth < 1024) closeNav();
});

window.addEventListener('resize', () => {
    if (window.innerWidth < 1024) return;
    document.body.style.overflow = '';
    $('#nav-backdrop')?.classList.add('opacity-0', 'pointer-events-none');
    $('#nav-toggle-btn')?.setAttribute('aria-expanded', 'false');
});

// Toggle de la capa "Limites municipales": se aplica directo sobre el mapa
// actual (sin re-render completo) para no perder el zoom/paneo del usuario.
canvas.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'chk-municipios') {
        showMunicipios = e.target.checked;
        if (municipiosLayer && map) {
            if (showMunicipios) municipiosLayer.addTo(map);
            else map.removeLayer(municipiosLayer);
        }
    }
});

// Checkboxes de la vista "Propuesta Territorial": igual que chk-municipios,
// se aplican directo sobre propuestaMap sin re-renderizar la vista completa.
$('#propuesta-view').addEventListener('change', (e) => {
    if (e.target && e.target.id === 'chk-propuesta-actual') {
        showPropuestaActual = e.target.checked;
        if (propuestaActualLayer && propuestaMap) {
            if (showPropuestaActual) propuestaActualLayer.addTo(propuestaMap);
            else propuestaMap.removeLayer(propuestaActualLayer);
        }
    }
    if (e.target && e.target.id === 'chk-propuesta-nueva') {
        showPropuestaNueva = e.target.checked;
        if (propuestaNuevaLayer && propuestaMap) {
            if (showPropuestaNueva) propuestaNuevaLayer.addTo(propuestaMap);
            else propuestaMap.removeLayer(propuestaNuevaLayer);
        }
    }
    if (e.target && e.target.id === 'chk-municipios-propuesta') {
        showMunicipiosPropuesta = e.target.checked;
        if (municipiosLayerPropuesta && propuestaMap) {
            if (showMunicipiosPropuesta) municipiosLayerPropuesta.addTo(propuestaMap);
            else propuestaMap.removeLayer(municipiosLayerPropuesta);
        }
    }
    if (e.target && e.target.id === 'chk-nuevas-localidades') {
        showNuevasLocalidades = e.target.checked;
        if (nuevasLocalidadesLayer && propuestaMap) {
            if (showNuevasLocalidades) nuevasLocalidadesLayer.addTo(propuestaMap);
            else propuestaMap.removeLayer(nuevasLocalidadesLayer);
        }
    }
});

// Al cambiar el poligono se muestra la vista general (poligono + todas sus
// localidades); el zoom a una localidad especifica solo ocurre cuando el
// usuario la selecciona explicitamente (dropdown, lista lateral o popup).
// "Todos los Poligonos" no preselecciona ninguna localidad: se queda en un
// estado neutro hasta que el usuario elija un poligono o una localidad.
selPoligono.addEventListener('change', () => {
    buildLocalidadOptions(selPoligono.value);
    selLocalidad.value = '';
    if (selPoligono.value === 'all') {
        renderNoSelection();
    } else {
        renderAggregate(Number(selPoligono.value));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

selLocalidad.addEventListener('change', () => {
    if (!selLocalidad.value) return;
    selectLocalidad(parseInt(selLocalidad.value, 10));
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
updateDatasetToggleUI();
buildPoligonoOptions();
buildLocalidadOptions('all');
const initialIdx = activeData().findIndex((r) => r.localidad.includes('Tlaltetelco'));
selectLocalidad(initialIdx >= 0 ? initialIdx : 0);
