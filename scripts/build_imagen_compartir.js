// Genera la imagen para compartir en redes (Open Graph, 1200x630) y los íconos
// del sitio a partir de los logos y tipografías del tablero.
//
//   dashboard/assets/compartir/tpbv-compartir.jpg   -> og:image / twitter:image
//   dashboard/assets/compartir/apple-touch-icon.png -> ícono en iPhone/Android (180x180)
//   dashboard/assets/compartir/favicon-64.png       -> se incrusta en el HTML (pestaña)
//
// La imagen se publica por GitHub Pages con URL absoluta: el proxy de
// tpbv.morelos.gob.mx no sirve archivos nuevos de assets/ (ver CLAUDE.md).
//
// Uso (playwright-core con Chrome; NODE_PATH si está instalado fuera del repo):
//   node scripts/build_imagen_compartir.js
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const DASH = path.join(__dirname, '..', 'dashboard');
const SALIDA = path.join(DASH, 'assets', 'compartir');

// Cifras del programa (Propuesta Actual) calculadas de los datos del tablero.
function cifras() {
    const vm = require('vm');
    const ctx = {};
    vm.createContext(ctx);
    const leer = (f) => vm.runInContext(fs.readFileSync(path.join(DASH, f), 'utf8').replace(/^const /mg, 'var '), ctx);
    leer('data.js');
    leer('aulas_tecnologicas.js');
    const d = ctx.TPBV_DATA;
    return {
        localidades: d.length,
        poligonos: new Set(d.map((r) => r.poligono)).size,
        municipios: new Set(d.map((r) => r.municipio)).size,
        aulas: ctx.TPBV_AULAS_TECNOLOGICAS.length,
    };
}

const uri = (archivo, tipo) => `data:${tipo};base64,${fs.readFileSync(path.join(DASH, archivo)).toString('base64')}`;
const fuente = (archivo) => uri(`assets/fonts/${archivo}`, 'font/woff2');

function htmlCompartir(c) {
    return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Karol;src:url(${fuente('KarolSans-Bold.woff2')});font-weight:700}
@font-face{font-family:Twogether;src:url(${fuente('TwogetherSans-Medium.woff2')});font-weight:500}
@font-face{font-family:Twogether;src:url(${fuente('TwogetherSans-Bold.woff2')});font-weight:700}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#F5F4F2;font-family:Twogether;color:#2E3B2B;position:relative;overflow:hidden}
.franja{position:absolute;left:0;right:0;bottom:0;height:14px;background:linear-gradient(90deg,#773357 0 34%,#BC9B73 34% 67%,#71785B 67%)}
.texto{position:absolute;left:72px;top:64px;width:700px}
.morelos{height:58px;display:block;margin-bottom:46px}
.kicker{font-weight:700;font-size:19px;letter-spacing:.06em;text-transform:uppercase;color:#71785B;margin-bottom:16px}
h1{font-family:Karol;font-weight:700;font-size:74px;line-height:1.02;letter-spacing:-.01em;margin-bottom:34px}
.cifras{display:flex;gap:34px}
.cifra b{display:block;font-family:Karol;font-size:44px;color:#773357;line-height:1}
.cifra span{font-size:19px;font-weight:500;color:#4A5039}
.url{position:absolute;left:72px;bottom:44px;font-weight:700;font-size:21px;color:#2E3B2B}
.circulo{position:absolute;right:70px;top:115px;width:380px;height:380px;border-radius:50%;background:#fff;border:1px solid #CBCABE;display:flex;align-items:center;justify-content:center}
.circulo img{width:300px;height:300px}
</style></head><body>
<div class="texto">
  <img class="morelos" src="${uri('assets/logo-morelos.svg', 'image/svg+xml')}" alt="">
  <div class="kicker">Gobierno de Morelos · La tierra que nos une</div>
  <h1>Territorios de Paz<br>y Buen Vivir</h1>
  <div class="cifras">
    <div class="cifra"><b>${c.localidades}</b><span>comunidades</span></div>
    <div class="cifra"><b>${c.poligonos}</b><span>polígonos</span></div>
    <div class="cifra"><b>${c.municipios}</b><span>municipios</span></div>
    <div class="cifra"><b>${c.aulas}</b><span>aulas tecnológicas</span></div>
  </div>
</div>
<div class="url">tpbv.morelos.gob.mx</div>
<div class="circulo"><img src="${uri('assets/logo-tpbv.svg', 'image/svg+xml')}" alt=""></div>
<div class="franja"></div>
</body></html>`;
}

// Isotipo TPBV: el logo (1920x1920) recortado a su símbolo superior, sin el
// texto. Recuadro medido sobre el logo: x 472-1448, y 208-1192 (+ margen).
const ISOTIPO_VIEWBOX = '370 110 1180 1180';

function isotipoUri() {
    const svg = fs.readFileSync(path.join(DASH, 'assets', 'logo-tpbv.svg'), 'utf8')
        .replace(/<svg([^>]*?)viewBox="[^"]*"/, `<svg$1viewBox="${ISOTIPO_VIEWBOX}"`);
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// Ícono: isotipo sobre fondo blanco (cuadrado para iOS, que redondea solo; círculo en la pestaña).
function htmlIcono(lado) {
    return `<!doctype html><html><head><style>
*{margin:0}body{width:${lado}px;height:${lado}px;background:transparent}
.c{width:${lado}px;height:${lado}px;border-radius:${lado === 180 ? 0 : '50%'};background:#fff;display:flex;align-items:center;justify-content:center}
.c img{width:${lado}px;height:${lado}px}
</style></head><body><div class="c"><img src="${isotipoUri()}"></div></body></html>`;
}

(async () => {
    fs.mkdirSync(SALIDA, { recursive: true });
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const c = cifras();

    const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await og.setContent(htmlCompartir(c), { waitUntil: 'load' });
    await og.evaluate(() => document.fonts.ready);
    await og.screenshot({ path: path.join(SALIDA, 'tpbv-compartir.jpg'), type: 'jpeg', quality: 88 });

    for (const [lado, nombre] of [[180, 'apple-touch-icon.png'], [64, 'favicon-64.png']]) {
        const p = await browser.newPage({ viewport: { width: lado, height: lado } });
        await p.setContent(htmlIcono(lado), { waitUntil: 'load' });
        await p.screenshot({ path: path.join(SALIDA, nombre), omitBackground: true });
    }
    await browser.close();
    console.log(`Imagenes en ${SALIDA} (cifras: ${JSON.stringify(c)})`);
})().catch((e) => { console.error('FALLO', e); process.exit(1); });
