// ---------------------------------------------------------------------------
// Funciones comunes a las páginas del tablero (TPBV_2026_COMPLETO_PRO.html y
// conectividad.html): formato, tarjetas, cifras (KPI) y animaciones de
// entrada. Se carga ANTES que cualquier otro bloque de código (mapa, carrusel,
// vistas y app.js).
// ---------------------------------------------------------------------------

const $ = (sel) => document.querySelector(sel);

function fmtInt(n) {
    if (n === null || n === undefined || n === '') return '—';
    return Math.round(n).toLocaleString('es-MX');
}

function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

function card(innerHtml, extraClasses = '') {
    return `<div class="bg-surface-container-lowest rounded-xl p-card-padding card-shadow ${extraClasses}">${innerHtml}</div>`;
}

// Acento por tile: cada metrica clave tiene una identidad de color propia
// (chip de icono). Los tokens accent-blue/accent-teal se definen en el config
// de Tailwind de cada página (ver dashboard/design-tokens.md).
const KPI_ACCENTS = {
    primary: { border: 'border-primary', chipBg: 'bg-primary-container', chipText: 'text-on-primary-container' },
    blue: { border: 'border-accent-blue', chipBg: 'bg-accent-blue/10', chipText: 'text-accent-blue' },
    teal: { border: 'border-accent-teal', chipBg: 'bg-accent-teal/10', chipText: 'text-accent-teal' },
    warning: { border: 'border-warning', chipBg: 'bg-warning/10', chipText: 'text-warning' },
    error: { border: 'border-error', chipBg: 'bg-error-container', chipText: 'text-error' },
    neutral: { border: 'border-outline-variant', chipBg: 'bg-surface-container-high', chipText: 'text-secondary' },
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

// Cifra destacada (Karol SemiBold) con su texto (Inicio, Aulas, Red).
function cifraDestacada(valor, texto) {
    return `<div><p class="font-kpi-value text-kpi-value text-primary-container leading-none">${valor}</p>
        <p class="font-body-md text-body-md text-on-surface-variant mt-1">${texto}</p></div>`;
}

// Enlace a la nota de Prensa de la que salen textos y fotos.
function enlaceNota(url) {
    return `<a href="${url}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 font-body-md text-body-md text-primary-container underline underline-offset-2 w-fit">
        Leer la nota completa <span class="material-symbols-outlined text-[18px]" aria-hidden="true">north_east</span></a>`;
}

// ---------------------------------------------------------------------------
// Anima el conteo de las tarjetas KPI y el relleno de las barras de progreso
// despues de cada (re)render del contenedor indicado (por omision #canvas,
// el lienzo de Analisis Demografico).
// ---------------------------------------------------------------------------
const REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function animateEntrances(container = document.getElementById('canvas')) {
    if (!container) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
        container.querySelectorAll('.progress-bar-fill').forEach((el) => el.classList.add('fill-in'));
    }));

    container.querySelectorAll('.kpi-value[data-target]').forEach((el) => {
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
