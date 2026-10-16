// ---------------------------------------------------------------------------
// Sección de Inicio "Segundo Encuentro Estatal de Consejos Comunitarios" con
// carrusel de fotos (carrusel.js). Textos y cifras tomados de la nota oficial
// (Prensa, morelos.gob.mx, 10/10/2026); fotos de esa misma nota (Gobierno del
// Estado de Morelos), copiadas a dashboard/assets/encuentro/.
// Se carga ANTES de app.js; renderInicioView() inserta el HTML y llama a
// iniciarCarrusel('carrusel-encuentro').
// ---------------------------------------------------------------------------

const ENCUENTRO_NOTA_URL = 'https://www.morelos.gob.mx/ultimas-noticias/consolida-margarita-gonzalez-saravia-territorios-de-paz-y-buen-vivir-en-132-comunidades-de-morelos';
const ENCUENTRO_FOTOS = [
    ['encuentro-01.jpg', 'Segundo Encuentro Estatal de Consejos Comunitarios en el Centro de Convenciones Morelos, Xochitepec.'],
    ['encuentro-02.jpg', 'Mesa principal del encuentro, con más de mil representantes comunitarios.'],
    ['encuentro-03.jpg', 'Representantes de las comunidades durante el encuentro.'],
    ['encuentro-04.jpg', 'Consejeras y consejeros comunitarios de Territorios de Paz y Buen Vivir.'],
    ['encuentro-05.jpg', 'Participantes del encuentro.'],
    ['encuentro-06.jpg', 'Las comunidades en el centro de las decisiones.'],
    ['encuentro-07.jpg', 'Promotoras y promotores que acompañan a las comunidades.'],
];

// Cifra destacada (Karol SemiBold) con su texto; también la usa Aulas.
function cifraDestacada(valor, texto) {
    return `<div><p class="font-kpi-value text-kpi-value text-primary-container leading-none">${valor}</p>
        <p class="font-body-md text-body-md text-on-surface-variant mt-1">${texto}</p></div>`;
}

// Enlace a la nota de Prensa de la que salen textos y fotos.
function enlaceNota(url) {
    return `<a href="${url}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 font-body-md text-body-md text-primary-container underline underline-offset-2 w-fit">
        Leer la nota completa <span class="material-symbols-outlined text-[18px]" aria-hidden="true">north_east</span></a>`;
}

function inicioEncuentroHtml() {
    return `
    <section class="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center rounded-3xl p-6 md:p-10 border border-outline-variant bg-surface-container-lowest" aria-labelledby="encuentro-titulo">
        <div class="lg:col-span-2 flex flex-col gap-4">
            <span class="font-label-bold text-label-bold uppercase tracking-wider text-secondary">10 de octubre de 2026 · Xochitepec</span>
            <h2 id="encuentro-titulo" class="font-headline-lg text-headline-lg text-on-surface" style="font-size:30px;line-height:36px">Segundo Encuentro Estatal de Consejos Comunitarios</h2>
            <p class="font-body-lg text-body-lg text-on-surface-variant">
                Más de mil representantes de las comunidades se reunieron con la gobernadora Margarita González Saravia
                para fortalecer la organización comunitaria, que coloca a las comunidades en el centro de las decisiones.
            </p>
            <div class="grid grid-cols-3 gap-4 py-2">
                ${cifraDestacada('132', 'comunidades (eran 103 al inicio)')}
                ${cifraDestacada('148', 'millones de pesos de inversión interinstitucional')}
                ${cifraDestacada('+1,000', 'representantes comunitarios')}
            </div>
            ${enlaceNota(ENCUENTRO_NOTA_URL)}
        </div>
        <div class="lg:col-span-3 flex flex-col gap-2">
            ${carruselHtml({ id: 'carrusel-encuentro', etiqueta: 'Fotos del Segundo Encuentro Estatal', carpeta: 'encuentro', fotos: ENCUENTRO_FOTOS })}
            <p class="font-label-bold text-label-bold text-on-surface-variant">Fotos: Gobierno del Estado de Morelos</p>
        </div>
    </section>`;
}
