// ---------------------------------------------------------------------------
// Vista "Red La tierra que nos une": dependencias del Gobierno de Morelos con
// la red Wi-Fi pública de la ATDEM. Datos: TPBV_RED_LTQNU (red_ltqnu.js,
// generado por scripts/build_red_ltqnu.py; solo dependencias con red).
// Mapa sobre la base "solo Morelos" (mapa_morelos.js), un marcador por sede
// (varias dependencias comparten edificio, p. ej. Palacio de Gobierno).
// Se carga después de app.js; showView('red') llama a renderRedView().
// ---------------------------------------------------------------------------

const RED = (typeof TPBV_RED_LTQNU !== 'undefined') ? TPBV_RED_LTQNU : [];

let redViewBuilt = false;
let redMap = null;
let redMarcadores = null;
const redMarcadorPorSede = new Map();

const redClaveSede = (r) => `${r.lat},${r.lon}`;
const redPuntos = (n) => `${fmtInt(n)} ${n === 1 ? 'punto' : 'puntos'} de acceso`;
let redBase = null;

// Agrupa los registros por sede (coordenada) para el mapa.
function redSedes() {
    const sedes = new Map();
    RED.filter((r) => r.lat !== null).forEach((r) => {
        const k = redClaveSede(r);
        const s = sedes.get(k) || { lat: r.lat, lon: r.lon, direccion: r.direccion, registros: [] };
        if (!s.direccion && r.direccion) s.direccion = r.direccion;
        s.registros.push(r);
        sedes.set(k, s);
    });
    return [...sedes.values()];
}

function redResumen() {
    const dependencias = new Set(RED.map((r) => r.dependencia.toLowerCase()));
    const secretarias = new Set(RED.map((r) => r.secretaria.toLowerCase()));
    const puntos = RED.reduce((s, r) => s + (r.puntosAcceso || 0), 0);
    return { dependencias: dependencias.size, secretarias: secretarias.size, sedes: redSedes().length, puntos };
}

function redTarjetaInfo(icon, titulo, texto) {
    return `<div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow flex flex-col gap-3">
        <span class="w-12 h-12 shrink-0 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center">
            <span class="material-symbols-outlined text-[24px]" aria-hidden="true">${icon}</span>
        </span>
        <h3 class="font-headline-md text-headline-md text-on-surface">${esc(titulo)}</h3>
        <div class="font-body-md text-body-md text-on-surface-variant">${texto}</div>
    </div>`;
}

function redPopupHtml(sede) {
    const filas = sede.registros.map((r) => `
        <div class="dato"><span class="material-symbols-outlined">wifi</span><span><b style="color:#2E3B2B">${esc(r.dependencia)}</b>${r.puntosAcceso ? ` · ${redPuntos(r.puntosAcceso)}` : ''}</span></div>`).join('');
    const titulo = sede.registros.length > 1 ? `${sede.registros.length} dependencias en esta sede` : esc(sede.registros[0].secretaria);
    return `<div class="cab"><div class="nom">${sede.direccion ? esc(sede.direccion) : 'Sede de dependencia estatal'}</div><div class="sub">${titulo}</div></div>
        <div class="cuerpo">${filas}</div>`;
}

function redVistaHtml() {
    const r = redResumen();
    return `
    <div class="flex flex-col gap-4 max-w-5xl">
        <span class="font-label-bold text-label-bold uppercase tracking-wider text-secondary">Conectividad pública · Agencia de Transformación Digital</span>
        <h2 class="font-headline-xl text-headline-xl text-primary">Red La tierra que nos une</h2>
        <p class="font-body-lg text-body-lg text-on-surface-variant">
            Red de Wi-Fi pública, gratuita y abierta impulsada por la Agencia de Transformación Digital del Gobierno del Estado de
            Morelos (ATDEM). Busca reducir la brecha digital y que la ciudadanía pueda comunicarse sin costo, consultar la programación
            cultural, realizar trámites y acceder a las plataformas digitales institucionales.
        </p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-gutter-grid">
        ${redTarjetaInfo('wifi', 'Internet gratuito y abierto', 'Conexión Wi-Fi sin costo para la ciudadanía en espacios públicos y oficinas de gobierno.')}
        ${redTarjetaInfo('diversity_3', 'Reducir la brecha digital', 'Comunicarse sin costo, consultar programación cultural y realizar trámites en plataformas digitales institucionales.')}
        ${redTarjetaInfo('location_on', 'Puntos de conexión', `<ul class="list-disc pl-5 space-y-1">
            <li>Plazas públicas y espacios de alta concurrencia, como la Plaza de Armas Emiliano Zapata (Zócalo de Cuernavaca).</li>
            <li>Eventos especiales, como el Festival Internacional Cervantino en Cuernavaca.</li>
            <li>Dependencias estatales, ayudantías municipales y escuelas.</li>
        </ul>`)}
    </div>
    <h3 class="font-headline-lg text-headline-lg text-on-surface pt-2" style="font-size:28px;line-height:34px">Dependencias con red</h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-gutter-grid">
        ${kpiCount('apartment', 'Dependencias con red', r.dependencias, 'primary')}
        ${kpiCount('account_balance', 'Secretarías y órganos', r.secretarias, 'teal')}
        ${kpiCount('location_on', 'Sedes conectadas', r.sedes, 'blue')}
        ${kpiCount('router', 'Puntos de acceso', r.puntos, 'warning')}
    </div>
    <div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow flex flex-col">
        <div class="flex items-center justify-between gap-3 mb-stack-md pb-3 border-b-2 border-outline-variant flex-wrap">
            <div class="flex items-center gap-2.5">${iconChip('wifi')}<h2 class="font-headline-md text-headline-md text-on-surface">Mapa de la red</h2></div>
            <span class="flex items-center gap-1.5 font-body-md text-body-md text-on-surface-variant">
                <span class="inline-block rounded-full" style="width:12px;height:12px;background:#773357;border:2px solid #fff;box-shadow:0 0 0 1px #773357"></span>Sede con red (el tamaño indica cuántas dependencias)
            </span>
        </div>
        <div class="overflow-hidden relative w-full mx-auto" style="max-width:900px;aspect-ratio:1/0.8;max-height:75vh;min-height:340px;border-radius:16px;border:1px solid #CBCABE">
            <div id="red-map" style="position:absolute;inset:0"></div>
        </div>
    </div>
    ${card(`
        <div class="flex items-center justify-between gap-2 mb-stack-md pb-3 border-b-2 border-outline-variant">
            <div class="flex items-center gap-2.5">${iconChip('list')}<h2 class="font-headline-md text-headline-md text-on-surface">Dependencias por secretaría</h2></div>
            <span class="font-label-bold text-label-bold bg-surface-container-high text-on-surface-variant rounded-full px-2.5 py-0.5">${RED.length}</span>
        </div>
        <div id="red-lista"></div>`)}
    <p class="font-body-md text-body-md text-on-surface-variant">
        Fuente: ATDEM, "Agentes_dependencias La Tierra Que Nos Une" (dependencias con red La tierra que nos une). Puntos de acceso
        según el registro de la ATDEM; algunas dependencias no tienen el dato capturado.
    </p>`;
}

function redListaHtml() {
    const porSecretaria = new Map();
    RED.forEach((r) => {
        const lista = porSecretaria.get(r.secretaria) || [];
        lista.push(r);
        porSecretaria.set(r.secretaria, lista);
    });
    return [...porSecretaria.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([secretaria, lista]) => `
        <div class="py-3 border-b border-outline-variant last:border-b-0">
            <p class="font-label-bold text-label-bold uppercase tracking-wider text-secondary mb-2">${esc(secretaria)}</p>
            <ul class="flex flex-col gap-1.5">
                ${lista.map((r) => `
                <li class="flex items-start justify-between gap-4 ${r.lat !== null ? 'cursor-pointer hover:bg-surface-container-low rounded-lg' : ''} px-2 py-1.5" ${r.lat !== null ? `data-red-sede="${redClaveSede(r)}" tabindex="0" role="button" aria-label="Ver ${esc(r.dependencia)} en el mapa"` : ''}>
                    <span class="min-w-0">
                        <span class="font-body-md text-body-md text-on-surface font-semibold">${esc(r.dependencia)}</span>
                        ${r.direccion ? `<span class="block font-body-md text-body-md text-on-surface-variant">${esc(r.direccion)}</span>` : ''}
                    </span>
                    <span class="shrink-0 font-body-md text-body-md text-on-surface-variant whitespace-nowrap">${r.puntosAcceso ? redPuntos(r.puntosAcceso) : ''}</span>
                </li>`).join('')}
            </ul>
        </div>`).join('');
}

function dibujarRedMarcadores() {
    redMarcadores = L.featureGroup().addTo(redMap);
    redSedes().forEach((s) => {
        const n = s.registros.length;
        const radio = 7 + Math.sqrt(n) * 3.2;
        const base = { radius: radio, color: '#ffffff', weight: 2, fillColor: '#773357', fillOpacity: 0.92 };
        const m = L.circleMarker([s.lat, s.lon], base)
            .bindPopup(redPopupHtml(s), { className: 'atd-popup', maxWidth: 320 })
            .bindTooltip(n > 1 ? `${n} dependencias` : esc(s.registros[0].dependencia), { direction: 'top', offset: [0, -radio], className: 'atd-tooltip' })
            .addTo(redMarcadores);
        m.on('mouseover', () => m.setStyle({ color: '#BC9B73', weight: 3 }));
        m.on('mouseout', () => { if (!m.isPopupOpen()) m.setStyle(base); });
        m.on('popupclose', () => m.setStyle(base));
        redMarcadorPorSede.set(`${s.lat},${s.lon}`, m);
    });
}

function renderRedView() {
    if (!redViewBuilt) {
        $('#red-view').innerHTML = redVistaHtml();
        $('#red-lista').innerHTML = redListaHtml();
        redViewBuilt = true;
        animateEntrances($('#red-view'));
    }
    if (!redMap) {
        redMap = crearMapaMorelos('red-map');
        // Todas las sedes estan en Cuernavaca: el municipio va resaltado y es
        // el encuadre inicial (encuadrar solo los puntos dejaba un mapa
        // demasiado cercano y sin referencia).
        redBase = agregarBaseMorelos(redMap, {
            estilo: (f) => (normMunicipio(f.properties.NOMGEO) === 'cuernavaca' ? { ...MUNICIPIO_BASE, fillColor: TINTE_VERDE } : MUNICIPIO_BASE)
        });
        dibujarRedMarcadores();
    }
    // El contenedor estaba oculto hasta este momento (ver renderAulasView).
    setTimeout(() => {
        if (!redMap) return;
        redMap.invalidateSize();
        if (!redMap._encuadrado && redMarcadores.getLayers().length) {
            const cuernavaca = redBase && redBase.municipios
                ? redBase.municipios.getLayers().find((l) => normMunicipio(l.feature.properties.NOMGEO) === 'cuernavaca') : null;
            const limites = cuernavaca ? cuernavaca.getBounds().extend(redMarcadores.getBounds()) : redMarcadores.getBounds();
            redMap.fitBounds(limites, { padding: [24, 24] });
            redMap._encuadrado = true;
        }
    }, 150);
}

function enfocarSedeRed(clave) {
    const m = redMarcadorPorSede.get(clave);
    if (!m || !redMap) return;
    $('#red-map').scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'center' });
    redMap.setView(m.getLatLng(), 14);
    m.openPopup();
}

$('#red-view').addEventListener('click', (e) => {
    const item = e.target.closest('[data-red-sede]');
    if (item) enfocarSedeRed(item.dataset.redSede);
});
$('#red-view').addEventListener('keydown', (e) => {
    const item = e.target.closest && e.target.closest('[data-red-sede]');
    if (item && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); enfocarSedeRed(item.dataset.redSede); }
});
