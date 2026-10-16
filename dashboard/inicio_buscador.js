// ---------------------------------------------------------------------------
// Buscador ciudadano de Inicio: "¿Tu comunidad está en el programa?".
// Pensado para quien no conoce el tablero: escribe su localidad (o su
// municipio) y obtiene una respuesta directa, con acceso a los datos de la
// comunidad en Análisis Demográfico.
//   - Coincidencia por localidad: lista de comunidades con su polígono.
//   - Coincidencia por municipio: cuántas comunidades tiene y cuáles.
//   - Municipio de Morelos sin comunidades: lo dice explícitamente.
// Se carga ANTES de app.js (Inicio se pinta al arrancar); usa helpers de
// app.js (esc, normalizeSearch, poligonoLabel, selectLocalidad, showView)
// solo al ejecutarse. renderInicioView() inserta el HTML y llama a
// iniciarBuscadorComunidad().
// ---------------------------------------------------------------------------

const BUSCADOR_MIN_CARACTERES = 3;
const BUSCADOR_MAX_RESULTADOS = 6;

function buscadorComunidadHtml() {
    return `
    <section class="rounded-3xl p-6 md:p-10 border border-outline-variant bg-surface-container-lowest flex flex-col gap-5" aria-labelledby="buscador-comunidad-titulo">
        <div class="flex flex-col gap-2 max-w-3xl">
            <h2 id="buscador-comunidad-titulo" class="font-headline-lg text-headline-lg text-on-surface" style="font-size:30px;line-height:36px">¿Tu comunidad está en el programa?</h2>
            <p class="font-body-lg text-body-lg text-on-surface-variant">Escribe el nombre de tu localidad, colonia o municipio.</p>
        </div>
        <form id="buscador-comunidad" role="search" class="flex flex-col sm:flex-row gap-3 max-w-3xl" onsubmit="return false;">
            <label for="buscador-comunidad-input" class="sr-only">Nombre de tu localidad, colonia o municipio</label>
            <div class="relative flex-1">
                <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" aria-hidden="true">search</span>
                <input id="buscador-comunidad-input" type="search" autocomplete="off" placeholder="Por ejemplo: Tetela del Volcán"
                    class="w-full rounded-full border border-outline bg-surface pl-12 pr-5 py-3 font-body-lg text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary">
            </div>
        </form>
        <div id="buscador-comunidad-resultado" aria-live="polite" class="max-w-3xl"></div>
    </section>`;
}

function buscadorComunidadFila(r) {
    return `
    <li class="flex flex-col sm:flex-row sm:items-center gap-3 justify-between py-3 border-b border-outline-variant last:border-b-0">
        <div>
            <p class="font-headline-md text-headline-md text-on-surface">${esc(r.localidad)}</p>
            <p class="font-body-md text-body-md text-on-surface-variant">${esc(r.municipio)} · Polígono ${esc(poligonoLabel(r.poligono))}</p>
        </div>
        <button type="button" data-ver-comunidad="${r.idx}"
            class="shrink-0 border border-outline text-on-surface px-5 py-2 rounded-full font-body-md text-body-md inline-flex items-center gap-2 hover:bg-surface-container-high transition-colors">
            Ver sus datos <span class="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
        </button>
    </li>`;
}

function buscadorComunidadLista(registros) {
    const visibles = registros.slice(0, BUSCADOR_MAX_RESULTADOS);
    const resto = registros.length - visibles.length;
    return `<ul class="mt-2">${visibles.map(buscadorComunidadFila).join('')}</ul>` +
        (resto > 0 ? `<p class="font-body-md text-body-md text-on-surface-variant mt-2">Y ${resto} ${resto === 1 ? 'comunidad más' : 'comunidades más'}. Escribe más letras para afinar la búsqueda.</p>` : '');
}

function buscadorMensaje(icono, color, texto) {
    return `<p class="font-headline-sm text-headline-sm text-on-surface inline-flex items-start gap-2">
        <span class="material-symbols-outlined ${color} mt-0.5" aria-hidden="true">${icono}</span><span>${texto}</span></p>`;
}

function buscadorMunicipiosMorelos() {
    if (typeof TPBV_LIMITES_MUNICIPALES === 'undefined') return [];
    return [...new Set(TPBV_LIMITES_MUNICIPALES.features.map((f) => f.properties.NOMGEO))];
}

function buscadorComunidadResultado(texto) {
    const q = normalizeSearch(texto);
    if (q.length < BUSCADOR_MIN_CARACTERES) return '';
    const datos = TPBV_DATA.map((r, idx) => ({ ...r, idx }));

    const porLocalidad = datos.filter((r) => normalizeSearch(r.localidad).includes(q));
    if (porLocalidad.length) {
        const n = porLocalidad.length;
        return buscadorMensaje('check_circle', 'text-primary',
            n === 1 ? 'Sí, esta comunidad está en el programa.' : `Encontramos ${n} comunidades del programa con ese nombre.`) +
            buscadorComunidadLista(porLocalidad);
    }

    const porMunicipio = datos.filter((r) => normalizeSearch(r.municipio).includes(q));
    if (porMunicipio.length) {
        const municipio = porMunicipio[0].municipio;
        const n = porMunicipio.length;
        return buscadorMensaje('check_circle', 'text-primary',
            `${esc(municipio)} tiene ${n} ${n === 1 ? 'comunidad' : 'comunidades'} en el programa.`) +
            buscadorComunidadLista(porMunicipio);
    }

    const municipioSinComunidades = buscadorMunicipiosMorelos().find((m) => normalizeSearch(m).includes(q));
    if (municipioSinComunidades) {
        return buscadorMensaje('info', 'text-secondary',
            `${esc(municipioSinComunidades)} no tiene comunidades en la delimitación vigente del programa.`);
    }
    return buscadorMensaje('search_off', 'text-secondary',
        `No encontramos «${esc(texto.trim())}» entre las ${TPBV_DATA.length} comunidades del programa. Revisa cómo está escrito o busca por municipio.`);
}

function verComunidad(idx) {
    showView('analisis');
    selectLocalidad(idx);
}

function iniciarBuscadorComunidad() {
    const input = document.getElementById('buscador-comunidad-input');
    const salida = document.getElementById('buscador-comunidad-resultado');
    if (!input || !salida) return;
    input.addEventListener('input', () => { salida.innerHTML = buscadorComunidadResultado(input.value); });
    salida.addEventListener('click', (e) => {
        const boton = e.target.closest('[data-ver-comunidad]');
        if (boton) verComunidad(parseInt(boton.dataset.verComunidad, 10));
    });
}
