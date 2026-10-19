// ---------------------------------------------------------------------------
// analisis_migas.js — ruta de navegación (breadcrumbs, Morelos DS) de
// Análisis Demográfico: Inicio › Análisis Demográfico › Polígono › Localidad.
// Cada nivel anterior es un enlace que regresa a esa vista. Va antes de app.js
// porque el primer render de Análisis ocurre al cargar app.js; las variables
// de app.js (selPoligono, customPoligonos…) solo se usan al hacer clic.
// ---------------------------------------------------------------------------

// Niveles de la ruta según lo que muestra Análisis. `ctx`:
//   { tipo: 'todos' } | { tipo: 'poligono', poligono } |
//   { tipo: 'custom', n } | { tipo: 'localidad', poligono, localidad }
function migasNiveles(ctx) {
    const niveles = [
        { texto: 'Inicio', accion: "showView('inicio')" },
        { texto: 'Análisis Demográfico', accion: 'migasIrATodos()' },
    ];
    if (ctx.tipo === 'poligono' || ctx.tipo === 'localidad') {
        niveles.push({ texto: poligonoLabel(ctx.poligono), accion: `migasIrAPoligono(${Number(ctx.poligono)})`, esDato: true });
    }
    if (ctx.tipo === 'custom') niveles.push({ texto: `Comparación de ${ctx.n} polígonos` });
    if (ctx.tipo === 'localidad') niveles.push({ texto: ctx.localidad, esDato: true });
    return niveles;
}

function migasAnalisisHtml(ctx) {
    const niveles = migasNiveles(ctx);
    const ultimo = niveles.length - 1;
    const items = niveles.map((nivel, i) => {
        const dato = nivel.esDato ? ' data-no-traducir' : '';
        const contenido = i === ultimo
            ? `<span aria-current="page" class="text-on-surface"${dato}>${esc(nivel.texto)}</span>`
            : `<a href="#" onclick="${nivel.accion}; return false;" class="migas-enlace"${dato}>${esc(nivel.texto)}</a>`;
        const separador = i < ultimo
            ? '<span class="material-symbols-outlined text-[18px] text-outline" aria-hidden="true">chevron_right</span>'
            : '';
        return `<li class="flex items-center gap-1.5">${contenido}${separador}</li>`;
    }).join('');
    return `<nav aria-label="Ruta de navegación" class="col-span-1 md:col-span-2 xl:col-span-12 -mb-2">
        <ol class="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-body-md text-body-md text-on-surface-variant">${items}</ol>
    </nav>`;
}

function migasIrATodos() {
    if (customPoligonos.size > 0) {
        clearCustomPoligonos();
        return;
    }
    migasIrAPoligono('all');
}

function migasIrAPoligono(poligono) {
    selPoligono.value = String(poligono);
    selPoligono.dispatchEvent(new Event('change'));
}
