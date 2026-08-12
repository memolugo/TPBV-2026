# Design Tokens — Dashboard TPBV 2026

Documenta el sistema de color/tipografía/espaciado que ya usa el dashboard
(`index.html` + `app.js`), organizado en las 3 capas estándar
(`primitivo → semántico → componente`). **No es una fuente de verdad nueva**:
los valores reales siguen viviendo en `tailwind.config` (dentro de
`index.html`) y en las variables CSS de `:root`. Este archivo existe para que
sea fácil ver qué significa cada token y dónde se usa antes de tocarlo.

## Capa 1 — Primitivos (valores crudos)

Paleta base tipo Material Design 3, ya reducida a los tonos que el dashboard
realmente usa (no se importó la paleta M3 completa).

| Familia | Tono | Hex |
|---|---|---|
| Verde institucional | 900 (más oscuro) | `#154212` |
| | 700 | `#2d5a27` |
| | 500 | `#3b6934` |
| | 300 (claro, para chips/fills) | `#a1d494` |
| | 200 | `#bcf0ae` |
| | 100 | `#9dd090` |
| Neutro / gris | on-surface | `#191c1d` |
| | on-surface-variant | `#42493e` |
| | secondary | `#575f67` |
| | outline | `#72796e` |
| | outline-variant | `#c2c9bb` |
| Superficie | surface (fondo global) | `#f8f9fa` |
| | surface-container-lowest (tarjetas) | `#ffffff` |
| | surface-container-low/···-highest | `#f3f4f5` → `#e1e3e4` |
| Estado | error | `#ba1a1a` |
| | error-container | `#ffdad6` |
| | warning | `#8a5a00` |
| Acento (fuera de la familia verde) | accent-blue | `#2a78d6` |
| | accent-teal | `#0f766e` |

## Capa 2 — Semántico (el "para qué")

Definidos en `tailwind.config.theme.extend.colors` (índex.html) salvo donde
se indica que son variables CSS sueltas.

| Token | Primitivo | Rol |
|---|---|---|
| `primary` | verde 900 | Marca, texto de énfasis, bordes de foco |
| `primary-container` | verde 700 | Fondos de botones primarios, chip activo |
| `on-primary-container` | verde 100 | Texto sobre `primary-container` |
| `primary-fixed-dim` | verde 300 | Barras de progreso "buenas" (TIC, discapacidad) |
| `secondary` / `on-surface-variant` | gris | Texto secundario, iconos neutros |
| `surface` → `surface-container-highest` | escala de grises clara | Fondo de página → superficies elevadas |
| `error` / `warning` | rojo / ámbar | Alertas de datos (piso de tierra, hacinamiento, analfabetismo) |
| `accent-blue` | `#2a78d6` | Identidad de "Vivienda y Servicios"; también `--series-m` (Hombres) en gráficas |
| `accent-teal` | `#0f766e` | Identidad de "Salud y Bienestar" |
| `--series-f` (CSS var, no Tailwind) | verde vívido `#1f7a34` | Serie "Mujeres" en gráficas (pirámide, barra Mujeres/Hombres) |
| `--series-m` (CSS var) | `#2a78d6` (= accent-blue) | Serie "Hombres" en gráficas |

> **Por qué `--series-f`/`--series-m` no son iguales a `primary`/`accent-blue` en
> todos los usos**: el verde institucional (`primary`, `#154212`) es demasiado
> oscuro/desaturado para pasar el piso de croma y luminosidad del validador de
> paletas categóricas (`skill dataviz`, ver `scripts/validate_palette.js`).
> Para gráficas de dos series (Mujeres/Hombres) se usa un verde de la misma
> familia más vívido en vez del `primary` de marca. Fuera de gráficas
> (botones, texto, bordes) sí se usa `primary` normal.

### Tipografía

| Token | Familia | Tamaño/peso | Uso |
|---|---|---|---|
| `headline-xl` | Lexend 800 | 38px | Título principal del dashboard |
| `headline-lg` / `headline-md` | Lexend 700/600 | 24px / 17px | Encabezados de tarjeta |
| `kpi-value` | Lexend 800 | 32px | Números grandes de la franja de KPI |
| `body-lg` / `body-md` | Inter 400 | 16px / 14px | Texto y valores de datos |
| `data-display` | Inter 700 | 20px | Valores numéricos dentro de las filas de datos |
| `label-bold` | Inter 600 | 12px, uppercase | Etiquetas de sección, badges |

### Espaciado y forma

| Token | Valor | Uso |
|---|---|---|
| `margin-page` | 2rem | Padding lateral de página |
| `gutter-grid` | 1.5rem | Separación entre tarjetas |
| `card-padding` | 1.25rem | Padding interno de tarjeta |
| `rounded-xl` / `rounded-lg` | 0.75rem / 0.5rem | Tarjetas / botones-inputs |

## Capa 3 — Componente (dónde se aplica)

Mapas definidos directamente en `app.js` (no en Tailwind config) que deciden
qué combinación semántica usa cada componente.

**`KPI_ACCENTS`** (franja de KPI arriba del dashboard) — cada tile tiene
borde superior + chip de ícono con un color de identidad:

| Accent key | Border | Chip bg | Chip text | Tile actual |
|---|---|---|---|---|
| `primary` | `primary` | `primary-container` | `on-primary-container` | Población Total |
| `blue` | `accent-blue` | `accent-blue/10` | `accent-blue` | Viviendas Totales |
| `teal` | `accent-teal` | `accent-teal/10` | `accent-teal` | Afiliación a Salud |
| dinámico vía `MARGINACION_ACCENT` | según grado | — | — | Grado de Marginación |

**`sectionLabel(title, icon, accentKey)`** (separadores "DEMOGRAFÍA",
"VIVIENDA Y SERVICIOS", etc.) — mismo mapa `KPI_ACCENTS`, reutilizado para
que la identidad de color sea consistente entre la franja de KPI y los
separadores de sección:

| Sección | Accent | Ícono |
|---|---|---|
| Demografía | `primary` | `groups` |
| Vivienda y Servicios | `blue` | `home_work` |
| Salud y Bienestar | `teal` | `health_and_safety` |
| Educación y Economía | `warning` | `school` |

## Reglas al modificar

1. Nunca usar hex crudo dentro de `app.js`/`index.html` fuera de esta tabla —
   si hace falta un color nuevo, se agrega primero aquí y a
   `tailwind.config.colors`, con su justificación.
2. Cualquier color nuevo que se use para **codificar una serie de datos**
   (no un solo valor aislado) debe validarse con
   `scripts/validate_palette.js` (skill `dataviz`) antes de usarse — ver la
   nota de `--series-f`/`--series-m` arriba.
3. Los estados de foco (`:focus-visible`) están centralizados en un solo
   selector en `index.html` (verde institucional, no el azul por defecto del
   navegador) — no sobreescribir por componente.
