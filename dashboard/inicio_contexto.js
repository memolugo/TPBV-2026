// ---------------------------------------------------------------------------
// Contenido de la landing (vista Inicio): presentación del programa, cita de
// la Gobernadora, cómo funciona, cifras e hitos. Estilo digital.morelos.gob.mx.
// Fuentes (textos tomados de los boletines oficiales, sin parafrasear cifras):
//   - Boletín 01831 (DGCS, Cuernavaca, 28/04/2025): presentación del programa,
//     cita de la Gobernadora, 103 comunidades y 20 promotores en la primera
//     etapa, diagnóstico de la Jefatura de la Oficina de la Gubernatura.
//   - Boletín 06206 (30/04/2026): aulas de cómputo de ATDEM.
//   - Cifras vigentes: datos embebidos del tablero (TPBV_DATA, ...).
// Solo arma HTML; lo usa renderInicioView() en app.js. Se carga ANTES de
// app.js (app.js muestra Inicio al arrancar), pero sus funciones usan helpers
// de app.js (esc, fmtInt, card...) solo al ejecutarse.
// ---------------------------------------------------------------------------

// Fecha de corte de los datos del tablero (AAAA-MM-DD). ACTUALIZAR cada vez
// que se regeneren los datos (scripts/build_*.py). Se muestra en el héroe de
// Inicio y en el pie de página ([data-fecha-datos]).
const TPBV_FECHA_DATOS = '2026-10-16';

function fechaDatosLarga() {
    // UTC para que '2026-10-16' no se recorra al 15 por la zona horaria.
    return new Date(`${TPBV_FECHA_DATOS}T12:00:00Z`)
        .toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// El pie de página es del shell (ya existe al cargar este bloque).
document.querySelectorAll('[data-fecha-datos]').forEach((el) => {
    el.textContent = `Datos actualizados al ${fechaDatosLarga()}.`;
});

const TPBV_BOLETIN_URL = 'https://www.morelos.gob.mx/ultimas-noticias/territorios-de-paz-y-buen-vivir-es-el-programa-social-mas-importante-del-sexenio-margarita-gonzalez-saravia';

function inicioLogoTpbvSrc() {
    // El logo ya viene incrustado en el encabezado (data URI, ver
    // scripts/embed_dashboard.py): se reutiliza en vez de pedir el archivo.
    const img = document.querySelector('header img[data-recurso="assets/logo-tpbv.svg"]');
    return img ? img.src : 'assets/logo-tpbv.svg';
}

function inicioHeroHtml() {
    return `
    <section class="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center w-full py-10 px-6 md:px-12 rounded-3xl bg-surface-container-low">
        <div class="lg:col-span-3 flex flex-col gap-5">
            <span class="font-label-bold text-label-bold uppercase tracking-wider text-secondary">Gobierno del Estado de Morelos · La tierra que nos une</span>
            <h1 class="font-headline-xl text-headline-xl text-primary">Territorios de Paz y Buen Vivir</h1>
            <p class="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
                El programa social más importante del sexenio. Su propósito es terminar con el rezago social y garantizar
                que todas las personas cuenten con oportunidades reales para su desarrollo, llevando la acción coordinada
                del Gobierno de Morelos a las comunidades que más lo necesitan.
            </p>
            <p class="font-body-md text-body-md text-on-surface-variant max-w-2xl">
                Este tablero, de la Agencia de Transformación Digital, reúne la información sociodemográfica y territorial
                del programa para apoyar su planeación y seguimiento.
            </p>
            <div class="flex flex-wrap gap-3 pt-1">
                <button onclick="showView('analisis')" class="bg-primary-container text-on-primary-container px-6 py-3 rounded-full font-headline-md text-headline-md inline-flex items-center gap-2">
                    <span class="material-symbols-outlined" aria-hidden="true">analytics</span> Explorar el análisis
                </button>
                <button onclick="showView('datos')" class="border border-outline text-on-surface px-6 py-3 rounded-full font-headline-md text-headline-md inline-flex items-center gap-2 hover:bg-surface-container-high transition-colors">
                    <span class="material-symbols-outlined" aria-hidden="true">database</span> Datos abiertos
                </button>
            </div>
            <p class="font-body-md text-body-md text-on-surface-variant inline-flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px] text-secondary" aria-hidden="true">update</span>
                <span>Datos actualizados al ${fechaDatosLarga()} · Fuentes: INEGI (Censo 2020), CONAPO y ATDEM</span>
            </p>
        </div>
        <div class="lg:col-span-2 flex justify-center">
            <div class="w-56 h-56 md:w-72 md:h-72 rounded-full bg-surface-container-lowest border border-outline-variant flex items-center justify-center p-8">
                <img src="${inicioLogoTpbvSrc()}" alt="Territorios de Paz y Buen Vivir" class="w-full h-full object-contain" />
            </div>
        </div>
    </section>`;
}

function inicioCitaHtml() {
    return `
    <figure class="rounded-3xl p-8 md:p-12 bg-secondary-container/50 border border-outline-variant flex flex-col gap-5">
        <span class="material-symbols-outlined text-[48px]" style="color:#BC9B73" aria-hidden="true">format_quote</span>
        <blockquote class="font-headline-lg text-on-surface max-w-5xl" style="font-size:clamp(24px,2.8vw,36px);line-height:1.22;font-weight:300">
            Este es el programa social más importante para nosotros en estos seis años. Yo, como titular del Ejecutivo,
            quiero hacer una transformación en el estado, y los necesito a todos ustedes.
        </blockquote>
        <figcaption class="font-body-md text-body-md text-on-surface-variant">
            <b class="text-on-surface">Margarita González Saravia</b>, Gobernadora del Estado de Morelos, durante la presentación del programa.
            <a href="${TPBV_BOLETIN_URL}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 font-label-bold text-label-bold text-primary-container underline underline-offset-2 ml-1">Boletín 01831 <span class="material-symbols-outlined text-[16px]" aria-hidden="true">north_east</span></a>
        </figcaption>
    </figure>`;
}

function inicioPilar(icon, titulo, texto) {
    return `<div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow flex flex-col gap-3">
        <span class="w-12 h-12 shrink-0 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center">
            <span class="material-symbols-outlined text-[24px]" aria-hidden="true">${icon}</span>
        </span>
        <h3 class="font-headline-md text-headline-md text-on-surface">${esc(titulo)}</h3>
        <p class="font-body-md text-body-md text-on-surface-variant">${texto}</p>
    </div>`;
}

function inicioComoFuncionaHtml() {
    return `
    <div>
        <h2 class="font-headline-lg text-headline-lg text-on-surface mb-4" style="font-size:30px;line-height:36px">¿Cómo funciona?</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-gutter-grid">
            ${inicioPilar('travel_explore', 'Diagnóstico territorial', 'Las comunidades se identifican mediante un diagnóstico realizado por la Jefatura de la Oficina de la Gubernatura, que define los polígonos de atención.')}
            ${inicioPilar('diversity_3', 'Promotores comunitarios', 'Promotores capacitados visitan a la población para escuchar y conocer a detalle sus necesidades básicas.')}
            ${inicioPilar('handshake', 'Acción coordinada', 'Cada secretaría y organismo del Poder Ejecutivo lleva a cabo acciones coordinadas para fortalecer proyectos de mejora en las localidades.')}
            ${inicioPilar('volunteer_activism', 'Equidad y dignidad', 'El objetivo es construir una sociedad más equitativa y justa, donde todas las personas puedan vivir con dignidad.')}
        </div>
    </div>`;
}

function inicioHitosHtml(nLocalidades, nPoligonos) {
    const nAulas = (typeof TPBV_AULAS_TECNOLOGICAS !== 'undefined') ? TPBV_AULAS_TECNOLOGICAS.length : 0;
    const hitos = [
        ['28 de abril de 2025', 'Presentación del programa', 'Arranca la primera etapa con 103 comunidades y 20 promotores comunitarios capacitados.'],
        ['Diciembre 2025 – enero 2026', 'Aulas Tecnológicas', `La ATDEM instala aulas de cómputo en ${fmtInt(nAulas)} escuelas de los polígonos.`],
        ['2026', 'Delimitación vigente', `${fmtInt(nLocalidades)} localidades en ${fmtInt(nPoligonos)} polígonos de atención, que se analizan en este tablero.`],
    ];
    return `
    <div>
        <h2 class="font-headline-lg text-headline-lg text-on-surface mb-4" style="font-size:30px;line-height:36px">Hitos</h2>
        <ol class="grid grid-cols-1 md:grid-cols-3 gap-gutter-grid">
            ${hitos.map(([fecha, titulo, texto]) => `
            <li class="relative bg-surface-container-lowest rounded-xl p-card-padding card-shadow flex flex-col gap-2" style="border-top:4px solid #BC9B73">
                <span class="font-label-bold text-label-bold uppercase tracking-wider text-secondary">${esc(fecha)}</span>
                <h3 class="font-headline-md text-headline-md text-on-surface">${esc(titulo)}</h3>
                <p class="font-body-md text-body-md text-on-surface-variant">${esc(texto)}</p>
            </li>`).join('')}
        </ol>
    </div>`;
}

function inicioCifrasHtml(nLocalidades, nPoligonos, poblacion) {
    const municipios = new Set(TPBV_DATA.map((r) => r.municipio)).size;
    const nAulas = (typeof TPBV_AULAS_TECNOLOGICAS !== 'undefined') ? TPBV_AULAS_TECNOLOGICAS.length : 0;
    const nProyectos = (typeof TPBV_BANCO_PROYECTOS !== 'undefined') ? TPBV_BANCO_PROYECTOS.length : 0;
    return `
    <div>
        <h2 class="font-headline-lg text-headline-lg text-on-surface mb-4" style="font-size:30px;line-height:36px">El programa en cifras</h2>
        <div class="grid grid-cols-2 lg:grid-cols-3 ${nProyectos ? 'xl:grid-cols-6' : 'xl:grid-cols-5'} gap-gutter-grid">
            ${[['location_on', nLocalidades, 'Localidades'], ['map', nPoligonos, 'Polígonos'], ['location_city', municipios, 'Municipios'],
               ['groups', poblacion, 'Habitantes'], ['school', nAulas, 'Escuelas con aula'], ['inventory_2', nProyectos, 'Proyectos registrados']]
            // Sin datos (p. ej. Banco de Proyectos retirado) la cifra no se muestra.
            .filter(([, valor]) => valor)
            .map(([icon, valor, etiqueta]) => `
            <div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow flex flex-col gap-2">
                <span class="material-symbols-outlined text-secondary" aria-hidden="true">${icon}</span>
                <p class="font-kpi-value text-kpi-value text-primary leading-none kpi-value" data-target="${valor || 0}">0</p>
                <p class="font-label-bold text-label-bold text-on-surface-variant">${esc(etiqueta)}</p>
            </div>`).join('')}
        </div>
    </div>`;
}
