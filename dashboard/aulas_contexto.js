// ---------------------------------------------------------------------------
// Contexto de "Aulas Tecnológicas": presentación del programa, qué incluye
// cada aula, cita oficial y escuelas por nivel. Estilo digital.morelos.gob.mx
// (tarjetas con icono en círculo mora claro, titulares Karol Sans).
// Fuentes:
//   - Boletín 06206 (DGCS, Cuernavaca, 30/04/2026): propósito, dependencias
//     y cita textual. Ese boletín reportaba 42 aulas; hoy son 45 escuelas
//     (TPBV_AULAS_TECNOLOGICAS).
//   - "Proyecto Escuelas entrega Computadoras.xlsx": cifras por escuela y
//     totales de mobiliario (TPBV_AULAS_MOBILIARIO).
// Solo arma HTML; lo usa aulasVistaHtml() en aulas_view.js (que define AULAS).
// ---------------------------------------------------------------------------

const AULAS_BOLETIN_URL = 'https://www.morelos.gob.mx/ultimas-noticias/equipa-atdem-a-42-escuelas-con-aulas-de-computo-para-fortalecer-el-aprendizaje-de-la-ninez-en-la-tierra-que-nos-une';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "Lunes 1 de diciembre de 2025" -> Date (null si no se reconoce).
function aulasParseFecha(texto) {
    const m = String(texto || '').toLowerCase().match(/(\d{1,2}) de ([a-záéíóú]+) de (\d{4})/);
    if (!m) return null;
    const mes = MESES.indexOf(m[2]);
    return mes < 0 ? null : new Date(Number(m[3]), mes, Number(m[1]));
}

function aulasPeriodoInstalacion() {
    const fechas = AULAS.map((a) => aulasParseFecha(a.fechaInstalacion)).filter(Boolean).sort((x, y) => x - y);
    if (!fechas.length) return '';
    const fmt = (d) => `${MESES[d.getMonth()]} ${d.getFullYear()}`;
    const ini = fmt(fechas[0]);
    const fin = fmt(fechas[fechas.length - 1]);
    return ini === fin ? ini : `${ini} a ${fin}`;
}

function aulasIconoCirculo(icon) {
    return `<span class="w-12 h-12 shrink-0 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center">
        <span class="material-symbols-outlined text-[24px]">${icon}</span>
    </span>`;
}

function aulasTarjetaIncluye(icon, titulo, texto) {
    return `<div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow flex flex-col gap-3">
        ${aulasIconoCirculo(icon)}
        <h3 class="font-headline-md text-headline-md text-on-surface">${esc(titulo)}</h3>
        <p class="font-body-md text-body-md text-on-surface-variant">${texto}</p>
    </div>`;
}

function aulasIncluyeHtml() {
    const computadoras = AULAS.reduce((s, a) => s + a.computadoras, 0);
    const mob = (typeof TPBV_AULAS_MOBILIARIO !== 'undefined') ? TPBV_AULAS_MOBILIARIO : {};
    const mobiliario = (mob.sillas && mob.mesas)
        ? `<b>${fmtInt(mob.sillas)}</b> sillas y <b>${fmtInt(mob.mesas)}</b> mesas para las aulas que no contaban con mobiliario suficiente.`
        : 'Mesas y sillas para las aulas que no contaban con mobiliario suficiente.';
    return `<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-gutter-grid">
        ${aulasTarjetaIncluye('computer', 'Equipo de cómputo', `<b>${fmtInt(computadoras)}</b> computadoras con conexión a internet y software educativo.`)}
        ${aulasTarjetaIncluye('chair', 'Mobiliario', mobiliario)}
        ${aulasTarjetaIncluye('wifi', 'Conectividad', 'Una tarjeta WiFi por equipo e internet dedicado para el aula.')}
        ${aulasTarjetaIncluye('school', 'Acompañamiento', 'Un promotor capacitado en cada escuela para el uso del aula.')}
    </div>`;
}

function aulasCitaHtml() {
    return `<figure class="bg-secondary-container/50 rounded-xl p-card-padding md:p-8 border border-outline-variant h-full flex flex-col justify-between gap-5">
        <span class="material-symbols-outlined text-[44px]" style="color:#BC9B73" aria-hidden="true">format_quote</span>
        <blockquote class="font-headline-lg text-on-surface" style="font-size:clamp(22px,2.4vw,30px);line-height:1.25">
            Acercar tecnología a las escuelas es abrir oportunidades reales para las niñas y los niños,
            especialmente en zonas donde el acceso ha sido limitado.
        </blockquote>
        <figcaption class="font-body-md text-body-md text-on-surface-variant">
            <b class="text-on-surface">Daniel Sotelo Salazar</b>, director de Agenda Digital de la ATDEM, durante una entrega en Jojutla.
            <a href="${AULAS_BOLETIN_URL}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 font-label-bold text-label-bold text-primary-container underline underline-offset-2 ml-1">Boletín 06206 <span class="material-symbols-outlined text-[16px]" aria-hidden="true">north_east</span></a>
        </figcaption>
    </figure>`;
}

// Orden de presentacion de niveles (educacion basica primero).
const AULAS_ORDEN_NIVEL = ['Primaria', 'Primaria indígena', 'Primaria comunitaria (CONAFE)', 'Telesecundaria', 'Secundaria general', 'Secundaria técnica', 'Media superior (EMSAD)'];

function aulasNivelesHtml() {
    const conteo = {};
    AULAS.forEach((a) => { conteo[a.nivel] = (conteo[a.nivel] || 0) + 1; });
    const niveles = Object.keys(conteo).sort((x, y) => {
        const ix = AULAS_ORDEN_NIVEL.indexOf(x), iy = AULAS_ORDEN_NIVEL.indexOf(y);
        return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
    });
    const max = Math.max(1, ...Object.values(conteo));
    const filas = niveles.map((n) => `
        <div class="flex items-center gap-3">
            <span class="w-40 shrink-0 font-body-md text-body-md text-on-surface truncate" title="${esc(n)}">${esc(n)}</span>
            <div class="flex-1 h-2.5 rounded-full bg-surface-container-high overflow-hidden">
                <div class="h-full rounded-full bg-secondary" style="width:${(conteo[n] / max * 100).toFixed(1)}%"></div>
            </div>
            <span class="w-6 shrink-0 text-right font-data-display text-data-display text-on-surface">${conteo[n]}</span>
        </div>`).join('');
    return card(`${cardHeader('school', 'Escuelas por nivel educativo')}<div class="space-y-3">${filas}</div>`, 'h-full');
}

function aulasContextoHtml() {
    const municipios = new Set(AULAS.map((a) => a.municipio)).size;
    const periodo = aulasPeriodoInstalacion();
    return `
    <div class="flex flex-col gap-4 max-w-5xl">
        <span class="font-label-bold text-label-bold uppercase tracking-wider text-secondary">Territorios de Paz y Buen Vivir · Educación digital</span>
        <h2 class="font-headline-xl text-headline-xl text-primary">Aulas Tecnológicas</h2>
        <p class="font-body-lg text-body-lg text-on-surface-variant">
            Para reducir la brecha digital desde edades tempranas, la Agencia de Transformación Digital del Estado de Morelos
            (ATDEM), en coordinación con la Secretaría de Educación y el Instituto de Educación Básica del Estado de Morelos
            (IEBEM), equipó aulas de cómputo en <b class="text-on-surface">${AULAS.length} escuelas</b> de
            <b class="text-on-surface">${municipios} municipios</b> ubicadas en los polígonos de Territorios de Paz y Buen Vivir.
        </p>
        <p class="font-body-lg text-body-lg text-on-surface-variant">
            Con computadoras conectadas a internet y software educativo, niñas, niños y jóvenes fortalecen sus procesos de
            aprendizaje, desarrollan habilidades digitales y amplían sus oportunidades en entornos con mayor infraestructura tecnológica.
        </p>
        <div class="flex flex-wrap gap-2 pt-1">
            ${['ATDEM', 'Secretaría de Educación', 'IEBEM'].map((d) => `<span class="px-3 py-1.5 rounded-full bg-surface-container-high font-label-bold text-label-bold text-on-surface">${d}</span>`).join('')}
            ${periodo ? `<span class="px-3 py-1.5 rounded-full bg-secondary-container font-label-bold text-label-bold text-on-surface inline-flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]" aria-hidden="true">event</span>Instalación: ${esc(periodo)}</span>` : ''}
        </div>
    </div>
    <div>
        <h3 class="font-headline-lg text-headline-lg text-on-surface mb-4" style="font-size:28px;line-height:34px">¿Qué incluye cada aula?</h3>
        ${aulasIncluyeHtml()}
    </div>
    <div class="grid grid-cols-1 xl:grid-cols-5 gap-gutter-grid">
        <div class="xl:col-span-3">${aulasCitaHtml()}</div>
        <div class="xl:col-span-2">${aulasNivelesHtml()}</div>
    </div>
    <h3 class="font-headline-lg text-headline-lg text-on-surface pt-2" style="font-size:28px;line-height:34px">¿Dónde están las aulas?</h3>`;
}
